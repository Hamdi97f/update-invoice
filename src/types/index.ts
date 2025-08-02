export interface Client {
  id: string;
  code: string; // Client reference/code
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siret?: string;
  matriculeFiscal?: string; // Ajout du matricule fiscal
}

export interface Fournisseur {
  id: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siret?: string;
  matriculeFiscal?: string; // Ajout du matricule fiscal
}

export interface Produit {
  id: string;
  ref?: string; // Product reference (optional)
  nom: string;
  description: string;
  prixUnitaire: number;
  tva: number; // TVA principale du produit
  stock?: number;
  type: 'vente' | 'achat'; // Product type
}

// NOUVEAU SYSTÈME DE TAXES DYNAMIQUES
export interface TaxeUtilisateur {
  id: string;
  nom: string; // Nom libre (ex: "FODEC", "Timbre", "Écotaxe")
  type: 'percentage' | 'fixed';
  valeur: number; // Taux en % ou montant fixe
  base: 'HT' | 'HT_plus_taxes_precedentes';
  ordre: number; // Ordre d'application
  affecteTVAProduit: boolean; // Si true, cette taxe modifie la base de calcul de la TVA produit
  applicableDocuments: ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[];
  actif: boolean;
}

// Taxe calculée pour affichage
export interface TaxeCalculee {
  nom: string;
  type: 'percentage' | 'fixed';
  taux?: number; // Pour les taxes percentage
  montant: number;
  base?: number; // Base de calcul utilisée
}

// Ligne de document avec nouveau système
export interface LigneDocument {
  id: string;
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montantHT: number;
  montantTVA: number; // TVA calculée selon le taux produit + base ajustée
  montantTTC: number; // HT + TVA (les autres taxes sont globales)
  baseCalculTVA: number; // Base utilisée pour calculer la TVA (HT + taxes qui affectent TVA)
}

export interface Facture {
  id: string;
  numero: string;
  date: Date;
  dateEcheance: Date;
  client: Client;
  lignes: LigneDocument[];
  totalHT: number;
  totalTVA: number; // Somme des TVA produits
  taxesAutres: TaxeCalculee[]; // Taxes configurables par l'utilisateur
  totalTaxesAutres: number;
  totalTTC: number; // HT + TVA + autres taxes
  statut: 'brouillon' | 'envoyee' | 'payee' | 'annulee';
  notes?: string;
}

export interface Devis {
  id: string;
  numero: string;
  date: Date;
  dateValidite: Date;
  client: Client;
  lignes: LigneDocument[];
  totalHT: number;
  totalTVA: number;
  taxesAutres: TaxeCalculee[];
  totalTaxesAutres: number;
  totalTTC: number;
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';
  notes?: string;
}

export interface BonLivraison {
  id: string;
  numero: string;
  date: Date;
  client: Client;
  lignes: LigneDocument[];
  statut: 'prepare' | 'expedie' | 'livre';
  factureId?: string;
  notes?: string;
  totalHT: number;
  totalTVA: number;
  taxesAutres: TaxeCalculee[];
  totalTaxesAutres: number;
  totalTTC: number;
}

export interface CommandeFournisseur {
  id: string;
  numero: string;
  date: Date;
  dateReception: Date;
  fournisseur: Fournisseur;
  lignes: LigneDocument[];
  totalHT: number;
  totalTVA: number;
  taxesAutres: TaxeCalculee[];
  totalTaxesAutres: number;
  totalTTC: number;
  statut: 'brouillon' | 'envoyee' | 'confirmee' | 'recue' | 'annulee';
  notes?: string;
}

export interface Payment {
  id: string;
  factureId: string;
  factureNumero: string;
  clientId: string;
  clientNom: string;
  montant: number;
  montantFacture: number;
  date: Date;
  methode: 'especes' | 'cheque' | 'virement' | 'carte' | 'autre';
  reference?: string;
  notes?: string;
  statut: 'valide' | 'en_attente' | 'annule';
}

// LEGACY - Gardé pour compatibilité avec l'ancien code
export interface Tax {
  id: string;
  nom: string;
  type: 'percentage' | 'fixed';
  valeur: number;
  calculationBase: 'totalHT' | 'totalHTWithPreviousTaxes';
  applicableDocuments: ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[];
  ordre: number;
  actif: boolean;
}

export interface ProductTax {
  id: string;
  nom: string;
  type: 'percentage' | 'fixed';
  taux: number;
  base: 'HT' | 'HT_plus_taxes_precedentes';
  ordre: number;
}

export interface TaxeFixe {
  id: string;
  nom: string;
  valeur: number;
  base: 'totalHT' | 'totalTTC';
  actif: boolean;
}