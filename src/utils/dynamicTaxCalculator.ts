import { TaxeUtilisateur, TaxeCalculee, LigneDocument, Produit } from '../types';

// NOUVEAU SYSTÈME DE CALCUL DES TAXES DYNAMIQUES

/**
 * Calculer la TVA d'un produit avec base ajustée selon les taxes utilisateur
 */
export const calculerTVAProduit = (
  montantHT: number,
  tauxTVAProduit: number,
  taxesUtilisateur: TaxeUtilisateur[]
): {
  baseCalculTVA: number;
  montantTVA: number;
} => {
  // Commencer par la base HT
  let baseCalculTVA = montantHT;
  
  // Ajouter les taxes qui affectent la base de calcul de la TVA
  const taxesAffectantTVA = taxesUtilisateur
    .filter(taxe => taxe.actif && taxe.affecteTVAProduit && taxe.type === 'percentage')
    .sort((a, b) => a.ordre - b.ordre);
  
  for (const taxe of taxesAffectantTVA) {
    const montantTaxe = (baseCalculTVA * taxe.valeur) / 100;
    baseCalculTVA += montantTaxe;
  }
  
  // Calculer la TVA sur la base ajustée
  const montantTVA = (baseCalculTVA * tauxTVAProduit) / 100;
  
  return {
    baseCalculTVA,
    montantTVA
  };
};

/**
 * Calculer une ligne de document avec le nouveau système
 */
export const calculerLigneDocument = (
  produit: Produit,
  quantite: number,
  prixUnitaire: number,
  remise: number,
  taxesUtilisateur: TaxeUtilisateur[]
): LigneDocument => {
  // Calcul de base
  const montantHT = quantite * prixUnitaire * (1 - remise / 100);
  
  // Calculer la TVA avec base ajustée
  const { baseCalculTVA, montantTVA } = calculerTVAProduit(
    montantHT,
    produit.tva,
    taxesUtilisateur
  );
  
  const montantTTC = montantHT + montantTVA;
  
  return {
    id: '', // Sera défini par l'appelant
    produit,
    quantite,
    prixUnitaire,
    remise,
    montantHT,
    montantTVA,
    montantTTC,
    baseCalculTVA
  };
};

/**
 * Calculer les taxes globales (autres que TVA produit)
 */
export const calculerTaxesGlobales = (
  totalHT: number,
  totalTVA: number,
  taxesUtilisateur: TaxeUtilisateur[],
  typeDocument: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): {
  taxesCalculees: TaxeCalculee[];
  totalTaxes: number;
} => {
  const taxesCalculees: TaxeCalculee[] = [];
  let totalTaxes = 0;
  let montantCourant = totalHT;
  
  // Filtrer les taxes applicables au type de document
  const taxesApplicables = taxesUtilisateur
    .filter(taxe => 
      taxe.actif && 
      taxe.applicableDocuments.includes(typeDocument) &&
      !taxe.affecteTVAProduit // Exclure les taxes qui affectent la TVA produit (déjà calculées)
    )
    .sort((a, b) => a.ordre - b.ordre);
  
  for (const taxe of taxesApplicables) {
    let base = 0;
    let montantTaxe = 0;
    
    if (taxe.type === 'fixed') {
      // Taxe fixe - base non utilisée
      montantTaxe = taxe.valeur;
      base = 0;
    } else {
      // Taxe percentage
      if (taxe.base === 'HT') {
        base = totalHT;
      } else if (taxe.base === 'HT_plus_taxes_precedentes') {
        base = montantCourant;
      }
      
      montantTaxe = (base * taxe.valeur) / 100;
    }
    
    taxesCalculees.push({
      nom: taxe.nom,
      type: taxe.type,
      taux: taxe.type === 'percentage' ? taxe.valeur : undefined,
      montant: montantTaxe,
      base: taxe.type === 'percentage' ? base : undefined
    });
    
    totalTaxes += montantTaxe;
    montantCourant += montantTaxe;
  }
  
  return {
    taxesCalculees,
    totalTaxes
  };
};

/**
 * Regrouper les TVA par taux pour l'affichage
 */
export const regrouperTVAParTaux = (lignes: LigneDocument[]): TaxeCalculee[] => {
  const tvaParTaux: { [taux: string]: number } = {};
  
  for (const ligne of lignes) {
    const taux = ligne.produit.tva;
    const cleTaux = `${taux}`;
    
    if (tvaParTaux[cleTaux]) {
      tvaParTaux[cleTaux] += ligne.montantTVA;
    } else {
      tvaParTaux[cleTaux] = ligne.montantTVA;
    }
  }
  
  return Object.entries(tvaParTaux)
    .filter(([_, montant]) => montant > 0)
    .map(([taux, montant]) => ({
      nom: 'TVA',
      type: 'percentage' as const,
      taux: parseFloat(taux),
      montant
    }));
};

