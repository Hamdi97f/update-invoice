import React, { useState, useEffect } from 'react';
import { Save, Upload, Eye, RotateCcw, Settings, Image as ImageIcon, Type, Palette } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';

interface TemplateSettings {
  // Margins (in mm)
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  
  // Logo settings
  logo: {
    enabled: boolean;
    position: 'left' | 'center' | 'right';
    size: number; // height in mm
    width?: number; // width in mm (optional, auto if not set)
    url?: string;
  };
  
  // Title settings
  title: {
    fontSize: number;
    color: string;
    fontWeight: 'normal' | 'bold';
    position: 'left' | 'center' | 'right';
    marginBottom: number;
  };
  
  // Table settings
  table: {
    fontSize: number;
    headerFontSize: number;
    cellPadding: number;
    borderWidth: number;
    model: 'simple' | 'bordered' | 'minimal';
  };
  
  // Footer settings
  footer: {
    enabled: boolean;
    text: string;
    fontSize: number;
    color: string;
    fontWeight: 'normal' | 'bold';
    position: 'left' | 'center' | 'right';
    showDate: boolean;
    customText: string;
  };
  
  // Amount in words
  amountInWords: {
    enabled: boolean;
    position: 'left' | 'right';
    fontSize: number;
    color: string;
  };
  
  // Document title position
  titlePosition: 'header' | 'body';
  
  // Colors
  colors: {
    primary: string;
    text: string;
    light: string;
    border: string;
  };
  
  // Fonts
  fonts: {
    title: { size: number; weight: string; color: string };
    heading: { size: number; weight: string; color: string };
    body: { size: number; weight: string; color: string };
    small: { size: number; weight: string; color: string };
    footer: { size: number; weight: string; color: string };
  };
  
  // Spacing
  spacing: {
    section: number;
    line: number;
    element: number;
  };
}

const defaultSettings: TemplateSettings = {
  margins: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10
  },
  logo: {
    enabled: false,
    position: 'right',
    size: 15,
    width: 22
  },
  title: {
    fontSize: 18,
    color: '#2563eb',
    fontWeight: 'bold',
    position: 'center',
    marginBottom: 8
  },
  table: {
    fontSize: 8,
    headerFontSize: 9,
    cellPadding: 3,
    borderWidth: 0,
    model: 'simple'
  },
  footer: {
    enabled: true,
    text: 'Merci pour votre confiance',
    fontSize: 8,
    color: '#6b7280',
    fontWeight: 'normal',
    position: 'left',
    showDate: true,
    customText: ''
  },
  amountInWords: {
    enabled: false,
    position: 'left',
    fontSize: 8,
    color: '#000000'
  },
  titlePosition: 'body',
  colors: {
    primary: '#2563eb',
    text: '#000000',
    light: '#f8fafc',
    border: '#e2e8f0'
  },
  fonts: {
    title: { size: 18, weight: 'bold', color: '#2563eb' },
    heading: { size: 11, weight: 'bold', color: '#000000' },
    body: { size: 9, weight: 'normal', color: '#000000' },
    small: { size: 7, weight: 'normal', color: '#6b7280' },
    footer: { size: 8, weight: 'normal', color: '#6b7280' }
  },
  spacing: {
    section: 8,
    line: 4,
    element: 6
  }
};

