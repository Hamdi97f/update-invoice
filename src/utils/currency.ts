// Currency settings interface
interface CurrencySettings {
  symbol: string;
  decimals: number;
  position: 'before' | 'after';
}

// Default currency settings
const defaultCurrencySettings: CurrencySettings = {
  symbol: '',
  decimals: 3,
  position: 'after'
};

// Get currency settings from localStorage or database (synchronous)
const getCurrencySettings = (): CurrencySettings => {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('currencySettings');
      if (saved) {
        return { ...defaultCurrencySettings, ...JSON.parse(saved) };
      }
    }
  } catch (error) {
    console.error('Error loading currency settings:', error);
  }
  return defaultCurrencySettings;
};

// Get currency settings from database (asynchronous for PDF generation)
export const getCurrencySettingsFromDB = async (isElectron: boolean, query?: any): Promise<CurrencySettings> => {
  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['currencySettings']);
      if (result.length > 0) {
        const dbSettings = JSON.parse(result[0].value);
        return { ...defaultCurrencySettings, ...dbSettings };
      }
    }
  } catch (error) {
    console.error('Error loading currency settings from database:', error);
  }
  return getCurrencySettings(); // Fallback to localStorage
};

// Format currency with database settings (for PDF generation)
export const formatCurrencyWithSettings = (amount: number, settings: CurrencySettings): string => {
  const formattedAmount = amount.toFixed(settings.decimals);
  
  // If no symbol is set, return just the formatted amount
  if (!settings.symbol || settings.symbol.trim() === '') {
    return formattedAmount;
  }
  
  if (settings.position === 'before') {
    return `${settings.symbol} ${formattedAmount}`;
  } else {
    return `${formattedAmount} ${settings.symbol}`;
  }
};

export const formatCurrency = (amount: number): string => {
  const settings = getCurrencySettings();
  return formatCurrencyWithSettings(amount, settings);
};

export const setCurrencySettings = (settings: Partial<CurrencySettings>): void => {
  try {
    const currentSettings = getCurrencySettings();
    const newSettings = { ...currentSettings, ...settings };
    localStorage.setItem('currencySettings', JSON.stringify(newSettings));
  } catch (error) {
    console.error('Error saving currency settings:', error);
  }
};

export const getCurrencySymbol = (): string => {
  return getCurrencySettings().symbol;
};

export const getCurrencyDecimals = (): number => {
  return getCurrencySettings().decimals;
};

// Ensure this function is properly exported
export { getCurrencySettingsFromDB, formatCurrencyWithSettings };

export const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
};

export const calculateTVA = (montantHT: number, tauxTVA: number = 19): number => {
  return montantHT * (tauxTVA / 100);
};

export const calculateTTC = (montantHT: number, tauxTVA: number = 19): number => {
  return montantHT + calculateTVA(montantHT, tauxTVA);
};