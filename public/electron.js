const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const Database = require('better-sqlite3');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { format } = require('date-fns');

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Configure auto-updater
if (!isDev) {
  // In production, set up auto-updater
  log.info('Setting up auto-updater');
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Set GitHub repository for updates
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Hamdi97f',
    repo: 'update-invoice',
    private: false,
    releaseType: 'release'
  });
}

let mainWindow;
let db;
let isActivated = false;
let activeTransactions = 0;

// Initialize database with better error handling
function initDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    
    // Ensure the userData directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    const dbPath = path.join(userDataPath, 'facturation.db');
    log.info('Database path:', dbPath);
    
    // Create database connection with better options
    db = new Database(dbPath, { 
      verbose: log.info,
      fileMustExist: false
    });
    
    // Enable foreign keys and WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000'); // Set busy timeout to 5 seconds
    
    // Check and update database schema
    updateDatabaseSchema();
    
    // Insert sample data if tables are empty
    const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get();
    if (clientCount.count === 0) {
      insertSampleData();
    }

    // Initialize default settings if not exists
    initializeDefaultSettings();
    
    // Check activation status
    checkActivation();
    
    log.info('Database initialized successfully');
    
  } catch (error) {
    log.error('Error initializing database:', error);
    
    // Show error dialog to user
    dialog.showErrorBox('Database Error', 
      `Failed to initialize database: ${error.message}\n\nPlease restart the application.`);
  }
}

function updateDatabaseSchema() {
  try {
    log.info('Updating database schema...');
    
    // Create tables with complete schema
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        nom TEXT NOT NULL,
        adresse TEXT DEFAULT '',
        codePostal TEXT DEFAULT '',
        ville TEXT DEFAULT '',
        telephone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        siret TEXT DEFAULT '',
        matriculeFiscal TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fournisseurs (
        id TEXT PRIMARY KEY,
        nom TEXT NOT NULL,
        adresse TEXT DEFAULT '',
        codePostal TEXT DEFAULT '',
        ville TEXT DEFAULT '',
        telephone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        siret TEXT DEFAULT '',
        matriculeFiscal TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS produits (
        id TEXT PRIMARY KEY,
        ref TEXT,
        nom TEXT NOT NULL,
        description TEXT DEFAULT '',
        prixUnitaire REAL NOT NULL,
        tva REAL DEFAULT 19,
        fodecApplicable BOOLEAN DEFAULT 0,
        tauxFodec REAL DEFAULT 1,
        stock INTEGER DEFAULT 0,
        type TEXT DEFAULT 'vente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS factures (
        id TEXT PRIMARY KEY,
        numero TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        dateEcheance TEXT NOT NULL,
        clientId TEXT NOT NULL,
        totalHT REAL NOT NULL,
        totalFodec REAL DEFAULT 0,
        totalTVA REAL NOT NULL,
        totalTTC REAL NOT NULL,
        statut TEXT DEFAULT 'brouillon',
        notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES clients (id)
      );

      CREATE TABLE IF NOT EXISTS lignes_facture (
        id TEXT PRIMARY KEY,
        factureId TEXT NOT NULL,
        produitId TEXT NOT NULL,
        quantite INTEGER NOT NULL,
        prixUnitaire REAL NOT NULL,
        remise REAL DEFAULT 0,
        montantHT REAL NOT NULL,
        montantTTC REAL NOT NULL,
        FOREIGN KEY (factureId) REFERENCES factures (id),
        FOREIGN KEY (produitId) REFERENCES produits (id)
      );

      CREATE TABLE IF NOT EXISTS devis (
        id TEXT PRIMARY KEY,
        numero TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        dateValidite TEXT NOT NULL,
        clientId TEXT NOT NULL,
        totalHT REAL NOT NULL,
        totalFodec REAL DEFAULT 0,
        totalTVA REAL NOT NULL,
        totalTTC REAL NOT NULL,
        statut TEXT DEFAULT 'brouillon',
        notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES clients (id)
      );

      CREATE TABLE IF NOT EXISTS lignes_devis (
        id TEXT PRIMARY KEY,
        devisId TEXT NOT NULL,
        produitId TEXT NOT NULL,
        quantite INTEGER NOT NULL,
        prixUnitaire REAL NOT NULL,
        remise REAL DEFAULT 0,
        montantHT REAL NOT NULL,
        montantTTC REAL NOT NULL,
        FOREIGN KEY (devisId) REFERENCES devis (id),
        FOREIGN KEY (produitId) REFERENCES produits (id)
      );

      CREATE TABLE IF NOT EXISTS bons_livraison (
        id TEXT PRIMARY KEY,
        numero TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        clientId TEXT NOT NULL,
        statut TEXT DEFAULT 'prepare',
        factureId TEXT,
        notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES clients (id),
        FOREIGN KEY (factureId) REFERENCES factures (id)
      );

      CREATE TABLE IF NOT EXISTS lignes_bon_livraison (
        id TEXT PRIMARY KEY,
        bonLivraisonId TEXT NOT NULL,
        produitId TEXT NOT NULL,
        quantite INTEGER NOT NULL,
        FOREIGN KEY (bonLivraisonId) REFERENCES bons_livraison (id),
        FOREIGN KEY (produitId) REFERENCES produits (id)
      );

      CREATE TABLE IF NOT EXISTS commandes_fournisseur (
        id TEXT PRIMARY KEY,
        numero TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        dateReception TEXT NOT NULL,
        fournisseurId TEXT NOT NULL,
        totalHT REAL NOT NULL,
        totalFodec REAL DEFAULT 0,
        totalTVA REAL NOT NULL,
        totalTTC REAL NOT NULL,
        statut TEXT DEFAULT 'brouillon',
        notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fournisseurId) REFERENCES fournisseurs (id)
      );

      CREATE TABLE IF NOT EXISTS lignes_commande_fournisseur (
        id TEXT PRIMARY KEY,
        commandeId TEXT NOT NULL,
        produitId TEXT NOT NULL,
        quantite INTEGER NOT NULL,
        prixUnitaire REAL NOT NULL,
        remise REAL DEFAULT 0,
        montantHT REAL NOT NULL,
        montantTTC REAL NOT NULL,
        FOREIGN KEY (commandeId) REFERENCES commandes_fournisseur (id),
        FOREIGN KEY (produitId) REFERENCES produits (id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        factureId TEXT NOT NULL,
        factureNumero TEXT NOT NULL,
        clientId TEXT NOT NULL,
        clientNom TEXT NOT NULL,
        montant REAL NOT NULL,
        montantFacture REAL NOT NULL,
        date TEXT NOT NULL,
        methode TEXT NOT NULL,
        reference TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        statut TEXT DEFAULT 'valide',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (factureId) REFERENCES factures (id),
        FOREIGN KEY (clientId) REFERENCES clients (id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS taxes (
        id TEXT PRIMARY KEY,
        nom TEXT NOT NULL,
        type TEXT NOT NULL,
        valeur REAL NOT NULL,
        calculationBase TEXT NOT NULL,
        applicableDocuments TEXT NOT NULL,
        ordre INTEGER NOT NULL,
        actif BOOLEAN DEFAULT 1
      );
      
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        produitId TEXT NOT NULL,
        produitNom TEXT NOT NULL,
        produitRef TEXT,
        type TEXT NOT NULL,
        quantite INTEGER NOT NULL,
        date TEXT NOT NULL,
        source TEXT NOT NULL,
        sourceId TEXT,
        sourceNumero TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produitId) REFERENCES produits (id)
      );

      CREATE TABLE IF NOT EXISTS tax_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        calculationBase TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        isAutoCreated BOOLEAN DEFAULT 0,
        isActive BOOLEAN DEFAULT 1
      );
    `;

    // Execute table creation
    db.exec(createTablesSQL);
    log.info('Database tables created successfully');

    // Check and add missing columns
    addMissingColumns();
    
  } catch (error) {
    log.error('Error updating database schema:', error);
    throw error;
  }
}

function addMissingColumns() {
  try {
    // First, ensure settings table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    
    // Helper function to safely add column if it doesn't exist
    const addColumnIfNotExists = (tableName, columnName, columnDefinition) => {
      try {
        const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const hasColumn = tableInfo.some(col => col.name === columnName);
        
        if (!hasColumn) {
          log.info(`Adding '${columnName}' column to ${tableName} table`);
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
        }
      } catch (error) {
        log.error(`Error adding column ${columnName} to ${tableName}:`, error);
      }
    };
    
    // Add missing columns to clients table
    addColumnIfNotExists('clients', 'code', 'TEXT');
    addColumnIfNotExists('clients', 'matriculeFiscal', 'TEXT DEFAULT ""');
    
    // Update existing clients with generated codes if needed
    try {
      const clientsWithoutCode = db.prepare("SELECT id FROM clients WHERE code IS NULL OR code = ''").all();
      if (clientsWithoutCode.length > 0) {
        const updateClient = db.prepare("UPDATE clients SET code = ? WHERE id = ?");
        clientsWithoutCode.forEach((client, index) => {
          const code = `CL${String(index + 1).padStart(4, '0')}`;
          updateClient.run(code, client.id);
        });
        
        // Create unique index if it doesn't exist
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_code ON clients(code)`);
      }
    } catch (error) {
      log.error('Error updating client codes:', error);
    }
    
    // Add missing columns to fournisseurs table
    addColumnIfNotExists('fournisseurs', 'matriculeFiscal', 'TEXT DEFAULT ""');
    
    // Add missing columns to produits table
    addColumnIfNotExists('produits', 'ref', 'TEXT');
    addColumnIfNotExists('produits', 'type', 'TEXT DEFAULT "vente"');
    addColumnIfNotExists('produits', 'fodecApplicable', 'BOOLEAN DEFAULT 0');
    addColumnIfNotExists('produits', 'tauxFodec', 'REAL DEFAULT 1');
    
    // Add missing columns to factures table
    addColumnIfNotExists('factures', 'totalFodec', 'REAL DEFAULT 0');
    
    // Add missing columns to devis table
    addColumnIfNotExists('devis', 'totalFodec', 'REAL DEFAULT 0');
    
    // Add missing columns to commandes_fournisseur table
    addColumnIfNotExists('commandes_fournisseur', 'totalFodec', 'REAL DEFAULT 0');
    
    // Add missing columns to lignes_facture table
    addColumnIfNotExists('lignes_facture', 'montantFodec', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_facture', 'baseTVA', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_facture', 'montantTVA', 'REAL DEFAULT 0');
    
    // Add missing columns to lignes_devis table
    addColumnIfNotExists('lignes_devis', 'montantFodec', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_devis', 'baseTVA', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_devis', 'montantTVA', 'REAL DEFAULT 0');
    
    // Add missing columns to lignes_bon_livraison table
    addColumnIfNotExists('lignes_bon_livraison', 'prixUnitaire', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_bon_livraison', 'remise', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_bon_livraison', 'montantHT', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_bon_livraison', 'montantFodec', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_bon_livraison', 'baseTVA', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_bon_livraison', 'montantTVA', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_bon_livraison', 'montantTTC', 'REAL DEFAULT 0');
    
    // Add missing columns to lignes_commande_fournisseur table
    addColumnIfNotExists('lignes_commande_fournisseur', 'montantFodec', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_commande_fournisseur', 'baseTVA', 'REAL DEFAULT 0');
    addColumnIfNotExists('lignes_commande_fournisseur', 'montantTVA', 'REAL DEFAULT 0');
    
    // Add missing columns to bons_livraison table
    addColumnIfNotExists('bons_livraison', 'totalHT', 'REAL DEFAULT 0');
    addColumnIfNotExists('bons_livraison', 'totalFodec', 'REAL DEFAULT 0');
    addColumnIfNotExists('bons_livraison', 'totalTVA', 'REAL DEFAULT 0');
    addColumnIfNotExists('bons_livraison', 'totalTTC', 'REAL DEFAULT 0');
    
    // Add missing columns to tax_groups table
    addColumnIfNotExists('tax_groups', 'applicableDocuments', 'TEXT DEFAULT "[]"');
    
    // Update existing tax groups with default applicable documents
    try {
      db.exec(`
        UPDATE tax_groups 
        SET applicableDocuments = '["factures","devis","bonsLivraison","commandesFournisseur"]' 
        WHERE applicableDocuments = '[]' OR applicableDocuments IS NULL
      `);
    } catch (error) {
      log.error('Error updating tax groups:', error);
    }
    
    log.info('Missing columns added successfully');
    
  } catch (error) {
    log.error('Error adding missing columns:', error);
  }
}

