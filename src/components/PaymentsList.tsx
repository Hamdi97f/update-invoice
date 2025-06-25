import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, CreditCard, Eye, FileText, Calendar, DollarSign } from 'lucide-react';
import { Payment, Facture } from '../types';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import PaymentForm from './PaymentForm';

const PaymentsList: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'montant' | 'client' | 'facture'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  
  const { query, isElectron } = useDatabase();

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      loadPayments();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadPayments = async () => {
    try {
      if (isElectron) {
        const result = await query(`
          SELECT p.*, f.numero as factureNumero, f.totalTTC as montantFacture, 
                 c.nom as clientNom
          FROM payments p
          JOIN factures f ON p.factureId = f.id
          JOIN clients c ON p.clientId = c.id
          ORDER BY p.date DESC
        `);

        const paymentsData = result.map((p: any) => ({
          ...p,
          date: new Date(p.date)
        }));
        setPayments(paymentsData);
      } else {
        const savedPayments = localStorage.getItem('payments');
        if (savedPayments) {
          const parsedPayments = JSON.parse(savedPayments).map((p: any) => ({
            ...p,
            date: new Date(p.date)
          }));
          setPayments(parsedPayments);
        }
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort payments
  const sortedPayments = React.useMemo(() => {
    const sorted = [...payments].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = a.date.getTime();
          bValue = b.date.getTime();
          break;
        case 'montant':
          aValue = a.montant;
          bValue = b.montant;
          break;
        case 'client':
          aValue = a.clientNom.toLowerCase();
          bValue = b.clientNom.toLowerCase();
          break;
        case 'facture':
          aValue = a.factureNumero;
          bValue = b.factureNumero;
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
  }, [payments, sortField, sortDirection]);

  // Filter payments
  const filteredPayments = sortedPayments.filter(payment => {
    const matchesSearch = payment.factureNumero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.clientNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (payment.reference && payment.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || payment.statut === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.methode === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const handleSort = (field: 'date' | 'montant' | 'client' | 'facture') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'date' | 'montant' | 'client' | 'facture') => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-green-600" />
      : <ArrowDown className="w-4 h-4 text-green-600" />;
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'valide': return 'bg-green-100 text-green-800';
      case 'en_attente': return 'bg-yellow-100 text-yellow-800';
      case 'annule': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'valide': return 'Validé';
      case 'en_attente': return 'En attente';
      case 'annule': return 'Annulé';
      default: return statut;
    }
  };

  const getMethodLabel = (methode: string) => {
    switch (methode) {
      case 'especes': return 'Espèces';
      case 'cheque': return 'Chèque';
      case 'virement': return 'Virement';
      case 'carte': return 'Carte bancaire';
      case 'autre': return 'Autre';
      default: return methode;
    }
  };

  const getMethodIcon = (methode: string) => {
    switch (methode) {
      case 'especes': return '💵';
      case 'cheque': return '📝';
      case 'virement': return '🏦';
      case 'carte': return '💳';
      case 'autre': return '💰';
      default: return '💰';
    }
  };

  const handleCreateNew = () => {
    setEditingPayment(null);
    setSelectedFacture(null);
    setShowForm(true);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setSelectedFacture(null);
    setShowForm(true);
  };

  const handleSave = async (payment: Payment) => {
    try {
      if (!isElectron) {
        const existingPayments = JSON.parse(localStorage.getItem('payments') || '[]');
        const updatedPayments = editingPayment 
          ? existingPayments.map((p: any) => p.id === payment.id ? payment : p)
          : [...existingPayments, payment];
        localStorage.setItem('payments', JSON.stringify(updatedPayments));
      }

      if (editingPayment) {
        setPayments(payments.map(p => p.id === payment.id ? payment : p));
      } else {
        setPayments([payment, ...payments]);
      }

      setShowForm(false);
      setEditingPayment(null);
      setSelectedFacture(null);

      setTimeout(() => {
        loadPayments();
      }, 100);
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Erreur lors de la sauvegarde du paiement');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      try {
        if (isElectron) {
          await query('DELETE FROM payments WHERE id = ?', [id]);
        } else {
          const existingPayments = JSON.parse(localStorage.getItem('payments') || '[]');
          const updatedPayments = existingPayments.filter((p: any) => p.id !== id);
          localStorage.setItem('payments', JSON.stringify(updatedPayments));
        }
        
        setPayments(payments.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Erreur lors de la suppression du paiement');
      }
    }
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    const totalPayments = filteredPayments.reduce((sum, p) => sum + p.montant, 0);
    const validPayments = filteredPayments.filter(p => p.statut === 'valide');
    const totalValidPayments = validPayments.reduce((sum, p) => sum + p.montant, 0);
    const pendingPayments = filteredPayments.filter(p => p.statut === 'en_attente');
    const totalPendingPayments = pendingPayments.reduce((sum, p) => sum + p.montant, 0);

    return {
      totalPayments,
      totalValidPayments,
      totalPendingPayments,
      countValid: validPayments.length,
      countPending: pendingPayments.length,
      countTotal: filteredPayments.length
    };
  }, [filteredPayments]);

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
                placeholder="Rechercher par facture, client ou référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-80"
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
                <option value="valide">Validé</option>
                <option value="en_attente">En attente</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
            <div className="relative">
              <CreditCard className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Toutes les méthodes</option>
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="virement">Virement</option>
                <option value="carte">Carte bancaire</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <button
              onClick={loadPayments}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau paiement</span>
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total paiements</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalPayments)}</p>
                <p className="text-xs text-gray-500">{stats.countTotal} paiement(s)</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-lg">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Paiements validés</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(stats.totalValidPayments)}</p>
                <p className="text-xs text-gray-500">{stats.countValid} paiement(s)</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-yellow-500 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En attente</p>
                <p className="text-xl font-bold text-yellow-600">{formatCurrency(stats.totalPendingPayments)}</p>
                <p className="text-xs text-gray-500">{stats.countPending} paiement(s)</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-purple-500 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Taux de validation</p>
                <p className="text-xl font-bold text-purple-600">
                  {stats.countTotal > 0 ? Math.round((stats.countValid / stats.countTotal) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500">des paiements</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
                  onClick={() => handleSort('facture')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Facture</span>
                    {getSortIcon('facture')}
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
                  onClick={() => handleSort('montant')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Montant</span>
                    {getSortIcon('montant')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Méthode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
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
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.date.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {payment.factureNumero}
                    <div className="text-xs text-gray-500">
                      {formatCurrency(payment.montantFacture)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.clientNom}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(payment.montant)}
                    {payment.montant < payment.montantFacture && (
                      <div className="text-xs text-orange-600">
                        Partiel ({Math.round((payment.montant / payment.montantFacture) * 100)}%)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="mr-2">{getMethodIcon(payment.methode)}</span>
                      {getMethodLabel(payment.methode)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.reference || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.statut)}`}>
                      {getStatusLabel(payment.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(payment)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(payment.id)}
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
          {filteredPayments.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' || methodFilter !== 'all'
                  ? 'Aucun paiement trouvé avec ces critères' 
                  : 'Aucun paiement enregistré pour le moment'}
              </p>
              {!searchTerm && statusFilter === 'all' && methodFilter === 'all' && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Enregistrer le premier paiement
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Form Dialog */}
      <PaymentForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingPayment(null);
          setSelectedFacture(null);
        }}
        onSave={handleSave}
        payment={editingPayment}
        preselectedFacture={selectedFacture}
      />
    </>
  );
};

export default PaymentsList;