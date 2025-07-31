import React, { useState, useEffect } from 'react';
import { Save, Building, FileText, Receipt, Shield, Palette, Database, Download, Upload, Key, Lock, Eye, EyeOff, Calculator, Plus, Trash2, Edit, ArrowUp, ArrowDown, ToggleLeft, ToggleRight } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import DocumentTemplateSettings from './DocumentTemplateSettings';
import TaxConfiguration from './TaxConfiguration';

interface CompanyInfo {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  siret: string;
  tva: string;
  matriculeFiscal: string;
}

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

interface AutoTvaSettings {
  enabled: boolean;
  calculationBase: 'totalHT' | 'totalHTWithFirstTax';
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'numbering' | 'invoices' | 'taxes' | 'security' | 'templates' | 'backup'>('company');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    pays: 'Tunisie',
    telephone: '',
    email: '',
    siret: '',
    tva: '',
    matriculeFiscal: ''
  });

  const [numberingSettings, setNumberingSettings] = useState<NumberingSettings>({
    factures: { prefix: 'FA', startNumber: 1, currentNumber: 1, includeYear: true },
    devis: { prefix: 'DV', startNumber: 1, currentNumber: 1, includeYear: true },
    bonsLivraison: { prefix: 'BL', startNumber: 1, currentNumber: 1, includeYear: true },
    commandesFournisseur: { prefix: 'CF', startNumber: 1, currentNumber: 1, includeYear: true }
  });

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    useEcheanceDate: true
  });

  const [autoTvaSettings, setAutoTvaSettings] = useState<AutoTvaSettings>({
    enabled: false,
    calculationBase: 'totalHT'
  });

  const [appPassword, setAppPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { query, isElectron, backupDatabase, restoreDatabase, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadSettings();
    }
  }, [isReady]);

  const loadSettings = async () => {
    if (!isReady) return;
    
    try {
      // Load company info
      if (isElectron) {
        const companyResult = await query('SELECT value FROM settings WHERE key = ?', ['company']);
        if (companyResult.length > 0) {
          setCompanyInfo(JSON.parse(companyResult[0].value));
        }

        // Load numbering settings
        const numberingResult = await query('SELECT value FROM settings WHERE key = ?', ['numbering']);
        if (numberingResult.length > 0) {
          const loadedSettings = JSON.parse(numberingResult[0].value);
          // Ensure backward compatibility - add includeYear if missing
          Object.keys(loadedSettings).forEach(key => {
            if (loadedSettings[key] && typeof loadedSettings[key].includeYear === 'undefined') {
              loadedSettings[key].includeYear = true;
            }
          });
          setNumberingSettings(loadedSettings);
        }

        // Load invoice settings
        const invoiceResult = await query('SELECT value FROM settings WHERE key = ?', ['invoiceSettings']);
        if (invoiceResult.length > 0) {
          setInvoiceSettings(JSON.parse(invoiceResult[0].value));
        }

        // Load auto TVA settings
        const autoTvaResult = await query('SELECT value FROM settings WHERE key = ?', ['autoTvaSettings']);
        if (autoTvaResult.length > 0) {
          setAutoTvaSettings(JSON.parse(autoTvaResult[0].value));
        }

        // Load password
        const passwordResult = await query('SELECT value FROM settings WHERE key = ?', ['appPassword']);
        if (passwordResult.length > 0) {
          setAppPassword(passwordResult[0].value);
        }
      } else {
        // Load from localStorage for web version
        const savedCompany = localStorage.getItem('company');
        if (savedCompany) {
          setCompanyInfo(JSON.parse(savedCompany));
        }

        const savedNumbering = localStorage.getItem('numbering');
        if (savedNumbering) {
          setNumberingSettings(JSON.parse(savedNumbering));
        }

        const savedInvoice = localStorage.getItem('invoiceSettings');
        if (savedInvoice) {
          setInvoiceSettings(JSON.parse(savedInvoice));
        }

        const savedAutoTva = localStorage.getItem('autoTvaSettings');
        if (savedAutoTva) {
          setAutoTvaSettings(JSON.parse(savedAutoTva));
        }

        const savedPassword = localStorage.getItem('appPassword');
        if (savedPassword) {
          setAppPassword(savedPassword);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveCompanyInfo = async () => {
    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['company', JSON.stringify(companyInfo)]
        );
      } else {
        localStorage.setItem('company', JSON.stringify(companyInfo));
      }
      alert('Informations de l\'entreprise sauvegardées avec succès');
    } catch (error) {
      console.error('Error saving company info:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const saveNumberingSettings = async () => {
    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['numbering', JSON.stringify(numberingSettings)]
        );
      } else {
        localStorage.setItem('numbering', JSON.stringify(numberingSettings));
      }
      alert('Paramètres de numérotation sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving numbering settings:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const saveInvoiceSettings = async () => {
    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['invoiceSettings', JSON.stringify(invoiceSettings)]
        );
      } else {
        localStorage.setItem('invoiceSettings', JSON.stringify(invoiceSettings));
      }
      alert('Paramètres de facturation sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving invoice settings:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const saveAutoTvaSettings = async () => {
    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['autoTvaSettings', JSON.stringify(autoTvaSettings)]
        );
      } else {
        localStorage.setItem('autoTvaSettings', JSON.stringify(autoTvaSettings));
      }
      alert('Paramètres de TVA automatique sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving auto TVA settings:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const savePassword = async () => {
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }

    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['appPassword', newPassword]
        );
      } else {
        localStorage.setItem('appPassword', newPassword);
      }
      
      setAppPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      alert('Mot de passe sauvegardé avec succès');
    } catch (error) {
      console.error('Error saving password:', error);
      alert('Erreur lors de la sauvegarde du mot de passe');
    }
  };

  const removePassword = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer la protection par mot de passe ?')) {
      try {
        if (isElectron) {
          await query('DELETE FROM settings WHERE key = ?', ['appPassword']);
        } else {
          localStorage.removeItem('appPassword');
        }
        
        setAppPassword('');
        setNewPassword('');
        setConfirmPassword('');
        alert('Protection par mot de passe supprimée');
      } catch (error) {
        console.error('Error removing password:', error);
        alert('Erreur lors de la suppression du mot de passe');
      }
    }
  };

  const handleBackup = async () => {
    try {
      const result = await backupDatabase();
      if (result.success) {
        alert(`Sauvegarde créée avec succès :\n${result.path}`);
      } else {
        alert(`Erreur lors de la sauvegarde : ${result.error}`);
      }
    } catch (error) {
      console.error('Error during backup:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleRestore = async () => {
    try {
      const result = await restoreDatabase();
      if (result.success) {
        alert('Base de données restaurée avec succès. L\'application va redémarrer.');
        window.location.reload();
      } else {
        alert(`Erreur lors de la restauration : ${result.error}`);
      }
    } catch (error) {
      console.error('Error during restore:', error);
      alert('Erreur lors de la restauration');
    }
  };

  const tabs = [
    { id: 'company', label: 'Entreprise', icon: Building },
    { id: 'numbering', label: 'Numérotation', icon: FileText },
    { id: 'invoices', label: 'Factures', icon: Receipt },
    { id: 'taxes', label: 'Taxes', icon: Calculator },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'templates', label: 'Modèles & Design', icon: Palette },
    { id: 'backup', label: 'Sauvegarde', icon: Database }
  ];

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initialisation de la base de données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Paramètres</h2>
        <p className="text-gray-300">Configuration de l'application, numérotation des documents et personnalisation</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 ${
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

        <div className="p-6">
          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de l'entreprise</h3>
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
                      Matricule Fiscal
                    </label>
                    <input
                      type="text"
                      value={companyInfo.matriculeFiscal}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, matriculeFiscal: e.target.value }))}
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
                      Pays
                    </label>
                    <input
                      type="text"
                      value={companyInfo.pays}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, pays: e.target.value }))}
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
                      Email
                    </label>
                    <input
                      type="email"
                      value={companyInfo.email}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, email: e.target.value }))}
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

                <div className="mt-6">
                  <button
                    onClick={saveCompanyInfo}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder les informations
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Numbering Tab */}
          {activeTab === 'numbering' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Numérotation des documents</h3>
                
                {Object.entries(numberingSettings).map(([docType, settings]) => (
                  <div key={docType} className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-gray-900 mb-3 capitalize">
                      {docType === 'factures' ? 'Factures' :
                       docType === 'devis' ? 'Devis' :
                       docType === 'bonsLivraison' ? 'Bons de livraison' :
                       'Commandes fournisseur'}
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Préfixe
                        </label>
                        <input
                          type="text"
                          value={settings.prefix}
                          onChange={(e) => setNumberingSettings(prev => ({
                            ...prev,
                            [docType]: { ...prev[docType as keyof NumberingSettings], prefix: e.target.value }
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
                            [docType]: { ...prev[docType as keyof NumberingSettings], startNumber: parseInt(e.target.value) || 1 }
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
                            [docType]: { ...prev[docType as keyof NumberingSettings], currentNumber: parseInt(e.target.value) || 1 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="1"
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`includeYear-${docType}`}
                          checked={settings.includeYear}
                          onChange={(e) => setNumberingSettings(prev => ({
                            ...prev,
                            [docType]: { ...prev[docType as keyof NumberingSettings], includeYear: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`includeYear-${docType}`} className="ml-2 text-sm text-gray-700">
                          Inclure l'année
                        </label>
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                      Exemple: {settings.includeYear 
                        ? `${settings.prefix}-${new Date().getFullYear()}-${String(settings.currentNumber).padStart(3, '0')}`
                        : `${settings.prefix}-${String(settings.currentNumber).padStart(3, '0')}`
                      }
                    </div>
                  </div>
                ))}

                <button
                  onClick={saveNumberingSettings}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder la numérotation
                </button>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Paramètres de facturation</h3>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Date d'échéance</h4>
                      <p className="text-sm text-gray-600">Afficher le champ date d'échéance dans les factures</p>
                    </div>
                    <button
                      onClick={() => setInvoiceSettings(prev => ({ ...prev, useEcheanceDate: !prev.useEcheanceDate }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        invoiceSettings.useEcheanceDate ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          invoiceSettings.useEcheanceDate ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <button
                  onClick={saveInvoiceSettings}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder les paramètres
                </button>
              </div>
            </div>
          )}

          {/* Taxes Tab */}
          {activeTab === 'taxes' && (
            <div className="space-y-8">
              {/* Auto TVA Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calculator className="w-5 h-5 mr-2 text-blue-600" />
                  TVA Automatique
                </h3>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Calculator className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Calcul automatique de la TVA</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Génère automatiquement des lignes de TVA basées sur les taux des produits dans vos documents.
                        Par exemple, si vous avez des produits à 19% et 7%, des lignes "TVA 19%" et "TVA 7%" seront ajoutées automatiquement.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Enable/Disable Toggle */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Activer la TVA automatique</h4>
                        <p className="text-sm text-gray-600">
                          Ajoute automatiquement les lignes de TVA dans les documents selon les taux des produits
                        </p>
                      </div>
                      <button
                        onClick={() => setAutoTvaSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          autoTvaSettings.enabled ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            autoTvaSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Calculation Base Selection */}
                  {autoTvaSettings.enabled && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">Base de calcul</h4>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="totalHT"
                            checked={autoTvaSettings.calculationBase === 'totalHT'}
                            onChange={(e) => setAutoTvaSettings(prev => ({ ...prev, calculationBase: e.target.value as 'totalHT' }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <div className="text-gray-700 font-medium">Calculer sur le montant HT</div>
                            <div className="text-sm text-gray-500">
                              La TVA est calculée uniquement sur le total HT des produits
                            </div>
                          </div>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="totalHTWithFirstTax"
                            checked={autoTvaSettings.calculationBase === 'totalHTWithFirstTax'}
                            onChange={(e) => setAutoTvaSettings(prev => ({ ...prev, calculationBase: e.target.value as 'totalHTWithFirstTax' }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <div className="text-gray-700 font-medium">Calculer sur HT + première taxe</div>
                            <div className="text-sm text-gray-500">
                              La TVA est calculée sur le total HT plus la première taxe configurée
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Example Display */}
                  {autoTvaSettings.enabled && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">Exemple d'affichage</h4>
                      <div className="text-sm text-green-700 space-y-1">
                        <div>Total HT: 1000.000 TND</div>
                        {autoTvaSettings.calculationBase === 'totalHTWithFirstTax' && (
                          <div>Timbre Fiscal: 1.000 TND</div>
                        )}
                        <div className="border-t border-green-300 pt-1 mt-2">
                          <div className="font-medium">TVA automatique:</div>
                          <div>TVA 7%: 35.000 TND</div>
                          <div>TVA 19%: 114.000 TND</div>
                        </div>
                        <div className="border-t border-green-300 pt-1 mt-2 font-medium">
                          Total TTC: 1150.000 TND
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={saveAutoTvaSettings}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder les paramètres TVA
                  </button>
                </div>
              </div>

              {/* Tax Configuration */}
              <div className="border-t pt-8">
                <TaxConfiguration />
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sécurité de l'application</h3>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Protection par mot de passe</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Configurez un mot de passe pour protéger l'accès à l'application. 
                        Ce mot de passe sera demandé à chaque démarrage de l'application.
                      </p>
                    </div>
                  </div>
                </div>

                {appPassword ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Lock className="w-5 h-5 text-green-600 mr-2" />
                        <span className="text-green-800 font-medium">Protection activée</span>
                      </div>
                      <button
                        onClick={removePassword}
                        className="text-red-600 hover:text-red-800 text-sm underline"
                      >
                        Supprimer la protection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nouveau mot de passe
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError('');
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          placeholder="Entrez un mot de passe"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmer le mot de passe
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError('');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Confirmez le mot de passe"
                      />
                    </div>

                    {passwordError && (
                      <p className="text-red-600 text-sm">{passwordError}</p>
                    )}

                    <button
                      onClick={savePassword}
                      disabled={!newPassword || !confirmPassword}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Activer la protection
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <DocumentTemplateSettings />
          )}

          {/* Backup Tab */}
          {activeTab === 'backup' && isElectron && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sauvegarde et restauration</h3>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Database className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Gestion des données</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Sauvegardez régulièrement vos données pour éviter toute perte. 
                        Vous pouvez également restaurer une sauvegarde précédente si nécessaire.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Download className="w-6 h-6 text-green-600 mr-3" />
                      <h4 className="font-medium text-gray-900">Créer une sauvegarde</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Exporte toutes vos données (clients, produits, factures, etc.) dans un fichier de sauvegarde.
                    </p>
                    <button
                      onClick={handleBackup}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Créer une sauvegarde
                    </button>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <Upload className="w-6 h-6 text-orange-600 mr-3" />
                      <h4 className="font-medium text-gray-900">Restaurer une sauvegarde</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Restaure vos données à partir d'un fichier de sauvegarde précédent. 
                      <span className="text-red-600 font-medium">Attention : cette action remplacera toutes vos données actuelles.</span>
                    </p>
                    <button
                      onClick={handleRestore}
                      className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Restaurer une sauvegarde
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;