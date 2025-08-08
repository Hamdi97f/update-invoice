import { LigneDocument, TaxGroupSummary, Produit } from '../types';

// Calculate taxes for a single product line using the standardized logic
export const calculateProductTaxes = (ligne: LigneDocument): LigneDocument => {
  const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - (ligne.remise || 0) / 100);
  
  // Step 1: Calculate FODEC
  let montantFodec = 0;
  if (ligne.produit.fodecApplicable && ligne.produit.tauxFodec > 0) {
    montantFodec = montantHT * (ligne.produit.tauxFodec / 100);
  }
  
  // Step 2: Calculate TVA base (HT + FODEC if applicable)
  const baseTVA = montantHT + montantFodec;
  
  // Step 3: Calculate TVA
  const montantTVA = baseTVA * (ligne.produit.tva / 100);
  
  // Step 4: Calculate TTC
  const montantTTC = montantHT + montantFodec + montantTVA;
  
  return {
    ...ligne,
    montantHT,
    montantFodec,
    baseTVA,
    montantTVA,
    montantTTC
  };
};

// Calculate totals for all lines - STANDARDIZED FOR ALL DOCUMENT TYPES
export const calculateDocumentTotals = (lignes: LigneDocument[]) => {
  // Recalculate each line first
  const calculatedLignes = lignes.map(ligne => calculateProductTaxes(ligne));
  
  // Calculate totals
  const totalHT = calculatedLignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
  const totalFodec = calculatedLignes.reduce((sum, ligne) => sum + (ligne.montantFodec || 0), 0);
  const totalTVA = calculatedLignes.reduce((sum, ligne) => sum + (ligne.montantTVA || 0), 0);
  const totalTTC = calculatedLignes.reduce((sum, ligne) => sum + ligne.montantTTC, 0);
  
  // Create tax summary by type and rate - STANDARDIZED
  const taxSummary: TaxGroupSummary[] = [];
  
  // FODEC summary (if any products have FODEC)
  if (totalFodec > 0) {
    // Group by FODEC rate
    const fodecGroups = new Map<number, { baseAmount: number; taxAmount: number }>();
    
    calculatedLignes.forEach(ligne => {
      if (ligne.produit.fodecApplicable && ligne.montantFodec && ligne.montantFodec > 0) {
        const rate = ligne.produit.tauxFodec || 1;
        if (!fodecGroups.has(rate)) {
          fodecGroups.set(rate, { baseAmount: 0, taxAmount: 0 });
        }
        const group = fodecGroups.get(rate)!;
        group.baseAmount += ligne.montantHT;
        group.taxAmount += ligne.montantFodec;
      }
    });
    
    fodecGroups.forEach((group, rate) => {
      taxSummary.push({
        type: 'FODEC',
        rate,
        baseAmount: group.baseAmount,
        taxAmount: group.taxAmount
      });
    });
  }
  
  // TVA summary (group by TVA rate)
  if (totalTVA > 0) {
    const tvaGroups = new Map<number, { baseAmount: number; taxAmount: number }>();
    
    calculatedLignes.forEach(ligne => {
      if (ligne.produit.tva > 0 && ligne.montantTVA && ligne.montantTVA > 0) {
        const rate = ligne.produit.tva;
        if (!tvaGroups.has(rate)) {
          tvaGroups.set(rate, { baseAmount: 0, taxAmount: 0 });
        }
        const group = tvaGroups.get(rate)!;
        group.baseAmount += ligne.baseTVA || (ligne.montantHT + (ligne.montantFodec || 0)); // Use TVA base (HT + FODEC)
        group.taxAmount += ligne.montantTVA;
      }
    });
    
    tvaGroups.forEach((group, rate) => {
      taxSummary.push({
        type: 'TVA',
        rate,
        baseAmount: group.baseAmount,
        taxAmount: group.taxAmount
      });
    });
  }
  
  return {
    lignes: calculatedLignes,
    totalHT,
    totalFodec,
    totalTVA,
    totalTTC,
    taxSummary
  };
};

// STANDARDIZED function for all document types
export const calculateTaxesByGroup = (
  lignes: LigneDocument[],
  taxGroups: any[] = [],
  documentType: string = 'factures'
) => {
  const result = calculateDocumentTotals(lignes);
  
  return {
    taxGroupsSummary: result.taxSummary,
    totalTaxes: result.totalFodec + result.totalTVA
  };
};

// Helper functions for backward compatibility
export const loadTaxGroups = async (query: any) => {
  // Return empty array since we're using the new simplified logic
  return [];
};

export const ensureTaxGroupForProduct = async (productTaxRate: number, query: any) => {
  // No longer needed with the new logic
  return;
};

export const autoCreateTaxGroupFromProduct = (taxRate: number) => {
  // No longer needed with the new logic
  return null;
};

export const getOrCreateTaxGroup = async (taxRate: number, existingGroups: any[], query: any) => {
  // No longer needed with the new logic
  return null;
};

export const calculateTaxesWithCascade = (lignes: LigneDocument[], taxGroups: any[]) => {
  // Use the new simplified logic
  const result = calculateDocumentTotals(lignes);
  
  return {
    taxGroupsSummary: result.taxSummary,
    totalTaxes: result.totalFodec + result.totalTVA
  };
};

export const initializeTaxGroupsTable = async (query: any) => {
  // No longer needed with the new logic
  return;
};