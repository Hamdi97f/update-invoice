import { Tax, TaxCalculation } from '../types';

export const calculateTaxes = (
  totalHT: number,
  taxes: Tax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur',
  lignes?: any[] // Add lignes parameter to access product TVA rates
): { taxes: TaxCalculation[], totalTaxes: number } => {
  // Filter taxes applicable to this document type and active taxes
  const applicableTaxes = taxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .sort((a, b) => a.ordre - b.ordre);

  const taxCalculations: TaxCalculation[] = [];
  let runningTotal = totalHT;
  let totalTaxes = 0;

  // Step 1: Calculate product TVA rates (group by rate)
  const productTVAGroups = new Map<number, { base: number, rate: number }>();
  
  if (lignes && lignes.length > 0) {
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

  // Step 3: Add product TVA calculations for rates NOT covered by configured taxes
  productTVAGroups.forEach((group, rate) => {
    if (!configuredTVARates.has(rate)) {
      const montant = (group.base * rate) / 100;
      
      taxCalculations.push({
        taxId: `product-tva-${rate}`,
        nom: `TVA (${rate}%)`,
        base: group.base,
        montant
      });
      
      runningTotal += montant;
      totalTaxes += montant;
    }
  });

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
        // For TVA taxes, only apply to products with matching rate
        if (tax.nom.toLowerCase().includes('tva')) {
          const matchingGroup = productTVAGroups.get(tax.valeur);
          if (matchingGroup) {
            base = matchingGroup.base;
            montant = (base * tax.valeur) / 100;
          } else {
            // No products with this TVA rate, skip this tax
            continue;
          }
        } else {
          // Non-TVA tax, apply to total HT
          base = totalHT;
          montant = (base * tax.valeur) / 100;
        }
      } else {
        // totalHTWithPreviousTaxes
        if (tax.nom.toLowerCase().includes('tva')) {
          const matchingGroup = productTVAGroups.get(tax.valeur);
          if (matchingGroup) {
            base = matchingGroup.base;
            montant = (base * tax.valeur) / 100;
          } else {
            // No products with this TVA rate, skip this tax
            continue;
          }
        } else {
          // Non-TVA tax, apply to running total
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