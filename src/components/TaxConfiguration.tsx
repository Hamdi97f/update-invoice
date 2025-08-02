import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Tax } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

interface TaxConfigurationProps {
  onTaxesChange?: (taxes: Tax[]) => void;
}

const TaxConfiguration: React.FC<TaxConfigurationProps> = ({ onTaxesChange }) => {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    type: 'percentage' as const,
    valeur: 0,
    amount: 0,
    calculationBase: 'totalHT' as 'totalHT' | 'totalHTWithPreviousTaxes',
    applicableDocuments: [] as ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[],
    actif: true
  });

  const { query, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadTaxes();
    }
  }, [isReady]);

  const loadTaxes = async () => {
    if (isElectron && query) {
      try {
        // Ensure table exists with correct schema
        await query(`
          CREATE TABLE IF NOT EXISTS taxes (
            id TEXT PRIMARY KEY,
            nom TEXT NOT NULL,
            type TEXT NOT NULL,
            rate REAL,
            amount REAL,
            base TEXT NOT NULL,
            applicableDocuments TEXT NOT NULL,
            ordre INTEGER NOT NULL,
            actif BOOLEAN DEFAULT 1
          )
        `);

        const result = await query('SELECT * FROM taxes ORDER BY ordre ASC');
        const loadedTaxes = result.map((tax: any) => ({
          ...tax,
          applicableDocuments: JSON.parse(tax.applicableDocuments),
          actif: Boolean(tax.actif)
        }));
        
        setTaxes(loadedTaxes);
        onTaxesChange?.(loadedTaxes);
      } catch (error) {
        console.error('Error loading taxes:', error);
        setTaxes([]);
      }
    } else {
      try {
        // Web version - use localStorage
        const savedTaxes = localStorage.getItem('taxes');
        if (savedTaxes) {
          const loadedTaxes = JSON.parse(savedTaxes);
          setTaxes(loadedTaxes);
          onTaxesChange?.(loadedTaxes);
        }
      } catch (error) {
        console.error('Error loading taxes:', error);
        setTaxes([]);
      }
    }
  };

  const saveTaxes = async (updatedTaxes: Tax[]) => {
    try {
      if (isElectron && query) {
        // Ensure table exists with correct schema
        await query(`
          CREATE TABLE IF NOT EXISTS taxes (
            id TEXT PRIMARY KEY,
            nom TEXT NOT NULL,
            type TEXT NOT NULL,
            valeur REAL NOT NULL,
            amount REAL,
            calculationBase TEXT NOT NULL,
            applicableDocuments TEXT NOT NULL,
            ordre INTEGER NOT NULL,
            actif BOOLEAN DEFAULT 1
          )
        `);

        // Save each tax individually
        for (const tax of updatedTaxes) {
          await query(
            `INSERT OR REPLACE INTO taxes (id, nom, type, valeur, amount, calculationBase, applicableDocuments, ordre, actif)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tax.id,
              tax.nom,
              tax.type,
              tax.valeur,
              tax.amount || null,
              tax.calculationBase,
              JSON.stringify(tax.applicableDocuments),
              tax.ordre,
              tax.actif ? 1 : 0
            ]
          );
        }
      } else {
        // Web version - use localStorage
        localStorage.setItem('taxes', JSON.stringify(updatedTaxes));
      }
    } catch (error) {
      console.error('Error saving taxes:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nom.trim()) {
      alert('Le nom de la taxe est obligatoire');
      return;
    }

    if (formData.type === 'percentage' && formData.valeur <= 0) {
      alert('Le taux de la taxe doit être supérieur à 0');
      return;
    }

    if (formData.type === 'fixed' && formData.amount <= 0) {
      alert('Le montant de la taxe doit être supérieur à 0');
      return;
    }

    if (formData.applicableDocuments.length === 0) {
      alert('Veuillez sélectionner au moins un type de document');
      return;
    }

    const taxData: Tax = {
      id: editingTax?.id || uuidv4(),
      nom: formData.nom.trim(),
      type: formData.type,
      valeur: formData.valeur,
      amount: formData.type === 'fixed' ? formData.amount : undefined,
      calculationBase: formData.calculationBase,
      applicableDocuments: formData.applicableDocuments,
      ordre: editingTax?.ordre || taxes.length + 1,
      actif: formData.actif
    };

    try {
      let updatedTaxes;
      if (editingTax) {
        updatedTaxes = taxes.map(t => t.id === taxData.id ? taxData : t);
      } else {
        updatedTaxes = [...taxes, taxData];
      }

      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
      
      setShowForm(false);
      setEditingTax(null);
      resetForm();
      
      alert('Taxe sauvegardée avec succès');
    } catch (error) {
      console.error('Error saving tax:', error);
      alert('Erreur lors de la sauvegarde de la taxe');
    }
  };

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax);
    setFormData({
      nom: tax.nom,
      type: tax.type,
      valeur: tax.valeur,
      amount: tax.amount || 0,
      calculationBase: tax.calculationBase,
      applicableDocuments: tax.applicableDocuments,
      actif: tax.actif
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette taxe ?')) {
      try {
        const updatedTaxes = taxes.filter(t => t.id !== id);
        await saveTaxes(updatedTaxes);
        setTaxes(updatedTaxes);
        onTaxesChange?.(updatedTaxes);
      } catch (error) {
        alert('Erreur lors de la suppression de la taxe');
      }
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const updatedTaxes = taxes.map(t => 
        t.id === id ? { ...t, actif: !t.actif } : t
      );
      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
    } catch (error) {
      alert('Erreur lors de la mise à jour de la taxe');
    }
  };

  const moveOrder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = taxes.findIndex(t => t.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === taxes.length - 1)
    ) {
      return;
    }

    const newTaxes = [...taxes];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap positions
    [newTaxes[currentIndex], newTaxes[targetIndex]] = [newTaxes[targetIndex], newTaxes[currentIndex]];
    
    // Update order numbers
    const updatedTaxes = newTaxes.map((tax, index) => ({
      ...tax,
      ordre: index + 1
    }));

    try {
      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
    } catch (error) {
      alert('Erreur lors du réordonnancement des taxes');
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      type: 'percentage',
      valeur: 0,
      amount: 0,
      calculationBase: 'totalHT',
      applicableDocuments: [],
      actif: true
    });
  };

  const handleDocumentToggle = (docType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur') => {
    setFormData(prev => ({
      ...prev,
      applicableDocuments: prev.applicableDocuments.includes(docType)
        ? prev.applicableDocuments.filter(d => d !== docType)
        : [...prev.applicableDocuments, docType]
    }));
  };

  const documentLabels = {
    factures: 'Factures',
    devis: 'Devis',
    bonsLivraison: 'Bons de livraison',
    commandesFournisseur: 'Commandes fournisseur'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Configuration des taxes</h3>
        <button
          onClick={() => {
            resetForm();
            setEditingTax(null);
            setShowForm(true);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle taxe</span>
        </button>
      </div>

      {/* Tax List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {taxes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucune taxe configurée. Cliquez sur "Nouvelle taxe" pour commencer.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ordre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base de calcul
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxes.map((tax, index) => (
                <tr key={tax.id} className={tax.actif ? '' : 'opacity-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <span>{tax.ordre}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveOrder(tax.id, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveOrder(tax.id, 'down')}
                          disabled={index === taxes.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tax.nom}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tax.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tax.type === 'percentage' ? `${tax.valeur}%` : `${(tax.amount || tax.valeur).toFixed(3)} TND`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tax.calculationBase === 'totalHT' ? 'Total HT' : 'Total HT + taxes précédentes'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {tax.applicableDocuments.map(doc => (
                        <span key={doc} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {documentLabels[doc]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(tax.id)}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tax.actif 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tax.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(tax)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tax.id)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tax Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTax ? 'Modifier la taxe' : 'Nouvelle taxe'}
              </h2>
              <button 
                onClick={() => {
                  setShowForm(false);
                  setEditingTax(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de la taxe *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Taxe municipale, Timbre fiscal..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de taxe *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="percentage">Pourcentage</option>
                      <option value="fixed">Montant fixe</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.type === 'percentage' ? 'Taux (%)' : 'Montant (TND)'} *
                    </label>
                    {formData.type === 'percentage' ? (
                      <input
                        type="number"
                        value={formData.valeur}
                        onChange={(e) => setFormData(prev => ({ ...prev, valeur: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        step="0.1"
                        min="0"
                        max="100"
                        required
                      />
                    ) : (
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        step="0.001"
                        min="0"
                        required
                      />
                    )}
                  </div>
                </div>

                {formData.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base de calcul *
                    </label>
                    <select
                      value={formData.calculationBase}
                      onChange={(e) => setFormData(prev => ({ ...prev, calculationBase: e.target.value as 'totalHT' | 'totalHTWithPreviousTaxes' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="totalHT">Total HT</option>
                      <option value="totalHTWithPreviousTaxes">Total HT + taxes précédentes</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.calculationBase === 'totalHT' 
                        ? 'La taxe sera calculée sur le montant HT uniquement'
                        : 'La taxe sera calculée sur le montant HT + toutes les taxes précédentes dans l\'ordre'
                      }
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documents applicables *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(documentLabels).map(([key, label]) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableDocuments.includes(key as any)}
                          onChange={() => handleDocumentToggle(key as any)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData(prev => ({ ...prev, actif: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Taxe active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTax(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxConfiguration;