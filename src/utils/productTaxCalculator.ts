import { ProductTax, LigneDocument } from '../types';

export interface ProductTaxResult {
  taxes: ProductTax[];
  taxBreakdown: { [key: string]: number };
  totalTaxes: number;
  totalTTC: number;
}

// Calculate taxes for a single product line
export const calculateProductTaxes = (
  montantHT: number,
  productTaxRate: number, // The product's own tax rate (e.g., 19, 7, 0)
  globalTaxes: any[], // Global tax configuration
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): ProductTaxResult => {
  // Filter applicable taxes for this document type
  const applicableTaxes = globalTaxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .sort((a, b) => a.ordre - b.ordre);

  const productTaxes: ProductTax[] = [];
  const taxBreakdown: { [key: string]: number } = {};
  let runningTotal = montantHT;
  let totalTaxes = 0;

  for (const globalTax of applicableTaxes) {
    let taxAmount = 0;
    let base = 0;

    if (globalTax.type === 'fixed') {
      // Fixed amount tax (like stamp duty)
      taxAmount = globalTax.valeur;
      base = 0; // Not applicable for fixed taxes
    } else {
      // Percentage tax
      if (globalTax.calculationBase === 'totalHT') {
        base = montantHT;
      } else {
        // totalHTWithPreviousTaxes
        base = runningTotal;
      }

      // Use the product's specific tax rate if this is a TVA-type tax
      // Otherwise use the global tax rate
      let effectiveRate = globalTax.valeur;
      
      // If this is a TVA tax and the product has a specific rate, use it
      if (globalTax.nom.toLowerCase().includes('tva') || globalTax.nom.toLowerCase().includes('vat')) {
        effectiveRate = productTaxRate;
      }

      taxAmount = (base * effectiveRate) / 100;
    }

    if (taxAmount > 0) {
      const productTax: ProductTax = {
        id: globalTax.id,
        nom: globalTax.nom,
        type: globalTax.type,
        valeur: globalTax.type === 'fixed' ? globalTax.valeur : 
                (globalTax.nom.toLowerCase().includes('tva') ? productTaxRate : globalTax.valeur),
        calculationBase: globalTax.calculationBase,
        ordre: globalTax.ordre
      };

      productTaxes.push(productTax);
      
      // Create a unique key for tax breakdown (name + rate for percentage taxes)
      const taxKey = globalTax.type === 'fixed' 
        ? globalTax.nom 
        : `${globalTax.nom} ${productTax.valeur}%`;
      
      taxBreakdown[taxKey] = taxAmount;
      runningTotal += taxAmount;
      totalTaxes += taxAmount;
    }
  }

  return {
    taxes: productTaxes,
    taxBreakdown,
    totalTaxes,
    totalTTC: montantHT + totalTaxes
  };
};

// Aggregate tax calculations from multiple product lines
export const aggregateInvoiceTaxes = (lignes: LigneDocument[]): { 
  aggregatedTaxes: { [key: string]: number },
  totalTaxes: number 
} => {
  const aggregatedTaxes: { [key: string]: number } = {};
  let totalTaxes = 0;

  for (const ligne of lignes) {
    if (ligne.taxBreakdown) {
      for (const [taxKey, amount] of Object.entries(ligne.taxBreakdown)) {
        if (aggregatedTaxes[taxKey]) {
          aggregatedTaxes[taxKey] += amount;
        } else {
          aggregatedTaxes[taxKey] = amount;
        }
        totalTaxes += amount;
      }
    }
  }

  return { aggregatedTaxes, totalTaxes };
};

// Convert aggregated taxes to TaxCalculation format for display
export const formatAggregatedTaxes = (aggregatedTaxes: { [key: string]: number }): any[] => {
  return Object.entries(aggregatedTaxes).map(([taxKey, amount]) => {
    // Parse tax name and rate from key
    const parts = taxKey.split(' ');
    const rate = parts[parts.length - 1];
    const name = parts.slice(0, -1).join(' ');
    
    return {
      nom: taxKey,
      montant: amount,
      rate: rate.includes('%') ? parseFloat(rate.replace('%', '')) : undefined
    };
  });
};