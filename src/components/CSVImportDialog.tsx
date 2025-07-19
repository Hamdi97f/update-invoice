import React, { useState } from 'react';
import { X, Upload, Download, FileText, AlertCircle, CheckCircle, Users, Package } from 'lucide-react';
import { 
  importClientsFromCSV, 
  importProduitsFromCSV, 
  generateClientCSVTemplate, 
  generateProduitCSVTemplate,
  ImportResult 
} from '../utils/csvImporter';
import { Client, Produit } from '../types';

interface CSVImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'clients' | 'produits';
  existingData: Client[] | Produit[];
  onImportComplete: (result: ImportResult) => void;
  query?: (sql: string, params?: any[]) => Promise<any>;
}

const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  isOpen,
  onClose,
  type,
  existingData,
  onImportComplete,
  query
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
        setImportResult(null);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      alert('Veuillez sélectionner un fichier CSV valide');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
        setImportResult(null);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      alert('Veuillez déposer un fichier CSV valide');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const downloadTemplate = () => {
    const template = type === 'clients' ? generateClientCSVTemplate() : generateProduitCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_${type}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      alert('Veuillez charger un fichier CSV');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      let result: ImportResult;
      
      if (type === 'clients') {
        result = await importClientsFromCSV(csvContent, existingData as Client[], query);
      } else {
        result = await importProduitsFromCSV(csvContent, existingData as Produit[], query);
      }
      
      setImportResult(result);
      
      if (result.success) {
        onImportComplete(result);
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        imported: 0,
        errors: [`Erreur lors de l'importation: ${error.message}`],
        duplicates: 0,
        skipped: 0
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getFormatInstructions = () => {
    if (type === 'clients') {
      return {
        title: 'Format CSV pour les clients',
        required: ['code', 'nom'],
        optional: ['adresse', 'codePostal', 'ville', 'telephone', 'email', 'siret', 'matriculeFiscal'],
        example: 'CL0001,"Entreprise ABC","123 Rue de la Paix",1000,Tunis,"+216 71 123 456","contact@abc.tn","12345678901234","123456789ABC"'
      };
    } else {
      return {
        title: 'Format CSV pour les produits',
        required: ['nom', 'prixUnitaire', 'type'],
        optional: ['ref', 'description', 'tva', 'stock'],
        example: 'V0001,"Consultation","Conseil en informatique",500.000,19,0,vente',
        notes: [
          'Le type doit être "vente" ou "achat"',
          'Le prix unitaire doit être un nombre (utilisez . pour les décimales)',
          'La TVA doit être un pourcentage entre 0 et 100',
          'Le stock doit être un nombre entier positif'
        ]
      };
    }
  };

  const formatInfo = getFormatInstructions();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            {type === 'clients' ? <Users className="w-6 h-6 mr-2 text-blue-600" /> : <Package className="w-6 h-6 mr-2 text-green-600" />}
            Importer {type === 'clients' ? 'des clients' : 'des produits'} depuis CSV
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Upload and Import */}
            <div className="space-y-6">
              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Download className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="font-medium text-blue-900">Télécharger le modèle</h3>
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  Téléchargez un fichier CSV modèle avec le format correct et des exemples de données.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger le modèle CSV
                </button>
              </div>

              {/* File Upload */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  Charger votre fichier CSV
                </h3>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragOver 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 mb-2">
                    Glissez-déposez votre fichier CSV ici ou
                  </p>
                  <label className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
                    Parcourir les fichiers
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {csvContent && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-green-700 font-medium">Fichier CSV chargé</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      {csvContent.split('\n').length - 1} ligne(s) de données détectée(s)
                    </p>
                  </div>
                )}
              </div>

              {/* Import Button */}
              <button
                onClick={handleImport}
                disabled={!csvContent || isImporting}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Importation en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Importer les données
                  </>
                )}
              </button>

              {/* Import Results */}
              {importResult && (
                <div className={`rounded-lg p-4 ${
                  importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center mb-2">
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    )}
                    <h4 className={`font-medium ${
                      importResult.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                      Résultat de l'importation
                    </h4>
                  </div>
                  
                  <div className={`text-sm space-y-1 ${
                    importResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    <p>✅ Importés: {importResult.imported}</p>
                    <p>🔄 Doublons: {importResult.duplicates}</p>
                    <p>⏭️ Ignorés: {importResult.skipped}</p>
                    
                    {importResult.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="font-medium">Erreurs:</p>
                        <ul className="list-disc list-inside space-y-1 max-h-32 overflow-y-auto">
                          {importResult.errors.slice(0, 10).map((error, index) => (
                            <li key={index} className="text-xs">{error}</li>
                          ))}
                          {importResult.errors.length > 10 && (
                            <li className="text-xs font-medium">
                              ... et {importResult.errors.length - 10} autres erreurs
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Format Instructions */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <FileText className="w-5 h-5 text-gray-600 mr-2" />
                  <h3 className="font-medium text-gray-900">{formatInfo.title}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Colonnes obligatoires:</h4>
                    <div className="flex flex-wrap gap-2">
                      {formatInfo.required.map(field => (
                        <span key={field} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Colonnes optionnelles:</h4>
                    <div className="flex flex-wrap gap-2">
                      {formatInfo.optional.map(field => (
                        <span key={field} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Exemple de ligne:</h4>
                    <div className="bg-white p-2 rounded border text-xs font-mono break-all">
                      {formatInfo.example}
                    </div>
                  </div>

                  {formatInfo.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Notes importantes:</h4>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {formatInfo.notes.map((note, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-yellow-500 mr-1">⚠️</span>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* General Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900 mb-2">Instructions générales</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• La première ligne doit contenir les en-têtes de colonnes</li>
                      <li>• Utilisez des guillemets pour les champs contenant des virgules</li>
                      <li>• L'encodage du fichier doit être UTF-8</li>
                      <li>• Les doublons seront automatiquement détectés et ignorés</li>
                      <li>• Sauvegardez vos données avant l'importation</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* CSV Preview */}
              {csvContent && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Aperçu du fichier CSV</h4>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-40 overflow-auto">
                    {csvContent.split('\n').slice(0, 5).map((line, index) => (
                      <div key={index} className={index === 0 ? 'font-bold text-blue-600' : 'text-gray-700'}>
                        {line}
                      </div>
                    ))}
                    {csvContent.split('\n').length > 5 && (
                      <div className="text-gray-500 italic">
                        ... et {csvContent.split('\n').length - 5} autres lignes
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CSVImportDialog;