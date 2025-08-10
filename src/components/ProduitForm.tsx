import React, { useState, useEffect } from 'react';
import { X, Save, Store, ShoppingCart, CheckCircle } from 'lucide-react';
import { Produit } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '../contexts/NotificationContext';

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
    tva: 19,
    fodecApplicable: false,
    tauxFodec: 1,
    stock: 0,
    type: defaultType as 'vente' | 'achat'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { query, isReady } = useDatabase();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen && isReady) {
      setError(null);
      setSuccessMessage(null);
      if (produit) {
        setFormData({
          ref: produit.ref || '',
          nom: produit.nom,
          description: produit.description || '',
          prixUnitaire: produit.prixUnitaire,
          tva: produit.tva,
          fodecApplicable: produit.fodecApplicable || false,
          tauxFodec: produit.tauxFodec || 1,
          stock: produit.stock || 0,
          type: produit.type || 'vente' // Default to 'vente' for backward compatibility
        });
      } else {
        // Generate product ref automatically for new products (optional)
        generateProductRef(defaultType);
        // Load FODEC auto-enable setting
        loadFodecAutoSetting(defaultType);
        setFormData({
          ref: '',
          nom: '',
          description: '',
          prixUnitaire: 0,
          tva: 19,
          fodecApplicable: false,
          tauxFodec: 1,
          stock: 0,
          type: defaultType
        });
      }
    }
  }, [produit, isOpen, defaultType, isReady]);

  const loadFodecAutoSetting = async (type: 'vente' | 'achat') => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['generalSettings']);
      if (result.length > 0) {
        const generalSettings = JSON.parse(result[0].value);
        if (generalSettings.autoEnableFodec) {
          setFormData(prev => ({ ...prev, fodecApplicable: true }));
        }
      }
    } catch (error) {
      console.error('Error loading FODEC auto setting:', error);
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
        tva: formData.tva,
        fodecApplicable: formData.fodecApplicable,
        tauxFodec: formData.tauxFodec,
        stock: formData.stock,
        type: formData.type
      };

      await query(
        `INSERT OR REPLACE INTO produits 
         (id, ref, nom, description, prixUnitaire, tva, fodecApplicable, tauxFodec, stock, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          produitData.id,
          produitData.ref || null,
          produitData.nom,
          produitData.description,
          produitData.prixUnitaire,
          produitData.tva,
          produitData.fodecApplicable ? 1 : 0,
          produitData.tauxFodec,
          produitData.stock,
          produitData.type
        ]
      );

      onSave(produitData);
      
      // Ensure tax group exists for this product's tax rate
      if (produitData.tva > 0) {
        ensureTaxGroupForProduct(produitData.tva, query);
      }
      
      // Show success message and reset form for new product
      setSuccessMessage(`Produit "${produitData.nom}" créé avec succès!`);
      
      // Reset form for next product
      setFormData({
        ref: '',
        nom: '',
        description: '',
        prixUnitaire: 0,
        tva: 19,
        fodecApplicable: false,
        tauxFodec: 1,
        stock: 0,
        type: formData.type // Keep the same type
      });
      
      // Generate new ref for next product
      generateProductRef(formData.type);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      // Only close if editing existing product
      if (produit) {
        onClose();
      }
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
      setSuccessMessage(null); // Clear success message when user starts editing
    }
  };

  const handleTypeChange = (type: 'vente' | 'achat') => {
    setFormData(prev => ({ ...prev, type }));
    generateProductRef(type);
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
          
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              {successMessage}
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
                value={formData.prixUnitaire === null ? '' : formData.prixUnitaire}
                onChange={(e) => {
                  const value = e.target.value;
                  const parsedValue = parseFloat(value);
                  handleChange('prixUnitaire', isNaN(parsedValue) ? null : parsedValue);
                }}
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
                TVA (%)
              </label>
              <select
                value={formData.tva}
                onChange={(e) => handleChange('tva', parseFloat(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                  formData.type === 'vente' 
                    ? 'border-green-300 focus:ring-green-500' 
                    : 'border-purple-300 focus:ring-purple-500'
                }`}
                disabled={isSubmitting}
              >
                <option value={0}>0%</option>
                <option value={7}>7%</option>
                <option value={13}>13%</option>
                <option value={19}>19%</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FODEC applicable
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fodecApplicable"
                    checked={formData.fodecApplicable === true}
                    onChange={() => handleChange('fodecApplicable', true)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="ml-2 text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fodecApplicable"
                    checked={formData.fodecApplicable === false}
                    onChange={() => handleChange('fodecApplicable', false)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="ml-2 text-sm text-gray-700">Non</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                FODEC obligatoire pour les produits industriels locaux
              </p>
            </div>

            {formData.fodecApplicable && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux FODEC (%)
                </label>
                <input
                  type="number"
                  value={formData.tauxFodec}
                  onChange={(e) => handleChange('tauxFodec', parseFloat(e.target.value) || 1)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent ${
                    formData.type === 'vente' 
                      ? 'border-green-300 focus:ring-green-500' 
                      : 'border-purple-300 focus:ring-purple-500'
                  }`}
                  step="0.1"
                  min="0"
                  max="10"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Taux par défaut: 1%
                </p>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock
              </label>
              <input
                type="number"
                value={formData.stock === null ? '' : formData.stock}
                onChange={(e) => {
                  const value = e.target.value;
                  const parsedValue = parseInt(value);
                  handleChange('stock', isNaN(parsedValue) ? null : parsedValue);
                }}
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
              {produit ? 'Annuler' : 'Fermer'}
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
              {isSubmitting ? 'Enregistrement...' : produit ? 'Modifier' : 'Créer le produit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProduitForm;