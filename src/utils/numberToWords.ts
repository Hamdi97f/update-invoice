// Convert numbers to French words for amount display
export const numberToWords = (amount: number): string => {
  const dinars = Math.floor(amount);
  const millimes = Math.round((amount - dinars) * 1000);
  
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
    result = 'ZÉRO DINAR';
  } else if (dinars === 1) {
    result = 'UN DINAR';
  } else {
    result = convertThousands(dinars) + ' DINARS';
  }
  
  if (millimes > 0) {
    result += ' ET ' + millimes.toString() + ' MILLIMES';
  }
  
  return result;
};