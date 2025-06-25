import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, LineChart, Calendar, TrendingUp, CreditCard, Package, RefreshCw, Download, Printer } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title } from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const Rapport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ca' | 'produits' | 'clients' | 'paiements'>('ca');
  const [period, setPeriod] = useState<'month' | '3months' | '6months' | 'year'>('6months');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [caData, setCaData] = useState<any>({
    labels: [],
    datasets: []
  });
  
  const [produitsData, setProduitsData] = useState<any>({
    labels: [],
    datasets: []
  });
  
  const [clientsData, setClientsData] = useState<any>({
    labels: [],
    datasets: []
  });
  
  const [paiementsData, setPaiementsData] = useState<any>({
    labels: [],
    datasets: []
  });
  
  const [stats, setStats] = useState({
    totalCA: 0,
    totalPaiements: 0,
    totalClients: 0,
    totalProduits: 0,
    moyenneFacture: 0,
    facturesPayees: 0,
    facturesEnRetard: 0
  });
  
  const { query, isReady, savePDF } = useDatabase();
  
  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady, period, activeTab]);
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get date range based on selected period
      const endDate = new Date();
      let startDate;
      
      switch (period) {
        case 'month':
          startDate = subMonths(endDate, 1);
          break;
        case '3months':
          startDate = subMonths(endDate, 3);
          break;
        case '6months':
          startDate = subMonths(endDate, 6);
          break;
        case 'year':
          startDate = subMonths(endDate, 12);
          break;
        default:
          startDate = subMonths(endDate, 6);
      }
      
      // Format dates for SQL query
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();
      
      // Load data based on active tab
      switch (activeTab) {
        case 'ca':
          await loadCAData(startDateStr, endDateStr);
          break;
        case 'produits':
          await loadProduitsData(startDateStr, endDateStr);
          break;
        case 'clients':
          await loadClientsData(startDateStr, endDateStr);
          break;
        case 'paiements':
          await loadPaiementsData(startDateStr, endDateStr);
          break;
      }
      
      // Load global stats
      await loadStats(startDateStr, endDateStr);
      
    } catch (error: any) {
      console.error('Error loading report data:', error);
      setError(`Erreur lors du chargement des données: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const loadStats = async (startDateStr: string, endDateStr: string) => {
    try {
      // Total CA
      const caResult = await query(`
        SELECT SUM(totalTTC) as total
        FROM factures
        WHERE date BETWEEN ? AND ? AND statut != 'annulee'
      `, [startDateStr, endDateStr]);
      
      // Total paiements
      const paiementsResult = await query(`
        SELECT SUM(montant) as total
        FROM payments
        WHERE date BETWEEN ? AND ? AND statut = 'valide'
      `, [startDateStr, endDateStr]);
      
      // Total clients actifs (avec facture dans la période)
      const clientsResult = await query(`
        SELECT COUNT(DISTINCT clientId) as total
        FROM factures
        WHERE date BETWEEN ? AND ?
      `, [startDateStr, endDateStr]);
      
      // Total produits vendus
      const produitsResult = await query(`
        SELECT SUM(lf.quantite) as total
        FROM lignes_facture lf
        JOIN factures f ON lf.factureId = f.id
        WHERE f.date BETWEEN ? AND ? AND f.statut != 'annulee'
      `, [startDateStr, endDateStr]);
      
      // Moyenne par facture
      const moyenneResult = await query(`
        SELECT AVG(totalTTC) as moyenne, COUNT(*) as count
        FROM factures
        WHERE date BETWEEN ? AND ? AND statut != 'annulee'
      `, [startDateStr, endDateStr]);
      
      // Factures payées vs en retard
      const facturesPayeesResult = await query(`
        SELECT COUNT(*) as count
        FROM factures
        WHERE date BETWEEN ? AND ? AND statut = 'payee'
      `, [startDateStr, endDateStr]);
      
      const facturesEnRetardResult = await query(`
        SELECT COUNT(*) as count 
        FROM factures 
        WHERE dateEcheance < date('now') AND statut != 'payee' AND statut != 'annulee'
      `);
      
      setStats({
        totalCA: caResult[0]?.total || 0,
        totalPaiements: paiementsResult[0]?.total || 0,
        totalClients: clientsResult[0]?.total || 0,
        totalProduits: produitsResult[0]?.total || 0,
        moyenneFacture: moyenneResult[0]?.moyenne || 0,
        facturesPayees: facturesPayeesResult[0]?.count || 0,
        facturesEnRetard: facturesEnRetardResult[0]?.count || 0
      });
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };
  
  const loadCAData = async (startDateStr: string, endDateStr: string) => {
    try {
      // Get months between start and end date
      const months = [];
      let currentDate = startOfMonth(new Date(startDateStr));
      const lastDate = endOfMonth(new Date(endDateStr));
      
      while (currentDate <= lastDate) {
        months.push(format(currentDate, 'yyyy-MM'));
        currentDate = startOfMonth(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
      }
      
      // Get CA data for each month
      const caByMonth = await Promise.all(months.map(async (month) => {
        const [year, monthNum] = month.split('-');
        const startOfMonthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toISOString();
        const endOfMonthDate = endOfMonth(new Date(parseInt(year), parseInt(monthNum) - 1, 1)).toISOString();
        
        const result = await query(`
          SELECT SUM(totalTTC) as total
          FROM factures
          WHERE date BETWEEN ? AND ? AND statut != 'annulee'
        `, [startOfMonthDate, endOfMonthDate]);
        
        return {
          month,
          total: result[0]?.total || 0
        };
      }));
      
      // Format data for chart
      const labels = caByMonth.map(item => format(new Date(item.month + '-01'), 'MMM yyyy', { locale: fr }));
      const data = caByMonth.map(item => item.total);
      
      setCaData({
        labels,
        datasets: [
          {
            label: 'Chiffre d\'affaires',
            data,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }
        ]
      });
      
    } catch (error) {
      console.error('Error loading CA data:', error);
      throw error;
    }
  };
  
  const loadProduitsData = async (startDateStr: string, endDateStr: string) => {
    try {
      // Get top 5 products by quantity
      const topProduitsResult = await query(`
        SELECT p.nom, SUM(lf.quantite) as total
        FROM lignes_facture lf
        JOIN produits p ON lf.produitId = p.id
        JOIN factures f ON lf.factureId = f.id
        WHERE f.date BETWEEN ? AND ? AND f.statut != 'annulee'
        GROUP BY p.id
        ORDER BY total DESC
        LIMIT 5
      `, [startDateStr, endDateStr]);
      
      // Format data for chart
      const labels = topProduitsResult.map(item => item.nom);
      const data = topProduitsResult.map(item => item.total);
      
      setProduitsData({
        labels,
        datasets: [
          {
            label: 'Quantité vendue',
            data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 206, 86, 0.6)',
              'rgba(75, 192, 192, 0.6)',
              'rgba(153, 102, 255, 0.6)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)'
            ],
            borderWidth: 1
          }
        ]
      });
      
    } catch (error) {
      console.error('Error loading produits data:', error);
      throw error;
    }
  };
  
  const loadClientsData = async (startDateStr: string, endDateStr: string) => {
    try {
      // Get top 5 clients by total amount
      const topClientsResult = await query(`
        SELECT c.nom, SUM(f.totalTTC) as total
        FROM factures f
        JOIN clients c ON f.clientId = c.id
        WHERE f.date BETWEEN ? AND ? AND f.statut != 'annulee'
        GROUP BY c.id
        ORDER BY total DESC
        LIMIT 5
      `, [startDateStr, endDateStr]);
      
      // Format data for chart
      const labels = topClientsResult.map(item => item.nom);
      const data = topClientsResult.map(item => item.total);
      
      setClientsData({
        labels,
        datasets: [
          {
            label: 'Montant total',
            data,
            backgroundColor: [
              'rgba(255, 159, 64, 0.6)',
              'rgba(75, 192, 192, 0.6)',
              'rgba(153, 102, 255, 0.6)',
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)'
            ],
            borderColor: [
              'rgba(255, 159, 64, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)'
            ],
            borderWidth: 1
          }
        ]
      });
      
    } catch (error) {
      console.error('Error loading clients data:', error);
      throw error;
    }
  };
  
  const loadPaiementsData = async (startDateStr: string, endDateStr: string) => {
    try {
      // Get payments by method
      const paiementsResult = await query(`
        SELECT methode, SUM(montant) as total
        FROM payments
        WHERE date BETWEEN ? AND ? AND statut = 'valide'
        GROUP BY methode
      `, [startDateStr, endDateStr]);
      
      // Format data for chart
      const methodLabels = {
        'especes': 'Espèces',
        'cheque': 'Chèque',
        'virement': 'Virement',
        'carte': 'Carte bancaire',
        'autre': 'Autre'
      };
      
      const labels = paiementsResult.map(item => methodLabels[item.methode as keyof typeof methodLabels] || item.methode);
      const data = paiementsResult.map(item => item.total);
      
      setPaiementsData({
        labels,
        datasets: [
          {
            label: 'Montant total',
            data,
            backgroundColor: [
              'rgba(75, 192, 192, 0.6)',
              'rgba(153, 102, 255, 0.6)',
              'rgba(255, 159, 64, 0.6)',
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)'
            ],
            borderColor: [
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
              'rgba(255, 159, 64, 1)',
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)'
            ],
            borderWidth: 1
          }
        ]
      });
      
    } catch (error) {
      console.error('Error loading paiements data:', error);
      throw error;
    }
  };
  
  const getPeriodLabel = () => {
    switch (period) {
      case 'month': return 'Dernier mois';
      case '3months': return '3 derniers mois';
      case '6months': return '6 derniers mois';
      case 'year': return 'Dernière année';
      default: return '6 derniers mois';
    }
  };
  
  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Rapport - ' + getPeriodLabel(), 105, 15, { align: 'center' });
      
      // Date
      doc.setFontSize(10);
      doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy')}`, 105, 22, { align: 'center' });
      
      // Stats
      doc.setFontSize(12);
      doc.text('Statistiques générales', 14, 35);
      
      const statsData = [
        ['Chiffre d\'affaires', formatCurrency(stats.totalCA)],
        ['Paiements reçus', formatCurrency(stats.totalPaiements)],
        ['Clients actifs', stats.totalClients.toString()],
        ['Produits vendus', stats.totalProduits.toString()],
        ['Moyenne par facture', formatCurrency(stats.moyenneFacture)],
        ['Factures payées', stats.facturesPayees.toString()],
        ['Factures en retard', stats.facturesEnRetard.toString()]
      ];
      
      autoTable(doc, {
        startY: 40,
        head: [['Indicateur', 'Valeur']],
        body: statsData,
        theme: 'grid',
        headStyles: {
          fillColor: [54, 162, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        }
      });
      
      // Add chart if data is available
      let currentY = (doc as any).lastAutoTable.finalY + 20;
      
      if (activeTab === 'ca' && caData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Évolution du chiffre d\'affaires', 14, currentY);
        
        // Create a table for CA data
        const caTableData = caData.labels.map((label: string, index: number) => [
          label,
          formatCurrency(caData.datasets[0].data[index])
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Mois', 'Chiffre d\'affaires']],
          body: caTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [54, 162, 235],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      } else if (activeTab === 'produits' && produitsData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Top 5 des produits vendus', 14, currentY);
        
        const produitsTableData = produitsData.labels.map((label: string, index: number) => [
          label,
          produitsData.datasets[0].data[index].toString()
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Produit', 'Quantité vendue']],
          body: produitsTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [255, 99, 132],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      } else if (activeTab === 'clients' && clientsData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Top 5 des clients', 14, currentY);
        
        const clientsTableData = clientsData.labels.map((label: string, index: number) => [
          label,
          formatCurrency(clientsData.datasets[0].data[index])
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Client', 'Montant total']],
          body: clientsTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [255, 159, 64],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      } else if (activeTab === 'paiements' && paiementsData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Paiements par méthode', 14, currentY);
        
        const paiementsTableData = paiementsData.labels.map((label: string, index: number) => [
          label,
          formatCurrency(paiementsData.datasets[0].data[index])
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Méthode', 'Montant total']],
          body: paiementsTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [75, 192, 192],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      }
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Facturation Pro - Rapport ${getPeriodLabel()} - Page ${i} sur ${pageCount}`,
          105,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
      
      // Save the PDF
      const pdfData = doc.output('arraybuffer');
      const result = await savePDF(new Uint8Array(pdfData), `Rapport_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de l\'export du PDF');
      }
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Erreur lors de l\'export du rapport en PDF');
    }
  };
  
  const handlePrint = async () => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Rapport - ' + getPeriodLabel(), 105, 15, { align: 'center' });
      
      // Date
      doc.setFontSize(10);
      doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy')}`, 105, 22, { align: 'center' });
      
      // Stats
      doc.setFontSize(12);
      doc.text('Statistiques générales', 14, 35);
      
      const statsData = [
        ['Chiffre d\'affaires', formatCurrency(stats.totalCA)],
        ['Paiements reçus', formatCurrency(stats.totalPaiements)],
        ['Clients actifs', stats.totalClients.toString()],
        ['Produits vendus', stats.totalProduits.toString()],
        ['Moyenne par facture', formatCurrency(stats.moyenneFacture)],
        ['Factures payées', stats.facturesPayees.toString()],
        ['Factures en retard', stats.facturesEnRetard.toString()]
      ];
      
      autoTable(doc, {
        startY: 40,
        head: [['Indicateur', 'Valeur']],
        body: statsData,
        theme: 'grid',
        headStyles: {
          fillColor: [54, 162, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        }
      });
      
      // Add chart if data is available
      let currentY = (doc as any).lastAutoTable.finalY + 20;
      
      if (activeTab === 'ca' && caData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Évolution du chiffre d\'affaires', 14, currentY);
        
        // Create a table for CA data
        const caTableData = caData.labels.map((label: string, index: number) => [
          label,
          formatCurrency(caData.datasets[0].data[index])
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Mois', 'Chiffre d\'affaires']],
          body: caTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [54, 162, 235],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      } else if (activeTab === 'produits' && produitsData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Top 5 des produits vendus', 14, currentY);
        
        const produitsTableData = produitsData.labels.map((label: string, index: number) => [
          label,
          produitsData.datasets[0].data[index].toString()
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Produit', 'Quantité vendue']],
          body: produitsTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [255, 99, 132],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      } else if (activeTab === 'clients' && clientsData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Top 5 des clients', 14, currentY);
        
        const clientsTableData = clientsData.labels.map((label: string, index: number) => [
          label,
          formatCurrency(clientsData.datasets[0].data[index])
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Client', 'Montant total']],
          body: clientsTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [255, 159, 64],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      } else if (activeTab === 'paiements' && paiementsData.labels.length > 0) {
        doc.setFontSize(12);
        doc.text('Paiements par méthode', 14, currentY);
        
        const paiementsTableData = paiementsData.labels.map((label: string, index: number) => [
          label,
          formatCurrency(paiementsData.datasets[0].data[index])
        ]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Méthode', 'Montant total']],
          body: paiementsTableData,
          theme: 'striped',
          headStyles: {
            fillColor: [75, 192, 192],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          }
        });
      }
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Facturation Pro - Rapport ${getPeriodLabel()} - Page ${i} sur ${pageCount}`,
          105,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }
      
      // Print the PDF
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      
    } catch (error) {
      console.error('Error printing report:', error);
      alert('Erreur lors de l\'impression du rapport');
    }
  };
  
  const tabs = [
    { id: 'ca', label: 'Chiffre d\'affaires', icon: TrendingUp, color: 'text-blue-600' },
    { id: 'produits', label: 'Produits', icon: Package, color: 'text-red-600' },
    { id: 'clients', label: 'Clients', icon: Calendar, color: 'text-orange-600' },
    { id: 'paiements', label: 'Paiements', icon: CreditCard, color: 'text-green-600' }
  ];
  
  const periods = [
    { id: 'month', label: 'Dernier mois' },
    { id: '3months', label: '3 derniers mois' },
    { id: '6months', label: '6 derniers mois' },
    { id: 'year', label: 'Dernière année' }
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Rapports</h2>
          <p className="text-gray-600">Analysez les performances de votre entreprise</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Exporter PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex flex-wrap space-x-2 border-b border-gray-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 mb-2 rounded-t-lg flex items-center space-x-2 ${
                activeTab === tab.id
                  ? `bg-white border border-gray-200 border-b-white ${tab.color}`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Period selector */}
      <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg">
        <span className="text-gray-700 font-medium">Période:</span>
        <div className="flex space-x-2">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`px-3 py-1 rounded-md text-sm ${
                period === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={loadData}
          className="ml-auto px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center space-x-1"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Actualiser</span>
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}
      
      {/* Loading indicator */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <div className="bg-blue-100 p-3 rounded-full">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Chiffre d'affaires</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalCA)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <div className="bg-green-100 p-3 rounded-full">
                  <CreditCard className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Paiements reçus</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalPaiements)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <div className="bg-orange-100 p-3 rounded-full">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Produits vendus</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalProduits}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center">
                <div className="bg-purple-100 p-3 rounded-full">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Clients actifs</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalClients}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            {activeTab === 'ca' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  Évolution du chiffre d'affaires
                </h3>
                {caData.labels.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={caData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number);
                              }
                            }
                          }
                        },
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return formatCurrency(context.parsed.y);
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'produits' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-red-600" />
                  Top 5 des produits vendus
                </h3>
                {produitsData.labels.length > 0 ? (
                  <div className="h-80">
                    <Pie
                      data={produitsData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right'
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <PieChart className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'clients' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-orange-600" />
                  Top 5 des clients
                </h3>
                {clientsData.labels.length > 0 ? (
                  <div className="h-80">
                    <Bar
                      data={clientsData}
                      options={{
                        indexAxis: 'y' as const,
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return formatCurrency(value as number);
                              }
                            }
                          }
                        },
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return formatCurrency(context.parsed.x);
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'paiements' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-green-600" />
                  Paiements par méthode
                </h3>
                {paiementsData.labels.length > 0 ? (
                  <div className="h-80">
                    <Pie
                      data={paiementsData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right'
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: ${formatCurrency(value)}`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <PieChart className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">Aucune donnée disponible pour cette période</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Additional stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiques supplémentaires</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-600">Moyenne par facture</span>
                  <span className="font-semibold">{formatCurrency(stats.moyenneFacture)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-600">Factures payées</span>
                  <span className="font-semibold text-green-600">{stats.facturesPayees}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-600">Factures en retard</span>
                  <span className="font-semibold text-red-600">{stats.facturesEnRetard}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Taux de paiement</span>
                  <span className="font-semibold">
                    {stats.facturesPayees + stats.facturesEnRetard > 0
                      ? `${Math.round((stats.facturesPayees / (stats.facturesPayees + stats.facturesEnRetard)) * 100)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Informations</h3>
              <div className="space-y-4 text-gray-600">
                <p>
                  Ce rapport présente les données pour la période: <span className="font-semibold">{getPeriodLabel()}</span>
                </p>
                <p>
                  Utilisez les onglets pour naviguer entre les différentes analyses et le sélecteur de période pour ajuster la plage de dates.
                </p>
                <p>
                  Vous pouvez exporter ce rapport en PDF ou l'imprimer en utilisant les boutons en haut à droite.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Rapport;