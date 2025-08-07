import React, { useState, useEffect } from 'react';
import { Save, Upload, Download, RotateCcw, Settings as SettingsIcon, Building, Calculator, FileText, Shield, Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import DocumentTemplateSettings from './DocumentTemplateSettings';
import TaxSettings from './TaxSettings';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'numbering' | 'templates' | 'taxes' | 'security' | 'general'>('company');
  const [companyInfo, setCompanyInfo] = useState({
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

  const [numberingSettings, setNumberingSettings] = useState({
    factures: { prefix: 'FA', startNumber: 1, currentNumber: 1, includeYear: true },
    devis: { prefix: 'DV', startNumber: 1, currentNumber: 1, includeYear: true },
    bonsLivraison: { prefix: 'BL', startNumber: 1, currentNumber: 1, includeYear: true },
    commandesFournisseur: { prefix: 'CF', startNumber: 1, currentNumber: 1, includeYear: true }
  });

  const [securitySettings, setSecuritySettings] = useState({
    passwordEnabled: false,
    password: '',
    confirmPassword: ''
  });

  const [generalSettings, setGeneralSettings] = useState({
    autoEnableFodec: false,
    useEcheanceDate: true,
    allowNegativeStock: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { query, backupDatabase, restoreDatabase, checkForUpdates, getAppVersion, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadSettings();
    }
  }, [isReady]);

  const loadSettings = async () => {
    if (!isReady) return;
    
    try {
      // Load company info
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

      // Load security settings
      const passwordResult = await query('SELECT value FROM settings WHERE key = ?', ['appPassword']);
      setSecuritySettings(prev => ({
        ...prev,
        passwordEnabled: passwordResult.length > 0,
        password: '',
        confirmPassword: ''
      }));

      // Load general settings
      const generalResult = await query('SELECT value FROM settings WHERE key = ?', ['generalSettings']);
      if (generalResult.length > 0) {
        const loadedGeneral = JSON.parse(generalResult[0].value);
        setGeneralSettings(prev => ({ ...prev, ...loadedGeneral }));
      }

      // Load invoice settings
      const invoiceResult = await query('SELECT value FROM settings WHERE key = ?', ['invoiceSettings']);
      if (invoiceResult.length > 0) {
        const invoiceSettings = JSON.parse(invoiceResult[0].value);
        setGeneralSettings(prev => ({ ...prev, useEcheanceDate: invoiceSettings.useEcheanceDate }));
      }

      // Load stock settings
      const stockResult = await query('SELECT value FROM settings WHERE key = ?', ['stockSettings']);
      if (stockResult.length > 0) {
        const stockSettings = JSON.parse(stockResult[0].value);
        setGeneralSettings(prev => ({ ...prev, allowNegativeStock: stockSettings.allowNegativeStock }));
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveCompanyInfo = async () => {
    if (!isReady) return;
    
    try {
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['company', JSON.stringify(companyInfo)]
      );
      alert('Informations de l\'entreprise sauvegardées avec succès');
    } catch (error) {
      console.error('Error saving company info:', error);
      alert('Erreur lors de la sauvegarde des informations de l\'entreprise');
    }
  };

  const saveNumberingSettings = async () => {
    if (!isReady) return;
    
    try {
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['numbering', JSON.stringify(numberingSettings)]
      );
      alert('Paramètres de numérotation sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving numbering settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres de numérotation');
    }
  };

  const saveSecuritySettings = async () => {
    if (!isReady) return;
    
    setIsSubmitting(true);
    setPasswordError('');

    try {
      if (securitySettings.passwordEnabled) {
        if (!securitySettings.password) {
          setPasswordError('Le mot de passe est obligatoire');
          setIsSubmitting(false);
          return;
        }

        if (securitySettings.password !== securitySettings.confirmPassword) {
          setPasswordError('Les mots de passe ne correspondent pas');
          setIsSubmitting(false);
          return;
        }

        if (securitySettings.password.length < 4) {
          setPasswordError('Le mot de passe doit contenir au moins 4 caractères');
          setIsSubmitting(false);
          return;
        }

        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['appPassword', securitySettings.password]
        );
      } else {
        // Remove password protection
        await query('DELETE FROM settings WHERE key = ?', ['appPassword']);
      }

      alert('Paramètres de sécurité sauvegardés avec succès');
      
      // Reset password fields
      setSecuritySettings(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));
      
    } catch (error) {
      console.error('Error saving security settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres de sécurité');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveGeneralSettings = async () => {
    if (!isReady) return;
    
    try {
      // Save general settings
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['generalSettings', JSON.stringify(generalSettings)]
      );

      // Save invoice settings
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['invoiceSettings', JSON.stringify({ useEcheanceDate: generalSettings.useEcheanceDate })]
      );

      // Save stock settings
      await query(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['stockSettings', JSON.stringify({ allowNegativeStock: generalSettings.allowNegativeStock })]
      );

      alert('Paramètres généraux sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving general settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres généraux');
    }
  };

  const handleBackup = async () => {
    try {
      const result = await backupDatabase();
      if (result.success) {
        alert(`Sauvegarde créée avec succès dans:\n${result.path}`);
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error backing up database:', error);
      alert('Erreur lors de la sauvegarde de la base de données');
    }
  };

  const handleRestore = async () => {
    try {
      const result = await restoreDatabase();
      if (result.success) {
        alert('Base de données restaurée avec succès. L\'application va redémarrer.');
        window.location.reload();
      } else {
        alert('Restauration annulée ou échouée');
      }
    } catch (error) {
      console.error('Error restoring database:', error);
      alert('Erreur lors de la restauration de la base de données');
    }
  };

  const handleCheckUpdates = async () => {
    try {
      const result = await checkForUpdates();
      if (result.updateAvailable) {
        alert(`Mise à jour disponible: version ${result.version}`);
      } else {
        alert('Aucune mise à jour disponible');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      alert('Erreur lors de la vérification des mises à jour');
    }
  };

  const resetNumbering = (docType: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir remettre à zéro la numérotation des ${docType} ?`)) {
      setNumberingSettings(prev => ({
        ...prev,
        [docType]: {
          ...prev[docType as keyof typeof prev],
          currentNumber: prev[docType as keyof typeof prev].startNumber
        }
      }));
    }
  };

  const tabs = [
    { id: 'company', label: 'Entreprise', icon: Building },
    { id: 'numbering', label: 'Numérotation', icon: Calculator },
    { id: 'general', label: 'Général', icon: SettingsIcon },
    { id: 'templates', label: 'Modèles', icon: FileText },
    { id: 'taxes', label: 'Taxes', icon: Calculator },
    { id: 'security', label: 'Sécurité', icon: Shield }
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

      {/* Company Settings */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Informations de l'entreprise</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      )}

      {/* Numbering Settings */}
      {activeTab === 'numbering' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres de numérotation</h3>
          
          <div className="space-y-6">
            {Object.entries(numberingSettings).map(([docType, settings]) => (
              <div key={docType} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 capitalize">
                    {docType === 'factures' ? 'Factures' :
                     docType === 'devis' ? 'Devis' :
                     docType === 'bonsLivraison' ? 'Bons de livraison' :
                     'Commandes fournisseur'}
                  </h4>
                  <button
                    onClick={() => resetNumbering(docType)}
                    className="text-red-600 hover:text-red-800 text-sm flex items-center"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Remettre à zéro
                  </button>
                </div>
                
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
                        [docType]: { ...settings, prefix: e.target.value }
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
                        [docType]: { ...settings, startNumber: parseInt(e.target.value) || 1 }
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
                        [docType]: { ...settings, currentNumber: parseInt(e.target.value) || 1 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.includeYear}
                      onChange={(e) => setNumberingSettings(prev => ({
                        ...prev,
                        [docType]: { ...settings, includeYear: e.target.checked }
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      Inclure l'année
                    </label>
                  </div>
                </div>
                
                <div className="mt-3 text-sm text-gray-500">
                  Exemple: {settings.includeYear 
                    ? `${settings.prefix}-${new Date().getFullYear()}-${String(settings.currentNumber).padStart(3, '0')}`
                    : `${settings.prefix}-${String(settings.currentNumber).padStart(3, '0')}`
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
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

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres généraux</h3>
          
          <div className="space-y-6">
            {/* FODEC Auto-Enable Setting */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Configuration FODEC</h4>
              
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900">Activer FODEC automatiquement</label>
                  <p className="text-sm text-gray-500 mt-1">
                    Quand activé, tous les nouveaux produits auront FODEC défini sur "Oui" par défaut
                  </p>
                </div>
                <div className="relative inline-block w-12 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-auto-fodec"
                    checked={generalSettings.autoEnableFodec}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, autoEnableFodec: e.target.checked }))}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-auto-fodec"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      generalSettings.autoEnableFodec ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        generalSettings.autoEnableFodec ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">À propos de FODEC</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      {generalSettings.autoEnableFodec ? (
                        <>
                          FODEC sera <strong>automatiquement activé</strong> pour tous les nouveaux produits créés.
                          Vous pourrez toujours le désactiver manuellement lors de la création/modification d'un produit.
                        </>
                      ) : (
                        <>
                          FODEC sera <strong>désactivé par défaut</strong> pour les nouveaux produits.
                          Vous devrez l'activer manuellement pour chaque produit qui en a besoin.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Paramètres des factures</h4>
              
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900">Utiliser la date d'échéance</label>
                  <p className="text-sm text-gray-500 mt-1">
                    Afficher et utiliser la date d'échéance dans les factures
                  </p>
                </div>
                <div className="relative inline-block w-12 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-echeance"
                    checked={generalSettings.useEcheanceDate}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, useEcheanceDate: e.target.checked }))}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-echeance"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      generalSettings.useEcheanceDate ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        generalSettings.useEcheanceDate ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Stock Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Paramètres de stock</h4>
              
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900">Autoriser le stock négatif</label>
                  <p className="text-sm text-gray-500 mt-1">
                    Permet de vendre des produits même si leur quantité en stock est insuffisante
                  </p>
                </div>
                <div className="relative inline-block w-12 mr-2 align-middle select-none">
                  <input
                    type="checkbox"
                    id="toggle-negative-stock"
                    checked={generalSettings.allowNegativeStock}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, allowNegativeStock: e.target.checked }))}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-negative-stock"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      generalSettings.allowNegativeStock ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        generalSettings.allowNegativeStock ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Backup and Restore */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Sauvegarde et restauration</h4>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleBackup}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Sauvegarder la base de données
                </button>
                
                <button
                  onClick={handleRestore}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Restaurer la base de données
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Important :</strong> Effectuez régulièrement des sauvegardes de votre base de données. 
                  La restauration remplacera toutes vos données actuelles.
                </p>
              </div>
            </div>

            {/* Updates */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Mises à jour</h4>
              
              <button
                onClick={handleCheckUpdates}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Vérifier les mises à jour
              </button>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={saveGeneralSettings}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder les paramètres généraux
            </button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Paramètres de sécurité</h3>
          
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Protection par mot de passe</h4>
              
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg mb-4">
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
                    checked={securitySettings.passwordEnabled}
                    onChange={(e) => setSecuritySettings(prev => ({ 
                      ...prev, 
                      passwordEnabled: e.target.checked,
                      password: '',
                      confirmPassword: ''
                    }))}
                    className="sr-only"
                  />
                  <label
                    htmlFor="toggle-password"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                      securitySettings.passwordEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                        securitySettings.passwordEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    ></span>
                  </label>
                </div>
              </div>

              {securitySettings.passwordEnabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={securitySettings.password}
                        onChange={(e) => {
                          setSecuritySettings(prev => ({ ...prev, password: e.target.value }));
                          setPasswordError('');
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${
                          passwordError ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Entrez votre mot de passe"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={securitySettings.confirmPassword}
                        onChange={(e) => {
                          setSecuritySettings(prev => ({ ...prev, confirmPassword: e.target.value }));
                          setPasswordError('');
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${
                          passwordError ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Confirmez votre mot de passe"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="text-red-600 text-sm">{passwordError}</div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <Shield className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-800 font-medium">Conseils de sécurité</p>
                        <ul className="text-xs text-blue-700 mt-1 space-y-1">
                          <li>• Utilisez un mot de passe d'au moins 4 caractères</li>
                          <li>• Évitez les mots de passe trop simples</li>
                          <li>• Gardez votre mot de passe en sécurité</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={saveSecuritySettings}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder les paramètres de sécurité'}
            </button>
          </div>
        </div>
      )}

      {/* Document Templates */}
      {activeTab === 'templates' && <DocumentTemplateSettings />}

      {/* Tax Settings */}
      {activeTab === 'taxes' && <TaxSettings />}
    </div>
  );
};

export default Settings;