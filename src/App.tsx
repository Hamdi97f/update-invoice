import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import FacturesList from './components/FacturesList';
import DevisList from './components/DevisList';
import BonLivraisonList from './components/BonLivraisonList';
import CommandeFournisseurList from './components/CommandeFournisseurList';
import PaymentsList from './components/PaymentsList';
import ClientsList from './components/ClientsList';
import FournisseursList from './components/FournisseursList';
import ProduitsList from './components/ProduitsList';
import StockPage from './components/StockPage';
import Rapport from './components/Rapport';
import Settings from './components/Settings';
import ActivationDialog from './components/ActivationDialog';
import { Facture, Devis, BonLivraison, CommandeFournisseur } from './types';
import { useDatabase } from './hooks/useDatabase';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showActivation, setShowActivation] = useState(false);
  const { isReady, isActivated, checkActivation } = useDatabase();

  useEffect(() => {
    // Check if database is ready
    if (isReady) {
      checkActivation().then(result => {
        if (!result.activated) {
          setShowActivation(true);
        }
        setIsLoading(false);
      }).catch(error => {
        console.error('Error checking activation:', error);
        setDbError("Erreur lors de la vérification de l'activation. Veuillez redémarrer l'application.");
        setIsLoading(false);
      });
    } else {
      // Set a timeout to check if database is still not ready after 5 seconds
      const timer = setTimeout(() => {
        if (!isReady) {
          setDbError("La base de données n'a pas pu être initialisée. Veuillez redémarrer l'application.");
          setIsLoading(false);
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  const handleCreateNewFacture = () => {
    console.log('Create new invoice');
  };

  const handleEditFacture = (facture: Facture) => {
    console.log('Edit invoice:', facture);
  };

  const handleDeleteFacture = (id: string) => {
    console.log('Delete invoice:', id);
  };

  const handleCreateNewDevis = () => {
    console.log('Create new devis');
  };

  const handleEditDevis = (devis: Devis) => {
    console.log('Edit devis:', devis);
  };

  const handleDeleteDevis = (id: string) => {
    console.log('Delete devis:', id);
  };

  const handleCreateNewBonLivraison = () => {
    console.log('Create new bon de livraison');
  };

  const handleEditBonLivraison = (bonLivraison: BonLivraison) => {
    console.log('Edit bon de livraison:', bonLivraison);
  };

  const handleDeleteBonLivraison = (id: string) => {
    console.log('Delete bon de livraison:', id);
  };

  const handleCreateNewCommandeFournisseur = () => {
    console.log('Create new commande fournisseur');
  };

  const handleEditCommandeFournisseur = (commande: CommandeFournisseur) => {
    console.log('Edit commande fournisseur:', commande);
  };

  const handleDeleteCommandeFournisseur = (id: string) => {
    console.log('Delete commande fournisseur:', id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Initialisation de l'application</h2>
          <p className="text-gray-600">Chargement de la base de données...</p>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Erreur d'initialisation</h2>
          <p className="text-gray-600 mb-4">{dbError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Redémarrer l'application
          </button>
        </div>
      </div>
    );
  }

  if (showActivation) {
    return <ActivationDialog isOpen={true} onClose={() => setShowActivation(false)} />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onPageChange={setCurrentPage} />;
      case 'factures':
        return (
          <FacturesList
            onCreateNew={handleCreateNewFacture}
            onEdit={handleEditFacture}
            onDelete={handleDeleteFacture}
          />
        );
      case 'devis':
        return (
          <DevisList
            onCreateNew={handleCreateNewDevis}
            onEdit={handleEditDevis}
            onDelete={handleDeleteDevis}
          />
        );
      case 'bons-livraison':
        return (
          <BonLivraisonList
            onCreateNew={handleCreateNewBonLivraison}
            onEdit={handleEditBonLivraison}
            onDelete={handleDeleteBonLivraison}
          />
        );
      case 'commandes-fournisseur':
        return (
          <CommandeFournisseurList
            onCreateNew={handleCreateNewCommandeFournisseur}
            onEdit={handleEditCommandeFournisseur}
            onDelete={handleDeleteCommandeFournisseur}
          />
        );
      case 'paiements':
        return <PaymentsList />;
      case 'clients':
        return <ClientsList />;
      case 'fournisseurs':
        return <FournisseursList />;
      case 'produits':
        return <ProduitsList />;
      case 'stock':
        return <StockPage />;
      case 'rapport':
        return <Rapport />;
      case 'parametres':
        return <Settings />;
      default:
        return <Dashboard onPageChange={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  );
}

export default App;