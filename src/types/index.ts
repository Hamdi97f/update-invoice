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
  tva: number;
  stock?: number;
  type: 'vente' | 'achat'; // NEW: Product type
}

export interface Tax {
  id: string;
  nom: string;
  rateType: 'percentage' | 'fixed';
  valeur: number;
  calculationBase: 'totalHT' | 'totalHTWithPreviousTaxes';
  applicableDocuments: ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[];
  ordre: number;
  actif: boolean;
}

export interface ProductTaxEntry {
  id: string;
  name: string;
  rateType: 'percentage' | 'fixed';
  value: number; // percentage (e.g., 19) or fixed amount (e.g., 5)
  base: 'HT' | 'HT_PLUS_PREVIOUS';
  order: number; // calculation order for cascade
}

export interface ProductTaxCalculation {
  name: string;
  rateType: 'percentage' | 'fixed';
  value: number;
  calculatedAmount: number;
  appliedToInvoice: boolean; // for fixed taxes applied once per invoice
}

export interface LigneDocument {
  id: string;
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montantHT: number;
  montantTTC: number;
  productTaxes: ProductTaxEntry[]; // List of taxes for this product
  taxCalculations: ProductTaxCalculation[]; // Calculated tax amounts
}

export interface TaxCalculation {
  taxId?: string;
  nom: string;
  rateType: 'percentage' | 'fixed';
  value: number;
  base?: number;
  montant: number;
}

export interface Facture {
  id: string;
  numero: string;
  date: Date;
  dateEcheance: Date;
  client: Client;
  lignes: LigneDocument[];
  totalHT: number;
  totalTVA: number;
  taxes: TaxCalculation[];
  totalTaxes: number;
  totalTTC: number;
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
  taxes: TaxCalculation[];
  totalTaxes: number;
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
  totalHT?: number;
  totalTVA?: number;
  totalTTC?: number;
  taxes?: TaxCalculation[];
  totalTaxes?: number;
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
  taxes: TaxCalculation[];
  totalTaxes: number;
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