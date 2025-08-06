import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Calculator, Percent, DollarSign, ArrowUp, ArrowDown, Settings, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { TaxGroup } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

const TaxSettings: React.FC = () => {
  const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    calculationBase: 'HT' as 'HT' | 'HT_plus_previous_taxes',
    applicableDocuments: ['factures', 'devis', 'bonsLivraison', 'commandesFournisseur'] as ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[],
    order: 1,
    isActive: true
  });

  const { query, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadTaxGroups();
    }
  }, [isReady]);

  const loadTaxGroups = async () => {
    if (!isReady) return;
    
    try {
      const result = await query(`
        SELECT * FROM tax_groups 
        ORDER BY order_index ASC, value ASC
      `);
      
      const groups = result.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        value: row.value,
        calculationBase: row.calculationBase,
        applicableDocuments: row.applicableDocuments ? JSON.parse(row.applicableDocuments) : ['factures', 'devis', 'bonsLivraison', 'commandesFournisseur'],
        order: row.order_index,
        isAutoCreated: Boolean(row.isAutoCreated),
        isActive: Boolean(row.isActive)
      }));
      
      setTaxGroups(groups);
    } catch (error) {
      console.error('Error loading tax groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTax(null);
    setFormData({
      name: '',
      type: 'percentage',
      value: 0,
      calculationBase: 'HT',
      applicableDocuments: ['factures', 'devis', 'bonsLivraison', 'commandesFournisseur'],
      order: Math.max(...taxGroups.map(t => t.order), 0) + 1,
      isActive: true
    });
    setShowForm(true);
  };

  const handleEdit = (tax: TaxGroup) => {
    setEditingTax(tax);
    setFormData({
      name: tax.name,
      type: tax.type,
      value: tax.value,
      calculationBase: tax.calculationBase,
      applicableDocuments: tax.applicableDocuments || ['factures', 'devis', 'bonsLivraison', 'commandesFournisseur'],
      order: tax.order,
      isActive: tax.isActive
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!isReady) return;
    
    if (!formData.name.trim()) {
      alert('Le nom de la taxe est obligatoire');
      return;
    }

    if (formData.value <= 0) {
      alert('La valeur de la taxe doit être supérieure à 0');
      return;
    }

    try {
      const taxData: TaxGroup = {
        id: editingTax?.id || uuidv4(),
        name: formData.name.trim(),
        type: formData.type,
        value: formData.value,
        calculationBase: formData.calculationBase,
        applicableDocuments: formData.applicableDocuments,
        order: formData.order,
        isAutoCreated: editingTax?.isAutoCreated || false,
        isActive: formData.isActive
      };

      await query(
        `INSERT OR REPLACE INTO tax_groups 
         (id, name, type, value, calculationBase, applicableDocuments, order_index, isAutoCreated, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taxData.id,
          taxData.name,
          taxData.type,
          taxData.value,
          taxData.calculationBase,
          JSON.stringify(taxData.applicableDocuments),
          taxData.order,
          taxData.isAutoCreated ? 1 : 0,
          taxData.isActive ? 1 : 0
        ]
      );

      setShowForm(false);
      setEditingTax(null);
      loadTaxGroups();
    } catch (error) {
      console.error('Error saving tax:', error);
      alert('Erreur lors de la sauvegarde de la taxe');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette taxe ?')) {
      try {
        await query('DELETE FROM tax_groups WHERE id = ?', [id]);
        loadTaxGroups();
      } catch (error) {
        console.error('Error deleting tax:', error);
        alert('Erreur lors de la suppression de la taxe');
      }
    }
  };

  const handleToggleActive = async (tax: TaxGroup) => {
    try {
      await query(
        'UPDATE tax_groups SET isActive = ? WHERE id = ?',
        [tax.isActive ? 0 : 1, tax.id]
      );
      loadTaxGroups();
    } catch (error) {
      console.error('Error toggling tax status:', error);
      alert('Erreur lors de la modification du statut');
    }
  };

  const moveOrder = async (tax: TaxGroup, direction: 'up' | 'down') => {
    const currentIndex = taxGroups.findIndex(t => t.id === tax.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= taxGroups.length) return;
    
    const targetTax = taxGroups[targetIndex];
    
    try {
      // Swap orders
      await query('UPDATE tax_groups SET order_index = ? WHERE id = ?', [targetTax.order, tax.id]);
      await query('UPDATE tax_groups SET order_index = ? WHERE id = ?', [tax.order, targetTax.id]);
      loadTaxGroups();
    } catch (error) {
      console.error('Error updating tax order:', error);
      alert('Erreur lors de la modification de l\'ordre');
    }
  };

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

  if (loading) {
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
          <h3 className="text-lg font-semibold text-gray-900">Configuration des taxes</h3>
          <p className="text-sm text-gray-600">Gérez les taxes appliquées aux documents</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle taxe</span>
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Calculator className="w-5 h-5 text-blue-600 mr-2" />
            <h4 className="font-medium text-blue-900">Taxes automatiques</h4>
          </div>
          <p className="text-sm text-blue-700">
            Les taxes sont automatiquement créées à partir des taux de TVA des produits. 
            Chaque taux unique génère un groupe de taxe correspondant.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Settings className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="font-medium text-green-900">Taxes manuelles</h4>
          </div>
          <p className="text-sm text-green-700">
            Vous pouvez ajouter des taxes personnalisées avec des bases de calcul spécifiques 
            (HT seul, HT + autres taxes, etc.).
          </p>
        </div>
      </div>

      {/* Tax Groups Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
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
                Source
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
            {taxGroups.map((tax, index) => (
              <tr key={tax.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{tax.order}</span>
                    {!tax.isAutoCreated && (
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => moveOrder(tax, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveOrder(tax, 'down')}
                          disabled={index === taxGroups.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    {tax.type === 'percentage' ? (
                      <Percent className="w-4 h-4 mr-2 text-blue-600" />
                    ) : (
                      <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                    )}
                    {tax.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    tax.type === 'percentage' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {tax.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {tax.value}{tax.type === 'percentage' ? '%' : ' TND'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {tax.calculationBase === 'HT' ? 'Total HT (même TVA) + taxe' : 'Total HT (même TVA) + taxe'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex flex-wrap gap-1">
                    {tax.applicableDocuments?.map(doc => (
                      <span key={doc} className="inline-flex px-1 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                        {doc === 'factures' ? 'Factures' : 
                         doc === 'devis' ? 'Devis' :
                         doc === 'bonsLivraison' ? 'BL' : 'CF'}
                      </span>
                    )) || (
                      <span className="text-gray-400">Tous</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    tax.isAutoCreated ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tax.isAutoCreated ? 'Automatique' : 'Manuelle'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleActive(tax)}
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tax.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {tax.isActive ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Actif
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Inactif
                      </>
                    )}
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
        {taxGroups.length === 0 && (
          <div className="text-center py-12">
            <Calculator className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Aucune taxe configurée</p>
            <p className="text-sm text-gray-400 mt-2">
              Les taxes seront créées automatiquement lors de la création de produits
            </p>
          </div>
        )}
      </div>

      {/* Tax Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTax ? 'Modifier la taxe' : 'Nouvelle taxe'}
              </h2>
              <button 
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de la taxe *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Taxe écologique"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de taxe *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      step="0.01"
                      min="0"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      {formData.type === 'percentage' ? '%' : 'TND'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base de calcul *
                  </label>
                  <select
                    value={formData.calculationBase}
                    onChange={(e) => setFormData(prev => ({ ...prev, calculationBase: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="HT">HT seulement</option>
                    <option value="HT_plus_previous_taxes">HT + taxes précédentes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ordre d'application
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Les taxes sont appliquées dans l'ordre croissant
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documents applicables *
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'factures', label: 'Factures' },
                      { id: 'devis', label: 'Devis' },
                      { id: 'bonsLivraison', label: 'Bons de livraison' },
                      { id: 'commandesFournisseur', label: 'Commandes fournisseur' }
                    ].map(doc => (
                      <label key={doc.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableDocuments.includes(doc.id as any)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                applicableDocuments: [...prev.applicableDocuments, doc.id as any]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                applicableDocuments: prev.applicableDocuments.filter(d => d !== doc.id)
                              }));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{doc.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Taxe active</label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};

export default TaxSettings;