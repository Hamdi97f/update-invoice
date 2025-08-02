import { ProductTax, LigneDocument, ProductTaxResult, FixedTaxResult, Tax } from '../types';

export interface ProductTaxCalculationResult {
  productTaxResults: ProductTaxResult[];
  totalProductTaxes: number;
  productTTC: number;
}

export interface InvoiceTaxCalculationResult {
  percentageTaxGroups: { [key: string]: number }; // "TVA 19%" -> total amount
  fixedTaxes: FixedTaxResult[];
  totalPercentageTaxes: number;
  totalFixedTaxes: number;
  totalAllTaxes: number;
  invoiceTotalTTC: number;
}

// Calculate taxes for a single product using cascade logic
export const calculateProductTaxes = (
  montantHT: number,
  productTaxes: ProductTax[]
): ProductTaxCalculationResult => {
  // Sort taxes by order for cascade calculation
  const sortedTaxes = [...productTaxes]
    .filter(tax => tax.type === 'percentage') // Only percentage taxes at product level
    .sort((a, b) => a.order - b.order);
  
  const productTaxResults: ProductTaxResult[] = [];
  let runningTotal = montantHT;
  let totalProductTaxes = 0;

  for (const tax of sortedTaxes) {
    let taxBase: number;
    
    if (tax.base === 'HT') {
      taxBase = montantHT;
    } else { // 'HT + previous taxes'
      taxBase = runningTotal;
    }
    
    const calculatedAmount = (taxBase * tax.rate) / 100;
    
    productTaxResults.push({
      name: tax.name,
      type: 'percentage',
      rate: tax.rate,
      calculatedAmount,
      base: taxBase
    });
    
    runningTotal += calculatedAmount;
    totalProductTaxes += calculatedAmount;
  }

  return {
    productTaxResults,
    totalProductTaxes,
    productTTC: montantHT + totalProductTaxes
  };
};

// Calculate fixed taxes at invoice level
export const calculateInvoiceFixedTaxes = (
  totalHT: number,
  totalTTC: number,
  enabledFixedTaxes: Tax[]
): FixedTaxResult[] => {
  const fixedTaxResults: FixedTaxResult[] = [];
  
  for (const tax of enabledFixedTaxes.filter(t => t.type === 'fixed' && t.actif)) {
    let base: number;
    let amount: number;
    
    if (tax.calculationBase === 'totalHT') {
      base = totalHT;
      amount = tax.amount || tax.valeur;
    } else {
      // Calculate on total TTC (HT + percentage taxes)
      base = totalTTC;
      amount = tax.amount || tax.valeur;
    }
    
    fixedTaxResults.push({
      name: tax.nom,
      amount,
      base,
      type: 'fixed'
    });
  }
  
  return fixedTaxResults;
};

// Aggregate all taxes from invoice lines and calculate totals
export const calculateInvoiceTaxes = (
  lignes: LigneDocument[],
  enabledTaxSettings: Tax[]
): InvoiceTaxCalculationResult => {
  const percentageTaxGroups: { [key: string]: number } = {};
  let totalPercentageTaxes = 0;
  
  // Create a map of enabled tax settings for filtering
  const enabledTaxMap = new Map<string, Tax>();
  enabledTaxSettings
    .filter(tax => tax.actif && tax.type === 'percentage')
    .forEach(tax => {
      const key = `${tax.nom}_${tax.valeur}`;
      enabledTaxMap.set(key, tax);
    });
  
  // Aggregate percentage taxes from all product lines
  for (const ligne of lignes) {
    if (ligne.productTaxResults) {
      for (const taxResult of ligne.productTaxResults) {
        if (taxResult.type === 'percentage') {
          const taxKey = `${taxResult.name}_${taxResult.rate}`;
          
          // Only include if this tax is enabled in settings
          if (enabledTaxMap.has(taxKey)) {
            const displayKey = `${taxResult.name} ${taxResult.rate}%`;
            
            if (percentageTaxGroups[displayKey]) {
              percentageTaxGroups[displayKey] += taxResult.calculatedAmount;
            } else {
              percentageTaxGroups[displayKey] = taxResult.calculatedAmount;
            }
            
            totalPercentageTaxes += taxResult.calculatedAmount;
          }
        }
      }
    }
  }
  
  // Calculate totals for fixed tax calculation
  const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
  const totalTTCFromProducts = lignes.reduce((sum, ligne) => sum + ligne.montantTTC, 0);
  
  // Calculate fixed taxes at invoice level
  const fixedTaxes = calculateInvoiceFixedTaxes(
    totalHT,
    totalTTCFromProducts,
    enabledTaxSettings
  );
  
  const totalFixedTaxes = fixedTaxes.reduce((sum, tax) => sum + tax.amount, 0);
  const totalAllTaxes = totalPercentageTaxes + totalFixedTaxes;
  const invoiceTotalTTC = totalHT + totalAllTaxes;
  
  return {
    percentageTaxGroups,
    fixedTaxes,
    totalPercentageTaxes,
    totalFixedTaxes,
    totalAllTaxes,
    invoiceTotalTTC
  };
};

// Get default product taxes based on global settings
export const getDefaultProductTaxes = (
  globalTaxes: Tax[],
  documentType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur',
  productTaxRate: number = 19
): ProductTax[] => {
  // Filter applicable percentage taxes for this document type
  const applicableTaxes = globalTaxes
    .filter(tax => 
      tax.actif && 
      tax.type === 'percentage' && 
      tax.applicableDocuments.includes(documentType)
    )
    .sort((a, b) => a.ordre - b.ordre);

  return applicableTaxes.map(globalTax => ({
    id: globalTax.id,
    name: globalTax.nom,
    rate: globalTax.nom.toLowerCase().includes('tva') ? productTaxRate : globalTax.valeur,
    base: globalTax.calculationBase === 'totalHT' ? 'HT' : 'HT + previous taxes',
    order: globalTax.ordre,
    type: 'percentage' as const
  }));
};

// Format tax summary for display in invoice
export const formatInvoiceTaxSummary = (
  taxCalculationResult: InvoiceTaxCalculationResult
): any[] => {
  const result: any[] = [];
  
  // Add percentage taxes (grouped by name and rate)
  Object.entries(taxCalculationResult.percentageTaxGroups).forEach(([taxKey, amount]) => {
    result.push({
      nom: taxKey,
      montant: amount,
      type: 'percentage'
    });
  });
  
  // Add fixed taxes
  taxCalculationResult.fixedTaxes.forEach(fixedTax => {
    result.push({
      nom: fixedTax.name,
      montant: fixedTax.amount,
      type: 'fixed'
    });
  });
  
  // Sort by type (percentage first, then fixed)
  return result.sort((a, b) => {
    if (a.type === 'percentage' && b.type === 'fixed') return -1;
    if (a.type === 'fixed' && b.type === 'percentage') return 1;
    return 0;
  });
};

// Calculate total HT from product lines
export const calculateInvoiceTotalHT = (lignes: LigneDocument[]): number => {
  return lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
};

// Calculate total TTC using new tax system
export const calculateInvoiceTotalTTC = (
  lignes: LigneDocument[],
  enabledTaxSettings: Tax[]
): number => {
  const taxResult = calculateInvoiceTaxes(lignes, enabledTaxSettings);
  return taxResult.invoiceTotalTTC;
};