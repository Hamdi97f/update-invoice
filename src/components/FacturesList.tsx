import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileDown, Printer, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, Download, PrinterIcon, CreditCard, RefreshCw, X } from 'lucide-react';
import { Facture } from '../types';
import { generateFacturePDF, generateCombinedFacturesPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import FactureForm from './FactureForm';
import PaymentForm from './PaymentForm';
import AvoirsList from './AvoirsList';

interface FacturesListProps {
  onCreateNew: () => void;
  onEdit: (facture: Facture) => void;
  onDelete: (id: string) => void;
}

type SortField = 'numero' | 'date' | 'dateEcheance' | 'totalTTC' | 'client';
type SortDirection = 'asc' | 'desc';

const FacturesList: React.FC<FacturesListProps> = ({ onCreateNew, onEdit, onDelete }) => {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFacture, setEditingFacture] = useState<Facture | null>(null);
  
  // Multi-selection state
  const [selectedFactures, setSelectedFactures] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedFactureForPayment, setSelectedFactureForPayment] = useState<Facture | null>(null);
  
  // Avoir state
  const [showAvoirForm, setShowAvoirForm] = useState(false);
  const [selectedFactureForAvoir, setSelectedFactureForAvoir] = useState<Facture | null>(null);
  const [showAvoirsList, setShowAvoirsList] = useState(false);
  
  // Error handling
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  const { getFactures, savePDF, isReady, query } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadFactures();
    }
  }, [isReady]);

  // Reload factures when component becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadFactures();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadFactures = async () => {
    if (!isReady) return;
    
    try {
      setLoading(true);
      const data = await getFactures();
      // Filter out avoirs (credit notes) which start with AV-
      const regularFactures = data.filter(f => !f.numero.startsWith('AV-'));
      setFactures(regularFactures);
    } catch (error) {
      console.error('Error loading factures:', error);
      alert('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  };

  // Sort factures
  const sortedFactures = React.useMemo(() => {
    const sorted = [...factures].sort((a, b) => {
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
        case 'dateEcheance':
          aValue = a.dateEcheance.getTime();
          bValue = b.dateEcheance.getTime();
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
  }, [factures, sortField, sortDirection]);

  // Filter factures
  const filteredFactures = sortedFactures.filter(facture => {
    const matchesSearch = facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         facture.client.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || facture.statut === statusFilter;
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
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'bg-gray-100 text-gray-800';
      case 'envoyee': return 'bg-blue-100 text-blue-800';
      case 'payee': return 'bg-green-100 text-green-800';
      case 'annulee': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'brouillon': return 'Brouillon';
      case 'envoyee': return 'Envoyée';
      case 'payee': return 'Payée';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  // Multi-selection handlers
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedFactures(new Set());
  };

  const toggleFactureSelection = (factureId: string) => {
    const newSelected = new Set(selectedFactures);
    if (newSelected.has(factureId)) {
      newSelected.delete(factureId);
    } else {
      newSelected.add(factureId);
    }
    setSelectedFactures(newSelected);
  };

  const selectAllFactures = () => {
    if (selectedFactures.size === filteredFactures.length) {
      setSelectedFactures(new Set());
    } else {
      setSelectedFactures(new Set(filteredFactures.map(f => f.id)));
    }
  };

  const getSelectedFacturesData = () => {
    return filteredFactures.filter(f => selectedFactures.has(f.id));
  };

  // Bulk operations using the new combined PDF generator
  const handleBulkDownload = async () => {
    if (selectedFactures.size === 0) {
      alert('Veuillez sélectionner au moins une facture');
      return;
    }

    setIsProcessing(true);
    setPdfError(null);
    
    try {
      const selectedFacturesData = getSelectedFacturesData();
      
      if (selectedFacturesData.length === 1) {
        // Single file download
        const facture = selectedFacturesData[0];
        const doc = await generateFacturePDF(facture);
        const pdfData = doc.output('arraybuffer');
        
        const result = await savePDF(new Uint8Array(pdfData), `Facture_${facture.numero}.pdf`);
        if (!result.success) {
          throw new Error(result.error || 'Erreur lors du téléchargement du PDF');
        }
      } else {
        // Use the combined PDF generator with full template support
        const combinedDoc = await generateCombinedFacturesPDF(selectedFacturesData);
        const pdfData = combinedDoc.output('arraybuffer');
        
        const filename = `Factures_${selectedFacturesData.length}_documents_${new Date().toISOString().split('T')[0]}.pdf`;
        
        const result = await savePDF(new Uint8Array(pdfData), filename);
        if (!result.success) {
          throw new Error(result.error || 'Erreur lors du téléchargement du PDF');
        }
      }
      
      alert(`${selectedFacturesData.length} facture(s) téléchargée(s) avec succès`);
      
    } catch (error: any) {
      console.error('Error downloading PDFs:', error);
      setPdfError(error.message || 'Erreur lors du téléchargement des PDFs');
      alert('Erreur lors du téléchargement des PDFs: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedFactures.size === 0) {
      alert('Veuillez sélectionner au moins une facture');
      return;
    }

    setIsProcessing(true);
    setPdfError(null);
    
    try {
      const selectedFacturesData = getSelectedFacturesData();
      
      if (selectedFacturesData.length === 1) {
        // Single document - use the proper PDF generator
        const doc = await generateFacturePDF(selectedFacturesData[0]);
        doc.autoPrint();
        const pdfUrl = doc.output('bloburl');
        window.open(pdfUrl, '_blank');
      } else {
        // Use the combined PDF generator with full template support for all pages
        const combinedDoc = await generateCombinedFacturesPDF(selectedFacturesData);
        
        // Set up auto-print
        combinedDoc.autoPrint();
        
        // Open in new window for printing
        const pdfUrl = combinedDoc.output('bloburl');
        const printWindow = window.open(pdfUrl, '_blank');
        
        if (!printWindow) {
          throw new Error('Impossible d\'ouvrir la fenêtre d\'impression. Veuillez autoriser les pop-ups.');
        }
      }
      
    } catch (error: any) {
      console.error('Error printing PDFs:', error);
      setPdfError(error.message || 'Erreur lors de l\'impression des PDFs');
      alert('Erreur lors de l\'impression des PDFs: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = async (facture: Facture) => {
    try {
      setPdfError(null);
      const doc = await generateFacturePDF(facture);
      const pdfData = doc.output('arraybuffer');
      
      const result = await savePDF(new Uint8Array(pdfData), `Facture_${facture.numero}.pdf`);
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du téléchargement du PDF');
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF');
      alert('Erreur lors de la génération du PDF: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handlePrint = async (facture: Facture) => {
    try {
      setPdfError(null);
      const doc = await generateFacturePDF(facture);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (error: any) {
      console.error('Error generating PDF for print:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF pour impression');
      alert('Erreur lors de la génération du PDF pour impression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  // Payment handlers
  const handleAddPayment = (facture: Facture) => {
    setSelectedFactureForPayment(facture);
    setShowPaymentForm(true);
  };

  const handlePaymentSave = (payment: any) => {
    // Reload factures to reflect any status changes
    setTimeout(() => {
      loadFactures();
    }, 100);
    
    setShowPaymentForm(false);
    setSelectedFactureForPayment(null);
  };

  // Avoir handlers
  const handleCreateAvoir = (facture: Facture) => {
    setSelectedFactureForAvoir(facture);
    setShowAvoirForm(true);
  };

  const handleAvoirSave = (avoir: Facture) => {
    // Reload factures to reflect any changes
    setTimeout(() => {
      loadFactures();
    }, 100);
    
    setShowAvoirForm(false);
    setSelectedFactureForAvoir(null);
  };

  const handleViewAvoirs = () => {
    setShowAvoirsList(true);
  };

  const handleCreateNew = () => {
    setEditingFacture(null);
    setShowForm(true);
  };

  const handleEdit = (facture: Facture) => {
    setEditingFacture(facture);
    setShowForm(true);
  };

  const handleSave = async (facture: Facture) => {
    try {
      if (editingFacture) {
        setFactures(factures.map(f => f.id === facture.id ? facture : f));
      } else {
        setFactures([facture, ...factures]);
      }

      setShowForm(false);
      setEditingFacture(null);

      // Reload to ensure persistence
      setTimeout(() => {
        loadFactures();
      }, 100);
    } catch (error) {
      console.error('Error saving facture:', error);
      alert('Erreur lors de la sauvegarde de la facture');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      try {
        // Delete related records first
        await query('DELETE FROM payments WHERE factureId = ?', [id]);
        await query('UPDATE bons_livraison SET factureId = NULL WHERE factureId = ?', [id]);
        await query('DELETE FROM lignes_facture WHERE factureId = ?', [id]);
        await query('DELETE FROM factures WHERE id = ?', [id]);
        
        setFactures(factures.filter(f => f.id !== id));
        
        // Remove from selection if selected
        const newSelected = new Set(selectedFactures);
        newSelected.delete(id);
        setSelectedFactures(newSelected);
      } catch (error) {
        console.error('Error deleting facture:', error);
        alert('Erreur lors de la suppression de la facture');
      }
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
                placeholder="Rechercher par numéro ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="brouillon">Brouillon</option>
                <option value="envoyee">Envoyée</option>
                <option value="payee">Payée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
            <button
              onClick={loadFactures}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleViewAvoirs}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200 flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Voir les avoirs</span>
            </button>
            <button
              onClick={toggleMultiSelectMode}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                isMultiSelectMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMultiSelectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span>{isMultiSelectMode ? 'Annuler sélection' : 'Sélection multiple'}</span>
            </button>
            <button
              onClick={handleCreateNew}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nouvelle facture</span>
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

        {/* Multi-selection toolbar */}
        {isMultiSelectMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={selectAllFactures}
                  className="flex items-center space-x-2 text-blue-700 hover:text-blue-900"
                >
                  {selectedFactures.size === filteredFactures.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedFactures.size === filteredFactures.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </span>
                </button>
                <span className="text-blue-700 font-medium">
                  {selectedFactures.size} facture(s) sélectionnée(s)
                </span>
              </div>
              
              {selectedFactures.size > 0 && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleBulkDownload}
                    disabled={isProcessing}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isProcessing ? 'Création PDF...' : 'Télécharger PDF'}</span>
                  </button>
                  <button
                    onClick={handleBulkPrint}
                    disabled={isProcessing}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    <span>{isProcessing ? 'Préparation impression...' : 'Imprimer tout'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-blue-800 font-medium">
                {factures.length} facture{factures.length > 1 ? 's' : ''} enregistrée{factures.length > 1 ? 's' : ''}
              </span>
              {sortField && (
                <span className="ml-4 text-blue-600 text-sm">
                  Triées par {sortField === 'numero' ? 'numéro' : 
                             sortField === 'date' ? 'date' :
                             sortField === 'dateEcheance' ? 'échéance' :
                             sortField === 'totalTTC' ? 'montant' : 'client'} 
                  ({sortDirection === 'asc' ? 'croissant' : 'décroissant'})
                </span>
              )}
            </div>
            {searchTerm && (
              <span className="text-blue-600 text-sm">
                {filteredFactures.length} résultat{filteredFactures.length > 1 ? 's' : ''} trouvé{filteredFactures.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isMultiSelectMode && (
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={selectAllFactures}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {selectedFactures.size === filteredFactures.length ? (
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
                  onClick={() => handleSort('dateEcheance')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Échéance</span>
                    {getSortIcon('dateEcheance')}
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
              {filteredFactures.map((facture) => (
                <tr 
                  key={facture.id} 
                  className={`hover:bg-gray-50 ${
                    selectedFactures.has(facture.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  {isMultiSelectMode && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleFactureSelection(facture.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedFactures.has(facture.id) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {facture.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{facture.client.nom}</div>
                      <div className="text-gray-500 text-xs">{facture.client.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {facture.date.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className={`${
                      facture.dateEcheance < new Date() && facture.statut !== 'payee' 
                        ? 'text-red-600 font-medium' 
                        : ''
                    }`}>
                      {facture.dateEcheance.toLocaleDateString('fr-FR')}
                      {facture.dateEcheance < new Date() && facture.statut !== 'payee' && (
                        <div className="text-xs text-red-500">En retard</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(facture.totalTTC)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(facture.statut)}`}>
                      {getStatusLabel(facture.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {(facture.statut === 'envoyee' || facture.statut === 'brouillon') && (
                        <button
                          onClick={() => handleAddPayment(facture)}
                          className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                          title="Ajouter un paiement"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCreateAvoir(facture)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                        title="Créer un avoir"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(facture)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                        title="Télécharger PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(facture)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(facture)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(facture.id)}
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
          {filteredFactures.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Aucune facture trouvée avec ces critères' 
                  : 'Aucune facture créée pour le moment'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Créer la première facture
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Form Dialog */}
      <FactureForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingFacture(null);
        }}
        onSave={handleSave}
        facture={editingFacture}
      />

      {/* Avoir Form Dialog */}
      <FactureForm
        isOpen={showAvoirForm}
        onClose={() => {
          setShowAvoirForm(false);
          setSelectedFactureForAvoir(null);
        }}
        onSave={handleAvoirSave}
        isAvoir={true}
        originalFacture={selectedFactureForAvoir}
      />

      {/* Payment Form Dialog */}
      <PaymentForm
        isOpen={showPaymentForm}
        onClose={() => {
          setShowPaymentForm(false);
          setSelectedFactureForPayment(null);
        }}
        onSave={handlePaymentSave}
        preselectedFacture={selectedFactureForPayment}
      />

      {/* Avoirs List Dialog */}
      <AvoirsList
        isOpen={showAvoirsList}
        onClose={() => setShowAvoirsList(false)}
      />
    </>
  );
};

export default FacturesList;