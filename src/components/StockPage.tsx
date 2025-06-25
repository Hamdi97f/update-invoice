import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Plus, Minus, RefreshCw, AlertTriangle, CheckCircle, Store, ShoppingCart, Settings, Save, X } from 'lucide-react';
import { Produit } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/currency';

interface StockMovement {
  id: string;
  produitId: string;
  produitNom: string;
  produitRef?: string;
  type: 'entree' | 'sortie';
  quantite: number;
  date: Date;
  source: string;
  sourceId: string;
  sourceNumero: string;
}

interface StockSettings {
  allowNegativeStock: boolean;
}

const StockPage: React.FC = () => {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vente' | 'achat'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortField, setSortField] = useState<'nom' | 'ref' | 'stock' | 'type'>('nom');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Produit | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [stockSettings, setStockSettings] = useState<StockSettings>({
    allowNegativeStock: true
  });
  
  const { query, isElectron } = useDatabase();

  useEffect(() => {
    loadProduits();
    loadStockSettings();
  }, []);

  const loadProduits = async () => {
    try {
      if (isElectron) {
        const result = await query('SELECT * FROM produits ORDER BY nom ASC');
        setProduits(result);
      } else {
        const savedProduits = localStorage.getItem('produits');
        if (savedProduits) {
          const parsedProduits = JSON.parse(savedProduits);
          setProduits(parsedProduits);
        }
      }
    } catch (error) {
      console.error('Error loading produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStockSettings = async () => {
    try {
      if (isElectron) {
        const result = await query('SELECT value FROM settings WHERE key = ?', ['stockSettings']);
        if (result.length > 0) {
          setStockSettings(JSON.parse(result[0].value));
        }
      } else {
        const savedSettings = localStorage.getItem('stockSettings');
        if (savedSettings) {
          setStockSettings(JSON.parse(savedSettings));
        }
      }
    } catch (error) {
      console.error('Error loading stock settings:', error);
    }
  };

  const saveStockSettings = async () => {
    try {
      if (isElectron) {
        await query(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['stockSettings', JSON.stringify(stockSettings)]
        );
      } else {
        localStorage.setItem('stockSettings', JSON.stringify(stockSettings));
      }
      alert('Paramètres de stock sauvegardés avec succès');
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving stock settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    }
  };

  const loadStockMovements = async (produitId: string) => {
    try {
      if (isElectron) {
        // This is a simplified query - in a real app, you would join with factures, bons_livraison, etc.
        const result = await query(`
          SELECT * FROM stock_movements 
          WHERE produitId = ?
          ORDER BY date DESC
        `, [produitId]);
        
        setStockMovements(result.map((m: any) => ({
          ...m,
          date: new Date(m.date)
        })));
      } else {
        // For web version, we'll use mock data
        const mockMovements: StockMovement[] = [
          {
            id: '1',
            produitId,
            produitNom: selectedProduct?.nom || '',
            produitRef: selectedProduct?.ref,
            type: 'entree',
            quantite: 10,
            date: new Date(2024, 0, 15),
            source: 'commande',
            sourceId: 'cmd1',
            sourceNumero: 'CF-2024-001'
          },
          {
            id: '2',
            produitId,
            produitNom: selectedProduct?.nom || '',
            produitRef: selectedProduct?.ref,
            type: 'sortie',
            quantite: 3,
            date: new Date(2024, 0, 20),
            source: 'facture',
            sourceId: 'fac1',
            sourceNumero: 'FA-2024-005'
          },
          {
            id: '3',
            produitId,
            produitNom: selectedProduct?.nom || '',
            produitRef: selectedProduct?.ref,
            type: 'sortie',
            quantite: 2,
            date: new Date(2024, 1, 5),
            source: 'bon_livraison',
            sourceId: 'bl1',
            sourceNumero: 'BL-2024-003'
          }
        ];
        setStockMovements(mockMovements);
      }
    } catch (error) {
      console.error('Error loading stock movements:', error);
      setStockMovements([]);
    }
  };

  // Sort products
  const sortedProduits = React.useMemo(() => {
    return [...produits].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'nom':
          aValue = a.nom.toLowerCase();
          bValue = b.nom.toLowerCase();
          break;
        case 'ref':
          aValue = (a.ref || '').toLowerCase();
          bValue = (b.ref || '').toLowerCase();
          break;
        case 'stock':
          aValue = a.stock || 0;
          bValue = b.stock || 0;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [produits, sortField, sortDirection]);

  // Filter products
  const filteredProduits = sortedProduits.filter(produit => {
    const matchesSearch = produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (produit.ref && produit.ref.toLowerCase().includes(searchTerm.toLowerCase())) ||
      produit.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || produit.type === typeFilter;
    
    const matchesStock = stockFilter === 'all' || 
      (stockFilter === 'low' && produit.stock !== undefined && produit.stock > 0 && produit.stock <= 5) ||
      (stockFilter === 'out' && produit.stock !== undefined && produit.stock <= 0);
    
    return matchesSearch && matchesType && matchesStock;
  });

  const handleSort = (field: 'nom' | 'ref' | 'stock' | 'type') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'nom' | 'ref' | 'stock' | 'type') => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const handleViewMovements = (produit: Produit) => {
    setSelectedProduct(produit);
    loadStockMovements(produit.id);
    setShowMovements(true);
  };

  const handleStockAdjustment = async (produitId: string, adjustment: number) => {
    // Check if negative stock is allowed
    if (!stockSettings.allowNegativeStock) {
      const product = produits.find(p => p.id === produitId);
      if (product && (product.stock || 0) + adjustment < 0) {
        alert('Stock négatif non autorisé. Veuillez ajuster la quantité.');
        return;
      }
    }

    try {
      if (isElectron) {
        // Update product stock
        await query(
          'UPDATE produits SET stock = stock + ? WHERE id = ?',
          [adjustment, produitId]
        );
        
        // Record stock movement
        await query(
          `INSERT INTO stock_movements 
           (id, produitId, produitNom, produitRef, type, quantite, date, source, sourceId, sourceNumero)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            produitId,
            produits.find(p => p.id === produitId)?.nom || '',
            produits.find(p => p.id === produitId)?.ref || null,
            adjustment > 0 ? 'entree' : 'sortie',
            Math.abs(adjustment),
            new Date().toISOString(),
            'ajustement_manuel',
            '',
            'Ajustement manuel'
          ]
        );
      } else {
        // For web version, update in localStorage
        const updatedProduits = produits.map(p => {
          if (p.id === produitId) {
            return {
              ...p,
              stock: (p.stock || 0) + adjustment
            };
          }
          return p;
        });
        
        setProduits(updatedProduits);
        localStorage.setItem('produits', JSON.stringify(updatedProduits));
      }
      
      // Reload products to reflect changes
      loadProduits();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Erreur lors de l\'ajustement du stock');
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

  const getStockStatusColor = (stock: number | undefined) => {
    if (stock === undefined) return 'text-gray-500';
    if (stock <= 0) return 'text-red-600';
    if (stock <= 5) return 'text-orange-600';
    return 'text-green-600';
  };

  const getStockStatusLabel = (stock: number | undefined) => {
    if (stock === undefined) return 'Non suivi';
    if (stock <= 0) return 'Rupture';
    if (stock <= 5) return 'Faible';
    return 'En stock';
  };

  const getStockStatusBadgeColor = (stock: number | undefined) => {
    if (stock === undefined) return 'bg-gray-100 text-gray-800';
    if (stock <= 0) return 'bg-red-100 text-red-800';
    if (stock <= 5) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    const totalStock = produits.reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStockCount = produits.filter(p => p.stock !== undefined && p.stock > 0 && p.stock <= 5).length;
    const outOfStockCount = produits.filter(p => p.stock !== undefined && p.stock <= 0).length;
    const totalStockValue = produits.reduce((sum, p) => sum + (p.stock || 0) * p.prixUnitaire, 0);
    
    return {
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalStockValue
    };
  }, [produits]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
              />
            </div>
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'vente' | 'achat')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les types</option>
                <option value="vente">Produits de vente</option>
                <option value="achat">Produits d'achat</option>
              </select>
            </div>
            <div className="relative">
              <Package className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'out')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les niveaux</option>
                <option value="low">Stock faible</option>
                <option value="out">Rupture de stock</option>
              </select>
            </div>
            <button
              onClick={loadProduits}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualiser
            </button>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Settings className="w-5 h-5" />
            <span>Paramètres de stock</span>
          </button>
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
                <p className="text-xl font-bold text-blue-600">{produits.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Quantité en stock</p>
                <p className="text-xl font-bold text-green-600">{stats.totalStock}</p>
                <p className="text-xs text-gray-500">Tous produits confondus</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-orange-500 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Stock faible</p>
                <p className="text-xl font-bold text-orange-600">{stats.lowStockCount}</p>
                <p className="text-xs text-gray-500">Produits à réapprovisionner</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-red-500 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rupture de stock</p>
                <p className="text-xl font-bold text-red-600">{stats.outOfStockCount}</p>
                <p className="text-xs text-gray-500">Produits indisponibles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Value Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Valeur du stock</h3>
                <p className="text-sm text-blue-700">Basée sur les prix unitaires des produits</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(stats.totalStockValue)}</p>
              <p className="text-sm text-blue-600">Valeur totale</p>
            </div>
          </div>
        </div>

        {/* Stock Status Info */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center mb-2">
            <Settings className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="font-medium text-gray-900">Paramètres de stock</h3>
          </div>
          <div className="flex items-center">
            <div className={`flex items-center ${stockSettings.allowNegativeStock ? 'text-green-600' : 'text-red-600'}`}>
              {stockSettings.allowNegativeStock ? (
                <CheckCircle className="w-5 h-5 mr-1" />
              ) : (
                <AlertTriangle className="w-5 h-5 mr-1" />
              )}
              <span className="text-sm font-medium">
                {stockSettings.allowNegativeStock 
                  ? 'Stock négatif autorisé' 
                  : 'Stock négatif non autorisé'}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="ml-4 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Modifier
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Type</span>
                    {getSortIcon('type')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('ref')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Référence</span>
                    {getSortIcon('ref')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('nom')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Produit</span>
                    {getSortIcon('nom')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Stock</span>
                    {getSortIcon('stock')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unitaire
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {produit.ref || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 mr-2 text-gray-400" />
                        <div>
                          <div className="font-medium">{produit.nom}</div>
                          <div className="text-xs text-gray-500 max-w-xs truncate">{produit.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-lg font-bold ${getStockStatusColor(produit.stock)}`}>
                          {produit.stock !== undefined ? produit.stock : '-'}
                        </span>
                        <div className="flex space-x-1 ml-3">
                          <button
                            onClick={() => handleStockAdjustment(produit.id, 1)}
                            className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            title="Ajouter 1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStockAdjustment(produit.id, -1)}
                            className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            title="Retirer 1"
                            disabled={!stockSettings.allowNegativeStock && (produit.stock || 0) <= 0}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusBadgeColor(produit.stock)}`}>
                        {getStockStatusLabel(produit.stock)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {formatCurrency(produit.prixUnitaire)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewMovements(produit)}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Mouvements
                      </button>
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
                {searchTerm || typeFilter !== 'all' || stockFilter !== 'all'
                  ? 'Aucun produit trouvé avec ces critères' 
                  : 'Aucun produit créé pour le moment'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Movements Modal */}
      {showMovements && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold flex items-center">
                <Package className="w-6 h-6 mr-2 text-blue-600" />
                Mouvements de stock: {selectedProduct.nom}
              </h2>
              <button 
                onClick={() => setShowMovements(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Référence:</span> {selectedProduct.ref || '-'}
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Type:</span> {getTypeLabel(selectedProduct.type)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Stock actuel:</span> 
                      <span className={`ml-2 font-bold ${getStockStatusColor(selectedProduct.stock)}`}>
                        {selectedProduct.stock !== undefined ? selectedProduct.stock : '-'}
                      </span>
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Prix unitaire:</span> {formatCurrency(selectedProduct.prixUnitaire)}
                    </p>
                  </div>
                </div>
              </div>

              {stockMovements.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Document
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stockMovements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {movement.date.toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              movement.type === 'entree' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {movement.type === 'entree' ? 'Entrée' : 'Sortie'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={movement.type === 'entree' ? 'text-green-600' : 'text-red-600'}>
                              {movement.type === 'entree' ? '+' : '-'}{movement.quantite}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {movement.source === 'facture' ? 'Facture' : 
                             movement.source === 'bon_livraison' ? 'Bon de livraison' :
                             movement.source === 'commande' ? 'Commande fournisseur' :
                             movement.source === 'ajustement_manuel' ? 'Ajustement manuel' : 
                             movement.source}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {movement.sourceNumero}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Package className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500">Aucun mouvement de stock enregistré pour ce produit</p>
                </div>
              )}

              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> Les mouvements de stock sont générés automatiquement lors de la création de factures, 
                  bons de livraison et commandes fournisseur. Vous pouvez également ajuster manuellement le stock 
                  en utilisant les boutons + et - dans la liste des produits.
                </p>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowMovements(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold flex items-center">
                <Settings className="w-6 h-6 mr-2 text-blue-600" />
                Paramètres de stock
              </h2>
              <button 
                onClick={() => setShowSettings(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Options générales</h3>
                  
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <div className="flex items-start">
                      <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                      <p className="text-sm text-blue-700">
                        Ces paramètres affectent le comportement global de la gestion des stocks dans l'application.
                      </p>
                    </div>
                  </div>
                  
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
                        checked={stockSettings.allowNegativeStock}
                        onChange={() => setStockSettings(prev => ({ ...prev, allowNegativeStock: !prev.allowNegativeStock }))}
                        className="sr-only"
                      />
                      <label
                        htmlFor="toggle-negative-stock"
                        className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                          stockSettings.allowNegativeStock ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
                            stockSettings.allowNegativeStock ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        ></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Implications du stock négatif</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        {stockSettings.allowNegativeStock ? (
                          <>
                            Le stock négatif est <strong>autorisé</strong>. Vous pourrez vendre des produits même si leur quantité en stock est insuffisante.
                            Cela peut être utile pour gérer les commandes en attente de réapprovisionnement.
                          </>
                        ) : (
                          <>
                            Le stock négatif est <strong>interdit</strong>. Vous ne pourrez pas vendre des produits si leur quantité en stock est insuffisante.
                            Cela permet d'éviter les ventes de produits indisponibles.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={saveStockSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StockPage;

// Helper function for UUID generation
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}