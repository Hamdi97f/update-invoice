import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, User, Upload } from 'lucide-react';
import { Client } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import ClientForm from './ClientForm';
import CSVImportDialog from './CSVImportDialog';
import { ImportResult } from '../utils/csvImporter';
import { useNotification } from '../contexts/NotificationContext';

const ClientsList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { query, isReady } = useDatabase();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isReady) {
      loadClients();
    }
  }, [isReady]);

  // Reload clients when component becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadClients();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadClients = async () => {
    if (!isReady) return;
    
    try {
      const result = await query('SELECT * FROM clients ORDER BY code ASC');
      setClients(result);
    } catch (error) {
      console.error('Error loading clients:', error);
      showNotification('Erreur lors du chargement des clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => 
    client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.matriculeFiscal && client.matriculeFiscal.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateNew = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleSave = (client: Client) => {
    if (editingClient) {
      setClients(clients.map(c => c.id === client.id ? client : c));
    } else {
      setClients([client, ...clients]);
    }
    setShowForm(false);
    setEditingClient(null);
    
    // Reload to ensure sync
    setTimeout(() => {
      loadClients();
    }, 100);
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      try {
        // Delete all related documents first
        const factures = await query('SELECT id FROM factures WHERE clientId = ?', [id]);
        for (const facture of factures) {
          await query('DELETE FROM payments WHERE factureId = ?', [facture.id]);
          await query('DELETE FROM lignes_facture WHERE factureId = ?', [facture.id]);
        }
        await query('DELETE FROM factures WHERE clientId = ?', [id]);
        
        const devis = await query('SELECT id FROM devis WHERE clientId = ?', [id]);
        for (const devi of devis) {
          await query('DELETE FROM lignes_devis WHERE devisId = ?', [devi.id]);
        }
        await query('DELETE FROM devis WHERE clientId = ?', [id]);
        
        const bonsLivraison = await query('SELECT id FROM bons_livraison WHERE clientId = ?', [id]);
        for (const bon of bonsLivraison) {
          await query('DELETE FROM lignes_bon_livraison WHERE bonLivraisonId = ?', [bon.id]);
        }
        await query('DELETE FROM bons_livraison WHERE clientId = ?', [id]);
        
        await query('DELETE FROM clients WHERE id = ?', [id]);
        setClients(clients.filter(c => c.id !== id));
      } catch (error) {
        console.error('Error deleting client:', error);
        showNotification('Erreur lors de la suppression du client', 'error');
      }
    }
  };

  const handleImportComplete = (result: ImportResult) => {
    if (result.success) {
      // Reload clients to show imported data
      loadClients();
      setShowImportDialog(false);
      
      // Show success message
      showNotification(`Importation réussie! ${result.imported} client(s) importé(s), ${result.duplicates} doublon(s) ignoré(s), ${result.skipped} ligne(s) ignorée(s)`, 'success');
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
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, code, email ou matricule fiscal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
              />
            </div>
            <button
              onClick={loadClients}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau client</span>
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Upload className="w-5 h-5" />
            <span>Importer CSV</span>
          </button>
        </div>

        {/* Stats */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-blue-800 font-medium">
                {clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
              </span>
            </div>
            {searchTerm && (
              <span className="text-blue-600 text-sm">
                {filteredClients.length} résultat{filteredClients.length > 1 ? 's' : ''} trouvé{filteredClients.length > 1 ? 's' : ''}
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
                  Code
                </th>
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
                  Matricule Fiscal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {client.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      {client.nom}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>
                      {client.adresse && <div>{client.adresse}</div>}
                      {(client.codePostal || client.ville) && (
                        <div>{client.codePostal} {client.ville}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>
                      {client.telephone && <div>Tél: {client.telephone}</div>}
                      {client.email && <div>Email: {client.email}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.matriculeFiscal || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
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
          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm 
                  ? 'Aucun client trouvé avec ces critères' 
                  : 'Aucun client créé pour le moment'}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Créer le premier client
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Client Form Dialog */}
      <ClientForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingClient(null);
        }}
        onSave={handleSave}
        client={editingClient}
      />

      {/* CSV Import Dialog */}
      <CSVImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        type="clients"
        existingData={clients}
        onImportComplete={handleImportComplete}
        query={query}
      />
    </>
  );
};

export default ClientsList;