const DocumentTemplateSettings: React.FC = () => {
  const [settings, setSettings] = useState<TemplateSettings>(defaultSettings);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'layout' | 'logo' | 'title' | 'table' | 'footer' | 'colors'>('layout');
  const { query, isElectron } = useDatabase();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (isElectron) {
        const result = await query('SELECT value FROM settings WHERE key = ?', ['templateSettings']);
        if (result.length > 0) {
          const loadedSettings = JSON.parse(result[0].value);
          setSettings({ ...defaultSettings, ...loadedSettings });
        }
        
        // Load logo if exists
        const logoResult = await query('SELECT value FROM settings WHERE key = ?', ['templateLogo']);
        if (logoResult.length > 0) {
          setLogoPreview(logoResult[0].value);
        }
      } else {
        const savedSettings = localStorage.getItem('templateSettings');
        if (savedSettings) {
          const loadedSettings = JSON.parse(savedSettings);
          setSettings({ ...defaultSettings, ...loadedSettings });
        }
        
        const savedLogo = localStorage.getItem('templateLogo');
        if (savedLogo) {
          setLogoPreview(savedLogo);
        }
      }
    } catch (error) {
      console.error('Error loading template settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['templateSettings', JSON.stringify(settings)]
        );
        
        if (logoPreview) {
          await query(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['templateLogo', logoPreview]
          );
        }
      } else {
        localStorage.setItem('templateSettings', JSON.stringify(settings));
        if (logoPreview) {
          localStorage.setItem('templateLogo', logoPreview);
        }
      }
      
      alert('Paramètres de modèle sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving template settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    }
  };

  const resetToDefault = () => {
    if (window.confirm('Êtes-vous sûr de vouloir remettre les paramètres par défaut ?')) {
      setSettings(defaultSettings);
      setLogoPreview('');
      setLogoFile(null);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setLogoFile(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setLogoPreview(result);
          setSettings(prev => ({
            ...prev,
            logo: { ...prev.logo, enabled: true, url: result }
          }));
        };
        reader.readAsDataURL(file);
      } else {
        alert('Veuillez sélectionner un fichier image (PNG, JPG, etc.)');
      }
    }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const newSettings = { ...prev };
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const sections = [
    { id: 'layout', label: 'Mise en page', icon: Settings },
    { id: 'logo', label: 'Logo', icon: ImageIcon },
    { id: 'title', label: 'Titre', icon: Type },
    { id: 'table', label: 'Tableau', icon: Settings },
    { id: 'footer', label: 'Pied de page', icon: Type },
    { id: 'colors', label: 'Couleurs', icon: Palette }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Configuration des modèles de documents</h3>
          <p className="text-sm text-gray-600">Personnalisez l'apparence de vos documents</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={resetToDefault}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Défaut
          </button>
          <button
            onClick={saveSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeSection === section.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Layout Settings */}
          {activeSection === 'layout' && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Marges et espacement</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marge haut (mm)</label>
                  <input
                    type="number"
                    value={settings.margins.top}
                    onChange={(e) => updateSettings('margins.top', parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="5"
                    max="50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marge bas (mm)</label>
                  <input
                    type="number"
                    value={settings.margins.bottom}
                    onChange={(e) => updateSettings('margins.bottom', parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="5"
                    max="50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marge gauche (mm)</label>
                  <input
                    type="number"
                    value={settings.margins.left}
                    onChange={(e) => updateSettings('margins.left', parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="5"
                    max="50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marge droite (mm)</label>
                  <input
                    type="number"
                    value={settings.margins.right}
                    onChange={(e) => updateSettings('margins.right', parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="5"
                    max="50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Logo Settings */}
          {activeSection === 'logo' && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Configuration du logo</h4>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.logo.enabled}
                    onChange={(e) => updateSettings('logo.enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Afficher le logo</label>
                </div>

                {settings.logo.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Télécharger le logo</label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Choisir un fichier
                        </label>
                        {logoPreview && (
                          <div className="flex items-center space-x-2">
                            <img src={logoPreview} alt="Logo preview" className="h-8 w-auto border rounded" />
                            <span className="text-sm text-green-600">✓ Logo chargé</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                      <select
                        value={settings.logo.position}
                        onChange={(e) => updateSettings('logo.position', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="left">À gauche</option>
                        <option value="center">Au centre</option>
                        <option value="right">À droite</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hauteur (mm)</label>
                        <input
                          type="number"
                          value={settings.logo.size}
                          onChange={(e) => updateSettings('logo.size', parseInt(e.target.value) || 15)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          min="5"
                          max="50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Largeur (mm)</label>
                        <input
                          type="number"
                          value={settings.logo.width || 22}
                          onChange={(e) => updateSettings('logo.width', parseInt(e.target.value) || 22)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          min="5"
                          max="80"
                          placeholder="Auto"
                        />
                        <p className="text-xs text-gray-500 mt-1">Laissez vide pour largeur automatique</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Title Settings */}
          {activeSection === 'title' && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Configuration du titre</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taille de police</label>
                  <input
                    type="number"
                    value={settings.title.fontSize}
                    onChange={(e) => updateSettings('title.fontSize', parseInt(e.target.value) || 18)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="12"
                    max="36"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={settings.title.color}
                      onChange={(e) => updateSettings('title.color', e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.title.color}
                      onChange={(e) => updateSettings('title.color', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="#2563eb"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                    <select
                      value={settings.title.fontWeight}
                      onChange={(e) => updateSettings('title.fontWeight', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Gras</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <select
                      value={settings.title.position}
                      onChange={(e) => updateSettings('title.position', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="left">À gauche</option>
                      <option value="center">Au centre</option>
                      <option value="right">À droite</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Espacement bas (mm)</label>
                  <input
                    type="number"
                    value={settings.title.marginBottom}
                    onChange={(e) => updateSettings('title.marginBottom', parseInt(e.target.value) || 8)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="2"
                    max="20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Table Settings */}
          {activeSection === 'table' && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Configuration du tableau</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Style de tableau</label>
                  <select
                    value={settings.table.model}
                    onChange={(e) => updateSettings('table.model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="simple">Simple (sans bordures)</option>
                    <option value="minimal">Minimal</option>
                    <option value="bordered">Avec bordures</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taille police contenu</label>
                    <input
                      type="number"
                      value={settings.table.fontSize}
                      onChange={(e) => updateSettings('table.fontSize', parseInt(e.target.value) || 8)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      min="6"
                      max="14"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taille police en-tête</label>
                    <input
                      type="number"
                      value={settings.table.headerFontSize}
                      onChange={(e) => updateSettings('table.headerFontSize', parseInt(e.target.value) || 9)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      min="6"
                      max="16"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Espacement cellules (mm)</label>
                  <input
                    type="number"
                    value={settings.table.cellPadding}
                    onChange={(e) => updateSettings('table.cellPadding', parseInt(e.target.value) || 3)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="8"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Settings */}
          {activeSection === 'footer' && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Configuration du pied de page</h4>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.footer.enabled}
                    onChange={(e) => updateSettings('footer.enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Afficher le pied de page</label>
                </div>

                {settings.footer.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texte principal</label>
                      <input
                        type="text"
                        value={settings.footer.text}
                        onChange={(e) => updateSettings('footer.text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Merci pour votre confiance"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Texte personnalisé (optionnel)</label>
                      <textarea
                        value={settings.footer.customText}
                        onChange={(e) => updateSettings('footer.customText', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Texte supplémentaire..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Taille de police</label>
                        <input
                          type="number"
                          value={settings.footer.fontSize}
                          onChange={(e) => updateSettings('footer.fontSize', parseInt(e.target.value) || 8)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          min="6"
                          max="14"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                        <select
                          value={settings.footer.fontWeight}
                          onChange={(e) => updateSettings('footer.fontWeight', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Gras</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                        <select
                          value={settings.footer.position}
                          onChange={(e) => updateSettings('footer.position', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="left">À gauche</option>
                          <option value="center">Au centre</option>
                          <option value="right">À droite</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={settings.footer.color}
                            onChange={(e) => updateSettings('footer.color', e.target.value)}
                            className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.footer.color}
                            onChange={(e) => updateSettings('footer.color', e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.footer.showDate}
                        onChange={(e) => updateSettings('footer.showDate', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">Afficher la date de génération</label>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Colors Settings */}
          {activeSection === 'colors' && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Palette de couleurs</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={settings.colors.primary}
                      onChange={(e) => updateSettings('colors.primary', e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.colors.primary}
                      onChange={(e) => updateSettings('colors.primary', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur du texte</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={settings.colors.text}
                      onChange={(e) => updateSettings('colors.text', e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.colors.text}
                      onChange={(e) => updateSettings('colors.text', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur des bordures</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={settings.colors.border}
                      onChange={(e) => updateSettings('colors.border', e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.colors.border}
                      onChange={(e) => updateSettings('colors.border', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant en lettres - Couleur</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={settings.amountInWords.color}
                      onChange={(e) => updateSettings('amountInWords.color', e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.amountInWords.color}
                      onChange={(e) => updateSettings('amountInWords.color', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Preview and Summary */}
        <div className="space-y-6">
          {/* Live Preview */}
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Eye className="w-5 h-5 text-blue-600 mr-2" />
              <h5 className="font-medium text-gray-900">Aperçu en temps réel</h5>
            </div>
            
            <div className="bg-gray-50 p-4 rounded border text-xs space-y-2">
              {/* Header Preview */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">Votre Entreprise</div>
                  <div className="text-gray-600">123 Avenue de la République</div>
                  <div className="text-gray-600">1000 Tunis</div>
                </div>
                {settings.logo.enabled && (
                  <div 
                    className="bg-blue-100 border border-blue-300 rounded flex items-center justify-center text-blue-600"
                    style={{ 
                      width: `${(settings.logo.width || 22) * 2}px`, 
                      height: `${settings.logo.size * 2}px` 
                    }}
                  >
                    LOGO
                  </div>
                )}
              </div>
              
              {/* Title Preview */}
              <div className="text-center py-2">
                <div 
                  className="font-bold"
                  style={{ 
                    color: settings.title.color,
                    fontSize: `${settings.title.fontSize * 0.8}px`,
                    fontWeight: settings.title.fontWeight,
                    textAlign: settings.title.position as any
                  }}
                >
                  FACTURE
                </div>
              </div>
              
              {/* Table Preview */}
              <div className="border-t border-b py-2">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="font-medium">Désignation</div>
                  <div className="font-medium text-center">Qté</div>
                  <div className="font-medium text-right">Prix U.</div>
                  <div className="font-medium text-right">Total</div>
                  <div>Produit exemple</div>
                  <div className="text-center">1</div>
                  <div className="text-right">100.000</div>
                  <div className="text-right">100.000</div>
                </div>
              </div>
              
              {/* Footer Preview */}
              {settings.footer.enabled && (
                <div 
                  className="pt-2 border-t"
                  style={{ 
                    color: settings.footer.color,
                    fontSize: `${settings.footer.fontSize * 0.8}px`,
                    fontWeight: settings.footer.fontWeight,
                    textAlign: settings.footer.position as any
                  }}
                >
                  {settings.footer.text}
                  {settings.footer.customText && (
                    <div className="mt-1">{settings.footer.customText}</div>
                  )}
                  {settings.footer.showDate && (
                    <div className="mt-1 text-gray-500">Document généré le {new Date().toLocaleDateString('fr-FR')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Settings Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-3">Résumé des paramètres</h5>
            <div className="text-sm text-gray-600 space-y-2">
              <div><strong>Marges:</strong> {settings.margins.top}mm (haut/bas), {settings.margins.left}mm (gauche/droite)</div>
              <div><strong>Logo:</strong> {settings.logo.enabled ? `Activé (${settings.logo.position}, ${settings.logo.size}×${settings.logo.width || 'auto'}mm)` : 'Désactivé'}</div>
              <div><strong>Titre:</strong> {settings.title.fontSize}pt, {settings.title.color}, {settings.title.position}</div>
              <div><strong>Tableau:</strong> Police {settings.table.fontSize}pt, style {settings.table.model}</div>
              <div><strong>Pied de page:</strong> {settings.footer.enabled ? `Activé (${settings.footer.fontSize}pt, ${settings.footer.position})` : 'Désactivé'}</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-3">Actions rapides</h5>
            <div className="space-y-2">
              <button
                onClick={() => {
                  updateSettings('amountInWords.enabled', !settings.amountInWords.enabled);
                }}
                className="w-full text-left px-3 py-2 text-sm bg-white border border-blue-200 rounded hover:bg-blue-50"
              >
                {settings.amountInWords.enabled ? '✓' : '○'} Montant en lettres
              </button>
              <button
                onClick={() => {
                  updateSettings('table.model', settings.table.model === 'simple' ? 'bordered' : 'simple');
                }}
                className="w-full text-left px-3 py-2 text-sm bg-white border border-blue-200 rounded hover:bg-blue-50"
              >
                Basculer bordures tableau
              </button>
              <button
                onClick={() => {
                  updateSettings('title.position', settings.title.position === 'center' ? 'left' : 'center');
                }}
                className="w-full text-left px-3 py-2 text-sm bg-white border border-blue-200 rounded hover:bg-blue-50"
              >
                Centrer/Aligner titre
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplateSettings;