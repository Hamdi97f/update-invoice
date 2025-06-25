export const formatCurrency = (amount: number): string => {
  return `${amount.toFixed(3)} TND`;
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