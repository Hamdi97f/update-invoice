// Currency settings interface
interface CurrencySettings {
  symbol: string;
  decimals: number;
  position: 'before' | 'after';
}

// Default currency settings
const defaultCurrencySettings: CurrencySettings = {
  symbol: 'TND',
  decimals: 3,
  position: 'after'
};

// Get currency settings from localStorage or database
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

export const formatCurrency = (amount: number): string => {
  const settings = getCurrencySettings();
  const formattedAmount = amount.toFixed(settings.decimals);
  
  if (settings.position === 'before') {
    return `${settings.symbol} ${formattedAmount}`;
  } else {
    return `${formattedAmount} ${settings.symbol}`;
  }
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

export const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
};

export const calculateTVA = (montantHT: number, tauxTVA: number = 19): number => {
  return montantHT * (tauxTVA / 100);
};

export const calculateTTC = (montantHT: number, tauxTVA: number = 19): number => {
  return montantHT + calculateTVA(montantHT, tauxTVA);
};