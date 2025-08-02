import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Edit, Trash2, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { TaxeUtilisateur } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

interface TaxeUtilisateurFormProps {
  isOpen: boolean;
  onClose: () => void;
  onTaxesChange: (taxes: TaxeUtilisateur[]) => void;
}

const TaxeUtilisateurForm: React.FC<TaxeUtilisateurFormProps> = ({ 
  isOpen, 
  onClose, 
  onTaxesChange 
}) => {
  const [taxes, setTaxes] = useState<TaxeUtilisateur[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxeUtilisateur | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    type: 'percentage' as 'percentage' | 'fixed',
    valeur: 0,
    base: 'HT' as 'HT' | 'HT_plus_taxes_precedentes',
    affecteTVAProduit: false,
    applicableDocuments: [] as ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[],
    actif: true
  });

  const { query, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isOpen && isReady) {
      loadTaxes();
    }
  }, [isOpen, isReady]);

  const loadTaxes = async () => {
    if (!isElectron) {
      const savedTaxes = localStorage.getItem('taxesUtilisateur');
      if (savedTaxes) {
        const loadedTaxes = JSON.parse(savedTaxes);
        setTaxes(loadedTaxes);
        onTaxesChange(loadedTaxes);
      }
      return;
    }

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS taxes_utilisateur (
          id TEXT PRIMARY KEY,
          nom TEXT NOT NULL,
          type TEXT NOT NULL,
          valeur REAL NOT NULL,
          base TEXT NOT NULL,
          ordre INTEGER NOT NULL,
          affecteTVAProduit BOOLEAN DEFAULT 0,
          applicableDocuments TEXT NOT NULL,
          actif BOOLEAN DEFAULT 1
        )
      `);

      const result = await query('SELECT * FROM taxes_utilisateur ORDER BY ordre ASC');
      const loadedTaxes = result.map((tax: any) => ({
        ...tax,
        applicableDocuments: JSON.parse(tax.applicableDocuments),
        affecteTVAProduit: Boolean(tax.affecteTVAProduit),
        actif: Boolean(tax.actif)
      }));
      
      setTaxes(loadedTaxes);
      onTaxesChange(loadedTaxes);
    } catch (error) {
      console.error('Error loading taxes utilisateur:', error);
    }
  };

  const saveTaxes = async (updatedTaxes: TaxeUtilisateur[]) => {
    if (!isElectron) {
      localStorage.setItem('taxesUtilisateur', JSON.stringify(updatedTaxes));
      return;
    }

    try {
      await query('DELETE FROM taxes_utilisateur');
      
      for (const tax of updatedTaxes) {
        await query(
          `INSERT INTO taxes_utilisateur 
           (id, nom, type, valeur, base, ordre, affecteTVAProduit, applicableDocuments, actif)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tax.id,
            tax.nom,
            tax.type,
            tax.valeur,
            tax.base,
            tax.ordre,
            tax.affecteTVAProduit ? 1 : 0,
            JSON.stringify(tax.applicableDocuments),
            tax.actif ? 1 : 0
          ]
        );
      }
    } catch (error) {
      console.error('Error saving taxes utilisateur:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nom.trim()) {
      alert('Le nom de la taxe est obligatoire');
      return;
    }

    if (formData.valeur <= 0) {
      alert('La valeur de la taxe doit être supérieure à 0');
      return;
    }

    if (formData.applicableDocuments.length === 0) {
      alert('Veuillez sélectionner au moins un type de document');
      return;
    }

    const taxData: TaxeUtilisateur = {
      id: editingTax?.id || uuidv4(),
      nom: formData.nom.trim(),
      type: formData.type,
      valeur: formData.valeur,
      base: formData.base,
      ordre: editingTax?.ordre || taxes.length + 1,
      affecteTVAProduit: formData.affecteTVAProduit,
      applicableDocuments: formData.applicableDocuments,
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
      onTaxesChange(updatedTaxes);
      
      setShowForm(false);
      setEditingTax(null);
      resetForm();
    } catch (error) {
      alert('Erreur lors de la sauvegarde de la taxe');
    }
  };

  const handleEdit = (tax: TaxeUtilisateur) => {
    setEditingTax(tax);
    setFormData({
      nom: tax.nom,
      type: tax.type,
      valeur: tax.valeur,
      base: tax.base,
      affecteTVAProduit: tax.affecteTVAProduit,
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
        onTaxesChange(updatedTaxes);
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
      onTaxesChange(updatedTaxes);
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
    
    [newTaxes[currentIndex], newTaxes[targetIndex]] = [newTaxes[targetIndex], newTaxes[currentIndex]];
    
    const updatedTaxes = newTaxes.map((tax, index) => ({
      ...tax,
      ordre: index + 1
    }));

    try {
      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange(updatedTaxes);
    } catch (error) {
      alert('Erreur lors du réordonnancement des taxes');
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      type: 'percentage',
      valeur: 0,
      base: 'HT',
      affecteTVAProduit: false,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <Settings className="w-6 h-6 mr-2 text-blue-600" />
            Configuration des taxes personnalisées
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Système de taxes dynamiques</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>TVA produit</strong> : Définie directement dans chaque produit</li>
              <li>• <strong>Taxes personnalisées</strong> : FODEC, Timbre, etc. configurables ici</li>
              <li>• <strong>Calcul en cascade</strong> : Les taxes s'appliquent dans l'ordre défini</li>
              <li>• <strong>Base ajustée</strong> : Certaines taxes peuvent modifier la base de calcul de la TVA</li>
            </ul>
          </div>

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Taxes configurées ({taxes.length})
            </h3>
            <button
              onClick={() => {
                resetForm();
                setEditingTax(null);
                setShowForm(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle taxe</span>
            </button>
          </div>

          {/* Tax List */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-6">
            {taxes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Aucune taxe personnalisée configurée.</p>
                <p className="text-sm">Les produits utiliseront uniquement leur TVA individuelle.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affecte TVA</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documents</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {taxes.map((tax, index) => (
                    <tr key={tax.id} className={tax.actif ? '' : 'opacity-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{tax.ordre}</span>
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
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          tax.type === 'percentage' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {tax.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {tax.type === 'percentage' ? `${tax.valeur}%` : `${tax.valeur.toFixed(3)} TND`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tax.type === 'percentage' ? (
                          tax.base === 'HT' ? 'Total HT' : 'HT + taxes précédentes'
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {tax.affecteTVAProduit ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Oui
                          </span>
                        ) : (
                          <span className="text-gray-400">Non</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {tax.applicableDocuments.map(doc => (
                            <span key={doc} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
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

          {/* Tax Form */}
          {showForm && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                {editingTax ? 'Modifier la taxe' : 'Nouvelle taxe'}
              </h4>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de la taxe *
                    </label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: FODEC, Timbre fiscal, Écotaxe..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de taxe *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="percentage">Pourcentage</option>
                      <option value="fixed">Montant fixe</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valeur *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.valeur}
                        onChange={(e) => setFormData(prev => ({ ...prev, valeur: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        step="0.001"
                        min="0"
                        required
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-sm">
                        {formData.type === 'percentage' ? '%' : 'TND'}
                      </span>
                    </div>
                  </div>

                  {formData.type === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base de calcul *
                      </label>
                      <select
                        value={formData.base}
                        onChange={(e) => setFormData(prev => ({ ...prev, base: e.target.value as 'HT' | 'HT_plus_taxes_precedentes' }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="HT">Total HT</option>
                        <option value="HT_plus_taxes_precedentes">HT + taxes précédentes</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Affecte TVA Produit */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={formData.affecteTVAProduit}
                      onChange={(e) => setFormData(prev => ({ ...prev, affecteTVAProduit: e.target.checked }))}
                      className="mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="ml-3">
                      <label className="font-medium text-orange-900">
                        Inclure cette taxe dans la base de calcul de la TVA des produits
                      </label>
                      <p className="text-sm text-orange-700 mt-1">
                        Si activé, la TVA de chaque produit sera calculée sur : (HT + montant de cette taxe) × taux_TVA_produit
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        <strong>Exemple :</strong> FODEC 1% → TVA = (HT + FODEC) × 19%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Documents applicables */}
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

                {/* Statut */}
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

                <div className="flex justify-end space-x-4 pt-4 border-t">
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
          )}
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaxeUtilisateurForm;