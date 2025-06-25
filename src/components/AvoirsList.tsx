import React, { useState, useEffect } from 'react';
import { X, FileDown, Printer, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { Facture } from '../types';
import { generateFacturePDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';

interface AvoirsListProps {
  isOpen: boolean;
  onClose: () => void;
}

type SortField = 'numero' | 'date' | 'totalTTC' | 'client';
type SortDirection = 'asc' | 'desc';

const AvoirsList: React.FC<AvoirsListProps> = ({ isOpen, onClose }) => {
  const [avoirs, setAvoirs] = useState<Facture[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  
  const { getFactures, savePDF, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isOpen && isReady) {
      loadAvoirs();
    }
  }, [isOpen, isReady]);

  const loadAvoirs = async () => {
    setLoading(true);
    try {
      if (isElectron) {
        const data = await getFactures();
        // Filter to only include avoirs (credit notes) which start with AV-
        const avoirsData = data.filter(f => f.numero.startsWith('AV-'));
        setAvoirs(avoirsData);
      } else {
        // Load from localStorage for web version
        const savedFactures = localStorage.getItem('factures');
        if (savedFactures) {
          const parsedFactures = JSON.parse(savedFactures).map((f: any) => ({
            ...f,
            date: new Date(f.date),
            dateEcheance: new Date(f.dateEcheance)
          }));
          // Filter to only include avoirs (credit notes) which start with AV-
          const avoirsData = parsedFactures.filter((f: any) => f.numero.startsWith('AV-'));
          setAvoirs(avoirsData);
        }
      }
    } catch (error) {
      console.error('Error loading avoirs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort avoirs
  const sortedAvoirs = React.useMemo(() => {
    const sorted = [...avoirs].sort((a, b) => {
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
  }, [avoirs, sortField, sortDirection]);

  // Filter avoirs
  const filteredAvoirs = sortedAvoirs.filter(avoir => {
    const matchesSearch = avoir.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         avoir.client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (avoir.notes && avoir.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || avoir.statut === statusFilter;
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
      ? <ArrowUp className="w-4 h-4 text-red-600" />
      : <ArrowDown className="w-4 h-4 text-red-600" />;
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
      case 'envoyee': return 'Envoyé';
      case 'payee': return 'Payé';
      case 'annulee': return 'Annulé';
      default: return statut;
    }
  };

  const handleDownloadPDF = async (avoir: Facture) => {
    try {
      const doc = await generateFacturePDF(avoir);
      const pdfData = doc.output('arraybuffer');
      
      if (isElectron) {
        await savePDF(new Uint8Array(pdfData), `Avoir_${avoir.numero}.pdf`);
      } else {
        doc.save(`Avoir_${avoir.numero}.pdf`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF');
    }
  };

  const handlePrint = async (avoir: Facture) => {
    try {
      const doc = await generateFacturePDF(avoir);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (error) {
      console.error('Error generating PDF for print:', error);
      alert('Erreur lors de la génération du PDF pour impression');
    }
  };

  // Get original invoice number from notes
  const getOriginalInvoiceNumber = (notes?: string): string => {
    if (!notes) return '-';
    
    const match = notes.match(/Avoir pour la facture ([A-Z0-9-]+)/);
    return match ? match[1] : '-';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <RefreshCw className="w-6 h-6 mr-2 text-red-600" />
            Liste des avoirs
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro, client ou facture d'origine..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent w-80"
                />
              </div>
              <div className="relative">
                <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="brouillon">Brouillon</option>
                  <option value="envoyee">Envoyé</option>
                  <option value="payee">Payé</option>
                  <option value="annulee">Annulé</option>
                </select>
              </div>
              <button
                onClick={loadAvoirs}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Actualiser
              </button>
            </div>

            {/* Info Card */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <RefreshCw className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900">Avoirs (factures d'annulation)</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Les avoirs sont des factures négatives qui annulent ou remboursent partiellement une facture existante.
                    Ils sont identifiés par le préfixe "AV-" dans leur numéro.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-red-800 font-medium">
                    {avoirs.length} avoir{avoirs.length > 1 ? 's' : ''} enregistré{avoirs.length > 1 ? 's' : ''}
                  </span>
                  {sortField && (
                    <span className="ml-4 text-red-600 text-sm">
                      Triés par {sortField === 'numero' ? 'numéro' : 
                                sortField === 'date' ? 'date' :
                                sortField === 'totalTTC' ? 'montant' : 'client'} 
                      ({sortDirection === 'asc' ? 'croissant' : 'décroissant'})
                    </span>
                  )}
                </div>
                {searchTerm && (
                  <span className="text-red-600 text-sm">
                    {filteredAvoirs.length} résultat{filteredAvoirs.length > 1 ? 's' : ''} trouvé{filteredAvoirs.length > 1 ? 's' : ''}
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
                        <span>Numéro d'avoir</span>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Facture d'origine
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
                  {filteredAvoirs.map((avoir) => (
                    <tr key={avoir.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {avoir.numero}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{avoir.client.nom}</div>
                          <div className="text-gray-500 text-xs">{avoir.client.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {avoir.date.toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {getOriginalInvoiceNumber(avoir.notes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {formatCurrency(avoir.totalTTC)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(avoir.statut)}`}>
                          {getStatusLabel(avoir.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleDownloadPDF(avoir)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="Télécharger PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(avoir)}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                            title="Imprimer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAvoirs.length === 0 && (
                <div className="text-center py-12">
                  <RefreshCw className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Aucun avoir trouvé avec ces critères' 
                      : 'Aucun avoir créé pour le moment'}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Les avoirs peuvent être créés à partir de la liste des factures
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvoirsList;