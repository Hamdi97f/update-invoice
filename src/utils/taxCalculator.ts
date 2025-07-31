import { Tax, TaxCalculation, TaxGroup, Produit, LigneDocument } from '../types';

// Calculate taxes from product lines (TVA from individual products)
export const calculateProductTaxes = (lignes: LigneDocument[]): number => {
  return lignes.reduce((total, ligne) => {
    return total + (ligne.montantTTC - ligne.montantHT);
  }, 0);
};

// Calculate taxes from tax groups applied to products
export const calculateTaxesFromGroups = (
  lignes: LigneDocument[],
  taxGroups: TaxGroup[],
  query?: (sql: string, params?: any[]) => Promise<any>
): { totalProductTaxes: number, taxDetails: TaxCalculation[] } => {
  let totalProductTaxes = 0;
  const taxDetails: TaxCalculation[] = [];
  
  // Group lines by tax group
  const linesByTaxGroup = new Map<string, LigneDocument[]>();
  
  lignes.forEach(ligne => {
    const produit = ligne.produit as any;
    const taxGroupId = produit.taxGroupId;
    
    if (taxGroupId) {
      if (!linesByTaxGroup.has(taxGroupId)) {
        linesByTaxGroup.set(taxGroupId, []);
      }
      linesByTaxGroup.get(taxGroupId)!.push(ligne);
    }
  });
  
  // Calculate taxes for each group
  linesByTaxGroup.forEach((groupLines, taxGroupId) => {
    const taxGroup = taxGroups.find(g => g.id === taxGroupId);
    if (!taxGroup || !taxGroup.actif) return;
    
    // Calculate base amount for this group (sum of HT amounts)
    const groupTotalHT = groupLines.reduce((sum, ligne) => sum + ligne.montantHT, 0);
    
    // Apply taxes in the group in order
    let runningTotal = groupTotalHT;
    
    taxGroup.taxes.forEach(groupTax => {
      if (!groupTax.tax.actif) return;
      
      let base: number;
      let montant: number;
      
      if (groupTax.tax.type === 'fixed') {
        base = 0;
        montant = groupTax.tax.valeur;
      } else {
        // Use the calculation base defined in the group, or fall back to the tax's default
        const calculationBase = groupTax.calculationBaseInGroup || groupTax.tax.calculationBase;
        
        if (calculationBase === 'totalHT') {
          base = groupTotalHT;
        } else {
          base = runningTotal;
        }
        montant = (base * groupTax.tax.valeur) / 100;
      }
      
      // Add to tax details
      const existingTaxIndex = taxDetails.findIndex(td => td.nom === groupTax.tax.nom);
      if (existingTaxIndex >= 0) {
        // Aggregate if same tax name exists
        taxDetails[existingTaxIndex].montant += montant;
        taxDetails[existingTaxIndex].base += base;
      } else {
        taxDetails.push({
          taxId: groupTax.tax.id,
          nom: groupTax.tax.nom,
          base,
          montant
        });
      }
      
      runningTotal += montant;
      totalProductTaxes += montant;
    });
  });
  
  return { totalProductTaxes, taxDetails };
};

export const calculateTaxes = (
  totalHT: number,
  taxes: Tax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): { taxes: TaxCalculation[], totalTaxes: number } => {
  // Filter taxes applicable to this document type, active taxes, and standard taxes only
  const applicableTaxes = taxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .filter(tax => tax.isStandard) // Only include standard taxes (auto-applied)
    .sort((a, b) => a.ordre - b.ordre);

  const taxCalculations: TaxCalculation[] = [];
  let runningTotal = totalHT;
  let totalTaxes = 0;

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
        base = totalHT;
      } else {
        // totalHTWithPreviousTaxes
        base = runningTotal;
      }
      montant = (base * tax.valeur) / 100;
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
  
  if (totalTVA > 0) {
    summary += `TVA sur produits: ${totalTVA.toFixed(3)} TND\n`;
  }
  
  if (taxCalculations.length > 0) {
    summary += '\nTaxes additionnelles:\n';
    taxCalculations.forEach(calc => {
      if (calc.base > 0) {
        summary += `${calc.nom}: ${calc.montant.toFixed(3)} TND (${calc.base.toFixed(3)} TND de base)\n`;
      } else {
        summary += `${calc.nom}: ${calc.montant.toFixed(3)} TND (montant fixe)\n`;
      }
    });
  }

  const totalAdditionalTaxes = taxCalculations.reduce((sum, calc) => sum + calc.montant, 0);
  const totalTTC = totalHT + totalTVA + totalAdditionalTaxes;
  
  summary += `\nTotal TTC: ${totalTTC.toFixed(3)} TND`;
  
  return summary;
};