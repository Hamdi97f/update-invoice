import { ProductTax, LigneDocument } from '../types';

export interface ProductTaxCalculationResult {
  productTaxes: ProductTax[];
  taxCalculations: { [key: string]: number }; // Tax name+rate -> amount
  totalTaxes: number;
  totalTTC: number;
}

export interface InvoiceTaxSummary {
  taxGroups: { [key: string]: number }; // "TVA 19%" -> total amount
  totalTaxes: number;
}

// Calculate taxes for a single product using cascade logic
export const calculateProductTaxes = (
  montantHT: number,
  productTaxes: ProductTax[]
): ProductTaxCalculationResult => {
  // Sort taxes by order for cascade calculation
  const sortedTaxes = [...productTaxes].sort((a, b) => a.order - b.order);
  
  const taxCalculations: { [key: string]: number } = {};
  let runningTotal = montantHT;
  let totalTaxes = 0;

  for (const tax of sortedTaxes) {
    let taxBase: number;
    
    if (tax.base === 'HT') {
      taxBase = montantHT;
    } else { // 'HT_PLUS_PREVIOUS'
      taxBase = runningTotal;
    }
    
    const taxAmount = (taxBase * tax.rate) / 100;
    const taxKey = `${tax.nom} ${tax.rate}%`;
    
    taxCalculations[taxKey] = taxAmount;
    runningTotal += taxAmount;
    totalTaxes += taxAmount;
  }

  return {
    productTaxes: sortedTaxes,
    taxCalculations,
    totalTaxes,
    totalTTC: montantHT + totalTaxes
  };
};

// Aggregate taxes from all product lines in an invoice
export const aggregateInvoiceTaxes = (lignes: LigneDocument[]): InvoiceTaxSummary => {
  const taxGroups: { [key: string]: number } = {};
  let totalTaxes = 0;

  for (const ligne of lignes) {
    if (ligne.taxCalculations) {
      for (const [taxKey, amount] of Object.entries(ligne.taxCalculations)) {
        if (taxGroups[taxKey]) {
          taxGroups[taxKey] += amount;
        } else {
          taxGroups[taxKey] = amount;
        }
        totalTaxes += amount;
      }
    }
  }

  return {
    taxGroups,
    totalTaxes
  };
};

// Get default tax configuration for a product based on global settings
export const getDefaultProductTaxes = (
  globalTaxes: any[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur',
  productTaxRate: number = 19 // Default product tax rate
): ProductTax[] => {
  // Filter applicable taxes for this document type
  const applicableTaxes = globalTaxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .sort((a, b) => a.ordre - b.ordre);

  return applicableTaxes.map(globalTax => ({
    id: globalTax.id,
    nom: globalTax.nom,
    rate: globalTax.nom.toLowerCase().includes('tva') ? productTaxRate : globalTax.valeur,
    base: globalTax.calculationBase === 'totalHT' ? 'HT' : 'HT_PLUS_PREVIOUS',
    order: globalTax.ordre
  }));
};

// Format tax groups for display
export const formatTaxGroupsForDisplay = (taxGroups: { [key: string]: number }): any[] => {
  return Object.entries(taxGroups).map(([taxKey, amount]) => ({
    nom: taxKey,
    montant: amount
  }));
};