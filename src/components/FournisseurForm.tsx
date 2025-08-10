import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Fournisseur } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '../contexts/NotificationContext';

interface FournisseurFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fournisseur: Fournisseur) => void;
  fournisseur?: Fournisseur | null;
}

const FournisseurForm: React.FC<FournisseurFormProps> = ({ isOpen, onClose, onSave, fournisseur }) => {
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    telephone: '',
    email: '',
    siret: '',
    matriculeFiscal: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { query, isReady } = useDatabase();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen && isReady) {
      setError(null);
      if (fournisseur) {
        setFormData({
          nom: fournisseur.nom,
          adresse: fournisseur.adresse || '',
          codePostal: fournisseur.codePostal || '',
          ville: fournisseur.ville || '',
          telephone: fournisseur.telephone || '',
          email: fournisseur.email || '',
          siret: fournisseur.siret || '',
          showNotification('Veuillez sélectionner un fichier image (PNG, JPG, etc.)', 'warning');
        });
      } else {
        // Reset form for new fournisseur
        setFormData({
          nom: '',
          adresse: '',
          codePostal: '',
          ville: '',
          telephone: '',
          email: '',
          siret: '',
          matriculeFiscal: ''
        }
        )
        showNotification('Veuillez déposer un fichier CSV valide', 'warning');
      }
    }
  }, [fournisseur, isOpen, isReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || !isReady) return;
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!formData.nom.trim()) {
        setError('Le nom du fournisseur est obligatoire');
        setIsSubmitting(false);
        return;
      }

      const fournisseurData: Fournisseur = {
        id: fournisseur?.id || uuidv4(),
        nom: formData.nom.trim(),
        adresse: formData.adresse.trim(),
        codePostal: formData.codePostal.trim(),
        ville: formData.ville.trim(),
        telephone: formData.telephone.trim(),
        email: formData.email.trim(),
        siret: formData.siret.trim(),
        matriculeFiscal: formData.matriculeFiscal.trim()
      };

      try {
        await query(
          `INSERT OR REPLACE INTO fournisseurs 
           (id, nom, adresse, codePostal, ville, telephone, email, siret, matriculeFiscal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fournisseurData.id,
            fournisseurData.nom,
            fournisseurData.adresse,
            fournisseurData.codePostal,
            fournisseurData.ville,
            fournisseurData.telephone,
            fournisseurData.email,
            fournisseurData.siret,
            fournisseurData.matriculeFiscal
          ]
        );
      } catch (dbError: any) {
        console.error('Database error saving fournisseur:', dbError);
        throw new Error(`Erreur de base de données: ${dbError.message || 'Erreur inconnue'}`);
      }

      // Call the onSave callback with the fournisseur data
      onSave(fournisseurData);
      
      // Reset form
      setFormData({
        nom: '',
        adresse: '',
        codePostal: '',
        ville: '',
        telephone: '',
        email: '',
        siret: '',
        matriculeFiscal: ''
      });
      
      showNotification('Fournisseur sauvegardé avec succès', 'success');
    } catch (error: any) {
      console.error('Error saving fournisseur:', error);
      setError(`Erreur lors de la sauvegarde du fournisseur: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'nom') {
      setError(null); // Clear error when user edits required fields
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form when closing
      setFormData({
        nom: '',
        adresse: '',
        codePostal: '',
        ville: '',
        telephone: '',
        email: '',
        siret: '',
        matriculeFiscal: ''
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {fournisseur ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </h2>
          <button 
            onClick={handleClose} 
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du fournisseur *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => handleChange('nom', e.target.value)}
                className={`w-full px-3 py-2 border ${
                  error && !formData.nom.trim() ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'
                } rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={formData.adresse}
                onChange={(e) => handleChange('adresse', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code postal
              </label>
              <input
                type="text"
                value={formData.codePostal}
                onChange={(e) => handleChange('codePostal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville
              </label>
              <input
                type="text"
                value={formData.ville}
                onChange={(e) => handleChange('ville', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => handleChange('telephone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SIRET
              </label>
              <input
                type="text"
                value={formData.siret}
                onChange={(e) => handleChange('siret', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matricule Fiscal
              </label>
              <input
                type="text"
                value={formData.matriculeFiscal}
                onChange={(e) => handleChange('matriculeFiscal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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

export default FournisseurForm;