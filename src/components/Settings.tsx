import React, { useState, useEffect } from 'react';
import { Save, FileText, Receipt, Truck, ShoppingCart, Settings as SettingsIcon, Calculator, Palette, Upload, Eye, RefreshCw, Info, Database, Download, Upload as UploadIcon } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import TaxConfiguration from './TaxConfiguration';
import DocumentTemplateSettings from './DocumentTemplateSettings';
import { Tax } from '../types';

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

interface InvoiceSettings {
  useEcheanceDate: boolean;
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'numbering' | 'taxes' | 'templates' | 'invoice' | 'updates' | 'backup'>('company');
  const [settings, setSettings] = useState<NumberingSettings>({
    factures: { prefix: 'FA', startNumber: 1, currentNumber: 1, includeYear: true },
    devis: { prefix: 'DV', startNumber: 1, currentNumber: 1, includeYear: true },
    bonsLivraison: { prefix: 'BL', startNumber: 1, currentNumber: 1, includeYear: true },
    commandesFournisseur: { prefix: 'CF', startNumber: 1, currentNumber: 1, includeYear: true }
  });

  const [companyInfo, setCompanyInfo] = useState({
    nom: 'Votre Entreprise',
    adresse: '123 Avenue de la République',
    codePostal: '1000',
    ville: 'Tunis',
    pays: 'Tunisie',
    telephone: '+216 71 123 456',
    email: 'contact@entreprise.tn',
    siret: '',
    tva: '',
    matriculeFiscal: ''
  });

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    useEcheanceDate: true
  });

  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  
  // Backup and restore states
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const { query, isReady, backupDatabase, restoreDatabase } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadSettings();
      if (window.electronAPI?.getAppVersion) {
        window.electronAPI.getAppVersion().then((version: string) => {
          setAppVersion(version);
        }).catch((err: any) => {
          console.error('Error getting app version:', err);
        });
      }
    }
  }, [isReady]);

  const loadSettings = async () => {
    if (!isReady) return;

    try {
      // Create settings table if it doesn't exist
      await query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // Load numbering settings
      const numberingResult = await query('SELECT value FROM settings WHERE key = ?', ['numbering']);
      if (numberingResult.length > 0) {
        const loadedSettings = JSON.parse(numberingResult[0].value);
        // Ensure backward compatibility - add includeYear if missing
        Object.keys(loadedSettings).forEach(key => {
          if (loadedSettings[key] && typeof loadedSettings[key].includeYear === 'undefined') {
            loadedSettings[key].includeYear = true; // Default to true for existing settings
          }
        });
        setSettings(loadedSettings);
      }

      // Load company info
      const companyResult = await query('SELECT value FROM settings WHERE key = ?', ['company']);
      if (companyResult.length > 0) {
        setCompanyInfo(JSON.parse(companyResult[0].value));
      }

      // Load invoice settings
      const invoiceSettingsResult = await query('SELECT value FROM settings WHERE key = ?', ['invoiceSettings']);
      if (invoiceSettingsResult.length > 0) {
        setInvoiceSettings(JSON.parse(invoiceSettingsResult[0].value));
      } else {
        // Set default and save
        const defaultInvoiceSettings = { useEcheanceDate: true };
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['invoiceSettings', JSON.stringify(defaultInvoiceSettings)]
        );
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!isReady) return;

    try {
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['numbering', JSON.stringify(settings)]
      );

      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['company', JSON.stringify(companyInfo)]
      );

      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['invoiceSettings', JSON.stringify(invoiceSettings)]
      );

      alert('Paramètres sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    }
  };

  const handleNumberingChange = (docType: keyof NumberingSettings, field: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [field]: value
      }
    }));
  };

  const handleCompanyChange = (field: string, value: string) => {
    setCompanyInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInvoiceSettingsChange = (field: string, value: boolean) => {
    setInvoiceSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetCurrentNumbers = async (docType: keyof NumberingSettings) => {
    if (window.confirm(`Êtes-vous sûr de vouloir remettre à zéro la numérotation des ${docType} ?`)) {
      setSettings(prev => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          currentNumber: prev[docType].startNumber
        }
      }));
    }
  };

  const checkForUpdates = async () => {
    if (window.electronAPI?.checkForUpdates) {
      setCheckingForUpdates(true);
      setUpdateMessage(null);
      
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (result.updateAvailable) {
          setUpdateMessage(`Une mise à jour (v${result.version}) est disponible et sera installée automatiquement.`);
        } else {
          setUpdateMessage('Vous utilisez déjà la dernière version de l\'application.');
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
        setUpdateMessage('Erreur lors de la vérification des mises à jour. Veuillez réessayer plus tard.');
      } finally {
        setCheckingForUpdates(false);
      }
    } else {
      setUpdateMessage('La vérification des mises à jour n\'est pas disponible pour le moment.');
    }
  };

  const handleBackupDatabase = async () => {
    setBackupInProgress(true);
    setBackupMessage(null);
    
    try {
      const result = await backupDatabase();
      if (result.success) {
        setBackupMessage(`Sauvegarde réussie. Fichier enregistré: ${result.path}`);
      } else {
        setBackupMessage(`Erreur lors de la sauvegarde: ${result.error || 'Opération annulée'}`);
      }
    } catch (error: any) {
      console.error('Error backing up database:', error);
      setBackupMessage(`Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleRestoreDatabase = async () => {
    // Show warning
    if (!window.confirm('ATTENTION: La restauration remplacera toutes vos données actuelles. Cette action est irréversible. Voulez-vous continuer?')) {
      return;
    }
    
    setRestoreInProgress(true);
    setBackupMessage(null);
    
    try {
      const result = await restoreDatabase();
      if (result.success) {
        setBackupMessage('Restauration réussie. L\'application va redémarrer.');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setBackupMessage(`Erreur lors de la restauration: ${result.error || 'Opération annulée'}`);
      }
    } catch (error: any) {
      console.error('Error restoring database:', error);
      setBackupMessage(`Erreur lors de la restauration: ${error.message}`);
    } finally {
      setRestoreInProgress(false);
    }
  };

  const generatePreviewNumber = (docType: keyof NumberingSettings) => {
    const config = settings[docType];
    const year = new Date().getFullYear();
    const number = String(config.currentNumber).padStart(3, '0');
    
    if (config.includeYear) {
      return `${config.prefix}-${year}-${number}`;
    } else {
      return `${config.prefix}-${number}`;
    }
  };

  const documentTypes = [
    { key: 'factures' as keyof NumberingSettings, label: 'Factures', icon: Receipt, color: 'text-blue-600' },
    { key: 'devis' as keyof NumberingSettings, label: 'Devis', icon: FileText, color: 'text-green-600' },
    { key: 'bonsLivraison' as keyof NumberingSettings, label: 'Bons de livraison', icon: Truck, color: 'text-orange-600' },
    { key: 'commandesFournisseur' as keyof NumberingSettings, label: 'Commandes fournisseur', icon: ShoppingCart, color: 'text-purple-600' }
  ];

  const tabs = [
    { id: 'company', label: 'Entreprise', icon: SettingsIcon },
    { id: 'numbering', label: 'Numérotation', icon: FileText },
    { id: 'invoice', label: 'Factures', icon: Receipt },
    { id: 'taxes', label: 'Taxes', icon: Calculator },
    { id: 'templates', label: 'Modèles & Design', icon: Palette },
    { id: 'backup', label: 'Sauvegarde', icon: Database },
    { id: 'updates', label: 'Mises à jour', icon: RefreshCw }
  ];

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg p-6 text-white">
        <div className="flex items-center">
          <SettingsIcon className="w-8 h-8 mr-3" />
          <div>
            <h2 className="text-2xl font-bold">Paramètres</h2>
            <p className="text-gray-200">Configuration de l'application, numérotation des documents et personnalisation</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Informations de l'entreprise</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={companyInfo.nom}
                onChange={(e) => handleCompanyChange('nom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                value={companyInfo.adresse}
                onChange={(e) => handleCompanyChange('adresse', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Code postal
              </label>
              <input
                type="text"
                value={companyInfo.codePostal}
                onChange={(e) => handleCompanyChange('codePostal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ville
              </label>
              <input
                type="text"
                value={companyInfo.ville}
                onChange={(e) => handleCompanyChange('ville', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pays
              </label>
              <input
                type="text"
                value={companyInfo.pays}
                onChange={(e) => handleCompanyChange('pays', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                value={companyInfo.telephone}
                onChange={(e) => handleCompanyChange('telephone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={companyInfo.email}
                onChange={(e) => handleCompanyChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SIRET
              </label>
              <input
                type="text"
                value={companyInfo.siret}
                onChange={(e) => handleCompanyChange('siret', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                N° TVA
              </label>
              <input
                type="text"
                value={companyInfo.tva}
                onChange={(e) => handleCompanyChange('tva', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Matricule Fiscal
              </label>
              <input
                type="text"
                value={companyInfo.matriculeFiscal}
                onChange={(e) => handleCompanyChange('matriculeFiscal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'numbering' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Numérotation des documents</h3>
          
          <div className="space-y-6">
            {documentTypes.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <Icon className={`w-5 h-5 mr-2 ${color}`} />
                  <h4 className="text-md font-medium text-gray-900">{label}</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Préfixe
                    </label>
                    <input
                      type="text"
                      value={settings[key].prefix}
                      onChange={(e) => handleNumberingChange(key, 'prefix', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="FA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro de départ
                    </label>
                    <input
                      type="number"
                      value={settings[key].startNumber}
                      onChange={(e) => handleNumberingChange(key, 'startNumber', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro actuel
                    </label>
                    <input
                      type="number"
                      value={settings[key].currentNumber}
                      onChange={(e) => handleNumberingChange(key, 'currentNumber', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Inclure l'année
                    </label>
                    <div className="flex items-center h-10">
                      <input
                        type="checkbox"
                        checked={settings[key].includeYear}
                        onChange={(e) => handleNumberingChange(key, 'includeYear', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-600">
                        {settings[key].includeYear ? 'Avec année' : 'Sans année'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => resetCurrentNumbers(key)}
                      className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Remettre à zéro
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        <strong>Aperçu du prochain numéro:</strong>
                      </p>
                      <p className="text-lg font-mono font-bold text-blue-600">
                        {generatePreviewNumber(key)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Format:</p>
                      <p className="text-sm font-medium text-gray-700">
                        {settings[key].includeYear 
                          ? `${settings[key].prefix}-ANNÉE-NNN`
                          : `${settings[key].prefix}-NNN`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Global Settings */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-md font-medium text-blue-900 mb-3">Options globales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  const newSettings = { ...settings };
                  Object.keys(newSettings).forEach(key => {
                    newSettings[key as keyof NumberingSettings].includeYear = true;
                  });
                  setSettings(newSettings);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Activer l'année pour tous
              </button>
              <button
                onClick={() => {
                  const newSettings = { ...settings };
                  Object.keys(newSettings).forEach(key => {
                    newSettings[key as keyof NumberingSettings].includeYear = false;
                  });
                  setSettings(newSettings);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Désactiver l'année pour tous
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoice' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres des factures</h3>
          
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <Receipt className="w-5 h-5 mr-2 text-blue-600" />
                <h4 className="text-md font-medium text-gray-900">Options des factures</h4>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <label className="font-medium text-gray-900">Utiliser la date d'échéance</label>
                    <p className="text-sm text-gray-500 mt-1">
                      Affiche et utilise la date d'échéance dans les factures
                    </p>
                  </div>
                  <div className="relative inline-block w-12 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="toggle-echeance"
                      checked={invoiceSettings.useEcheanceDate}
                      onChange={() => handleInvoiceSettingsChange('useEcheanceDate', !invoiceSettings.useEcheanceDate)}
                      className="sr-only"
                    />
                    <label
                      htmlFor="toggle-echeance"
                      className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                        invoiceSettings.useEcheanceDate ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                          invoiceSettings.useEcheanceDate ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <div className="flex items-start">
                  <Receipt className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-700">
                      <strong>Date d'échéance :</strong> {invoiceSettings.useEcheanceDate ? 'Activée' : 'Désactivée'}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {invoiceSettings.useEcheanceDate 
                        ? "La date d'échéance sera affichée sur les factures et utilisée pour le suivi des paiements."
                        : "La date d'échéance ne sera pas utilisée dans les factures."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <Receipt className="w-5 h-5 mr-2 text-red-600" />
                <h4 className="text-md font-medium text-gray-900">Avoirs</h4>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-700">
                  Les avoirs sont des factures négatives qui annulent ou remboursent partiellement une facture existante.
                  Vous pouvez créer un avoir à partir d'une facture existante en utilisant le bouton "Créer un avoir" dans la liste des factures.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  Les avoirs utilisent le même format de numérotation que les factures, mais avec un préfixe "AV" ajouté automatiquement.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'taxes' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <TaxConfiguration onTaxesChange={setTaxes} />
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <DocumentTemplateSettings />
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Sauvegarde et restauration</h3>
          
          <div className="space-y-6">
            {/* Backup Section */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Download className="w-5 h-5 mr-2 text-blue-600" />
                <h4 className="text-md font-medium text-gray-900">Sauvegarder la base de données</h4>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Créez une sauvegarde complète de toutes vos données. Vous pourrez restaurer cette sauvegarde ultérieurement si nécessaire.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-700">
                      <strong>Important:</strong> Sauvegardez régulièrement vos données pour éviter toute perte en cas de problème.
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      La sauvegarde contient toutes vos données: clients, produits, factures, devis, etc.
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleBackupDatabase}
                disabled={backupInProgress}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {backupInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sauvegarde en cours...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Sauvegarder maintenant
                  </>
                )}
              </button>
            </div>
            
            {/* Restore Section */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <UploadIcon className="w-5 h-5 mr-2 text-green-600" />
                <h4 className="text-md font-medium text-gray-900">Restaurer une sauvegarde</h4>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Restaurez une sauvegarde précédemment créée. Attention: cette action remplacera toutes vos données actuelles.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-700">
                      <strong>Attention:</strong> La restauration remplacera toutes vos données actuelles. Cette action est irréversible.
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      Assurez-vous de sauvegarder vos données actuelles avant de procéder à une restauration.
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleRestoreDatabase}
                disabled={restoreInProgress}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoreInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Restauration en cours...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4 mr-2" />
                    Restaurer une sauvegarde
                  </>
                )}
              </button>
            </div>
            
            {/* Status Message */}
            {backupMessage && (
              <div className={`p-4 rounded-lg ${backupMessage.includes('réussie') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {backupMessage}
              </div>
            )}
            
            {/* Tips */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Info className="w-5 h-5 mr-2 text-gray-600" />
                <h4 className="text-md font-medium text-gray-900">Conseils pour la sauvegarde</h4>
              </div>
              
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  1. Effectuez des sauvegardes régulières, idéalement après chaque session de travail importante.
                </p>
                <p>
                  2. Stockez vos sauvegardes dans plusieurs endroits (disque dur externe, cloud, etc.).
                </p>
                <p>
                  3. Nommez vos sauvegardes avec la date pour faciliter leur identification.
                </p>
                <p>
                  4. Testez régulièrement la restauration pour vous assurer que vos sauvegardes fonctionnent.
                </p>
                <p className="text-blue-600 font-medium mt-2">
                  La sauvegarde est la meilleure protection contre la perte de données.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'updates' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Mises à jour de l'application</h3>
          
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start">
                <Info className="w-6 h-6 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-md font-medium text-blue-900">Informations sur la version</h4>
                  <p className="text-sm text-blue-700 mt-2">
                    Version actuelle: <span className="font-semibold">{appVersion}</span>
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    L'application vérifie automatiquement les mises à jour au démarrage et les installe automatiquement.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <RefreshCw className="w-5 h-5 mr-2 text-green-600" />
                <h4 className="text-md font-medium text-gray-900">Vérifier les mises à jour</h4>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Vous pouvez vérifier manuellement si une nouvelle version de l'application est disponible.
              </p>
              
              <button
                onClick={checkForUpdates}
                disabled={checkingForUpdates}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingForUpdates ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Vérification en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Vérifier les mises à jour
                  </>
                )}
              </button>
              
              {updateMessage && (
                <div className={`mt-4 p-4 rounded-md ${updateMessage.includes('erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {updateMessage}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Info className="w-5 h-5 mr-2 text-gray-600" />
                <h4 className="text-md font-medium text-gray-900">Comment fonctionnent les mises à jour</h4>
              </div>
              
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  1. L'application vérifie automatiquement les mises à jour au démarrage.
                </p>
                <p>
                  2. Si une mise à jour est disponible, elle sera téléchargée en arrière-plan.
                </p>
                <p>
                  3. Une fois téléchargée, vous serez invité à redémarrer l'application pour installer la mise à jour.
                </p>
                <p>
                  4. Après le redémarrage, vous utiliserez automatiquement la nouvelle version.
                </p>
                <p className="text-blue-600 font-medium mt-2">
                  Vos données sont conservées lors des mises à jour. Aucune information ne sera perdue.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button - Only show for company, numbering, and invoice tabs */}
      {(activeTab === 'company' || activeTab === 'numbering' || activeTab === 'invoice') && (
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>Sauvegarder les paramètres</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Settings;