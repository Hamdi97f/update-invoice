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
  type: 'percentage' | 'fixed';
  valeur: number;
  amount?: number; // For fixed taxes
  calculationBase: 'totalHT' | 'totalHTWithPreviousTaxes';
  applicableDocuments: ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[];
  ordre: number;
  actif: boolean;
}

export interface ProductTax {
  id: string;
  name: string;
  rate: number; // For percentage taxes (e.g., 19, 7, 1)
  base: 'HT' | 'HT + previous taxes';
  order: number; // calculation order for cascade
  type: 'percentage' | 'fixed';
}

export interface ProductTaxResult {
  name: string;
  type: 'percentage' | 'fixed';
  rate?: number;
  calculatedAmount: number;
  base: number;
}

export interface FixedTaxResult {
  name: string;
  amount: number;
  base: number; // What it was calculated on (total HT or TTC)
  type: 'fixed';
}

export interface LigneDocument {
  id: string;
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montantHT: number;
  montantTTC: number;
  productTaxes: ProductTax[]; // List of taxes for this product
  productTaxResults: ProductTaxResult[]; // Calculated tax amounts for this product
}

export interface InvoiceTaxSummary {
  nom: string;
  montant: number;
  type: 'percentage' | 'fixed';
  rate?: number;
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