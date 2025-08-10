import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Client } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '../contexts/NotificationContext';

interface ClientFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  client?: Client | null;
}

const ClientForm: React.FC<ClientFormProps> = ({ isOpen, onClose, onSave, client }) => {
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    adresse: '',
    codePostal: '',
    ville: '',
    telephone: '',
    email: '',
    siret: '',
    matriculeFiscal: ''
  });

  const [isCodeEditable, setIsCodeEditable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { query, isReady } = useDatabase();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen && isReady) {
      setError(null);
      if (client) {
        setFormData({
          code: client.code,
          nom: client.nom,
          adresse: client.adresse || '',
          codePostal: client.codePostal || '',
          ville: client.ville || '',
          telephone: client.telephone || '',
          email: client.email || '',
          siret: client.siret || '',
          matriculeFiscal: client.matriculeFiscal || ''
        });
        setIsCodeEditable(false);
      } else {
        generateClientCode();
        setFormData({
          code: '',
          nom: '',
          adresse: '',
          codePostal: '',
          ville: '',
          telephone: '',
          email: '',
          siret: '',
          matriculeFiscal: ''
        });
        setIsCodeEditable(true);
      }
    }
  }, [client, isOpen, isReady]);

  const generateClientCode = async () => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT COUNT(*) as count FROM clients');
      const count = result[0]?.count || 0;
      const clientCode = `CL${String(count + 1).padStart(4, '0')}`;
      setFormData(prev => ({ ...prev, code: clientCode }));
    } catch (error) {
      console.error('Error generating client code:', error);
      const timestamp = Date.now().toString().slice(-6);
      setFormData(prev => ({ ...prev, code: `CL${timestamp}` }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || !isReady) return;
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!formData.nom.trim()) {
        setError('Le nom du client est obligatoire');
        setIsSubmitting(false);
        return;
      }

      if (!formData.code.trim()) {
        setError('Le code client est obligatoire');
        setIsSubmitting(false);
        return;
      }

      // Check if client code already exists (only for new clients)
      if (!client) {
        const existingClient = await query('SELECT id FROM clients WHERE code = ?', [formData.code.trim()]);
        if (existingClient.length > 0) {
          setError('Ce code client existe déjà. Veuillez en choisir un autre.');
          setIsSubmitting(false);
          return;
        }
      }

      const clientData: Client = {
        id: client?.id || uuidv4(),
        code: formData.code.trim(),
        nom: formData.nom.trim(),
        adresse: formData.adresse.trim(),
        codePostal: formData.codePostal.trim(),
        ville: formData.ville.trim(),
        telephone: formData.telephone.trim(),
        email: formData.email.trim(),
        siret: formData.siret.trim(),
        matriculeFiscal: formData.matriculeFiscal.trim()
      };

      await query(
        `INSERT OR REPLACE INTO clients 
         (id, code, nom, adresse, codePostal, ville, telephone, email, siret, matriculeFiscal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientData.id,
          clientData.code,
          clientData.nom,
          clientData.adresse,
          clientData.codePostal,
          clientData.ville,
          clientData.telephone,
          clientData.email,
          clientData.siret,
          clientData.matriculeFiscal
        ]
      );

      onSave(clientData);
      onClose();
    } catch (error: any) {
      console.error('Error saving client:', error);
      setError(`Erreur lors de la sauvegarde du client: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'code' || field === 'nom') {
      setError(null); // Clear error when user edits required fields
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {client ? 'Modifier le client' : 'Nouveau client'}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code client *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                className={`w-full px-3 py-2 border ${error && !formData.code.trim() ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isCodeEditable ? '' : 'bg-gray-50'}`}
                placeholder="Ex: CL0001"
                required
                readOnly={!isCodeEditable}
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Code généré automatiquement
                </p>
                {!client && (
                  <button 
                    type="button" 
                    onClick={() => setIsCodeEditable(!isCodeEditable)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    disabled={isSubmitting}
                  >
                    {isCodeEditable ? 'Verrouiller' : 'Modifier'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du client *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => handleChange('nom', e.target.value)}
                className={`w-full px-3 py-2 border ${error && !formData.nom.trim() ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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

export default ClientForm;