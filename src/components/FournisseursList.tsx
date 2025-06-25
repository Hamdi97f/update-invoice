import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Building2 } from 'lucide-react';
import { Fournisseur } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import FournisseurForm from './FournisseurForm';

const FournisseursList: React.FC = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const { query, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadFournisseurs();
    }
  }, [isReady]);

  // Reload fournisseurs when component becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadFournisseurs();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadFournisseurs = async () => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT * FROM fournisseurs ORDER BY nom ASC');
      setFournisseurs(result);
    } catch (error) {
      console.error('Error loading fournisseurs:', error);
      alert('Erreur lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  const filteredFournisseurs = fournisseurs.filter(fournisseur => 
    fournisseur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (fournisseur.email && fournisseur.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (fournisseur.ville && fournisseur.ville.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (fournisseur.matriculeFiscal && fournisseur.matriculeFiscal.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateNew = () => {
    setEditingFournisseur(null);
    setShowForm(true);
  };

  const handleEdit = (fournisseur: Fournisseur) => {
    setEditingFournisseur(fournisseur);
    setShowForm(true);
  };

  const handleSave = async (fournisseur: Fournisseur) => {
    try {
      // Update local state immediately
      if (editingFournisseur) {
        setFournisseurs(prevFournisseurs => 
          prevFournisseurs.map(f => f.id === fournisseur.id ? fournisseur : f)
        );
      } else {
        setFournisseurs(prevFournisseurs => [fournisseur, ...prevFournisseurs]);
      }

      // Close form and reset editing state
      setShowForm(false);
      setEditingFournisseur(null);
      
      // Reload to ensure sync with database
      setTimeout(() => {
        loadFournisseurs();
      }, 100);
    } catch (error) {
      console.error('Error saving fournisseur:', error);
      alert('Erreur lors de la sauvegarde du fournisseur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      try {
        // First check if fournisseur is used in any documents
        const commandesCount = await query('SELECT COUNT(*) as count FROM commandes_fournisseur WHERE fournisseurId = ?', [id]);
        
        if (commandesCount[0].count > 0) {
          alert('Ce fournisseur ne peut pas être supprimé car il est utilisé dans des commandes fournisseur.');
          return;
        }
        
        await query('DELETE FROM fournisseurs WHERE id = ?', [id]);
        setFournisseurs(fournisseurs.filter(f => f.id !== id));
      } catch (error) {
        console.error('Error deleting fournisseur:', error);
        alert('Erreur lors de la suppression du fournisseur');
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingFournisseur(null);
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initialisation de la base de données...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
                placeholder="Rechercher par nom, email, ville ou matricule fiscal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-80"
              />
            </div>
            <button
              onClick={loadFournisseurs}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau fournisseur</span>
          </button>
        </div>

        {/* Stats */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Building2 className="w-5 h-5 text-purple-600 mr-2" />
              <span className="text-purple-800 font-medium">
                {fournisseurs.length} fournisseur{fournisseurs.length > 1 ? 's' : ''} enregistré{fournisseurs.length > 1 ? 's' : ''}
              </span>
            </div>
            {searchTerm && (
              <span className="text-purple-600 text-sm">
                {filteredFournisseurs.length} résultat{filteredFournisseurs.length > 1 ? 's' : ''} trouvé{filteredFournisseurs.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adresse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SIRET
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Matricule Fiscal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFournisseurs.map((fournisseur) => (
                <tr key={fournisseur.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                      <div className="font-medium">{fournisseur.nom}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>
                      {fournisseur.adresse && <div>{fournisseur.adresse}</div>}
                      {(fournisseur.codePostal || fournisseur.ville) && (
                        <div>{fournisseur.codePostal} {fournisseur.ville}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>
                      {fournisseur.telephone && <div>Tél: {fournisseur.telephone}</div>}
                      {fournisseur.email && <div>Email: {fournisseur.email}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fournisseur.siret || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fournisseur.matriculeFiscal || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(fournisseur)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(fournisseur.id)}
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
          {filteredFournisseurs.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm 
                  ? 'Aucun fournisseur trouvé avec ces critères' 
                  : 'Aucun fournisseur créé pour le moment'}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Créer le premier fournisseur
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fournisseur Form Dialog */}
      <FournisseurForm
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={handleSave}
        fournisseur={editingFournisseur}
      />
    </>
  );
};

export default FournisseursList;