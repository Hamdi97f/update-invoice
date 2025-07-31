import { LigneDocument, TaxCalculation } from '../types';
import { formatCurrency } from './currency';

export interface AutoTvaSettings {
  enabled: boolean;
  calculationBase: 'totalHT' | 'totalHTWithFirstTax';
}

export interface AutoTvaResult {
  tvaLines: TaxCalculation[];
  totalAutoTva: number;
}

export const calculateAutoTva = (
  lignes: LigneDocument[],
  settings: AutoTvaSettings,
  existingTaxes: TaxCalculation[] = []
): AutoTvaResult => {
  if (!settings.enabled || lignes.length === 0) {
    return { tvaLines: [], totalAutoTva: 0 };
  }

  // Group lines by TVA rate
  const tvaGroups = new Map<number, number>();
  
  lignes.forEach(ligne => {
    const tvaRate = ligne.produit.tva;
    const montantHT = ligne.montantHT;
    
    if (tvaRate > 0) {
      const currentAmount = tvaGroups.get(tvaRate) || 0;
      tvaGroups.set(tvaRate, currentAmount + montantHT);
    }
  });

  // Calculate base amount for TVA calculation
  const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
  let calculationBase = totalHT;
  
  if (settings.calculationBase === 'totalHTWithFirstTax' && existingTaxes.length > 0) {
    // Add the first tax to the base
    calculationBase = totalHT + existingTaxes[0].montant;
  }

  // Generate TVA lines
  const tvaLines: TaxCalculation[] = [];
  let totalAutoTva = 0;

  // Sort by TVA rate for consistent ordering
  const sortedTvaRates = Array.from(tvaGroups.keys()).sort((a, b) => a - b);

  sortedTvaRates.forEach(tvaRate => {
    const baseAmount = tvaGroups.get(tvaRate) || 0;
    
    // Calculate TVA amount based on the proportion of this rate in total HT
    const proportion = totalHT > 0 ? baseAmount / totalHT : 0;
    const tvaAmount = calculationBase * proportion * (tvaRate / 100);

    if (tvaAmount > 0) {
      tvaLines.push({
        taxId: `auto-tva-${tvaRate}`,
        nom: `TVA ${tvaRate}%`,
        base: baseAmount,
        montant: tvaAmount
      });
      
      totalAutoTva += tvaAmount;
    }
  });

  return { tvaLines, totalAutoTva };
};

export const getAutoTvaSettings = async (
  isElectron: boolean,
  query?: (sql: string, params?: any[]) => Promise<any>
): Promise<AutoTvaSettings> => {
  const defaultSettings: AutoTvaSettings = {
    enabled: false,
    calculationBase: 'totalHT'
  };

  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['autoTvaSettings']);
      if (result.length > 0) {
        const settings = JSON.parse(result[0].value);
        return { ...defaultSettings, ...settings };
      }
    } else {
      const savedSettings = localStorage.getItem('autoTvaSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        return { ...defaultSettings, ...settings };
      }
    }
  } catch (error) {
    console.error('Error loading auto TVA settings:', error);
  }

  return defaultSettings;
};

export const saveAutoTvaSettings = async (
  settings: AutoTvaSettings,
  isElectron: boolean,
  query?: (sql: string, params?: any[]) => Promise<any>
): Promise<void> => {
  try {
    if (isElectron && query) {
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['autoTvaSettings', JSON.stringify(settings)]
      );
    } else {
      localStorage.setItem('autoTvaSettings', JSON.stringify(settings));
    }
  } catch (error) {
    console.error('Error saving auto TVA settings:', error);
    throw error;
  }
};

export const formatAutoTvaDisplay = (tvaLines: TaxCalculation[]): string => {
  if (tvaLines.length === 0) return '';
  
  return tvaLines
    .map(line => `${line.nom}: ${formatCurrency(line.montant)}`)
    .join('\n');
};