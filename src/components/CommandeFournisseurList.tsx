import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileDown, Printer, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CommandeFournisseur } from '../types';
import { generateCommandeFournisseurPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import CommandeFournisseurForm from './CommandeFournisseurForm';

interface CommandeFournisseurListProps {
  onCreateNew: () => void;
  onEdit: (commande: CommandeFournisseur) => void;
  onDelete: (id: string) => void;
}

type SortField = 'numero' | 'date' | 'dateReception' | 'totalTTC' | 'fournisseur';
type SortDirection = 'asc' | 'desc';

const CommandeFournisseurList: React.FC<CommandeFournisseurListProps> = ({ onCreateNew, onEdit, onDelete }) => {
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCommande, setEditingCommande] = useState<CommandeFournisseur | null>(null);
  
  // Error handling
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  const { query, savePDF, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadCommandes();
    }
  }, [isReady]);

  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadCommandes();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadCommandes = async () => {
    if (!isReady) return;
    
    try {
      setLoading(true);
      const result = await query(`
        SELECT cf.*, f.nom as fournisseurNom, f.adresse, f.codePostal, f.ville, f.telephone, f.email
        FROM commandes_fournisseur cf
        JOIN fournisseurs f ON cf.fournisseurId = f.id
        ORDER BY cf.numero DESC
      `);

      const commandesData = result.map((cf: any) => ({
        ...cf,
        date: new Date(cf.date),
        dateReception: new Date(cf.dateReception),
        taxGroupsSummary: [],
        totalTaxes: 0,
        lignes: [],
        fournisseur: {
          id: cf.fournisseurId,
          nom: cf.fournisseurNom,
          adresse: cf.adresse,
          codePostal: cf.codePostal,
          ville: cf.ville,
          telephone: cf.telephone,
          email: cf.email
        }
      }));
      
      // Load lines for each commande
      for (const commande of commandesData) {
        const lignesResult = await query(`
          SELECT lcf.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.stock, p.type
          FROM lignes_commande_fournisseur lcf
          JOIN produits p ON lcf.produitId = p.id
          WHERE lcf.commandeId = ?
        `, [commande.id]);
        
        commande.lignes = lignesResult.map((ligne: any) => ({
          id: ligne.id,
          produit: {
            id: ligne.produitId,
            ref: ligne.ref,
            nom: ligne.nom,
            description: ligne.description,
            prixUnitaire: ligne.prixUnitaire,
            tva: ligne.tva,
            stock: ligne.stock,
            type: ligne.type
          },
          quantite: ligne.quantite,
          prixUnitaire: ligne.prixUnitaire,
          remise: ligne.remise,
          montantHT: ligne.montantHT,
          montantTTC: ligne.montantTTC
        }));
        
        // Ensure tax data exists
        commande.totalTaxes = commande.totalTVA || 0;
        commande.taxGroupsSummary = [];
      }
      
      setCommandes(commandesData);
    } catch (error) {
      console.error('Error loading commandes fournisseur:', error);
      alert('Erreur lors du chargement des commandes fournisseur');
    } finally {
      setLoading(false);
    }
  };

  // Sort commandes
  const sortedCommandes = React.useMemo(() => {
    const sorted = [...commandes].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'numero':
          aValue = a.numero;
          bValue = b.numero;
          break;
        case 'date':
          aValue = a.date.getTime();
          bValue = b.date.getTime();
          break;
        case 'dateReception':
          aValue = a.dateReception.getTime();
          bValue = b.dateReception.getTime();
          break;
        case 'totalTTC':
          aValue = a.totalTTC;
          bValue = b.totalTTC;
          break;
        case 'fournisseur':
          aValue = a.fournisseur.nom.toLowerCase();
          bValue = b.fournisseur.nom.toLowerCase();
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

    return sorted;
  }, [commandes, sortField, sortDirection]);

  // Filter commandes
  const filteredCommandes = sortedCommandes.filter(commande => {
    const matchesSearch = commande.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commande.fournisseur.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || commande.statut === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-purple-600" />
      : <ArrowDown className="w-4 h-4 text-purple-600" />;
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'bg-gray-100 text-gray-800';
      case 'envoyee': return 'bg-blue-100 text-blue-800';
      case 'confirmee': return 'bg-green-100 text-green-800';
      case 'recue': return 'bg-purple-100 text-purple-800';
      case 'annulee': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'envoyee': return 'Envoyée';
      case 'confirmee': return 'Confirmée';
      case 'recue': return 'Reçue';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  const handleDownloadPDF = async (commande: CommandeFournisseur) => {
    try {
      setPdfError(null);
      const doc = await generateCommandeFournisseurPDF(commande);
      const pdfData = doc.output('arraybuffer');
      
      const result = await savePDF(new Uint8Array(pdfData), `CommandeFournisseur_${commande.numero}.pdf`);
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du téléchargement du PDF');
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF');
      alert('Erreur lors de la génération du PDF: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handlePrint = async (commande: CommandeFournisseur) => {
    try {
      setPdfError(null);
      const doc = await generateCommandeFournisseurPDF(commande);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (error: any) {
      console.error('Error generating PDF for print:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF pour impression');
      alert('Erreur lors de la génération du PDF pour impression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleCreateNew = () => {
    setEditingCommande(null);
    setShowForm(true);
  };

  const handleEdit = (commande: CommandeFournisseur) => {
    setEditingCommande(commande);
    setShowForm(true);
  };

  const handleSave = async (commande: CommandeFournisseur) => {
    try {
      if (editingCommande) {
        setCommandes(commandes.map(cf => cf.id === commande.id ? commande : cf));
      } else {
        setCommandes([commande, ...commandes]);
      }

      setShowForm(false);
      setEditingCommande(null);

      setTimeout(() => {
        loadCommandes();
      }, 100);
    } catch (error) {
      console.error('Error saving commande fournisseur:', error);
      alert('Erreur lors de la sauvegarde de la commande fournisseur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette commande fournisseur ?')) {
      try {
        await query('DELETE FROM lignes_commande_fournisseur WHERE commandeId = ?', [id]);
        await query('DELETE FROM commandes_fournisseur WHERE id = ?', [id]);
        
        setCommandes(commandes.filter(cf => cf.id !== id));
      } catch (error) {
        console.error('Error deleting commande fournisseur:', error);
        alert('Erreur lors de la suppression de la commande fournisseur');
      }
    }
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
                placeholder="Rechercher par numéro ou fournisseur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
              />
            </div>
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="brouillon">Brouillon</option>
                <option value="envoyee">Envoyée</option>
                <option value="confirmee">Confirmée</option>
                <option value="recue">Reçue</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
            <button
              onClick={loadCommandes}
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
            <span>Nouvelle commande fournisseur</span>
          </button>
        </div>

        {/* PDF Error Message */}
        {pdfError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erreur PDF</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{pdfError}</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setPdfError(null)}
                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-purple-800 font-medium">
                {commandes.length} commande{commandes.length > 1 ? 's' : ''} fournisseur enregistrée{commandes.length > 1 ? 's' : ''}
              </span>
              {sortField && (
                <span className="ml-4 text-purple-600 text-sm">
                  Triées par {sortField === 'numero' ? 'numéro' : 
                             sortField === 'date' ? 'date' :
                             sortField === 'dateReception' ? 'réception' :
                             sortField === 'totalTTC' ? 'montant' : 'fournisseur'} 
                  ({sortDirection === 'asc' ? 'croissant' : 'décroissant'})
                </span>
              )}
            </div>
            {searchTerm && (
              <span className="text-purple-600 text-sm">
                {filteredCommandes.length} résultat{filteredCommandes.length > 1 ? 's' : ''} trouvé{filteredCommandes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('numero')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Numéro</span>
                    {getSortIcon('numero')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('fournisseur')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Fournisseur</span>
                    {getSortIcon('fournisseur')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    {getSortIcon('date')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('dateReception')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Réception</span>
                    {getSortIcon('dateReception')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('totalTTC')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Montant TTC</span>
                    {getSortIcon('totalTTC')}
                  </div>
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
              {filteredCommandes.map((commande) => (
                <tr key={commande.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                    {commande.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{commande.fournisseur.nom}</div>
                      <div className="text-gray-500 text-xs">{commande.fournisseur.ville}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {commande.date.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className={`${
                      commande.dateReception < new Date() && commande.statut !== 'recue' 
                        ? 'text-red-600 font-medium' 
                        : ''
                    }`}>
                      {commande.dateReception.toLocaleDateString('fr-FR')}
                      {commande.dateReception < new Date() && commande.statut !== 'recue' && (
                        <div className="text-xs text-red-500">En retard</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(commande.totalTTC)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(commande.statut)}`}>
                      {getStatusLabel(commande.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleDownloadPDF(commande)}
                        className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded transition-colors"
                        title="Télécharger PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(commande)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(commande)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(commande.id)}
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
          {filteredCommandes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Aucune commande fournisseur trouvée avec ces critères' 
                  : 'Aucune commande fournisseur créée pour le moment'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Créer la première commande fournisseur
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Commande Fournisseur Form Dialog */}
      <CommandeFournisseurForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingCommande(null);
        }}
        onSave={handleSave}
        commande={editingCommande}
      />
    </>
  );
};

export default CommandeFournisseurList;