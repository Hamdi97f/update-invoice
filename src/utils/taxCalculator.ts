import { Tax, TaxCalculation } from '../types';

export const calculateTaxes = (
  totalHT: number,
  taxes: Tax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): { taxes: TaxCalculation[], totalTaxes: number } => {
  // Filter taxes applicable to this document type and active taxes
  const applicableTaxes = taxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
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