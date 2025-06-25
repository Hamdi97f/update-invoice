import React, { useState, useEffect } from 'react';
import { Receipt, FileText, Truck, ShoppingCart, TrendingUp, Users, Package, AlertCircle, CreditCard, Boxes, BarChart3, PieChart, LineChart, ArrowUpRight, ArrowDownRight, Store } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title } from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title
);

interface DashboardProps {
  onPageChange: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const [stats, setStats] = useState({
    facturesDuMois: 0,
    devisEnAttente: 0,
    livraisonsPrevues: 0,
    commandesFournisseur: 0,
    chiffreAffaires: 0,
    paiementsRecus: 0,
    facturesEnRetard: 0,
    stockTotal: 0,
    stockValeur: 0,
    stockFaible: 0
  });
  
  const { query, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadStats();
    }
  }, [isReady]);

  const loadStats = async () => {
    if (!isReady) return;
    
    try {
      // Factures du mois
      const facturesResult = await query(`
        SELECT COUNT(*) as count, SUM(totalTTC) as total
        FROM factures 
        WHERE date >= date('now', 'start of month')
      `);
      
      // Devis en attente
      const devisResult = await query(`
        SELECT COUNT(*) as count 
        FROM devis 
        WHERE statut = 'envoye'
      `);

      // Factures en retard
      const facturesEnRetardResult = await query(`
        SELECT COUNT(*) as count 
        FROM factures 
        WHERE dateEcheance < date('now') AND statut != 'payee' AND statut != 'annulee'
      `);

      // Paiements reçus ce mois
      const paiementsResult = await query(`
        SELECT SUM(montant) as total
        FROM payments
        WHERE date >= date('now', 'start of month') AND statut = 'valide'
      `);

      // Livraisons prévues
      const livraisonsResult = await query(`
        SELECT COUNT(*) as count 
        FROM bons_livraison 
        WHERE statut = 'prepare'
      `);

      // Commandes fournisseur
      const commandesResult = await query(`
        SELECT COUNT(*) as count 
        FROM commandes_fournisseur 
        WHERE statut IN ('brouillon', 'envoyee')
      `);
      
      // Stock stats
      const stockResult = await query(`
        SELECT COUNT(*) as count, SUM(stock) as total, SUM(stock * prixUnitaire) as valeur
        FROM produits
      `);
      
      const stockFaibleResult = await query(`
        SELECT COUNT(*) as count
        FROM produits
        WHERE stock > 0 AND stock <= 5
      `);

      setStats({
        facturesDuMois: facturesResult[0]?.count || 0,
        devisEnAttente: devisResult[0]?.count || 0,
        livraisonsPrevues: livraisonsResult[0]?.count || 0,
        commandesFournisseur: commandesResult[0]?.count || 0,
        chiffreAffaires: facturesResult[0]?.total || 0,
        paiementsRecus: paiementsResult[0]?.total || 0,
        facturesEnRetard: facturesEnRetardResult[0]?.count || 0,
        stockTotal: stockResult[0]?.total || 0,
        stockValeur: stockResult[0]?.valeur || 0,
        stockFaible: stockFaibleResult[0]?.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Set default values in case of error
      setStats({
        facturesDuMois: 0,
        devisEnAttente: 0,
        livraisonsPrevues: 0,
        commandesFournisseur: 0,
        chiffreAffaires: 0,
        paiementsRecus: 0,
        facturesEnRetard: 0,
        stockTotal: 0,
        stockValeur: 0,
        stockFaible: 0
      });
    }
  };

  const dashboardStats = [
    {
      label: 'Factures du mois',
      value: stats.facturesDuMois.toString(),
      change: '+12%',
      icon: Receipt,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      trend: 'up'
    },
    {
      label: 'Devis en attente',
      value: stats.devisEnAttente.toString(),
      change: '-3%',
      icon: FileText,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      trend: 'down'
    },
    {
      label: 'Paiements reçus',
      value: formatCurrency(stats.paiementsRecus || 0),
      change: '+15%',
      icon: CreditCard,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      trend: 'up'
    },
    {
      label: 'CA du mois',
      value: formatCurrency(stats.chiffreAffaires),
      change: '+15%',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      trend: 'up'
    }
  ];

  const quickActions = [
    { label: 'Nouvelle facture', action: () => onPageChange('factures'), icon: Receipt, color: 'bg-blue-600' },
    { label: 'Nouveau devis', action: () => onPageChange('devis'), icon: FileText, color: 'bg-green-600' },
    { label: 'Nouveau paiement', action: () => onPageChange('paiements'), icon: CreditCard, color: 'bg-purple-600' },
    { label: 'Gérer le stock', action: () => onPageChange('stock'), icon: Boxes, color: 'bg-orange-600' },
  ];

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Bienvenue dans Facturation Pro</h2>
        <p className="text-blue-100">Gérez facilement vos factures, devis et documents commerciaux</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-semibold text-gray-900">{stat.value}</p>
                    <span className={`text-sm font-medium flex items-center ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={action.action}
                className={`${action.color} text-white p-4 rounded-lg hover:opacity-90 transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-105 transform`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      {stats.facturesEnRetard > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Rappel important</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Vous avez {stats.facturesEnRetard} facture(s) qui arrivent à échéance dans les 7 prochains jours. 
                <button 
                  className="ml-2 text-yellow-800 underline hover:text-yellow-900"
                  onClick={() => onPageChange('factures')}
                >
                  Voir les détails
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;