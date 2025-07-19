// Convert numbers to French words for amount display
export const numberToWords = (amount: number, currency: string = 'TND'): string => {
  const dinars = Math.floor(amount);
  
  // Get decimal places from currency settings
  const getCurrencyDecimals = (): number => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('currencySettings');
        if (saved) {
          const settings = JSON.parse(saved);
          return settings.decimals || 3;
        }
      }
    } catch (error) {
      console.error('Error loading currency settings:', error);
    }
    return 3; // Default to 3 decimals
  };
  
  const decimals = getCurrencyDecimals();
  const multiplier = Math.pow(10, decimals);
  const fractionalPart = Math.round((amount - dinars) * multiplier);
  
  const units = [
    '', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
    'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT',
    'DIX-HUIT', 'DIX-NEUF'
  ];
  
  const tens = [
    '', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE',
    'QUATRE-VINGT', 'QUATRE-VINGT'
  ];
  
  const convertHundreds = (num: number): string => {
    let result = '';
    
    if (num >= 100) {
      const hundreds = Math.floor(num / 100);
      if (hundreds === 1) {
        result += 'CENT ';
      } else {
        result += units[hundreds] + ' CENT ';
      }
      num %= 100;
    }
    
    if (num >= 20) {
      const tensDigit = Math.floor(num / 10);
      const unitsDigit = num % 10;
      
      if (tensDigit === 7) {
        result += 'SOIXANTE-';
        if (unitsDigit === 0) {
          result += 'DIX ';
        } else {
          result += units[10 + unitsDigit] + ' ';
        }
      } else if (tensDigit === 9) {
        result += 'QUATRE-VINGT-';
        if (unitsDigit === 0) {
          result += 'DIX ';
        } else {
          result += units[10 + unitsDigit] + ' ';
        }
      } else {
        result += tens[tensDigit];
        if (unitsDigit > 0) {
          if (tensDigit === 8 && unitsDigit === 0) {
            result += 'S ';
          } else {
            result += '-' + units[unitsDigit] + ' ';
          }
        } else {
          if (tensDigit === 8) {
            result += 'S ';
          } else {
            result += ' ';
          }
        }
      }
    } else if (num > 0) {
      result += units[num] + ' ';
    }
    
    return result.trim();
  };
  
  const convertThousands = (num: number): string => {
    if (num === 0) return '';
    
    let result = '';
    
    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      if (millions === 1) {
        result += 'UN MILLION ';
      } else {
        result += convertHundreds(millions) + ' MILLIONS ';
      }
      num %= 1000000;
    }
    
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      if (thousands === 1) {
        result += 'MILLE ';
      } else {
        result += convertHundreds(thousands) + ' MILLE ';
      }
      num %= 1000;
    }
    
    if (num > 0) {
      result += convertHundreds(num);
    }
    
    return result.trim();
  };
  
  let result = '';
  
  if (dinars === 0) {
    result = `ZÉRO ${getCurrencyName(currency, false)}`;
  } else if (dinars === 1) {
    result = `UN ${getCurrencyName(currency, false)}`;
  } else {
    result = convertThousands(dinars) + ` ${getCurrencyName(currency, true)}`;
  }
  
  if (fractionalPart > 0 && decimals > 0) {
    const fractionalName = getFractionalName(currency, decimals);
    result += ' ET ' + fractionalPart.toString() + ` ${fractionalName}`;
  }
  
  return result;
};

// Get currency name in singular or plural
const getCurrencyName = (currency: string, plural: boolean): string => {
  const currencyNames: { [key: string]: { singular: string; plural: string } } = {
    'TND': { singular: 'DINAR', plural: 'DINARS' },
    'EUR': { singular: 'EURO', plural: 'EUROS' },
    'USD': { singular: 'DOLLAR', plural: 'DOLLARS' },
    'MAD': { singular: 'DIRHAM', plural: 'DIRHAMS' },
    'DZD': { singular: 'DINAR', plural: 'DINARS' },
    'GBP': { singular: 'LIVRE', plural: 'LIVRES' },
    'CHF': { singular: 'FRANC', plural: 'FRANCS' },
    'CAD': { singular: 'DOLLAR', plural: 'DOLLARS' }
  };
  
  const names = currencyNames[currency.toUpperCase()];
  if (names) {
    return plural ? names.plural : names.singular;
  }
  
  // Default fallback
  return plural ? `${currency.toUpperCase()}S` : currency.toUpperCase();
};

// Get fractional currency name
const getFractionalName = (currency: string, decimals: number): string => {
  const fractionalNames: { [key: string]: string } = {
    'TND': 'MILLIMES',
    'EUR': 'CENTIMES',
    'USD': 'CENTS',
    'MAD': 'CENTIMES',
    'DZD': 'CENTIMES',
    'GBP': 'PENCE',
    'CHF': 'CENTIMES',
    'CAD': 'CENTS'
  };
  
  return fractionalNames[currency.toUpperCase()] || 'CENTIMES';
};