function insertSampleData() {
  try {
    const { v4: uuidv4 } = require('uuid');
    
    // Sample clients
    const insertClient = db.prepare(`
      INSERT INTO clients (id, code, nom, adresse, codePostal, ville, telephone, email, matriculeFiscal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertClient.run(uuidv4(), 'CL0001', 'Entreprise ABC', '123 Rue de la Paix', '1000', 'Tunis', '+216 71 123 456', 'contact@abc.tn', '123456789ABC');
    insertClient.run(uuidv4(), 'CL0002', 'Société XYZ', '456 Avenue Habib Bourguiba', '2000', 'Sfax', '+216 74 789 012', 'info@xyz.tn', '987654321XYZ');
    
    // Sample products
    const insertProduit = db.prepare(`
      INSERT INTO produits (id, ref, nom, description, prixUnitaire, tva, fodecApplicable, tauxFodec, stock, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertProduit.run(uuidv4(), 'V0001', 'Consultation', 'Conseil en informatique', 500, 19, 0, 1, 0, 'vente');
    insertProduit.run(uuidv4(), 'V0002', 'Développement web', 'Site vitrine responsive', 1500, 19, 0, 1, 0, 'vente');
    insertProduit.run(uuidv4(), 'A0001', 'Hébergement serveur', 'Hébergement mensuel', 200, 19, 0, 1, 0, 'achat');
    insertProduit.run(uuidv4(), 'A0002', 'Licence logiciel', 'Licence annuelle', 800, 19, 0, 1, 0, 'achat');
    
    // Sample fournisseurs
    const insertFournisseur = db.prepare(`
      INSERT INTO fournisseurs (id, nom, adresse, codePostal, ville, telephone, email, matriculeFiscal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertFournisseur.run(uuidv4(), 'Fournisseur Informatique', '789 Rue des Serveurs', '1000', 'Tunis', '+216 71 987 654', 'contact@fournisseur-info.tn', '456789ABC123');
    insertFournisseur.run(uuidv4(), 'Matériel Pro', '321 Avenue des Composants', '2000', 'Sfax', '+216 74 456 789', 'info@materiel-pro.tn', '789ABC123456');
    
    // Sample taxes
    const insertTax = db.prepare(`
      INSERT INTO taxes (id, nom, type, valeur, calculationBase, applicableDocuments, ordre, actif)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertTax.run(
      uuidv4(),
      'TVA',
      'percentage',
      19,
      'totalHT',
      JSON.stringify(['factures', 'devis', 'bonsLivraison', 'commandesFournisseur']),
      1,
      1
    );
    
    insertTax.run(
      uuidv4(),
      'Timbre Fiscal',
      'fixed',
      1,
      'totalHT',
      JSON.stringify(['factures']),
      2,
      1
    );
    
    // Sample tax groups
    const insertTaxGroup = db.prepare(`
      INSERT INTO tax_groups (id, name, type, value, calculationBase, order_index, isAutoCreated, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertTaxGroup.run(
      uuidv4(),
      'TVA',
      'percentage',
      0,
      'HT',
      1,
      1,
      1
    );
    
    insertTaxGroup.run(
      uuidv4(),
      'TVA',
      'percentage',
      7,
      'HT',
      1,
      1,
      1
    );
    
    insertTaxGroup.run(
      uuidv4(),
      'TVA',
      'percentage',
      13,
      'HT',
      1,
      1,
      1
    );
    
    insertTaxGroup.run(
      uuidv4(),
      'TVA',
      'percentage',
      19,
      'HT',
      1,
      1,
      1
    );
    
    log.info('Sample data inserted successfully');
  } catch (error) {
    log.error('Error inserting sample data:', error);
  }
}

function initializeDefaultSettings() {
  try {
    const settingsExist = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    
    if (settingsExist.count === 0) {
      const defaultNumberingSettings = {
        factures: { prefix: 'FA', startNumber: 1, currentNumber: 1, includeYear: true },
        devis: { prefix: 'DV', startNumber: 1, currentNumber: 1, includeYear: true },
        bonsLivraison: { prefix: 'BL', startNumber: 1, currentNumber: 1, includeYear: true },
        commandesFournisseur: { prefix: 'CF', startNumber: 1, currentNumber: 1, includeYear: true }
      };

      const defaultCompanyInfo = {
        nom: 'Votre Entreprise',
        adresse: '123 Avenue de la République',
        codePostal: '1000',
        ville: 'Tunis',
        pays: 'Tunisie',
        telephone: '+216 71 123 456',
        email: 'contact@entreprise.tn',
        siret: '',
        tva: '',
        matriculeFiscal: 'MF123456789'
      };

      const defaultStockSettings = {
        allowNegativeStock: true
      };

      const defaultInvoiceSettings = {
        useEcheanceDate: true
      };

      const defaultCurrencySettings = {
        symbol: '',
        decimals: 3,
        position: 'after'
      };

      const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      insertSetting.run('numbering', JSON.stringify(defaultNumberingSettings));
      insertSetting.run('company', JSON.stringify(defaultCompanyInfo));
      insertSetting.run('stockSettings', JSON.stringify(defaultStockSettings));
      insertSetting.run('invoiceSettings', JSON.stringify(defaultInvoiceSettings));
      insertSetting.run('currencySettings', JSON.stringify(defaultCurrencySettings));
      
      log.info('Default settings initialized');
    }
  } catch (error) {
    log.error('Error initializing default settings:', error);
  }
}

function checkActivation() {
  try {
    const activationResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('activation');
    
    if (activationResult) {
      const activationData = JSON.parse(activationResult.value);
      isActivated = activationData.activated === true;
      log.info('Activation status:', isActivated ? 'Activated' : 'Not activated');
    } else {
      // No activation record found, set to not activated
      isActivated = false;
      
      // Create activation record
      const activationData = {
        activated: false,
        activationCode: '',
        activationDate: null
      };
      
      const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      insertSetting.run('activation', JSON.stringify(activationData));
      
      log.info('Created new activation record');
    }
  } catch (error) {
    log.error('Error checking activation:', error);
    isActivated = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false
  });

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  log.info('Loading URL:', startUrl);
  log.info('isDev:', isDev);
  log.info('__dirname:', __dirname);
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Check for updates after the app is shown (only in production)
    if (!isDev) {
      setTimeout(() => {
        checkForUpdates();
      }, 3000); // Check after 3 seconds to allow app to initialize
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log.error('Failed to load:', errorDescription, validatedURL);
    
    // If dev server fails, try to start it
    if (isDev && validatedURL.includes('localhost:5173')) {
      log.info('Dev server not running, please start it with: npm run dev');
    }
  });

  // Debug console messages
  mainWindow.webContents.on('console-message', (event, level, message) => {
    log.info('Renderer console:', message);
  });
}

// Check for updates
function checkForUpdates() {
  log.info('Checking for updates...');
  try {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.error('Error in checkForUpdatesAndNotify:', err);
    });
  } catch (error) {
    log.error('Error checking for updates:', error);
  }
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour disponible',
    message: 'Une nouvelle version de Facturation Pro est disponible.',
    detail: 'La mise à jour sera téléchargée et installée automatiquement.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Téléchargement: ${progressObj.percent}%`;
  log.info(logMessage);
  // You could show a progress bar here if you want
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour prête',
    message: 'Une mise à jour a été téléchargée.',
    detail: 'L\'application va redémarrer pour installer la mise à jour.',
    buttons: ['Redémarrer maintenant', 'Plus tard'],
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      try {
        db.close();
      } catch (error) {
        log.error('Error closing database:', error);
      }
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Enhanced IPC handlers with better error handling
ipcMain.handle('db-query', async (event, query, params = []) => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    log.info('Executing query:', query, 'with params:', params);
    
    // Wrap in a transaction for better stability
    let result;
    
    if (query.trim().toLowerCase().startsWith('delete')) {
      // For DELETE operations, check if the record exists first
      const tableName = query.match(/delete\s+from\s+([^\s]+)/i)?.[1];
      const whereClause = query.match(/where\s+(.+)/i)?.[1];
      
      if (tableName && whereClause) {
        const checkQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;
        const checkResult = db.prepare(checkQuery).get(params);
        
        if (checkResult.count === 0) {
          return { changes: 0, message: 'Record not found' };
        }
      }
    }
    
    // Track active transactions
    activeTransactions++;
    
    try {
      const stmt = db.prepare(query);
      if (query.trim().toLowerCase().startsWith('select')) {
        result = stmt.all(params);
        log.info('Query result count:', result.length);
      } else {
        result = stmt.run(params);
        log.info('Query result:', result);
      }
    } finally {
      // Ensure we always decrement the counter
      activeTransactions--;
    }
    
    return result;
  } catch (error) {
    log.error('Database error:', error);
    log.error('Query:', query);
    log.error('Params:', params);
    throw new Error(`Database operation failed: ${error.message}`);
  }
});

ipcMain.handle('get-factures', async () => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const factures = db.prepare(`
      SELECT f.*, c.code as clientCode, c.nom as clientNom, c.adresse, c.codePostal, c.ville, c.telephone, c.email, c.matriculeFiscal
      FROM factures f
      JOIN clients c ON f.clientId = c.id
      ORDER BY f.created_at DESC
    `).all();

    // For each facture, load its lines
    for (const facture of factures) {
      const lignes = db.prepare(`
        SELECT lf.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.fodecApplicable, p.tauxFodec, p.stock, p.type
        FROM lignes_facture lf
        JOIN produits p ON lf.produitId = p.id
        WHERE lf.factureId = ?
      `).all(facture.id);
      
      facture.lignes = lignes.map(ligne => ({
        id: ligne.id,
        produit: {
          id: ligne.produitId,
          ref: ligne.ref,
          nom: ligne.nom,
          description: ligne.description,
          prixUnitaire: ligne.prixUnitaire,
          tva: ligne.tva,
          fodecApplicable: Boolean(ligne.fodecApplicable),
          tauxFodec: ligne.tauxFodec || 1,
          stock: ligne.stock,
          type: ligne.type || 'vente'
        },
        quantite: ligne.quantite,
        prixUnitaire: ligne.prixUnitaire,
        remise: ligne.remise,
        montantHT: ligne.montantHT,
        montantFodec: ligne.montantFodec || 0,
        baseTVA: ligne.baseTVA || 0,
        montantTVA: ligne.montantTVA || 0,
        montantTTC: ligne.montantTTC
      }));
      
      // Load taxes for this facture
      const taxesResult = db.prepare(`
        SELECT * FROM taxes 
        WHERE actif = 1 AND json_extract(applicableDocuments, '$') LIKE '%factures%'
        ORDER BY ordre ASC
      `).all();
      
      // Calculate taxes
      const taxes = [];
      let totalTaxes = 0;
      let runningTotal = facture.totalHT;
      
      if (taxesResult && taxesResult.length > 0) {
        for (const tax of taxesResult) {
          const applicableDocuments = JSON.parse(tax.applicableDocuments);
          if (!applicableDocuments.includes('factures')) continue;
          
          let base;
          let montant;
          
          if (tax.type === 'fixed') {
            base = 0;
            montant = tax.valeur;
          } else {
            if (tax.calculationBase === 'totalHT') {
              base = facture.totalHT;
            } else {
              base = runningTotal;
            }
            montant = (base * tax.valeur) / 100;
          }
          
          taxes.push({
            taxId: tax.id,
            nom: tax.nom,
            base,
            montant
          });
          
          runningTotal += montant;
          totalTaxes += montant;
        }
      }
      
      facture.taxes = taxes;
      facture.totalTaxes = totalTaxes;
    }

    return factures.map(facture => ({
      ...facture,
      date: new Date(facture.date),
      dateEcheance: new Date(facture.dateEcheance),
      client: {
        id: facture.clientId,
        code: facture.clientCode,
        nom: facture.clientNom,
        adresse: facture.adresse,
        codePostal: facture.codePostal,
        ville: facture.ville,
        telephone: facture.telephone,
        email: facture.email,
        matriculeFiscal: facture.matriculeFiscal
      }
    }));
  } catch (error) {
    log.error('Error getting factures:', error);
    return [];
  }
});

// Stock movement tracking with better error handling
ipcMain.handle('track-stock-movement', async (event, movement) => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Get stock settings
    const settingsResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('stockSettings');
    const stockSettings = settingsResult ? JSON.parse(settingsResult.value) : { allowNegativeStock: true };
    
    // Check if negative stock is allowed
    if (!stockSettings.allowNegativeStock && movement.type === 'sortie') {
      const product = db.prepare('SELECT stock FROM produits WHERE id = ?').get(movement.produitId);
      if (product && (product.stock < movement.quantite)) {
        return { 
          success: false, 
          error: 'Stock insuffisant et stock négatif non autorisé',
          currentStock: product.stock
        };
      }
    }
    
    // Update product stock
    const updateStmt = db.prepare(`
      UPDATE produits 
      SET stock = stock ${movement.type === 'entree' ? '+' : '-'} ? 
      WHERE id = ?
    `);
    
    updateStmt.run(movement.quantite, movement.produitId);
    
    // Record movement
    const insertStmt = db.prepare(`
      INSERT INTO stock_movements 
      (id, produitId, produitNom, produitRef, type, quantite, date, source, sourceId, sourceNumero)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      movement.id,
      movement.produitId,
      movement.produitNom,
      movement.produitRef || null,
      movement.type,
      movement.quantite,
      movement.date,
      movement.source,
      movement.sourceId,
      movement.sourceNumero
    );
    
    return { success: true };
  } catch (error) {
    log.error('Error tracking stock movement:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-pdf', async (event, pdfData, filename) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });

    if (!result.canceled) {
      fs.writeFileSync(result.filePath, Buffer.from(pdfData));
      return { success: true, path: result.filePath };
    }
    return { success: false };
  } catch (error) {
    log.error('Error saving PDF:', error);
    return { success: false, error: error.message };
  }
});

// Add methods for checking for updates and getting app version
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { updateAvailable: false };
  }
  
  try {
    log.info('Manually checking for updates...');
    const result = await autoUpdater.checkForUpdates();
    const updateAvailable = !!result?.updateInfo;
    return { 
      updateAvailable, 
      version: updateAvailable ? result.updateInfo.version : undefined 
    };
  } catch (error) {
    log.error('Error checking for updates:', error);
    return { updateAvailable: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Database backup and restore
ipcMain.handle('backup-database', async (event) => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Wait for any active transactions to complete
    if (activeTransactions > 0) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (activeTransactions === 0) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
      });
    }
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Sauvegarder la base de données',
      defaultPath: `facturation_backup_${format(new Date(), 'yyyy-MM-dd')}.db`,
      filters: [
        { name: 'Database Files', extensions: ['db'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false };
    }
    
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'facturation.db');
    
    // Create a backup using better-sqlite3 backup API
    const backupDb = new Database(result.filePath, { fileMustExist: false });
    
    // Backup the database
    db.backup(backupDb)
      .then(() => {
        log.info('Database backup completed successfully');
        backupDb.close();
      })
      .catch(err => {
        log.error('Database backup failed:', err);
        backupDb.close();
        throw err;
      });
    
    return { success: true, path: result.filePath };
  } catch (error) {
    log.error('Error backing up database:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-database', async (event) => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Wait for any active transactions to complete
    if (activeTransactions > 0) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (activeTransactions === 0) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
      });
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurer la base de données',
      filters: [
        { name: 'Database Files', extensions: ['db'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    
    const backupPath = result.filePaths[0];
    
    // Confirm restoration
    const confirmResult = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Confirmer la restauration',
      message: 'Êtes-vous sûr de vouloir restaurer la base de données ?',
      detail: 'Cette opération remplacera toutes vos données actuelles. Cette action est irréversible.',
      buttons: ['Restaurer', 'Annuler'],
      cancelId: 1
    });
    
    if (confirmResult.response === 1) {
      return { success: false };
    }
    
    // Close current database connection
    db.close();
    
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'facturation.db');
    
    // Create a backup of the current database before restoring
    const currentBackupPath = path.join(userDataPath, `facturation_before_restore_${Date.now()}.db`);
    fs.copyFileSync(dbPath, currentBackupPath);
    
    // Copy the backup file to the database location
    fs.copyFileSync(backupPath, dbPath);
    
    // Reopen the database
    db = new Database(dbPath, { verbose: log.info });
    
    // Enable foreign keys and WAL mode
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000'); // Set busy timeout to 5 seconds
    
    return { success: true };
  } catch (error) {
    log.error('Error restoring database:', error);
    return { success: false, error: error.message };
  }
});

// Activation system
ipcMain.handle('activate-app', async (event, activationCode) => {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Validate activation code
    if (!/^\d{15}$/.test(activationCode)) {
      return { success: false, error: 'Code d\'activation invalide' };
    }
    
    // Calculate sum of digits
    const sum = activationCode.split('').reduce((acc, digit) => acc + parseInt(digit), 0);
    
    // Check if sum equals 75 (full activation) or 60 (demo activation)
    if (sum !== 75 && sum !== 60) {
      return { success: false, error: 'Code d\'activation invalide' };
    }
    
    const isDemo = sum === 60;
    const isFull = sum === 75;
    const activationDate = new Date().toISOString();
    const expirationDate = isDemo ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    
    // Save activation status
    const activationData = {
      activated: true,
      isDemo: isDemo,
      isFull: isFull,
      activationCode: activationCode,
      activationDate: activationDate,
      expirationDate: expirationDate
    };
    
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'activation', 
      JSON.stringify(activationData)
    );
    
    isActivated = true;
    
    return { 
      success: true, 
      isFull: isFull,
      isDemo: isDemo,
      expirationDate: expirationDate
    };
  } catch (error) {
    log.error('Error activating app:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-activation', () => {
  try {
    if (!db) {
      return { activated: false };
    }
    
    const activationResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('activation');
    
    if (!activationResult) {
      return { activated: false };
    }
    
    const activationData = JSON.parse(activationResult.value);
    
    // Check if it's a demo version and if it has expired
    if (activationData.isDemo && activationData.expirationDate) {
      const now = new Date();
      const expiration = new Date(activationData.expirationDate);
      
      if (now > expiration) {
        log.info('Demo version has expired, deactivating...');
        // Demo has expired, deactivate
        const expiredActivationData = {
          ...activationData,
          activated: false,
          expired: true
        };
        
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'activation', 
          JSON.stringify(expiredActivationData)
        );
        
        isActivated = false;
        
        return { 
          activated: false, 
          isDemo: true, 
          expired: true,
          expirationDate: activationData.expirationDate
        };
      }
      
      // Demo is still valid
      return { 
        activated: true, 
        isDemo: true, 
        expirationDate: activationData.expirationDate,
        daysRemaining: Math.ceil((expiration - now) / (1000 * 60 * 60 * 24))
      };
    }
    
    // Full activation
    return { 
      activated: activationData.activated && !activationData.isDemo,
      isFull: activationData.isFull || false,
      isDemo: false
    };
  } catch (error) {
    log.error('Error checking activation:', error);
    return { activated: false };
  }
});

ipcMain.handle('quit-app', () => {
  app.quit();
});