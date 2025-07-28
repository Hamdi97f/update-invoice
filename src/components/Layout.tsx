import React, { ReactNode } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { 
  FileText, 
  Receipt, 
  Truck, 
  ShoppingCart, 
  Users, 
  Package,
  Settings,
  Home,
  Building2,
  BarChart3,
  CreditCard,
  Boxes
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  const [activationStatus, setActivationStatus] = React.useState<any>(null);
  const { checkActivation } = useDatabase();
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'factures', label: 'Factures', icon: Receipt },
    { id: 'devis', label: 'Devis', icon: FileText },
    { id: 'bons-livraison', label: 'Bons de livraison', icon: Truck },
    { id: 'commandes-fournisseur', label: 'Commandes fournisseur', icon: ShoppingCart },
    { id: 'paiements', label: 'Paiements', icon: CreditCard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'fournisseurs', label: 'Fournisseurs', icon: Building2 },
    { id: 'produits', label: 'Produits', icon: Package },
    { id: 'stock', label: 'Gestion Stock', icon: Boxes },
    { id: 'rapport', label: 'Rapports', icon: BarChart3 },
    { id: 'parametres', label: 'Paramètres', icon: Settings },
  ];

  React.useEffect(() => {
    const loadActivationStatus = async () => {
      try {
        const status = await checkActivation();
        setActivationStatus(status);
      } catch (error) {
        console.error('Error checking activation status:', error);
      }
    };
    loadActivationStatus();
  }, [checkActivation]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="flex items-center justify-center h-16 bg-blue-700">
          <h1 className="text-xl font-bold text-white">Facturation Pro</h1>
        </div>
        
        {/* Demo Status Banner */}
        {activationStatus?.isDemo && activationStatus?.activated && !activationStatus?.expired && (
          <div className="bg-yellow-500 text-white px-4 py-2 text-center text-sm">
            <div className="font-medium">Version de démonstration</div>
            <div className="text-xs">
              {activationStatus.daysRemaining > 0 
                ? `${activationStatus.daysRemaining} jour(s) restant(s)`
                : 'Expire aujourd\'hui'
              }
            </div>
          </div>
        )}
        
        {activationStatus?.expired && (
          <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium">
            Période d'essai expirée
          </div>
        )}
        
        <nav className="mt-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`w-full flex items-center px-6 py-3 text-left transition-colors duration-200 ${
                  currentPage === item.id
                    ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              {menuItems.find(item => item.id === currentPage)?.label}
            </h2>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;