import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Building2, FileText, Calculator, Palette, Shield, Eye, EyeOff, Download, Upload, RefreshCw, CheckCircle } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import TaxConfiguration from './TaxConfiguration';
import DocumentTemplateSettings from './DocumentTemplateSettings';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'numbering' | 'taxes' | 'templates' | 'security' | 'backup'>('company');
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
    matriculeFiscal: 'MF123456789'
  });

  const [numberingSettings, setNumberingSettings] = useState({
    factures: { prefix: 'FA', startNumber: 1, currentNumber: 1, includeYear: true },
    devis: { prefix: 'DV', startNumber: 1, currentNumber: 1, includeYear: true },
    bonsLivraison: { prefix: 'BL', startNumber: 1, currentNumber: 1, includeYear: true },
    commandesFournisseur: { prefix: 'CF', startNumber: 1, currentNumber: 1, includeYear: true }
  });

  const [invoiceSettings, setInvoiceSettings] = useState({
    useEcheanceDate: true
  });

  const [passwordSettings, setPasswordSettings] = useState({
    enabled: false,
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { query, backupDatabase, restoreDatabase, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadSettings();
    }
  }, [isReady]);

  const loadSettings = async () => {
    if (!isReady) return;
    
    try {
      setIsLoading(true);
      
      if (isElectron) {
        // Load company info
        const companyResult = await query('SELECT value FROM settings WHERE key = ?', ['company']);
        if (companyResult.length > 0) {
          setCompanyInfo(JSON.parse(companyResult[0].value));
        }

        // Load numbering settings
        const numberingResult = await query('SELECT value FROM settings WHERE key = ?', ['numbering']);
        if (numberingResult.length > 0) {
          setNumberingSettings(JSON.parse(numberingResult[0].value));
        }

        // Load invoice settings
        const invoiceResult = await query('SELECT value FROM settings WHERE key = ?', ['invoiceSettings']);
        if (invoiceResult.length > 0) {
          setInvoiceSettings(JSON.parse(invoiceResult[0].value));
        }

        // Load password settings
        const passwordResult = await query('SELECT value FROM settings WHERE key = ?', ['appPassword']);
        if (passwordResult.length > 0) {
          setPasswordSettings({
            enabled: true,
            password: passwordResult[0].value
          });
        }
      } else {
        // Load from localStorage for web version
        const savedCompany = localStorage.getItem('companyInfo');
        if (savedCompany) {
          setCompanyInfo(JSON.parse(savedCompany));
        }

        const savedNumbering = localStorage.getItem('numberingSettings');
        if (savedNumbering) {
          setNumberingSettings(JSON.parse(savedNumbering));
        }

        const savedInvoice = localStorage.getItem('invoiceSettings');
        if (savedInvoice) {
          setInvoiceSettings(JSON.parse(savedInvoice));
        }

        const savedPassword = localStorage.getItem('appPassword');
        if (savedPassword) {
          setPasswordSettings({
            enabled: true,
            password: savedPassword
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!isReady) return;
    
    setIsSaving(true);
    try {
      if (isElectron) {
        await query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['company', JSON.stringify(companyInfo)]);
        await query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['numbering', JSON.stringify(numberingSettings)]);
        await query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['invoiceSettings', JSON.stringify(invoiceSettings)]);
        
        if (passwordSettings.enabled && passwordSettings.password) {
          await query('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['appPassword', passwordSettings.password]);
        } else {
          await query('DELETE FROM settings WHERE key = ?', ['appPassword']);
        }
      } else {
        localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
        localStorage.setItem('numberingSettings', JSON.stringify(numberingSettings));
        localStorage.setItem('invoiceSettings', JSON.stringify(invoiceSettings));
        
        if (passwordSettings.enabled && passwordSettings.password) {
          localStorage.setItem('appPassword', passwordSettings.password);
        } else {
          localStorage.removeItem('appPassword');
        }
      }
      
      alert('Paramètres sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!isElectron) {
      alert('La sauvegarde n\'est disponible qu\'en mode bureau');
      return;
    }

    try {
      const result = await backupDatabase();
      if (result.success) {
        alert(`Base de données sauvegardée avec succès dans :\n${result.path}`);
      } else {
        alert('Erreur lors de la sauvegarde : ' + (result.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('Error backing up database:', error);
      alert('Erreur lors de la sauvegarde de la base de données');
    }
  };

  const handleRestore = async () => {
    if (!isElectron) {
      alert('La restauration n\'est disponible qu\'en mode bureau');
      return;
    }

    try {
      const result = await restoreDatabase();
      if (result.success) {
        alert('Base de données restaurée avec succès. L\'application va redémarrer.');
        window.location.reload();
      } else {
        alert('Erreur lors de la restauration : ' + (result.error || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('Error restoring database:', error);
      alert('Erreur lors de la restauration de la base de données');
    }
  };

  const tabs = [
    { id: 'company', label: 'Entreprise', icon: Building2 },
    { id: 'numbering', label: 'Numérotation', icon: FileText },
    { id: 'taxes', label: 'Taxes', icon: Calculator },
    { id: 'templates', label: 'Modèles', icon: Palette },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'backup', label: 'Sauvegarde', icon: Download }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Paramètres</h2>
          <p className="text-gray-600">Configurez votre application</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{isSaving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
        </button>
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
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {/* Company Tab */}
        {activeTab === 'company' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Informations de l'entreprise</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  value={companyInfo.nom}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={companyInfo.email}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={companyInfo.adresse}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, adresse: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code postal
                </label>
                <input
                  type="text"
                  value={companyInfo.codePostal}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, codePostal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={companyInfo.ville}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, ville: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={companyInfo.telephone}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, telephone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SIRET
                </label>
                <input
                  type="text"
                  value={companyInfo.siret}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, siret: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Matricule Fiscal
                </label>
                <input
                  type="text"
                  value={companyInfo.matriculeFiscal}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, matriculeFiscal: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro TVA
                </label>
                <input
                  type="text"
                  value={companyInfo.tva}
                  onChange={(e) => setCompanyInfo(prev => ({ ...prev, tva: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Numbering Tab */}
        {activeTab === 'numbering' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Numérotation des documents</h3>
            
            <div className="space-y-6">
              {Object.entries(numberingSettings).map(([key, settings]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3 capitalize">
                    {key === 'factures' ? 'Factures' :
                     key === 'devis' ? 'Devis' :
                     key === 'bonsLivraison' ? 'Bons de livraison' :
                     'Commandes fournisseur'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Préfixe
                      </label>
                      <input
                        type="text"
                        value={settings.prefix}
                        onChange={(e) => setNumberingSettings(prev => ({
                          ...prev,
                          [key]: { ...prev[key as keyof typeof prev], prefix: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Numéro de départ
                      </label>
                      <input
                        type="number"
                        value={settings.startNumber}
                        onChange={(e) => setNumberingSettings(prev => ({
                          ...prev,
                          [key]: { ...prev[key as keyof typeof prev], startNumber: parseInt(e.target.value) || 1 }
                        }))}
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
                        value={settings.currentNumber}
                        onChange={(e) => setNumberingSettings(prev => ({
                          ...prev,
                          [key]: { ...prev[key as keyof typeof prev], currentNumber: parseInt(e.target.value) || 1 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.includeYear}
                        onChange={(e) => setNumberingSettings(prev => ({
                          ...prev,
                          [key]: { ...prev[key as keyof typeof prev], includeYear: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Inclure l'année dans le numéro</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Exemple: {settings.includeYear 
                        ? `${settings.prefix}-${new Date().getFullYear()}-${String(settings.currentNumber).padStart(3, '0')}`
                        : `${settings.prefix}-${String(settings.currentNumber).padStart(3, '0')}`
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Options des factures</h4>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={invoiceSettings.useEcheanceDate}
                  onChange={(e) => setInvoiceSettings(prev => ({ ...prev, useEcheanceDate: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Utiliser la date d'échéance</span>
              </label>
            </div>
          </div>
        )}

        {/* Taxes Tab */}
        {activeTab === 'taxes' && (
          <TaxConfiguration />
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <DocumentTemplateSettings />
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Sécurité de l'application</h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Protection par mot de passe</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Protégez l'accès à votre application avec un mot de passe. 
                    Ce mot de passe sera demandé à chaque démarrage de l'application.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900">Activer la protection par mot de passe</label>
                  <p className="text-sm text-gray-500 mt-1">
                    Demander un mot de passe au démarrage de l'application
                  </p>
                </div>
                <div className="relative inline-block w-12 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-password"
                    checked={passwordSettings.enabled}
                    onChange={(e) => setPasswordSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-password"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      passwordSettings.enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        passwordSettings.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              {passwordSettings.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordSettings.password}
                      onChange={(e) => setPasswordSettings(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      placeholder="Entrez votre mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Ce mot de passe sera demandé à chaque ouverture de l'application
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Sauvegarde et restauration</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Download className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Sauvegarde des données</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Créez une sauvegarde de toutes vos données (clients, produits, factures, etc.) 
                    pour les protéger contre la perte de données.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="bg-green-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <Download className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">Sauvegarder</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Créer une copie de sauvegarde de votre base de données
                  </p>
                  <button
                    onClick={handleBackup}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    disabled={!isElectron}
                  >
                    Créer une sauvegarde
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="bg-orange-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-orange-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">Restaurer</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Restaurer vos données à partir d'une sauvegarde
                  </p>
                  <button
                    onClick={handleRestore}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                    disabled={!isElectron}
                  >
                    Restaurer une sauvegarde
                  </button>
                </div>
              </div>
            </div>

            {!isElectron && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <RefreshCw className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Mode web</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Les fonctionnalités de sauvegarde et restauration ne sont disponibles qu'en mode bureau.
                      En mode web, vos données sont stockées localement dans votre navigateur.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900">Important</h4>
                  <ul className="text-sm text-red-700 mt-1 space-y-1">
                    <li>• Effectuez des sauvegardes régulières de vos données</li>
                    <li>• Stockez vos sauvegardes dans un lieu sûr</li>
                    <li>• La restauration remplacera toutes vos données actuelles</li>
                    <li>• Testez vos sauvegardes périodiquement</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;