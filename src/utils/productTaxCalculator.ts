import { ProductTax, LigneDocument, TaxCalculationResult, Tax } from '../types';

export interface ProductTaxCalculationResult {
  productTaxes: ProductTax[];
  taxCalculations: TaxCalculationResult[];
  totalTaxes: number;
  totalTTC: number;
}

export interface InvoiceTaxSummary {
  taxGroups: { [key: string]: number }; // "TVA 19%" -> total amount
  fixedTaxes: { [key: string]: number }; // "FODEC" -> fixed amount (applied once)
  totalTaxes: number;
}

// Calculate taxes for a single product using cascade logic
export const calculateProductTaxes = (
  montantHT: number,
  productTaxes: ProductTax[],
  appliedFixedTaxes: Set<string> = new Set() // Track fixed taxes already applied at invoice level
): ProductTaxCalculationResult => {
  // Sort taxes by order for cascade calculation
  const sortedTaxes = [...productTaxes].sort((a, b) => a.order - b.order);
  
  const taxCalculations: TaxCalculationResult[] = [];
  let runningTotal = montantHT;
  let totalTaxes = 0;

  for (const tax of sortedTaxes) {
    let calculatedAmount = 0;
    let appliedOnce = false;
    
    if (tax.type === 'fixed') {
      // Fixed taxes are applied only once per invoice
      if (!appliedFixedTaxes.has(tax.name)) {
        calculatedAmount = tax.amount || 0;
        appliedFixedTaxes.add(tax.name);
        appliedOnce = true;
      }
      // For fixed taxes, don't add to running total as they're invoice-level
    } else {
      // Percentage tax
      let taxBase: number;
      
      if (tax.base === 'HT') {
        taxBase = montantHT;
      } else { // 'HT + previous taxes'
        taxBase = runningTotal;
      }
      
      calculatedAmount = (taxBase * (tax.rate || 0)) / 100;
      runningTotal += calculatedAmount;
    }
    
    taxCalculations.push({
      name: tax.name,
      type: tax.type,
      rate: tax.rate,
      amount: tax.amount,
      calculatedAmount,
      appliedOnce
    });
    
    totalTaxes += calculatedAmount;
  }

  return {
    productTaxes: sortedTaxes,
    taxCalculations,
    totalTaxes,
    totalTTC: montantHT + totalTaxes
  };
};

// Aggregate taxes from all product lines in an invoice
export const aggregateInvoiceTaxes = (
  lignes: LigneDocument[],
  allowedTaxSettings: Tax[] = []
): InvoiceTaxSummary => {
  const taxGroups: { [key: string]: number } = {};
  const fixedTaxes: { [key: string]: number } = {};
  const appliedFixedTaxes = new Set<string>();
  let totalTaxes = 0;

  // Create a map of allowed tax settings for quick lookup
  const allowedTaxMap = new Map<string, Tax>();
  allowedTaxSettings.forEach(tax => {
    const key = tax.type === 'percentage' 
      ? `${tax.nom}_percentage_${tax.valeur}`
      : `${tax.nom}_fixed_${tax.amount || tax.valeur}`;
    allowedTaxMap.set(key, tax);
  });

  for (const ligne of lignes) {
    if (ligne.taxCalculations) {
      for (const taxCalc of ligne.taxCalculations) {
        const taxKey = taxCalc.type === 'percentage'
          ? `${taxCalc.name}_percentage_${taxCalc.rate}`
          : `${taxCalc.name}_fixed_${taxCalc.amount}`;
        const isAllowed = allowedTaxMap.has(taxKey);
        
        if (taxCalc.type === 'fixed') {
          // Fixed taxes: apply only once per invoice and only if allowed in settings
          if (!appliedFixedTaxes.has(taxCalc.name) && taxCalc.appliedOnce) {
            if (isAllowed) {
              const displayKey = taxCalc.name;
              fixedTaxes[displayKey] = taxCalc.calculatedAmount;
            }
            appliedFixedTaxes.add(taxCalc.name);
            totalTaxes += taxCalc.calculatedAmount;
          }
        } else {
          // Percentage taxes: aggregate by name and rate, only if allowed in settings
          if (isAllowed) {
            const displayKey = `${taxCalc.name} ${taxCalc.rate}%`;
            if (taxGroups[displayKey]) {
              taxGroups[displayKey] += taxCalc.calculatedAmount;
            } else {
              taxGroups[displayKey] = taxCalc.calculatedAmount;
            }
          }
          totalTaxes += taxCalc.calculatedAmount;
        }
      }
    }
  }

  return {
    taxGroups,
    fixedTaxes,
    totalTaxes
  };
};

// Get default tax configuration for a product based on global settings
export const getDefaultProductTaxes = (
  globalTaxes: Tax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur',
  productTaxRate: number = 19 // Default product tax rate
): ProductTax[] => {
  // Filter applicable taxes for this document type
  const applicableTaxes = globalTaxes
    .filter(tax => tax.actif && tax.applicableDocuments.includes(documentType))
    .sort((a, b) => a.ordre - b.ordre);

  return applicableTaxes.map(globalTax => ({
    id: globalTax.id,
    name: globalTax.nom,
    type: globalTax.type,
    rate: globalTax.type === 'percentage' ? 
      (globalTax.nom.toLowerCase().includes('tva') ? productTaxRate : globalTax.valeur) : undefined,
    amount: globalTax.type === 'fixed' ? (globalTax.amount || globalTax.valeur) : undefined,
    base: globalTax.calculationBase === 'totalHT' ? 'HT' : 'HT + previous taxes',
    order: globalTax.ordre
  }));
};

// Format tax groups for display in invoice totals
export const formatTaxSummaryForDisplay = (
  taxGroups: { [key: string]: number },
  fixedTaxes: { [key: string]: number }
): any[] => {
  const result: any[] = [];
  
  // Add percentage taxes
  Object.entries(taxGroups).forEach(([taxKey, amount]) => {
    result.push({
      nom: taxKey,
      montant: amount,
      type: 'percentage'
    });
  });
  
  // Add fixed taxes
  Object.entries(fixedTaxes).forEach(([taxKey, amount]) => {
    result.push({
      nom: taxKey,
      montant: amount,
      type: 'fixed'
    });
  });
  
  return result;
};

// Calculate total TTC from product lines (sum of individual product TTC values)
export const calculateInvoiceTotalTTC = (lignes: LigneDocument[]): number => {
  return lignes.reduce((sum, ligne) => sum + ligne.montantTTC, 0);
};

// Calculate total HT from product lines
export const calculateInvoiceTotalHT = (lignes: LigneDocument[]): number => {
  return lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
};