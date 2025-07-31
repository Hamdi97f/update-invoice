import { Tax, TaxCalculation } from '../types';

// Load auto TVA settings
const getAutoTvaSettings = async (isElectron: boolean, query?: any) => {
  const defaultSettings = {
    enabled: false,
    calculationBase: 'totalHT' as 'totalHT' | 'totalHTWithPreviousTaxes'
  };

  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['autoTvaSettings']);
      if (result.length > 0) {
        return { ...defaultSettings, ...JSON.parse(result[0].value) };
      }
    } else {
      const savedSettings = localStorage.getItem('autoTvaSettings');
      if (savedSettings) {
        return { ...defaultSettings, ...JSON.parse(savedSettings) };
      }
    }
  } catch (error) {
    console.error('Error loading auto TVA settings:', error);
  }

  return defaultSettings;
};

export const calculateTaxes = async (
  totalHT: number,
  taxes: Tax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur',
  lignes?: any[] // Add lignes parameter to access product TVA rates
): Promise<{ taxes: TaxCalculation[], totalTaxes: number }> => {
  // Get auto TVA settings
  const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
  const query = isElectron ? window.electronAPI.dbQuery : undefined;
  const autoTvaSettings = await getAutoTvaSettings(isElectron, query);

  // Filter taxes applicable to this document type and active taxes
  const applicableTaxes = taxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .sort((a, b) => a.ordre - b.ordre);

  const taxCalculations: TaxCalculation[] = [];
  let runningTotal = totalHT;
  let totalTaxes = 0;

  // Step 1: Calculate product TVA rates (group by rate) if Auto TVA is enabled
  const productTVAGroups = new Map<number, { base: number, rate: number }>();
  
  if (autoTvaSettings.enabled && lignes && lignes.length > 0) {
    lignes.forEach(ligne => {
      const tvaRate = ligne.produit?.tva || 0;
      if (tvaRate > 0) {
        const montantHT = ligne.montantHT || (ligne.quantite * ligne.prixUnitaire * (1 - (ligne.remise || 0) / 100));
        
        if (productTVAGroups.has(tvaRate)) {
          const existing = productTVAGroups.get(tvaRate)!;
          existing.base += montantHT;
        } else {
          productTVAGroups.set(tvaRate, { base: montantHT, rate: tvaRate });
        }
      }
    });
  }

  // Step 2: Check which TVA rates are covered by configured taxes
  const configuredTVARates = new Set<number>();
  applicableTaxes.forEach(tax => {
    if (tax.type === 'percentage' && tax.nom.toLowerCase().includes('tva')) {
      configuredTVARates.add(tax.valeur);
    }
  });

  // Step 3: Add product TVA calculations for rates NOT covered by configured taxes (Auto TVA)
  if (autoTvaSettings.enabled) {
    productTVAGroups.forEach((group, rate) => {
      if (!configuredTVARates.has(rate)) {
        let base = group.base;
        
        // Apply calculation base setting for Auto TVA
        if (autoTvaSettings.calculationBase === 'totalHTWithPreviousTaxes') {
          // For Auto TVA with previous taxes, we still use the product HT base
          // but we could adjust this logic if needed
          base = group.base;
        }
        
        const montant = (base * rate) / 100;
        
        taxCalculations.push({
          taxId: `auto-tva-${rate}`,
          nom: `TVA (${rate}%)`,
          base,
          montant
        });
        
        runningTotal += montant;
        totalTaxes += montant;
      }
    });
  }

  // Step 4: Apply configured taxes
  for (const tax of applicableTaxes) {
    let base: number;
    let montant: number;

    if (tax.type === 'fixed') {
      // Fixed amount tax
      base = 0; // Not applicable for fixed taxes
      montant = tax.valeur;
    } else {
      // Percentage tax
      if (tax.calculationBase === 'totalHT') {
        // For TVA taxes, only apply to products with matching rate if Auto TVA is enabled
        if (autoTvaSettings.enabled && tax.nom.toLowerCase().includes('tva')) {
          const matchingGroup = productTVAGroups.get(tax.valeur);
          if (matchingGroup) {
            base = matchingGroup.base;
            montant = (base * tax.valeur) / 100;
          } else {
            // No products with this TVA rate, skip this tax
            continue;
          }
        } else {
          // Non-TVA tax or Auto TVA disabled, apply to total HT
          base = totalHT;
          montant = (base * tax.valeur) / 100;
        }
      } else {
        // totalHTWithPreviousTaxes
        if (autoTvaSettings.enabled && tax.nom.toLowerCase().includes('tva')) {
          const matchingGroup = productTVAGroups.get(tax.valeur);
          if (matchingGroup) {
            base = matchingGroup.base;
            montant = (base * tax.valeur) / 100;
          } else {
            // No products with this TVA rate, skip this tax
            continue;
          }
        } else {
          // Non-TVA tax or Auto TVA disabled, apply to running total
          base = runningTotal;
          montant = (base * tax.valeur) / 100;
        }
      }
    }

    taxCalculations.push({
      taxId: tax.id,
      nom: tax.nom,
      base,
      montant
    });

    runningTotal += montant;
    totalTaxes += montant;
  }

  return {
    taxes: taxCalculations,
    totalTaxes
  };
};

export const formatTaxDisplay = (tax: Tax): string => {
  if (tax.type === 'fixed') {
    return `${tax.valeur.toFixed(3)} TND`;
  } else {
    return `${tax.valeur}%`;
  }
};

export const getTaxCalculationSummary = (
  totalHT: number,
  totalTVA: number,
  taxCalculations: TaxCalculation[]
): string => {
  let summary = `Total HT: ${totalHT.toFixed(3)} TND\n`;
  
  if (taxCalculations.length > 0) {
    summary += '\nTaxes:\n';
    taxCalculations.forEach(calc => {
      if (calc.base > 0) {
        summary += `${calc.nom}: ${calc.montant.toFixed(3)} TND (${calc.base.toFixed(3)} TND de base)\n`;
      } else {
        summary += `${calc.nom}: ${calc.montant.toFixed(3)} TND (montant fixe)\n`;
      }
    });
  }

  const totalTaxes = taxCalculations.reduce((sum, calc) => sum + calc.montant, 0);
  const totalTTC = totalHT + totalTaxes;
  
  summary += `\nTotal TTC: ${totalTTC.toFixed(3)} TND`;
  
  return summary;
};