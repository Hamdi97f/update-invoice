import { TaxGroup, LigneDocument, TaxGroupSummary, ProductTaxCalculation } from '../types';

// Auto-create tax group from product tax rate
export const autoCreateTaxGroupFromProduct = (taxRate: number): TaxGroup => {
  return {
    id: `auto_tva_${taxRate}`,
    name: `TVA`,
    type: 'percentage',
    value: taxRate,
    calculationBase: 'HT',
    order: 1,
    isAutoCreated: true,
    isActive: true
  };
};

// Get or create tax group for a product tax rate
export const getOrCreateTaxGroup = async (
  taxRate: number,
  existingGroups: TaxGroup[],
  query?: (sql: string, params?: any[]) => Promise<any>
): Promise<TaxGroup> => {
  // Look for existing auto-created group with this rate
  const existingGroup = existingGroups.find(
    group => group.isAutoCreated && group.type === 'percentage' && group.value === taxRate
  );
  
  if (existingGroup) {
    return existingGroup;
  }
  
  // Create new auto group
  const newGroup = autoCreateTaxGroupFromProduct(taxRate);
  
  // Save to database if available
  if (query) {
    try {
      await query(
        `INSERT OR REPLACE INTO tax_groups 
         (id, name, type, value, calculationBase, order_index, isAutoCreated, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newGroup.id,
          newGroup.name,
          newGroup.type,
          newGroup.value,
          newGroup.calculationBase,
          newGroup.order,
          newGroup.isAutoCreated ? 1 : 0,
          newGroup.isActive ? 1 : 0
        ]
      );
    } catch (error) {
      console.error('Error saving auto-created tax group:', error);
    }
  }
  
  return newGroup;
};

// Calculate taxes for a single product line
export const calculateProductTaxes = (
  ligne: LigneDocument,
  taxGroups: TaxGroup[]
): {
  taxCalculations: ProductTaxCalculation[];
  totalTaxes: number;
  montantTTC: number;
} => {
  const taxCalculations: ProductTaxCalculation[] = [];
  let totalTaxes = 0;
  
  // Find applicable tax groups for this product's tax rate
  const productTaxRate = ligne.produit.tva;
  
  if (productTaxRate > 0) {
    // Find or use auto-created group for this rate
    const applicableGroup = taxGroups.find(
      group => group.isAutoCreated && group.type === 'percentage' && group.value === productTaxRate && group.isActive
    );
    
    if (applicableGroup) {
      const baseAmount = ligne.montantHT;
      const taxAmount = (baseAmount * applicableGroup.value) / 100;
      
      taxCalculations.push({
        groupId: applicableGroup.id,
        groupName: applicableGroup.name,
        baseAmount,
        taxAmount,
        rate: applicableGroup.value
      });
      
      totalTaxes += taxAmount;
    }
  }
  
  const montantTTC = ligne.montantHT + totalTaxes;
  
  return {
    taxCalculations,
    totalTaxes,
    montantTTC
  };
};

// Group products by tax rate and calculate taxes per group
export const calculateTaxesByGroup = (
  lignes: LigneDocument[],
  taxGroups: TaxGroup[]
): {
  taxGroupsSummary: TaxGroupSummary[];
  totalTaxes: number;
} => {
  if (!lignes || lignes.length === 0) {
    return { taxGroupsSummary: [], totalTaxes: 0 };
  }

  const groupsMap = new Map<string, TaxGroupSummary>();
  let totalTaxes = 0;
  
  // Group products by tax rate
  for (const ligne of lignes) {
    const productTaxRate = ligne.produit.tva;
    
    if (productTaxRate >= 0) {
      // Find applicable tax group
      const applicableGroup = taxGroups.find(
        group => group.isAutoCreated && group.type === 'percentage' && group.value === productTaxRate && group.isActive
      );
      
      if (applicableGroup) {
        const groupKey = `${applicableGroup.name}_${applicableGroup.value}`;
        
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            groupId: applicableGroup.id,
            groupName: applicableGroup.name,
            type: applicableGroup.type,
            rate: applicableGroup.value,
            baseAmount: 0,
            taxAmount: 0,
            products: []
          });
        }
        
          groupId: `tva_${productTaxRate}`,
          groupName: productTaxRate === 0 ? 'Exonéré TVA' : `TVA ${productTaxRate}%`,
        groupSummary.products.push({
          productId: ligne.produit.id,
          productName: ligne.produit.nom,
          quantity: ligne.quantite,
          htAmount: ligne.montantHT
        });
      }
    
      // Calculate tax for this group
      if (productTaxRate > 0) {
        groupSummary.taxAmount = (groupSummary.baseAmount * productTaxRate) / 100;
        totalTaxes += groupSummary.taxAmount;
      }
    }
  }
  
  const taxGroupsSummary: TaxGroupSummary[] = [];
  
  for (const [groupKey, groupSummary] of groupsMap) {
    taxGroupsSummary.push(groupSummary);
  }
  
  // Sort by tax rate for consistent display
  taxGroupsSummary.sort((a, b) => (a.rate || 0) - (b.rate || 0));
  
  return {
    taxGroupsSummary,
    totalTaxes
  };
};

// Calculate taxes with cascade for manual taxes (advanced)
export const calculateTaxesWithCascade = (
  lignes: LigneDocument[],
  taxGroups: TaxGroup[]
): {
  taxGroupsSummary: TaxGroupSummary[];
  totalTaxes: number;
} => {
  // First, calculate basic product group taxes
  const { taxGroupsSummary: basicGroups, totalTaxes: basicTaxes } = calculateTaxesByGroup(lignes, taxGroups);
  
  // Then apply manual taxes with cascade if any
  const manualTaxGroups = taxGroups.filter(group => !group.isAutoCreated && group.isActive);
  const allGroupsSummary = [...basicGroups];
  let totalTaxes = basicTaxes;
  
  // Sort manual taxes by order
  manualTaxGroups.sort((a, b) => a.order - b.order);
  
  for (const manualGroup of manualTaxGroups) {
    let baseAmount = 0;
    
    if (manualGroup.calculationBase === 'HT') {
      // Calculate on total HT
      baseAmount = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
    } else if (manualGroup.calculationBase === 'HT_plus_previous_taxes') {
      // Calculate on HT + all previous taxes
      baseAmount = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0) + totalTaxes;
    }
    
    let taxAmount = 0;
    if (manualGroup.type === 'percentage') {
      taxAmount = (baseAmount * manualGroup.value) / 100;
    } else {
      taxAmount = manualGroup.value;
    }
    
    allGroupsSummary.push({
      groupId: manualGroup.id,
      groupName: manualGroup.name,
      type: manualGroup.type,
      rate: manualGroup.type === 'percentage' ? manualGroup.value : undefined,
      baseAmount,
      taxAmount,
      products: [] // Manual taxes don't have specific products
    });
    
    totalTaxes += taxAmount;
  }
  
  return {
    taxGroupsSummary: allGroupsSummary,
    totalTaxes
  };
};

// Initialize tax groups table
export const initializeTaxGroupsTable = async (query: (sql: string, params?: any[]) => Promise<any>) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS tax_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        calculationBase TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        isAutoCreated BOOLEAN DEFAULT 0,
        isActive BOOLEAN DEFAULT 1
      )
    `);
    
    // Create default tax groups if none exist
    const existingGroups = await query('SELECT COUNT(*) as count FROM tax_groups');
    if (existingGroups[0].count === 0) {
      // Create common tax groups
      const defaultGroups = [
        { id: 'auto_tva_0', name: 'TVA', type: 'percentage', value: 0, calculationBase: 'HT', order: 1, isAutoCreated: true },
        { id: 'auto_tva_7', name: 'TVA', type: 'percentage', value: 7, calculationBase: 'HT', order: 1, isAutoCreated: true },
        { id: 'auto_tva_13', name: 'TVA', type: 'percentage', value: 13, calculationBase: 'HT', order: 1, isAutoCreated: true },
        { id: 'auto_tva_19', name: 'TVA', type: 'percentage', value: 19, calculationBase: 'HT', order: 1, isAutoCreated: true }
      ];
      
      for (const group of defaultGroups) {
        await query(
          `INSERT INTO tax_groups (id, name, type, value, calculationBase, order_index, isAutoCreated, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [group.id, group.name, group.type, group.value, group.calculationBase, group.order, group.isAutoCreated ? 1 : 0, 1]
        );
      }
    }
  } catch (error) {
    console.error('Error initializing tax groups table:', error);
  }
};

// Load tax groups from database
export const loadTaxGroups = async (query: (sql: string, params?: any[]) => Promise<any>): Promise<TaxGroup[]> => {
  try {
    const result = await query('SELECT * FROM tax_groups WHERE isActive = 1 ORDER BY order_index ASC');
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.value,
      calculationBase: row.calculationBase,
      order: row.order_index,
      isAutoCreated: Boolean(row.isAutoCreated),
      isActive: Boolean(row.isActive)
    }));
  } catch (error) {
    console.error('Error loading tax groups:', error);
    return [];
  }
};

// Ensure tax group exists for product tax rate
export const ensureTaxGroupForProduct = async (
  productTaxRate: number,
  query?: (sql: string, params?: any[]) => Promise<any>
): Promise<void> => {
  if (!query || productTaxRate === 0) return;
  
  try {
    // Check if auto-created group exists for this rate
    const existing = await query(
      'SELECT id FROM tax_groups WHERE isAutoCreated = 1 AND type = ? AND value = ?',
      ['percentage', productTaxRate]
    );
    
    if (existing.length === 0) {
      // Create new auto group
      const newGroup = autoCreateTaxGroupFromProduct(productTaxRate);
      await query(
        `INSERT INTO tax_groups (id, name, type, value, calculationBase, order_index, isAutoCreated, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newGroup.id,
          newGroup.name,
          newGroup.type,
          newGroup.value,
          newGroup.calculationBase,
          newGroup.order,
          newGroup.isAutoCreated ? 1 : 0,
          newGroup.isActive ? 1 : 0
        ]
      );
    }
  } catch (error) {
    console.error('Error ensuring tax group for product:', error);
  }
};