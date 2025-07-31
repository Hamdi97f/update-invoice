import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Calculator, ArrowUp, ArrowDown, ToggleLeft, ToggleRight, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { Tax } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

const TaxConfiguration: React.FC = () => {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nom: '',
    type: 'percentage' as 'percentage' | 'fixed',
    valeur: 0,
    calculationBase: 'totalHT' as 'totalHT' | 'totalHTWithPreviousTaxes',
    applicableDocuments: [] as ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[],
    ordre: 1,
    actif: true
  });

  const { query, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadTaxes();
    }
  }, [isReady]);

  const loadTaxes = async () => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query('SELECT * FROM taxes ORDER BY ordre ASC');
        const loadedTaxes = result.map((tax: any) => ({
          ...tax,
          applicableDocuments: JSON.parse(tax.applicableDocuments),
          actif: Boolean(tax.actif)
        }));
        setTaxes(loadedTaxes);
      } else {
        const savedTaxes = localStorage.getItem('taxes');
        if (savedTaxes) {
          setTaxes(JSON.parse(savedTaxes));
        }
      }
    } catch (error) {
      console.error('Error loading taxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTax(null);
    setFormData({
      nom: '',
      type: 'percentage',
      valeur: 0,
      calculationBase: 'totalHT',
      applicableDocuments: ['factures'],
      ordre: taxes.length + 1,
      actif: true
    });
    setShowForm(true);
  };

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax);
    setFormData({
      nom: tax.nom,
      type: tax.type,
      valeur: tax.valeur,
      calculationBase: tax.calculationBase,
      applicableDocuments: [...tax.applicableDocuments],
      ordre: tax.ordre,
      actif: tax.actif
    });
    setShowForm(true);
  };

  const handleSave = async () => {
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

    try {
      const taxData: Tax = {
        id: editingTax?.id || uuidv4(),
        nom: formData.nom.trim(),
        type: formData.type,
        valeur: formData.valeur,
        calculationBase: formData.calculationBase,
        applicableDocuments: formData.applicableDocuments,
        ordre: formData.ordre,
        actif: formData.actif
      };

      if (isElectron) {
        await query(
          `INSERT OR REPLACE INTO taxes 
           (id, nom, type, valeur, calculationBase, applicableDocuments, ordre, actif)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taxData.id,
            taxData.nom,
            taxData.type,
            taxData.valeur,
            taxData.calculationBase,
            JSON.stringify(taxData.applicableDocuments),
            taxData.ordre,
            taxData.actif ? 1 : 0
          ]
        );
      } else {
        const updatedTaxes = editingTax
          ? taxes.map(t => t.id === taxData.id ? taxData : t)
          : [...taxes, taxData];
        setTaxes(updatedTaxes);
        localStorage.setItem('taxes', JSON.stringify(updatedTaxes));
      }

      setShowForm(false);
      setEditingTax(null);
      loadTaxes();
    } catch (error) {
      console.error('Error saving tax:', error);
      alert('Erreur lors de la sauvegarde de la taxe');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette taxe ?')) {
      try {
        if (isElectron) {
          await query('DELETE FROM taxes WHERE id = ?', [id]);
        } else {
          const updatedTaxes = taxes.filter(t => t.id !== id);
          setTaxes(updatedTaxes);
          localStorage.setItem('taxes', JSON.stringify(updatedTaxes));
        }
        loadTaxes();
      } catch (error) {
        console.error('Error deleting tax:', error);
        alert('Erreur lors de la suppression de la taxe');
      }
    }
  };

  const handleToggleActive = async (tax: Tax) => {
    try {
      const updatedTax = { ...tax, actif: !tax.actif };
      
      if (isElectron) {
        await query(
          'UPDATE taxes SET actif = ? WHERE id = ?',
          [updatedTax.actif ? 1 : 0, tax.id]
        );
      } else {
        const updatedTaxes = taxes.map(t => t.id === tax.id ? updatedTax : t);
        setTaxes(updatedTaxes);
        localStorage.setItem('taxes', JSON.stringify(updatedTaxes));
      }
      
      loadTaxes();
    } catch (error) {
      console.error('Error toggling tax status:', error);
      alert('Erreur lors de la modification du statut de la taxe');
    }
  };

  const handleMoveOrder = async (tax: Tax, direction: 'up' | 'down') => {
    const currentIndex = taxes.findIndex(t => t.id === tax.id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === taxes.length - 1)
    ) {
      return;
    }

    const newTaxes = [...taxes];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap the taxes
    [newTaxes[currentIndex], newTaxes[targetIndex]] = [newTaxes[targetIndex], newTaxes[currentIndex]];
    
    // Update order values
    newTaxes.forEach((tax, index) => {
      tax.ordre = index + 1;
    });

    try {
      if (isElectron) {
        for (const updatedTax of newTaxes) {
          await query(
            'UPDATE taxes SET ordre = ? WHERE id = ?',
            [updatedTax.ordre, updatedTax.id]
          );
        }
      } else {
        setTaxes(newTaxes);
        localStorage.setItem('taxes', JSON.stringify(newTaxes));
      }
      
      loadTaxes();
    } catch (error) {
      console.error('Error updating tax order:', error);
      alert('Erreur lors de la modification de l\'ordre des taxes');
    }
  };

  const handleDocumentTypeChange = (docType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur', checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        applicableDocuments: [...prev.applicableDocuments, docType]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        applicableDocuments: prev.applicableDocuments.filter(d => d !== docType)
      }));
    }
  };

  const getDocumentTypeLabel = (docType: string) => {
    switch (docType) {
      case 'factures': return 'Factures';
      case 'devis': return 'Devis';
      case 'bonsLivraison': return 'Bons de livraison';
      case 'commandesFournisseur': return 'Commandes fournisseur';
      default: return docType;
    }
  };

  const formatTaxDisplay = (tax: Tax): string => {
    if (tax.type === 'fixed') {
      return `${tax.valeur.toFixed(3)} TND`;
    } else {
      return `${tax.valeur}%`;
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-blue-600" />
            Configuration des taxes personnalisées
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Créez et gérez vos taxes personnalisées (Timbre fiscal, taxes spéciales, etc.)
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle taxe</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Calculator className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Taxes personnalisées</h4>
            <p className="text-sm text-blue-700 mt-1">
              Configurez des taxes spécifiques comme le timbre fiscal, taxes municipales, ou autres prélèvements.
              Ces taxes s'ajoutent au calcul automatique de TVA et peuvent être appliquées à différents types de documents.
            </p>
          </div>
        </div>
      </div>

      {/* Taxes List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {taxes.length > 0 ? (
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
                <tr key={tax.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{tax.ordre}</span>
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => handleMoveOrder(tax, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Monter"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(tax, 'down')}
                          disabled={index === taxes.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Descendre"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calculator className="w-4 h-4 mr-2 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">{tax.nom}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tax.type === 'percentage' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {tax.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatTaxDisplay(tax)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tax.calculationBase === 'totalHT' ? 'Total HT' : 'Total HT + taxes précédentes'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {tax.applicableDocuments.map(doc => (
                        <span key={doc} className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                          {getDocumentTypeLabel(doc)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(tax)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tax.actif ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          tax.actif ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
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
        ) : (
          <div className="text-center py-12">
            <Calculator className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">Aucune taxe personnalisée configurée</p>
            <button
              onClick={handleCreateNew}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer la première taxe
            </button>
          </div>
        )}
      </div>

      {/* Tax Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTax ? 'Modifier la taxe' : 'Nouvelle taxe personnalisée'}
              </h2>
              <button 
                onClick={() => setShowForm(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de la taxe *
                    </label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Timbre Fiscal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ordre d'application
                    </label>
                    <input
                      type="number"
                      value={formData.ordre}
                      onChange={(e) => setFormData(prev => ({ ...prev, ordre: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Les taxes sont appliquées dans l'ordre croissant
                    </p>
                  </div>
                </div>

                {/* Tax Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Type de taxe *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        value="percentage"
                        checked={formData.type === 'percentage'}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'percentage' }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <div className="font-medium text-gray-900">Pourcentage</div>
                        <div className="text-sm text-gray-500">Ex: 1.5% du montant</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        value="fixed"
                        checked={formData.type === 'fixed'}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'fixed' }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <div className="font-medium text-gray-900">Montant fixe</div>
                        <div className="text-sm text-gray-500">Ex: 1.000 TND</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Tax Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'percentage' ? 'Pourcentage (%)' : 'Montant (TND)'} *
                  </label>
                  <input
                    type="number"
                    value={formData.valeur}
                    onChange={(e) => setFormData(prev => ({ ...prev, valeur: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step={formData.type === 'percentage' ? '0.1' : '0.001'}
                    min="0"
                    placeholder={formData.type === 'percentage' ? 'Ex: 1.5' : 'Ex: 1.000'}
                    required
                  />
                </div>

                {/* Calculation Base (only for percentage) */}
                {formData.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Base de calcul
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="totalHT"
                          checked={formData.calculationBase === 'totalHT'}
                          onChange={(e) => setFormData(prev => ({ ...prev, calculationBase: e.target.value as 'totalHT' }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <div className="text-gray-700 font-medium">Total HT</div>
                          <div className="text-sm text-gray-500">
                            La taxe est calculée sur le montant hors taxes uniquement
                          </div>
                        </div>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="totalHTWithPreviousTaxes"
                          checked={formData.calculationBase === 'totalHTWithPreviousTaxes'}
                          onChange={(e) => setFormData(prev => ({ ...prev, calculationBase: e.target.value as 'totalHTWithPreviousTaxes' }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <div className="text-gray-700 font-medium">Total HT + taxes précédentes</div>
                          <div className="text-sm text-gray-500">
                            La taxe est calculée sur le montant HT plus les taxes appliquées avant celle-ci
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Applicable Documents */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Types de documents applicables *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['factures', 'devis', 'bonsLivraison', 'commandesFournisseur'] as const).map(docType => (
                      <label key={docType} className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.applicableDocuments.includes(docType)}
                          onChange={(e) => handleDocumentTypeChange(docType, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-700">
                          {getDocumentTypeLabel(docType)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Active Status */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Taxe active</h4>
                    <p className="text-sm text-gray-600">
                      Cette taxe sera appliquée aux nouveaux documents
                    </p>
                  </div>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, actif: !prev.actif }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.actif ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.actif ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Preview */}
                {formData.nom && formData.valeur > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Aperçu</h4>
                    <div className="text-sm text-blue-700">
                      <div>Nom affiché: <strong>{formData.nom}</strong></div>
                      <div>
                        Valeur: <strong>{formatTaxDisplay(formData as Tax)}</strong>
                      </div>
                      <div>
                        Applicable aux: <strong>
                          {formData.applicableDocuments.map(d => getDocumentTypeLabel(d)).join(', ')}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
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

      {/* Usage Examples */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-gray-600" />
          Exemples d'utilisation
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg border">
            <h5 className="font-medium text-gray-900 mb-2">Timbre Fiscal</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Type: Montant fixe</li>
              <li>• Valeur: 1.000 TND</li>
              <li>• Applicable aux: Factures</li>
              <li>• Ordre: 1 (appliqué en premier)</li>
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <h5 className="font-medium text-gray-900 mb-2">Taxe Municipale</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Type: Pourcentage</li>
              <li>• Valeur: 0.5%</li>
              <li>• Base: Total HT + taxes précédentes</li>
              <li>• Applicable aux: Factures, Devis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxConfiguration;