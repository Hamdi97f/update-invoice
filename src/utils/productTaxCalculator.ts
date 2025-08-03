import { ProductTax, LigneDocument, TaxeCalculee, TaxeFixe } from '../types';

// Calculer les taxes pour une ligne de produit
export const calculerTaxesProduit = (
  montantHT: number,
  taxesProduit: ProductTax[]
): {
  taxesCalculees: { [key: string]: number };
  totalTaxes: number;
  montantTTC: number;
} => {
  const taxesCalculees: { [key: string]: number } = {};
  let totalTaxes = 0;
  let montantCourant = montantHT;

  // Trier les taxes par ordre
  const taxesTriees = [...taxesProduit]
    .filter(tax => tax.type === 'percentage') // Seules les taxes percentage pour les produits
    .sort((a, b) => a.ordre - b.ordre);

  for (const taxe of taxesTriees) {
    let base = 0;
    let montantTaxe = 0;

    if (taxe.base === 'HT') {
      base = montantHT;
    } else if (taxe.base === 'HT_plus_taxes_precedentes') {
      base = montantCourant;
    }

    montantTaxe = (base * taxe.taux) / 100;

    // Clé unique pour cette taxe (nom + taux)
    const cleTaxe = `${taxe.nom} ${taxe.taux}%`;
    taxesCalculees[cleTaxe] = montantTaxe;

    totalTaxes += montantTaxe;
    montantCourant += montantTaxe;
  }

  return {
    taxesCalculees,
    totalTaxes,
    montantTTC: montantHT + totalTaxes
  };
};

// Agréger les taxes de toutes les lignes de produits
export const agregerTaxesProduits = (lignes: LigneDocument[]): {
  taxesAgregees: { [key: string]: number };
  totalTaxesPercentage: number;
} => {
  const taxesAgregees: { [key: string]: number } = {};
  let totalTaxesPercentage = 0;

  for (const ligne of lignes) {
    if (ligne.taxesCalculees) {
      for (const [cleTaxe, montant] of Object.entries(ligne.taxesCalculees)) {
        if (taxesAgregees[cleTaxe]) {
          taxesAgregees[cleTaxe] += montant;
        } else {
          taxesAgregees[cleTaxe] = montant;
        }
        totalTaxesPercentage += montant;
      }
    }
  }

  return { taxesAgregees, totalTaxesPercentage };
};

// Calculer les taxes fixes pour la facture
export const calculerTaxesFixesFacture = (
  totalHT: number,
  totalTTC: number,
  taxesFixesConfig: TaxeFixe[]
): {
  taxesFixesCalculees: TaxeCalculee[];
  totalTaxesFixes: number;
} => {
  const taxesFixesCalculees: TaxeCalculee[] = [];
  let totalTaxesFixes = 0;

  for (const taxeFixe of taxesFixesConfig.filter(t => t.actif)) {
    const base = taxeFixe.base === 'totalHT' ? totalHT : totalTTC;
    
    taxesFixesCalculees.push({
      nom: taxeFixe.nom,
      montant: taxeFixe.valeur,
      type: 'fixed'
    });

    totalTaxesFixes += taxeFixe.valeur;
  }

  return { taxesFixesCalculees, totalTaxesFixes };
};

// Formater les taxes agrégées pour l'affichage
export const formaterTaxesPourAffichage = (
  taxesAgregees: { [key: string]: number }
): TaxeCalculee[] => {
  return Object.entries(taxesAgregees).map(([cleTaxe, montant]) => {
    // Extraire le nom et le taux de la clé
    const match = cleTaxe.match(/^(.+)\s(\d+(?:\.\d+)?)%$/);
    if (match) {
      return {
        nom: match[1],
        taux: parseFloat(match[2]),
        montant,
        type: 'percentage' as const
      };
    }
    
    // Fallback si le format ne correspond pas
    return {
      nom: cleTaxe,
      montant,
      type: 'percentage' as const
    };
  });
};

// Créer des taxes par défaut pour un produit basé sur son taux TVA
export const creerTaxesDefautProduit = (tauxTVA: number): ProductTax[] => {
  if (tauxTVA === 0) {
    return [];
  }

  return [
    {
      id: 'tva-default',
      nom: 'TVA',
      type: 'percentage',
      taux: tauxTVA,
      base: 'HT',
      ordre: 1
    }
  ];
};