import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileDown, Printer, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, RefreshCw, FileText, Receipt, Truck, X } from 'lucide-react';
import { Devis, Facture, BonLivraison, Client } from '../types';
import { generateDevisPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import { getNextDocumentNumber } from '../utils/numberGenerator';
import { v4 as uuidv4 } from 'uuid';
import DevisForm from './DevisForm';

interface DevisListProps {
  onCreateNew: () => void;
  onEdit: (devis: Devis) => void;
  onDelete: (id: string) => void;
}

type SortField = 'numero' | 'date' | 'dateValidite' | 'totalTTC' | 'client';
type SortDirection = 'asc' | 'desc';

const DevisList: React.FC<DevisListProps> = ({ onCreateNew, onEdit, onDelete }) => {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  
  // Conversion feature states
  const [selectedDevis, setSelectedDevis] = useState<Set<string>>(new Set());
  const [isConversionMode, setIsConversionMode] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionType, setConversionType] = useState<'facture' | 'bonLivraison'>('facture');
  const [isConverting, setIsConverting] = useState(false);
  
  // Error handling
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  const { query, savePDF, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadDevis();
    }
  }, [isReady]);

  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadDevis();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadDevis = async () => {
    if (!isReady) return;
    
    try {
      setLoading(true);
      const result = await query(`
        SELECT d.*, c.code as clientCode, c.nom as clientNom, c.adresse, c.codePostal, c.ville, c.telephone, c.email
        FROM devis d
        JOIN clients c ON d.clientId = c.id
        ORDER BY d.numero DESC
      `);

      const devisData = result.map((d: any) => ({
        ...d,
        date: new Date(d.date),
        dateValidite: new Date(d.dateValidite),
        taxGroupsSummary: [],
        totalTaxes: 0,
        lignes: [],
        client: {
          id: d.clientId,
          code: d.clientCode,
          nom: d.clientNom,
          adresse: d.adresse,
          codePostal: d.codePostal,
          ville: d.ville,
          telephone: d.telephone,
          email: d.email
        }
      }));
      
      // Load lines for each devis
      for (const d of devisData) {
        const lignesResult = await query(`
          SELECT ld.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.stock, p.type
          FROM lignes_devis ld
          JOIN produits p ON ld.produitId = p.id
          WHERE ld.devisId = ?
        `, [d.id]);
        
        d.lignes = lignesResult.map((ligne: any) => ({
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
      }
      
      setDevis(devisData);
    } catch (error) {
      console.error('Error loading devis:', error);
      alert('Erreur lors du chargement des devis');
    } finally {
      setLoading(false);
    }
  };

  // Sort devis
  const sortedDevis = React.useMemo(() => {
    const sorted = [...devis].sort((a, b) => {
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
        case 'dateValidite':
          aValue = a.dateValidite.getTime();
          bValue = b.dateValidite.getTime();
          break;
        case 'totalTTC':
          aValue = a.totalTTC;
          bValue = b.totalTTC;
          break;
        case 'client':
          aValue = a.client.nom.toLowerCase();
          bValue = b.client.nom.toLowerCase();
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
  }, [devis, sortField, sortDirection]);

  // Filter devis
  const filteredDevis = sortedDevis.filter(d => {
    const matchesSearch = d.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.client.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.statut === statusFilter;
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
      ? <ArrowUp className="w-4 h-4 text-green-600" />
      : <ArrowDown className="w-4 h-4 text-green-600" />;
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'bg-gray-100 text-gray-800';
      case 'envoye': return 'bg-blue-100 text-blue-800';
      case 'accepte': return 'bg-green-100 text-green-800';
      case 'refuse': return 'bg-red-100 text-red-800';
      case 'expire': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'envoye': return 'Envoyé';
      case 'accepte': return 'Accepté';
      case 'refuse': return 'Refusé';
      case 'expire': return 'Expiré';
      default: return statut;
    }
  };

  // Conversion functionality
  const toggleConversionMode = () => {
    setIsConversionMode(!isConversionMode);
    setSelectedDevis(new Set());
  };

  const toggleDevisSelection = (devisId: string) => {
    const newSelected = new Set(selectedDevis);
    if (newSelected.has(devisId)) {
      newSelected.delete(devisId);
    } else {
      newSelected.add(devisId);
    }
    setSelectedDevis(newSelected);
  };

  const selectAllDevis = () => {
    if (selectedDevis.size === filteredDevis.length) {
      setSelectedDevis(new Set());
    } else {
      setSelectedDevis(new Set(filteredDevis.map(d => d.id)));
    }
  };

  const getSelectedDevisData = () => {
    return filteredDevis.filter(d => selectedDevis.has(d.id));
  };

  // Check if selected devis have the same client
  const canConvertSelected = () => {
    const selectedData = getSelectedDevisData();
    if (selectedData.length === 0) return false;
    
    const firstClientId = selectedData[0].client.id;
    return selectedData.every(d => d.client.id === firstClientId);
  };

  const handleStartConversion = () => {
    if (selectedDevis.size === 0) {
      alert('Veuillez sélectionner au moins un devis');
      return;
    }

    if (!canConvertSelected()) {
      alert('Tous les devis sélectionnés doivent avoir le même client pour être convertis ensemble');
      return;
    }

    setShowConversionModal(true);
  };

  const handleConversion = async () => {
    if (selectedDevis.size === 0) return;

    setIsConverting(true);
    try {
      const selectedData = getSelectedDevisData();
      
      if (conversionType === 'facture') {
        await convertToFactures(selectedData);
      } else {
        await convertToBonsLivraison(selectedData);
      }

      // Update devis status to 'accepte' after successful conversion
      await updateDevisStatus(selectedData, 'accepte');
      
      setShowConversionModal(false);
      setIsConversionMode(false);
      setSelectedDevis(new Set());
      
      alert(`${selectedData.length} devis converti(s) avec succès en ${conversionType === 'facture' ? 'facture(s)' : 'bon(s) de livraison'}`);
      
      // Reload devis to reflect status changes
      loadDevis();
      
    } catch (error: any) {
      console.error('Error during conversion:', error);
      alert('Erreur lors de la conversion: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setIsConverting(false);
    }
  };

  const convertToFactures = async (devisData: Devis[]) => {
    for (const devis of devisData) {
      const factureNumero = await getNextDocumentNumber('factures', true, query);
      
      // CRITICAL: Do NOT copy old taxes - use the devis calculated totals directly
      // The taxes are already properly calculated in the devis
      
      const facture: Facture = {
        id: uuidv4(),
        numero: factureNumero,
        date: new Date(),
        dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        client: devis.client,
        lignes: devis.lignes,
        totalHT: devis.totalHT,
        totalFodec: devis.totalFodec,
        totalTVA: devis.totalTVA,
        totalTTC: devis.totalTTC,
        statut: 'brouillon',
        notes: `Converti du devis ${devis.numero}${devis.notes ? ` - ${devis.notes}` : ''}`
      };

      // Save facture
      await query(
        `INSERT INTO factures 
         (id, numero, date, dateEcheance, clientId, totalHT, totalFodec, totalTVA, totalTTC, statut, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          facture.id,
          facture.numero,
          facture.date.toISOString(),
          facture.dateEcheance.toISOString(),
          facture.client.id,
          facture.totalHT,
          facture.totalFodec,
          facture.totalTVA,
          facture.totalTTC,
          facture.statut,
          facture.notes
        ]
      );

      // Save facture lines
      for (const ligne of facture.lignes) {
        await query(
          `INSERT INTO lignes_facture 
           (id, factureId, produitId, quantite, prixUnitaire, remise, montantHT, montantFodec, baseTVA, montantTVA, montantTTC)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ligne.id,
            facture.id,
            ligne.produit.id,
            ligne.quantite,
            ligne.prixUnitaire,
            ligne.remise || 0,
            ligne.montantHT,
            ligne.montantFodec || 0,
            ligne.baseTVA || 0,
            ligne.montantTVA || 0,
            ligne.montantTTC
          ]
        );
      }
    }
  };

  const convertToBonsLivraison = async (devisData: Devis[]) => {
    for (const devis of devisData) {
      const bonNumero = await getNextDocumentNumber('bonsLivraison', true, query);
      
      const bonLivraison: BonLivraison = {
        id: uuidv4(),
        numero: bonNumero,
        date: new Date(),
        client: devis.client,
        lignes: devis.lignes,
        statut: 'prepare',
        totalHT: devis.totalHT,
        totalFodec: devis.totalFodec,
        totalTVA: devis.totalTVA,
        totalTTC: devis.totalTTC,
        notes: `Converti du devis ${devis.numero}${devis.notes ? ` - ${devis.notes}` : ''}`
      };

      // Save bon de livraison
      await query(
        `INSERT INTO bons_livraison 
         (id, numero, date, clientId, statut, totalHT, totalTVA, totalTTC, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bonLivraison.id,
          bonLivraison.numero,
          bonLivraison.date.toISOString(),
          bonLivraison.client.id,
          bonLivraison.statut,
          bonLivraison.totalHT,
          bonLivraison.totalTVA || 0,
          bonLivraison.totalTTC,
          bonLivraison.notes
        ]
      );

      // Save bon de livraison lines
      for (const ligne of bonLivraison.lignes) {
        await query(
          `INSERT INTO lignes_bon_livraison 
           (id, bonLivraisonId, produitId, quantite)
           VALUES (?, ?, ?, ?)`,
          [
            ligne.id,
            bonLivraison.id,
            ligne.produit.id,
            ligne.quantite
          ]
        );
      }
    }
  };

  const updateDevisStatus = async (devisData: Devis[], newStatus: string) => {
    for (const devis of devisData) {
      await query(
        'UPDATE devis SET statut = ? WHERE id = ?',
        [newStatus, devis.id]
      );
    }
  };

  const handleDownloadPDF = async (devis: Devis) => {
    try {
      setPdfError(null);
      const doc = await generateDevisPDF(devis);
      const pdfData = doc.output('arraybuffer');
      
      const result = await savePDF(new Uint8Array(pdfData), `Devis_${devis.numero}.pdf`);
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du téléchargement du PDF');
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF');
      alert('Erreur lors de la génération du PDF: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handlePrint = async (devis: Devis) => {
    try {
      setPdfError(null);
      const doc = await generateDevisPDF(devis);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (error: any) {
      console.error('Error generating PDF for print:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF pour impression');
      alert('Erreur lors de la génération du PDF pour impression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleCreateNew = () => {
    setEditingDevis(null);
    setShowForm(true);
  };

  const handleEdit = (devis: Devis) => {
    setEditingDevis(devis);
    setShowForm(true);
  };

  const handleSave = async (savedDevis: Devis) => {
    try {
      if (editingDevis) {
        setDevis(prevDevis => prevDevis.map(d => d.id === savedDevis.id ? savedDevis : d));
      } else {
        setDevis(prevDevis => [savedDevis, ...prevDevis]);
      }

      setShowForm(false);
      setEditingDevis(null);

      setTimeout(() => {
        loadDevis();
      }, 100);
    } catch (error) {
      console.error('Error saving devis:', error);
      alert('Erreur lors de la sauvegarde du devis');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) {
      try {
        await query('DELETE FROM lignes_devis WHERE devisId = ?', [id]);
        await query('DELETE FROM devis WHERE id = ?', [id]);
        
        setDevis(devis.filter(d => d.id !== id));
      } catch (error) {
        console.error('Error deleting devis:', error);
        alert('Erreur lors de la suppression du devis');
      }
    }
  };

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
                placeholder="Rechercher par numéro ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-64"
              />
            </div>
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="brouillon">Brouillon</option>
                <option value="envoye">Envoyé</option>
                <option value="accepte">Accepté</option>
                <option value="refuse">Refusé</option>
                <option value="expire">Expiré</option>
              </select>
            </div>
            <button
              onClick={loadDevis}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleConversionMode}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                isConversionMode 
                  ? 'bg-orange-600 text-white hover:bg-orange-700' 
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isConversionMode ? 'Annuler conversion' : 'Convertir devis'}</span>
            </button>
            <button
              onClick={handleCreateNew}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau devis</span>
            </button>
          </div>
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

        {/* Conversion toolbar */}
        {isConversionMode && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={selectAllDevis}
                  className="flex items-center space-x-2 text-orange-700 hover:text-orange-900"
                >
                  {selectedDevis.size === filteredDevis.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedDevis.size === filteredDevis.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </span>
                </button>
                <span className="text-orange-700 font-medium">
                  {selectedDevis.size} devis sélectionné(s)
                </span>
                {selectedDevis.size > 0 && !canConvertSelected() && (
                  <span className="text-red-600 text-sm font-medium">
                    ⚠️ Les devis sélectionnés doivent avoir le même client
                  </span>
                )}
              </div>
              
              {selectedDevis.size > 0 && canConvertSelected() && (
                <button
                  onClick={handleStartConversion}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Convertir sélection</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-green-800 font-medium">
                {devis.length} devis enregistré{devis.length > 1 ? 's' : ''}
              </span>
              {sortField && (
                <span className="ml-4 text-green-600 text-sm">
                  Triés par {sortField === 'numero' ? 'numéro' : 
                             sortField === 'date' ? 'date' :
                             sortField === 'dateValidite' ? 'validité' :
                             sortField === 'totalTTC' ? 'montant' : 'client'} 
                  ({sortDirection === 'asc' ? 'croissant' : 'décroissant'})
                </span>
              )}
            </div>
            {searchTerm && (
              <span className="text-green-600 text-sm">
                {filteredDevis.length} résultat{filteredDevis.length > 1 ? 's' : ''} trouvé{filteredDevis.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isConversionMode && (
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={selectAllDevis}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      {selectedDevis.size === filteredDevis.length ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                )}
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
                  onClick={() => handleSort('client')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Client</span>
                    {getSortIcon('client')}
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
                  onClick={() => handleSort('dateValidite')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Validité</span>
                    {getSortIcon('dateValidite')}
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
              {filteredDevis.map((devis) => (
                <tr 
                  key={devis.id} 
                  className={`hover:bg-gray-50 ${
                    selectedDevis.has(devis.id) ? 'bg-orange-50' : ''
                  }`}
                >
                  {isConversionMode && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleDevisSelection(devis.id)}
                        className="text-orange-600 hover:text-orange-800"
                      >
                        {selectedDevis.has(devis.id) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {devis.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{devis.client.nom}</div>
                      <div className="text-gray-500 text-xs">{devis.client.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {devis.date.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className={`${
                      devis.dateValidite < new Date() && devis.statut !== 'accepte' 
                        ? 'text-red-600 font-medium' 
                        : ''
                    }`}>
                      {devis.dateValidite.toLocaleDateString('fr-FR')}
                      {devis.dateValidite < new Date() && devis.statut !== 'accepte' && (
                        <div className="text-xs text-red-500">Expiré</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(devis.totalTTC)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(devis.statut)}`}>
                      {getStatusLabel(devis.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleDownloadPDF(devis)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                        title="Télécharger PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(devis)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(devis)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(devis.id)}
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
          {filteredDevis.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Aucun devis trouvé avec ces critères' 
                  : 'Aucun devis créé pour le moment'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Créer le premier devis
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conversion Modal */}
      {showConversionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Convertir les devis</h2>
              <button 
                onClick={() => setShowConversionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  Vous allez convertir <strong>{selectedDevis.size} devis</strong> pour le client :
                </p>
                <p className="font-medium text-gray-900">
                  {getSelectedDevisData()[0]?.client.nom}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Type de conversion :
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="facture"
                      checked={conversionType === 'facture'}
                      onChange={(e) => setConversionType(e.target.value as 'facture')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex items-center">
                      <Receipt className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="text-gray-700">Convertir en facture(s)</span>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="bonLivraison"
                      checked={conversionType === 'bonLivraison'}
                      onChange={(e) => setConversionType(e.target.value as 'bonLivraison')}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="ml-3 flex items-center">
                      <Truck className="w-5 h-5 text-orange-600 mr-2" />
                      <span className="text-gray-700">Convertir en bon(s) de livraison</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note :</strong> Après conversion, le statut des devis sera automatiquement mis à jour vers "Accepté".
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isConverting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConversion}
                  disabled={isConverting}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Conversion...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Convertir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Devis Form Dialog */}
      <DevisForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingDevis(null);
        }}
        onSave={handleSave}
        devis={editingDevis}
      />
    </>
  );
};

export default DevisList;