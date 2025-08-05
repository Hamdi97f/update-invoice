import { v4 as uuidv4 } from 'uuid';

interface NumberingSettings {
  factures: {
    prefix: string;
    startNumber: number;
    currentNumber: number;
    includeYear: boolean;
  };
  devis: {
    prefix: string;
    startNumber: number;
    currentNumber: number;
    includeYear: boolean;
  };
  bonsLivraison: {
    prefix: string;
    startNumber: number;
    currentNumber: number;
    includeYear: boolean;
  };
  commandesFournisseur: {
    prefix: string;
    startNumber: number;
    currentNumber: number;
    includeYear: boolean;
  };
}

const defaultSettings: NumberingSettings = {
  factures: { prefix: 'FA', startNumber: 1, currentNumber: 1, includeYear: true },
  devis: { prefix: 'DV', startNumber: 1, currentNumber: 1, includeYear: true },
  bonsLivraison: { prefix: 'BL', startNumber: 1, currentNumber: 1, includeYear: true },
  commandesFournisseur: { prefix: 'CF', startNumber: 1, currentNumber: 1, includeYear: true }
};

export const getNextDocumentNumber = async (
  documentType: keyof NumberingSettings,
  isElectron: boolean,
  query?: (sql: string, params?: any[]) => Promise<any>,
  shouldIncrement: boolean = true
): Promise<string> => {
  let settings = defaultSettings;

  if (isElectron && query) {
    try {
      // Load settings from database
      const result = await query('SELECT value FROM settings WHERE key = ?', ['numbering']);
      if (result.length > 0) {
        const loadedSettings = JSON.parse(result[0].value);
        // Ensure backward compatibility - add includeYear if missing
        Object.keys(loadedSettings).forEach(key => {
          if (loadedSettings[key] && typeof loadedSettings[key].includeYear === 'undefined') {
            loadedSettings[key].includeYear = true; // Default to true for existing settings
          }
        });
        settings = loadedSettings;
      }
    } catch (error) {
      console.error('Error loading numbering settings:', error);
    }
  }

  const docSettings = settings[documentType];
  const year = new Date().getFullYear();
  const number = String(docSettings.currentNumber).padStart(3, '0');
  
  // Generate document number based on includeYear setting
  const documentNumber = docSettings.includeYear 
    ? `${docSettings.prefix}-${year}-${number}`
    : `${docSettings.prefix}-${number}`;

  // Only increment if shouldIncrement is true (when actually saving)
  if (shouldIncrement) {
    const newSettings = {
      ...settings,
      [documentType]: {
        ...docSettings,
        currentNumber: docSettings.currentNumber + 1
      }
    };

    // Save updated settings
    if (isElectron && query) {
      try {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['numbering', JSON.stringify(newSettings)]
        );
      } catch (error) {
        console.error('Error updating numbering settings:', error);
      }
    }
  }

  return documentNumber;
};

export const getCompanyInfo = async (
  isElectron: boolean,
  query?: (sql: string, params?: any[]) => Promise<any>
) => {
  const defaultCompany = {
    nom: 'Votre Entreprise',
    adresse: '123 Avenue de la République',
    codePostal: '1000',
    ville: 'Tunis',
    pays: 'Tunisie',
    telephone: '+216 71 123 456',
    email: 'contact@entreprise.tn',
    siret: '',
    tva: ''
  };

  if (isElectron && query) {
    try {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['company']);
      if (result.length > 0) {
        return JSON.parse(result[0].value);
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    }
  }

  return defaultCompany;
};