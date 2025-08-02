import { ProductTax, LigneDocument, AppliedTax, InvoiceTaxSummary } from '../types';

export interface ProductTaxResult {
  appliedTaxes: AppliedTax[];
  taxBreakdown: { [key: string]: number };
  totalPercentageTaxes: number;
  totalTTC: number;
}

// Calculate taxes for a single product line using cascade logic
export const calculateProductTaxes = (
  montantHT: number,
  productTaxes: ProductTax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): ProductTaxResult => {
  // Filter only percentage taxes for product-level calculation
  const percentageTaxes = productTaxes
    .filter(tax => tax.type === 'percentage')
    .sort((a, b) => a.ordre - b.ordre);

  const appliedTaxes: AppliedTax[] = [];
  const taxBreakdown: { [key: string]: number } = {};
  let runningTotal = montantHT;
  let totalPercentageTaxes = 0;

  for (const tax of percentageTaxes) {
    let baseAmount: number;
    
    if (tax.base === 'HT') {
      baseAmount = montantHT;
    } else {
      // HT_plus_previous
      baseAmount = runningTotal;
    }

    const taxAmount = (baseAmount * tax.rate) / 100;

    const appliedTax: AppliedTax = {
      name: tax.nom,
      rate: tax.rate,
      base: tax.base,
      order: tax.ordre,
      type: tax.type,
      baseAmount,
      taxAmount
    };

    appliedTaxes.push(appliedTax);
    
    // Create unique key for tax breakdown (name + rate)
    const taxKey = `${tax.nom} ${tax.rate}%`;
    taxBreakdown[taxKey] = taxAmount;
    
    runningTotal += taxAmount;
    totalPercentageTaxes += taxAmount;
  }

  return {
    appliedTaxes,
    taxBreakdown,
    totalPercentageTaxes,
    totalTTC: montantHT + totalPercentageTaxes
  };
};

// Aggregate taxes from multiple product lines and calculate fixed taxes
export const aggregateInvoiceTaxes = (
  lignes: LigneDocument[],
  fixedTaxes: ProductTax[],
  totalHT: number
): InvoiceTaxSummary => {
  const percentageTaxes: { [key: string]: number } = {};
  const fixedTaxesCalculated: { [key: string]: number } = {};
  let totalPercentageTaxes = 0;
  let totalFixedTaxes = 0;

  // Aggregate percentage taxes from all product lines
  for (const ligne of lignes) {
    if (ligne.taxBreakdown) {
      for (const [taxKey, amount] of Object.entries(ligne.taxBreakdown)) {
        if (percentageTaxes[taxKey]) {
          percentageTaxes[taxKey] += amount;
        } else {
          percentageTaxes[taxKey] = amount;
        }
        totalPercentageTaxes += amount;
      }
    }
  }

  // Calculate fixed taxes at invoice level
  const sortedFixedTaxes = fixedTaxes
    .filter(tax => tax.type === 'fixed')
    .sort((a, b) => a.ordre - b.ordre);

  let runningInvoiceTotal = totalHT + totalPercentageTaxes;

  for (const tax of sortedFixedTaxes) {
    let taxAmount: number;
    
    if (tax.base === 'HT') {
      taxAmount = (totalHT * tax.rate) / 100;
    } else {
      // HT_plus_previous - use running total
      taxAmount = (runningInvoiceTotal * tax.rate) / 100;
    }

    fixedTaxesCalculated[tax.nom] = taxAmount;
    runningInvoiceTotal += taxAmount;
    totalFixedTaxes += taxAmount;
  }

  return {
    percentageTaxes,
    fixedTaxes: fixedTaxesCalculated,
    totalPercentageTaxes,
    totalFixedTaxes,
    totalAllTaxes: totalPercentageTaxes + totalFixedTaxes
  };
};

// Convert tax configuration to product taxes
export const convertGlobalTaxesToProductTaxes = (
  globalTaxes: any[],
  productTaxRate: number,
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): ProductTax[] => {
  return globalTaxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .map(tax => ({
      id: tax.id,
      nom: tax.nom,
      rate: tax.nom.toLowerCase().includes('tva') ? productTaxRate : tax.valeur,
      base: tax.calculationBase === 'totalHT' ? 'HT' as const : 'HT_plus_previous' as const,
      ordre: tax.ordre,
      type: tax.type
    }));
};

// Format aggregated taxes for display
export const formatAggregatedTaxes = (summary: InvoiceTaxSummary): any[] => {
  const formattedTaxes: any[] = [];

  // Add percentage taxes
  Object.entries(summary.percentageTaxes).forEach(([taxKey, amount]) => {
    formattedTaxes.push({
      nom: taxKey,
      montant: amount,
      type: 'percentage'
    });
  });

  // Add fixed taxes
  Object.entries(summary.fixedTaxes).forEach(([taxName, amount]) => {
    formattedTaxes.push({
      nom: taxName,
      montant: amount,
      type: 'fixed'
    });
  });

  return formattedTaxes;
};

// Legacy function for backward compatibility - now uses new system