/**
 * Calculer les totaux d'un document
 */
export const calculerTotauxDocument = (
  lignes: LigneDocument[],
  taxesUtilisateur: TaxeUtilisateur[],
  typeDocument: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur'
): {
  totalHT: number;
  totalTVA: number;
  tvaParTaux: TaxeCalculee[];
  taxesAutres: TaxeCalculee[];
  totalTaxesAutres: number;
  totalTTC: number;
} => {
  // Totaux des lignes
  const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
  const totalTVA = lignes.reduce((sum, ligne) => sum + ligne.montantTVA, 0);
  
  // Regrouper TVA par taux
  const tvaParTaux = regrouperTVAParTaux(lignes);
  
  // Calculer les autres taxes
  const { taxesCalculees: taxesAutres, totalTaxes: totalTaxesAutres } = calculerTaxesGlobales(
    totalHT,
    totalTVA,
    taxesUtilisateur,
    typeDocument
  );
  
  const totalTTC = totalHT + totalTVA + totalTaxesAutres;
  
  return {
    totalHT,
    totalTVA,
    tvaParTaux,
    taxesAutres,
    totalTaxesAutres,
    totalTTC
  };
};

/**
 * Créer des taxes par défaut pour la compatibilité
 */
export const creerTaxesDefautProduit = (tauxTVA: number): any[] => {
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

/**
 * Calculer les taxes pour un produit (compatibilité)
 */
export const calculerTaxesProduit = (
  montantHT: number,
  taxesProduit: any[]
): {
  taxesCalculees: { [key: string]: number };
  montantTTC: number;
} => {
  const taxesCalculees: { [key: string]: number } = {};
  let totalTaxes = 0;
  
  for (const taxe of taxesProduit) {
    if (taxe.type === 'percentage') {
      const montantTaxe = (montantHT * taxe.taux) / 100;
      const cleTaxe = `${taxe.nom} ${taxe.taux}%`;
      taxesCalculees[cleTaxe] = montantTaxe;
      totalTaxes += montantTaxe;
    }
  }
  
  return {
    taxesCalculees,
    montantTTC: montantHT + totalTaxes
  };
};

/**
 * Agréger les taxes des produits (compatibilité)
 */
export const agregerTaxesProduits = (lignes: LigneDocument[]): {
  taxesAgregees: { [key: string]: number };
  totalTaxesPercentage: number;
} => {
  const taxesAgregees: { [key: string]: number } = {};
  let totalTaxesPercentage = 0;
  
  // Regrouper les TVA par taux
  for (const ligne of lignes) {
    const taux = ligne.produit.tva;
    if (taux > 0) {
      const cleTaxe = `TVA ${taux}%`;
      if (taxesAgregees[cleTaxe]) {
        taxesAgregees[cleTaxe] += ligne.montantTVA;
      } else {
        taxesAgregees[cleTaxe] = ligne.montantTVA;
      }
      totalTaxesPercentage += ligne.montantTVA;
    }
  }
  
  return {
    taxesAgregees,
    totalTaxesPercentage
  };
};

/**
 * Formater les taxes pour l'affichage (compatibilité)
 */
export const formaterTaxesPourAffichage = (
  taxesAgregees: { [key: string]: number }
): TaxeCalculee[] => {
  return Object.entries(taxesAgregees).map(([cleTaxe, montant]) => {
    const match = cleTaxe.match(/^(.+)\s(\d+(?:\.\d+)?)%$/);
    return {
      nom: match ? match[1] : cleTaxe,
      type: 'percentage' as const,
      taux: match ? parseFloat(match[2]) : undefined,
      montant
    };
  });
};

/**
 * Calculer les taxes fixes pour une facture (compatibilité)
 */
export const calculerTaxesFixesFacture = (
  totalHT: number,
  totalTTC: number,
  taxesFixesConfig: any[]
): {
  taxesFixesCalculees: TaxeCalculee[];
  totalTaxesFixes: number;
} => {
  const taxesFixesCalculees: TaxeCalculee[] = [];
  let totalTaxesFixes = 0;
  
  for (const taxeFixe of taxesFixesConfig.filter(t => t.actif)) {
    taxesFixesCalculees.push({
      nom: taxeFixe.nom,
      type: 'fixed',
      montant: taxeFixe.valeur
    });
    
    totalTaxesFixes += taxeFixe.valeur;
  }
  
  return { taxesFixesCalculees, totalTaxesFixes };
};