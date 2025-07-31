import React, { useState, useEffect } from 'react';
import { X, Save, Store, ShoppingCart } from 'lucide-react';
import { Produit, TaxGroup } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

interface ProduitFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (produit: Produit) => void;
  produit?: Produit | null;
  defaultType?: 'vente' | 'achat';
}

const ProduitForm: React.FC<ProduitFormProps> = ({ isOpen, onClose, onSave, produit, defaultType = 'vente' }) => {
  const [formData, setFormData] = useState({
    ref: '',
    nom: '',
    description: '',
    prixUnitaire: 0,
    taxGroupId: '',
    stock: 0,
    type: defaultType as 'vente' | 'achat'
  });

  const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { query, isReady } = useDatabase();

  useEffect(() => {
    if (isOpen && isReady) {
      loadTaxGroups();
      setError(null);
      if (produit) {
        setFormData({
          ref: produit.ref || '',
          nom: produit.nom,
          description: produit.description || '',
          prixUnitaire: produit.prixUnitaire,
          taxGroupId: (produit as any).taxGroupId || '',
          stock: produit.stock || 0,
          type: produit.type || 'vente' // Default to 'vente' for backward compatibility
        });
      } else {
        // Generate product ref automatically for new products (optional)
        generateProductRef(defaultType);
        setFormData({
          ref: '',
          nom: '',
          description: '',
          prixUnitaire: 0,
          taxGroupId: '',
          stock: 0,
          type: defaultType
        });
      }
    }
  }, [produit, isOpen, defaultType, isReady]);

  const loadTaxGroups = async () => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT * FROM tax_groups WHERE actif = 1 ORDER BY nom ASC');
      const groupsWithTaxes = await Promise.all(result.map(async (group: any) => {
        const groupTaxes = await query(`
          SELECT tgt.*, t.nom, t.type, t.valeur, t.calculationBase, t.actif
          FROM tax_group_taxes tgt
          JOIN taxes t ON tgt.taxId = t.id
          WHERE tgt.taxGroupId = ?
          ORDER BY tgt.ordreInGroup ASC
        `, [group.id]);
        
        return {
          ...group,
          taxes: groupTaxes.map((gt: any) => ({
            taxId: gt.taxId,
            tax: {
              id: gt.taxId,
              nom: gt.nom,
              type: gt.type,
              valeur: gt.valeur,
              calculationBase: gt.calculationBase,
              actif: gt.actif
            },
            ordreInGroup: gt.ordreInGroup,
            calculationBaseInGroup: gt.calculationBaseInGroup
          }))
        };
      }));
      
      setTaxGroups(groupsWithTaxes);
    } catch (error) {
      console.error('Error loading tax groups:', error);
    }
  };

  const generateProductRef = async (type: 'vente' | 'achat') => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT COUNT(*) as count FROM produits WHERE type = ?', [type]);
      const count = result[0]?.count || 0;
      const prefix = type === 'vente' ? 'V' : 'A';
      const productRef = `${prefix}${String(count + 1).padStart(4, '0')}`;
      setFormData(prev => ({ ...prev, ref: productRef }));
    } catch (error) {
      console.error('Error generating product ref:', error);
      const timestamp = Date.now().toString().slice(-6);
      const prefix = type === 'vente' ? 'V' : 'A';
      setFormData(prev => ({ ...prev, ref: `${prefix}${timestamp}` }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || !isReady) return;
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!formData.nom.trim()) {
        setError('Le nom du produit est obligatoire');
        setIsSubmitting(false);
        return;
      }

      if (formData.prixUnitaire <= 0) {
        setError('Le prix unitaire doit être supérieur à 0');
        setIsSubmitting(false);
        return;
      }

      // Check if product ref already exists (only for new products and if ref is provided)
      if (!produit && formData.ref.trim()) {
        const existingProduct = await query('SELECT id FROM produits WHERE ref = ?', [formData.ref.trim()]);
        if (existingProduct.length > 0) {
          setError('Cette référence produit existe déjà. Veuillez en choisir une autre.');
          setIsSubmitting(false);
          return;
        }
      }

      const produitData: Produit = {
        id: produit?.id || uuidv4(),
        ref: formData.ref.trim() || undefined,
        nom: formData.nom.trim(),
        description: formData.description.trim(),
        prixUnitaire: formData.prixUnitaire,
        tva: 0, // Keep for backward compatibility
        stock: formData.stock,
        type: formData.type,
        taxGroupId: formData.taxGroupId || undefined
      };

      await query(
        `INSERT OR REPLACE INTO produits 
         (id, ref, nom, description, prixUnitaire, tva, stock, type, taxGroupId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          produitData.id,
          produitData.ref || null,
          produitData.nom,
          produitData.description,
          produitData.prixUnitaire,
          0, // Keep tva as 0 for backward compatibility
          produitData.stock,
          produitData.type,
          formData.taxGroupId || null
        ]
      );

      onSave(produitData);
      onClose();
    } catch (error: any) {
      console.error('Error saving produit:', error);
      setError(`Erreur lors de la sauvegarde du produit: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'nom' || field === 'prixUnitaire') {
      setError(null); // Clear error when user edits required fields
    }
  };

  const handleTypeChange = (type: 'vente' | 'achat') => {
    setFormData(prev => ({ ...prev, type }));
    generateProductRef(type);
  };

  const getSelectedTaxGroupDisplay = () => {
    if (!formData.taxGroupId) return 'Aucun groupe de taxes sélectionné';
    
    const selectedGroup = taxGroups.find(g => g.id === formData.taxGroupId);
    if (!selectedGroup) return 'Groupe non trouvé';
    
    return selectedGroup.taxes.map(gt => `${gt.tax.nom} (${gt.tax.valeur}${gt.tax.type === 'percentage' ? '%' : ' TND'})`).join(' + ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            {formData.type === 'vente' ? (
              <Store className="w-5 h-5 mr-2 text-green-600" />
            ) : (
              <ShoppingCart className="w-5 h-5 mr-2 text-purple-600" />
            )}
            {produit ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {/* Product Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de produit *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleTypeChange('vente')}
                className={`flex items-center justify-center p-4 rounded-lg border-2 ${
                  formData.type === 'vente' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 hover:border-green-200 hover:bg-green-50'
                }`}
                disabled={isSubmitting}
              >
                <Store className="w-5 h-5 mr-2 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Produit de vente</div>
                  <div className="text-xs text-gray-500">Factures, devis, bons de livraison</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('achat')}
                className={`flex items-center justify-center p-4 rounded-lg border-2 ${
                  formData.type === 'achat' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50'
                }`}
                disabled={isSubmitting}
              >
                <ShoppingCart className="w-5 h-5 mr-2 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">Produit d'achat</div>
                  <div className="text-xs text-gray-500">Commandes fournisseur</div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Référence produit (optionnel)
              </label>
              <input
                type="text"
                value={formData.ref}
                onChange={(e) => handleChange('ref', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent bg-gray-50 ${
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                placeholder={`Ex: ${formData.type === 'vente' ? 'V0001' : 'A0001'}`}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Référence suggérée automatiquement, modifiable
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du produit *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => handleChange('nom', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                  error && !formData.nom.trim() ? 'border-red-300 ring-1 ring-red-500' : 
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                placeholder="Description détaillée du produit ou service..."
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix unitaire (TND) *
              </label>
              <input
                type="number"
                value={formData.prixUnitaire}
                onChange={(e) => handleChange('prixUnitaire', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                  error && formData.prixUnitaire <= 0 ? 'border-red-300 ring-1 ring-red-500' :
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                step="0.001"
                min="0"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Groupe de taxes
              </label>
              <select
                value={formData.taxGroupId}
                onChange={(e) => handleChange('taxGroupId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                disabled={isSubmitting}
              >
                <option value="">Aucun groupe de taxes</option>
                {taxGroups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.nom} ({group.taxes.length} taxe{group.taxes.length > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
              {formData.taxGroupId && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <strong>Taxes appliquées:</strong> {getSelectedTaxGroupDisplay()}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                min="0"
                placeholder="Quantité en stock (optionnel)"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Laissez vide ou 0 pour les services
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-white rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
                formData.type === 'vente' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
              disabled={isSubmitting || !isReady}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProduitForm;