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
  fodecApplicable: boolean; // NEW: FODEC applicable
  tauxFodec: number; // NEW: FODEC rate (default 1%)
  stock?: number;
  type: 'vente' | 'achat'; // NEW: Product type
}

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

export interface TaxGroup {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  calculationBase: 'HT' | 'HT_plus_previous_taxes';
  applicableDocuments: ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[];
  order: number;
  isAutoCreated: boolean; // true if created from product tax rate
  isActive: boolean;
}

export interface ProductTaxCalculation {
  groupId: string;
  groupName: string;
  baseAmount: number;
  taxAmount: number;
  rate?: number;
}

export interface LigneDocument {
  id: string;
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  montantHT: number;
  montantFodec: number; // NEW: FODEC amount
  baseTVA: number; // NEW: TVA calculation base (HT + FODEC)
  montantTVA: number; // NEW: TVA amount
  montantTTC: number;
}

export interface TaxGroupSummary {
  type: 'FODEC' | 'TVA';
  rate: number;
  baseAmount: number;
  taxAmount: number;
}

export interface Facture {
  id: string;
  numero: string;
  date: Date;
  dateEcheance: Date;
  client: Client;
  lignes: LigneDocument[];
  totalHT: number;
  totalFodec: number; // NEW: Total FODEC
  totalTVA: number; // NEW: Total TVA
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
  totalFodec: number; // NEW: Total FODEC
  totalTVA: number; // NEW: Total TVA
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
  totalFodec?: number; // NEW: Total FODEC
  totalTVA?: number; // NEW: Total TVA
  totalTTC?: number;
}

export interface CommandeFournisseur {
  id: string;
  numero: string;
  date: Date;
  dateReception: Date;
  fournisseur: Fournisseur;
  lignes: LigneDocument[];
  totalHT: number;
  totalFodec: number; // NEW: Total FODEC
  totalTVA: number; // NEW: Total TVA
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