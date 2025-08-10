import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Package, ShoppingCart, Store, Filter, Upload } from 'lucide-react';
import { Produit } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/currency';
import ProduitForm from './ProduitForm';
import CSVImportDialog from './CSVImportDialog';
import { ImportResult } from '../utils/csvImporter';
import { useNotification } from '../contexts/NotificationContext';

const ProduitsList: React.FC = () => {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vente' | 'achat'>('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [newProductType, setNewProductType] = useState<'vente' | 'achat'>('vente');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { query, isReady } = useDatabase();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isReady) {
      loadProduits();
    }
  }, [isReady]);

  // Reload products when component becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadProduits();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadProduits = async () => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT * FROM produits ORDER BY type, nom ASC');
      setProduits(result);
    } catch (error) {
      console.error('Error loading produits:', error);
      showNotification('Erreur lors du chargement des produits', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredProduits = produits.filter(produit => {
    const matchesSearch = produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (produit.ref && produit.ref.toLowerCase().includes(searchTerm.toLowerCase())) ||
      produit.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || produit.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCreateNew = (type: 'vente' | 'achat') => {
    setNewProductType(type);
    setEditingProduit(null);
    setShowForm(true);
  };

  const handleEdit = (produit: Produit) => {
    setEditingProduit(produit);
    setNewProductType(produit.type);
    setShowForm(true);
  };

  const handleSave = (produit: Produit) => {
    if (editingProduit) {
      setProduits(produits.map(p => p.id === produit.id ? produit : p));
    } else {
      setProduits([produit, ...produits]);
    }
    setShowForm(false);
    setEditingProduit(null);
    
    // Reload to ensure sync
    setTimeout(() => {
      loadProduits();
    }, 100);
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        // Delete all related document lines first
        await query('DELETE FROM lignes_facture WHERE produitId = ?', [id]);
        await query('DELETE FROM lignes_devis WHERE produitId = ?', [id]);
        await query('DELETE FROM lignes_bon_livraison WHERE produitId = ?', [id]);
        await query('DELETE FROM lignes_commande_fournisseur WHERE produitId = ?', [id]);
        await query('DELETE FROM stock_movements WHERE produitId = ?', [id]);
        await query('DELETE FROM produits WHERE id = ?', [id]);
        setProduits(produits.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error deleting produit:', error);
        showNotification('Erreur lors de la suppression du produit', 'error');
      }
    }
  };

  const handleImportComplete = (result: ImportResult) => {
    if (result.success) {
      // Reload products to show imported data
      loadProduits();
      setShowImportDialog(false);
      
      // Show success message
      showNotification(`Importation réussie! ${result.imported} produit(s) importé(s), ${result.duplicates} doublon(s) ignoré(s), ${result.skipped} ligne(s) ignorée(s)`, 'success');
    }
  };

  const getTypeIcon = (type: 'vente' | 'achat') => {
    return type === 'vente' ? Store : ShoppingCart;
  };

  const getTypeColor = (type: 'vente' | 'achat') => {
    return type === 'vente' ? 'text-green-600' : 'text-purple-600';
  };

  const getTypeLabel = (type: 'vente' | 'achat') => {
    return type === 'vente' ? 'Vente' : 'Achat';
  };

  const getTypeBadgeColor = (type: 'vente' | 'achat') => {
    return type === 'vente' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800';
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    const venteProducts = produits.filter(p => p.type === 'vente');
    const achatProducts = produits.filter(p => p.type === 'achat');
    
    return {
      total: produits.length,
      vente: venteProducts.length,
      achat: achatProducts.length,
      venteValue: venteProducts.reduce((sum, p) => sum + p.prixUnitaire, 0),
      achatValue: achatProducts.reduce((sum, p) => sum + p.prixUnitaire, 0)
    };
  }, [produits]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initialisation de la base de données...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, référence ou description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-80"
              />
            </div>
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'vente' | 'achat')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Tous les types</option>
                <option value="vente">Produits de vente</option>
                <option value="achat">Produits d'achat</option>
              </select>
            </div>
            <button
              onClick={loadProduits}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowImportDialog(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Importer CSV</span>
            </button>
            <button
              onClick={() => handleCreateNew('vente')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Store className="w-4 h-4" />
              <span>Produit de vente</span>
            </button>
            <button
              onClick={() => handleCreateNew('achat')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Produit d'achat</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total produits</p>
                <p className="text-xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Produits de vente</p>
                <p className="text-xl font-bold text-green-600">{stats.vente}</p>
                <p className="text-xs text-gray-500">Factures, devis, livraisons</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-purple-500 p-3 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Produits d'achat</p>
                <p className="text-xl font-bold text-purple-600">{stats.achat}</p>
                <p className="text-xs text-gray-500">Commandes fournisseur</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-orange-500 p-3 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Valeur moyenne</p>
                <p className="text-xl font-bold text-orange-600">
                  {stats.total > 0 ? formatCurrency((stats.venteValue + stats.achatValue) / stats.total) : formatCurrency(0)}
                </p>
                <p className="text-xs text-gray-500">Prix unitaire moyen</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Store className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="font-medium text-green-900">Produits de vente</h3>
            </div>
            <p className="text-sm text-green-700">
              Utilisés dans les <strong>factures</strong>, <strong>devis</strong> et <strong>bons de livraison</strong>. 
              Ces produits représentent ce que vous vendez à vos clients.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <ShoppingCart className="w-5 h-5 text-purple-600 mr-2" />
              <h3 className="font-medium text-purple-900">Produits d'achat</h3>
            </div>
            <p className="text-sm text-purple-700">
              Utilisés dans les <strong>commandes fournisseur</strong>. 
              Ces produits représentent ce que vous achetez auprès de vos fournisseurs.
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unitaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProduits.map((produit) => {
                const TypeIcon = getTypeIcon(produit.type);
                return (
                  <tr key={produit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TypeIcon className={`w-4 h-4 mr-2 ${getTypeColor(produit.type)}`} />
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(produit.type)}`}>
                          {getTypeLabel(produit.type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {produit.ref || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 mr-2 text-gray-400" />
                        {produit.nom}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {produit.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {formatCurrency(produit.prixUnitaire)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.tva}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.stock || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(produit)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(produit.id)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProduits.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm || typeFilter !== 'all'
                  ? 'Aucun produit trouvé avec ces critères' 
                  : 'Aucun produit créé pour le moment'}
              </p>
              {!searchTerm && typeFilter === 'all' && (
                <div className="mt-4 flex justify-center space-x-4">
                  <button
                    onClick={() => handleCreateNew('vente')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Store className="w-4 h-4" />
                    <span>Créer un produit de vente</span>
                  </button>
                  <button
                    onClick={() => handleCreateNew('achat')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Créer un produit d'achat</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product Form Dialog */}
      <ProduitForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingProduit(null);
        }}
        onSave={handleSave}
        produit={editingProduit}
        defaultType={newProductType}
      />

      {/* CSV Import Dialog */}
      <CSVImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        type="produits"
        existingData={produits}
        onImportComplete={handleImportComplete}
        query={query}
      />
    </>
  );
};

export default ProduitsList;