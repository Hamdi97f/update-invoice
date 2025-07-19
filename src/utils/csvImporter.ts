import { Client, Produit } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  duplicates: number;
  skipped: number;
}

export interface ClientCSVRow {
  code: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  siret?: string;
  matriculeFiscal?: string;
}

export interface ProduitCSVRow {
  ref?: string;
  nom: string;
  description?: string;
  prixUnitaire: string;
  tva?: string;
  stock?: string;
  type: string;
}

// Parse CSV content
export const parseCSV = (csvContent: string): string[][] => {
  const lines = csvContent.trim().split('\n');
  const result: string[][] = [];
  
  for (const line of lines) {
    // Simple CSV parsing - handles quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current.trim());
    result.push(fields);
  }
  
  return result;
};

// Validate and import clients
export const importClientsFromCSV = async (
  csvContent: string,
  existingClients: Client[],
  query?: (sql: string, params?: any[]) => Promise<any>
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    duplicates: 0,
    skipped: 0
  };
  
  try {
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      result.errors.push('Le fichier CSV est vide');
      return result;
    }
    
    // Validate header
    const header = rows[0].map(h => h.toLowerCase().trim());
    const requiredFields = ['code', 'nom'];
    const optionalFields = ['adresse', 'codepostal', 'ville', 'telephone', 'email', 'siret', 'matriculefiscal'];
    
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        result.errors.push(`Colonne obligatoire manquante: ${field}`);
      }
    }
    
    if (result.errors.length > 0) {
      return result;
    }
    
    // Get column indices
    const getColumnIndex = (fieldName: string) => header.indexOf(fieldName.toLowerCase());
    
    const codeIndex = getColumnIndex('code');
    const nomIndex = getColumnIndex('nom');
    const adresseIndex = getColumnIndex('adresse');
    const codePostalIndex = getColumnIndex('codepostal');
    const villeIndex = getColumnIndex('ville');
    const telephoneIndex = getColumnIndex('telephone');
    const emailIndex = getColumnIndex('email');
    const siretIndex = getColumnIndex('siret');
    const matriculeFiscalIndex = getColumnIndex('matriculefiscal');
    
    // Process data rows
    const dataRows = rows.slice(1);
    const existingCodes = new Set(existingClients.map(c => c.code.toLowerCase()));
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because we start from row 2 (after header)
      
      try {
        // Validate required fields
        const code = row[codeIndex]?.trim();
        const nom = row[nomIndex]?.trim();
        
        if (!code) {
          result.errors.push(`Ligne ${rowNumber}: Code client manquant`);
          result.skipped++;
          continue;
        }
        
        if (!nom) {
          result.errors.push(`Ligne ${rowNumber}: Nom client manquant`);
          result.skipped++;
          continue;
        }
        
        // Check for duplicates
        if (existingCodes.has(code.toLowerCase())) {
          result.errors.push(`Ligne ${rowNumber}: Code client "${code}" existe déjà`);
          result.duplicates++;
          continue;
        }
        
        // Validate email format if provided
        const email = row[emailIndex]?.trim();
        if (email && !isValidEmail(email)) {
          result.errors.push(`Ligne ${rowNumber}: Format email invalide "${email}"`);
          result.skipped++;
          continue;
        }
        
        // Create client object
        const client: Client = {
          id: uuidv4(),
          code,
          nom,
          adresse: row[adresseIndex]?.trim() || '',
          codePostal: row[codePostalIndex]?.trim() || '',
          ville: row[villeIndex]?.trim() || '',
          telephone: row[telephoneIndex]?.trim() || '',
          email: email || '',
          siret: row[siretIndex]?.trim() || '',
          matriculeFiscal: row[matriculeFiscalIndex]?.trim() || ''
        };
        
        // Save to database if available
        if (query) {
          await query(
            `INSERT INTO clients 
             (id, code, nom, adresse, codePostal, ville, telephone, email, siret, matriculeFiscal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              client.id,
              client.code,
              client.nom,
              client.adresse,
              client.codePostal,
              client.ville,
              client.telephone,
              client.email,
              client.siret,
              client.matriculeFiscal
            ]
          );
        }
        
        existingCodes.add(code.toLowerCase());
        result.imported++;
        
      } catch (error: any) {
        result.errors.push(`Ligne ${rowNumber}: ${error.message}`);
        result.skipped++;
      }
    }
    
    result.success = result.imported > 0;
    return result;
    
  } catch (error: any) {
    result.errors.push(`Erreur lors de l'analyse du fichier: ${error.message}`);
    return result;
  }
};

// Validate and import products
export const importProduitsFromCSV = async (
  csvContent: string,
  existingProduits: Produit[],
  query?: (sql: string, params?: any[]) => Promise<any>
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    imported: 0,
    errors: [],
    duplicates: 0,
    skipped: 0
  };
  
  try {
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      result.errors.push('Le fichier CSV est vide');
      return result;
    }
    
    // Validate header
    const header = rows[0].map(h => h.toLowerCase().trim());
    const requiredFields = ['nom', 'prixunitaire', 'type'];
    const optionalFields = ['ref', 'description', 'tva', 'stock'];
    
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        result.errors.push(`Colonne obligatoire manquante: ${field}`);
      }
    }
    
    if (result.errors.length > 0) {
      return result;
    }
    
    // Get column indices
    const getColumnIndex = (fieldName: string) => header.indexOf(fieldName.toLowerCase());
    
    const refIndex = getColumnIndex('ref');
    const nomIndex = getColumnIndex('nom');
    const descriptionIndex = getColumnIndex('description');
    const prixUnitaireIndex = getColumnIndex('prixunitaire');
    const tvaIndex = getColumnIndex('tva');
    const stockIndex = getColumnIndex('stock');
    const typeIndex = getColumnIndex('type');
    
    // Process data rows
    const dataRows = rows.slice(1);
    const existingRefs = new Set(existingProduits.filter(p => p.ref).map(p => p.ref!.toLowerCase()));
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2;
      
      try {
        // Validate required fields
        const nom = row[nomIndex]?.trim();
        const prixUnitaireStr = row[prixUnitaireIndex]?.trim();
        const type = row[typeIndex]?.trim().toLowerCase();
        
        if (!nom) {
          result.errors.push(`Ligne ${rowNumber}: Nom produit manquant`);
          result.skipped++;
          continue;
        }
        
        if (!prixUnitaireStr) {
          result.errors.push(`Ligne ${rowNumber}: Prix unitaire manquant`);
          result.skipped++;
          continue;
        }
        
        const prixUnitaire = parseFloat(prixUnitaireStr.replace(',', '.'));
        if (isNaN(prixUnitaire) || prixUnitaire < 0) {
          result.errors.push(`Ligne ${rowNumber}: Prix unitaire invalide "${prixUnitaireStr}"`);
          result.skipped++;
          continue;
        }
        
        if (!type || (type !== 'vente' && type !== 'achat')) {
          result.errors.push(`Ligne ${rowNumber}: Type invalide "${type}" (doit être "vente" ou "achat")`);
          result.skipped++;
          continue;
        }
        
        // Validate optional fields
        const ref = row[refIndex]?.trim();
        if (ref && existingRefs.has(ref.toLowerCase())) {
          result.errors.push(`Ligne ${rowNumber}: Référence "${ref}" existe déjà`);
          result.duplicates++;
          continue;
        }
        
        const tvaStr = row[tvaIndex]?.trim();
        let tva = 19; // Default
        if (tvaStr) {
          tva = parseFloat(tvaStr.replace(',', '.'));
          if (isNaN(tva) || tva < 0 || tva > 100) {
            result.errors.push(`Ligne ${rowNumber}: TVA invalide "${tvaStr}" (doit être entre 0 et 100)`);
            result.skipped++;
            continue;
          }
        }
        
        const stockStr = row[stockIndex]?.trim();
        let stock = 0; // Default
        if (stockStr) {
          stock = parseInt(stockStr);
          if (isNaN(stock) || stock < 0) {
            result.errors.push(`Ligne ${rowNumber}: Stock invalide "${stockStr}" (doit être un nombre positif)`);
            result.skipped++;
            continue;
          }
        }
        
        // Create product object
        const produit: Produit = {
          id: uuidv4(),
          ref: ref || undefined,
          nom,
          description: row[descriptionIndex]?.trim() || '',
          prixUnitaire,
          tva,
          stock,
          type: type as 'vente' | 'achat'
        };
        
        // Save to database if available
        if (query) {
          await query(
            `INSERT INTO produits 
             (id, ref, nom, description, prixUnitaire, tva, stock, type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              produit.id,
              produit.ref || null,
              produit.nom,
              produit.description,
              produit.prixUnitaire,
              produit.tva,
              produit.stock,
              produit.type
            ]
          );
        }
        
        if (ref) {
          existingRefs.add(ref.toLowerCase());
        }
        result.imported++;
        
      } catch (error: any) {
        result.errors.push(`Ligne ${rowNumber}: ${error.message}`);
        result.skipped++;
      }
    }
    
    result.success = result.imported > 0;
    return result;
    
  } catch (error: any) {
    result.errors.push(`Erreur lors de l'analyse du fichier: ${error.message}`);
    return result;
  }
};

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate CSV template for clients
export const generateClientCSVTemplate = (): string => {
  const header = 'code,nom,adresse,codePostal,ville,telephone,email,siret,matriculeFiscal';
  const example1 = 'CL0001,"Entreprise ABC","123 Rue de la Paix",1000,Tunis,"+216 71 123 456","contact@abc.tn","12345678901234","123456789ABC"';
  const example2 = 'CL0002,"Société XYZ","456 Avenue Bourguiba",2000,Sfax,"+216 74 789 012","info@xyz.tn","98765432109876","987654321XYZ"';
  
  return [header, example1, example2].join('\n');
};

// Generate CSV template for products
export const generateProduitCSVTemplate = (): string => {
  const header = 'ref,nom,description,prixUnitaire,tva,stock,type';
  const example1 = 'V0001,"Consultation","Conseil en informatique",500.000,19,0,vente';
  const example2 = 'V0002,"Développement web","Site vitrine responsive",1500.000,19,0,vente';
  const example3 = 'A0001,"Hébergement serveur","Hébergement mensuel",200.000,19,0,achat';
  const example4 = 'A0002,"Licence logiciel","Licence annuelle",800.000,19,0,achat';
  
  return [header, example1, example2, example3, example4].join('\n');
};