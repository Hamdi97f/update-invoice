import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, User, Package, Calculator, Search, ShoppingCart, Store } from 'lucide-react';
import { Client, Produit, LigneDocument, Facture, Tax, TaxCalculation } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency, calculateTTC } from '../utils/currency';
import { 
  calculateProductTaxes, 
  aggregateInvoiceTaxes, 
  formatTaxSummaryForDisplay, 
  getDefaultProductTaxes,
  calculateInvoiceTotalTTC,
  calculateInvoiceTotalHT
} from '../utils/productTaxCalculator';
import { getNextDocumentNumber } from '../utils/numberGenerator';
import { v4 as uuidv4 } from 'uuid';
import ClientForm from './ClientForm';
import ProduitForm from './ProduitForm';

interface FactureFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (facture: Facture) => void;
  facture?: Facture;
  isAvoir?: boolean;
  originalFacture?: Facture;
}

const FactureForm: React.FC<FactureFormProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  facture, 
  isAvoir = false,
  originalFacture
}) => {
  const [formData, setFormData] = useState({
    numero: '',
    date: new Date().toISOString().split('T')[0],
    dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clientId: '',
    notes: '',
    statut: 'brouillon' as const
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [invoiceTaxSummary, setInvoiceTaxSummary] = useState<any[]>([]);
  const [appliedFixedTaxes, setAppliedFixedTaxes] = useState<Set<string>>(new Set());
  const [useEcheanceDate, setUseEcheanceDate] = useState(true);
  
  // Search states
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Product selection state - compact approach
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Produit[]>([]);
  
  const [showClientForm, setShowClientForm] = useState(false);
  const [showProduitForm, setShowProduitForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [newProductType, setNewProductType] = useState<'vente' | 'achat'>('vente');

  const { query, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isOpen && isReady) {
      loadClients();
      loadProduits();
      loadTaxes();
      loadInvoiceSettings();
      
      if (facture) {
        setFormData({
          numero: facture.numero,
          date: facture.date.toISOString().split('T')[0],
          dateEcheance: facture.dateEcheance.toISOString().split('T')[0],
          clientId: facture.client.id,
          notes: facture.notes || '',
          statut: facture.statut
        });
        setSelectedClient(facture.client);
        setClientSearchTerm(facture.client.nom);
        setLignes(facture.lignes);
        setInvoiceTaxSummary(facture.taxes || []);
      } else if (isAvoir && originalFacture) {
        // For avoir, use original invoice data but with negative quantities
        generateAvoirNumero(originalFacture.numero);
        setFormData({
          numero: '',  // Will be set by generateAvoirNumero
          date: new Date().toISOString().split('T')[0],
          dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          clientId: originalFacture.client.id,
          notes: `Avoir pour la facture ${originalFacture.numero}`,
          statut: 'brouillon'
        });
        setSelectedClient(originalFacture.client);
        setClientSearchTerm(originalFacture.client.nom);
        
        // Create negative lines for the avoir
        const avoirLignes = originalFacture.lignes.map(ligne => ({
          ...ligne,
          id: uuidv4(),  // Generate new IDs for the avoir lines
          quantite: -ligne.quantite,  // Negative quantity
          montantHT: -ligne.montantHT,  // Negative amounts
          montantTTC: -ligne.montantTTC
        }));
        
        setLignes(avoirLignes);
        
        // Recalculate taxes for avoir lines
        setTimeout(() => {
          recalculateInvoiceTaxes();
        }, 100);
      } else {
        generateNumero();
        // Reset form for new invoice
        setFormData({
          numero: '',
          date: new Date().toISOString().split('T')[0],
          dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          clientId: '',
          notes: '',
          statut: 'brouillon'
        });
        setSelectedClient(null);
        setClientSearchTerm('');
        setLignes([]);
        setInvoiceTaxSummary([]);
        setProductSearchTerm('');
        setShowProductDropdown(false);
      }
    }
  }, [isOpen, facture, isAvoir, originalFacture, isReady]);

  // Update filtered products when search term changes
  useEffect(() => {
    if (productSearchTerm.trim()) {
      const filtered = produits
        .filter(produit => produit.type === 'vente') // Only show vente products for factures
        .filter(produit =>
          produit.nom.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (produit.ref && produit.ref.toLowerCase().includes(productSearchTerm.toLowerCase())) ||
          produit.description.toLowerCase().includes(productSearchTerm.toLowerCase())
        );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(produits
        .filter(produit => produit.type === 'vente') // Only show vente products for factures
        .slice(0, 8)); // Show first 8 products when no search
    }
  }, [productSearchTerm, produits]);

  // Recalculate taxes when lines change
  useEffect(() => {
    if (lignes.length > 0) {
      recalculateInvoiceTaxes();
    } else {
      setInvoiceTaxSummary([]);
    }
  }, [lignes, taxes]);

  const loadClients = async () => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query('SELECT * FROM clients ORDER BY nom');
        setClients(result);
      } else {
        const savedClients = localStorage.getItem('clients');
        if (savedClients) {
          setClients(JSON.parse(savedClients));
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadProduits = async () => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query('SELECT * FROM produits ORDER BY nom');
        setProduits(result);
      } else {
        const savedProduits = localStorage.getItem('produits');
        if (savedProduits) {
          setProduits(JSON.parse(savedProduits));
        }
      }
    } catch (error) {
      console.error('Error loading produits:', error);
    }
  };

  const loadTaxes = async () => {
    if (!isReady) return;
    
    if (!isElectron) {
      const savedTaxes = localStorage.getItem('taxes');
      if (savedTaxes) {
        setTaxes(JSON.parse(savedTaxes));
      }
      return;
    }

    try {
      const result = await query('SELECT * FROM taxes WHERE actif = 1 ORDER BY ordre ASC');
      const loadedTaxes = result.map((tax: any) => ({
        ...tax,
        applicableDocuments: JSON.parse(tax.applicableDocuments),
        actif: Boolean(tax.actif)
      }));
      setTaxes(loadedTaxes);
    } catch (error) {
      console.error('Error loading taxes:', error);
    }
  };

  const loadInvoiceSettings = async () => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query('SELECT value FROM settings WHERE key = ?', ['invoiceSettings']);
        if (result.length > 0) {
          const settings = JSON.parse(result[0].value);
          setUseEcheanceDate(settings.useEcheanceDate);
        }
      } else {
        const savedSettings = localStorage.getItem('invoiceSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setUseEcheanceDate(settings.useEcheanceDate);
        }
      }
    } catch (error) {
      console.error('Error loading invoice settings:', error);
    }
  };

  const generateNumero = async () => {
    if (!isReady) return;
    
    try {
      const numero = await getNextDocumentNumber('factures', isElectron, query);
      setFormData(prev => ({ ...prev, numero }));
    } catch (error) {
      console.error('Error generating numero:', error);
      // Fallback to simple numbering
      const year = new Date().getFullYear();
      const count = Math.floor(Math.random() * 1000) + 1;
      setFormData(prev => ({
        ...prev,
        numero: `FA-${year}-${String(count).padStart(3, '0')}`
      }));
    }
  };

  const generateAvoirNumero = async (originalNumero: string) => {
    if (!isReady) return;
    
    try {
      const numero = await getNextDocumentNumber('factures', isElectron, query);
      // Add AV prefix to indicate this is an avoir
      const avoirNumero = `AV-${numero}`;
      setFormData(prev => ({ ...prev, numero: avoirNumero }));
    } catch (error) {
      console.error('Error generating avoir numero:', error);
      // Fallback to simple numbering
      const year = new Date().getFullYear();
      const count = Math.floor(Math.random() * 1000) + 1;
      setFormData(prev => ({
        ...prev,
        numero: `AV-FA-${year}-${String(count).padStart(3, '0')}`
      }));
    }
  };

  const recalculateInvoiceTaxes = () => {
    const newAppliedFixedTaxes = new Set<string>();
    
    // Calculate taxes for each product line
    const updatedLignes = lignes.map(ligne => {
      // Get default taxes for this product based on global settings
      const defaultTaxes = getDefaultProductTaxes(taxes, 'factures', ligne.produit.tva);
      
      // Use existing product taxes or default ones
      const productTaxes = ligne.productTaxes && ligne.productTaxes.length > 0 
        ? ligne.productTaxes 
        : defaultTaxes;
      
      // Calculate taxes for this product
      const taxResult = calculateProductTaxes(ligne.montantHT, productTaxes, newAppliedFixedTaxes);

      return {
        ...ligne,
        productTaxes: taxResult.productTaxes,
        taxCalculations: taxResult.taxCalculations,
        montantTTC: taxResult.totalTTC
      };
    });

    setLignes(updatedLignes);
    setAppliedFixedTaxes(newAppliedFixedTaxes);

    // Aggregate taxes from all product lines
    const { taxGroups, fixedTaxes } = aggregateInvoiceTaxes(updatedLignes, taxes);
    const formattedTaxes = formatTaxSummaryForDisplay(taxGroups, fixedTaxes);
    setInvoiceTaxSummary(formattedTaxes);
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.nom.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    client.code.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
    (client.matriculeFiscal && client.matriculeFiscal.toLowerCase().includes(clientSearchTerm.toLowerCase()))
  );

  const handleClientSearch = (value: string) => {
    setClientSearchTerm(value);
    setShowClientDropdown(true);
    if (!value.trim()) {
      setSelectedClient(null);
      setFormData(prev => ({ ...prev, clientId: '' }));
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientSearchTerm(client.nom);
    setFormData(prev => ({ ...prev, clientId: client.id }));
    setShowClientDropdown(false);
  };

  // Product search handling
  const handleProductSearch = (value: string) => {
    setProductSearchTerm(value);
    setShowProductDropdown(true);
  };

  // Compact product addition
  const handleAddProduct = (produit: Produit) => {
    // Check if product already exists in lines
    const existingLineIndex = lignes.findIndex(ligne => ligne.produit.id === produit.id);
    
    if (existingLineIndex !== -1) {
      // If product exists, increase quantity
      const newLignes = [...lignes];
      newLignes[existingLineIndex].quantite += 1;
      
      // Recalculate amounts
      const ligne = newLignes[existingLineIndex];
      const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - ligne.remise / 100);
      ligne.montantHT = montantHT;
      ligne.montantTTC = calculateTTC(montantHT, ligne.produit.tva);
      
      setLignes(newLignes);
    } else {
      // Add new line
      const newLigne: LigneDocument = {
        id: uuidv4(),
        produit,
        quantite: 1,
        prixUnitaire: produit.prixUnitaire,
        remise: 0,
        montantHT: produit.prixUnitaire,
        montantTTC: produit.prixUnitaire, // Will be recalculated by tax system
        productTaxes: getDefaultProductTaxes(taxes, 'factures', produit.tva),
        taxCalculations: []
      };
      setLignes([...lignes, newLigne]);
    }
    
    // Clear search and close dropdown
    setProductSearchTerm('');
    setShowProductDropdown(false);
  };

  const handleLigneChange = (index: number, field: string, value: any) => {
    const newLignes = [...lignes];
    const ligne = newLignes[index];

    if (field === 'produit') {
      const produit = produits.find(p => p.id === value);
      if (produit) {
        ligne.produit = produit;
        ligne.prixUnitaire = produit.prixUnitaire;
      }
    } else {
      (ligne as any)[field] = value;
    }

    // Recalculate amounts HT
    const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - ligne.remise / 100);
    ligne.montantHT = montantHT;

    setLignes(newLignes);
  };

  const handleRemoveLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totalHT = calculateInvoiceTotalHT(lignes);
    const totalTTC = calculateInvoiceTotalTTC(lignes);
    const totalTaxes = totalTTC - totalHT;
    
    return { totalHT, totalTaxes, totalTTC };
  };

  const handleSave = async () => {
    if (!isReady) return;
    
    if (!selectedClient || lignes.length === 0) {
      alert('Veuillez sélectionner un client et ajouter au moins une ligne');
      return;
    }

    const { totalHT, totalTaxes, totalTTC } = calculateTotals();

    const factureData: Facture = {
      id: facture?.id || uuidv4(),
      numero: formData.numero,
      date: new Date(formData.date),
      dateEcheance: new Date(formData.dateEcheance),
      client: selectedClient,
      lignes,
      totalHT,
      totalTVA: 0, // Legacy field
      taxes: invoiceTaxSummary,
      totalTaxes,
      totalTTC,
      statut: formData.statut,
      notes: formData.notes
    };

    if (isElectron) {
      try {
        // Save facture
        await query(
          `INSERT OR REPLACE INTO factures 
           (id, numero, date, dateEcheance, clientId, totalHT, totalTVA, totalTTC, statut, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            factureData.id,
            factureData.numero,
            factureData.date.toISOString(),
            factureData.dateEcheance.toISOString(),
            factureData.client.id,
            factureData.totalHT,
            factureData.totalTVA,
            factureData.totalTTC,
            factureData.statut,
            factureData.notes
          ]
        );

        // Delete existing lines
        await query('DELETE FROM lignes_facture WHERE factureId = ?', [factureData.id]);

        // Save lines
        for (const ligne of lignes) {
          await query(
            `INSERT INTO lignes_facture 
             (id, factureId, produitId, quantite, prixUnitaire, remise, montantHT, montantTTC)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              ligne.id,
              factureData.id,
              ligne.produit.id,
              ligne.quantite,
              ligne.prixUnitaire,
              ligne.remise,
              ligne.montantHT,
              ligne.montantTTC
            ]
          );
        }
        
        // If this is an avoir, update the original invoice status to 'annulee'
        if (isAvoir && originalFacture) {
          await query(
            'UPDATE factures SET statut = ? WHERE id = ?',
            ['annulee', originalFacture.id]
          );
        }
      } catch (error) {
        console.error('Error saving facture:', error);
        alert('Erreur lors de la sauvegarde');
        return;
      }
    }

    onSave(factureData);
    onClose();
  };

  const handleClientSave = (client: Client) => {
    // Update the clients list immediately
    if (editingClient) {
      setClients(clients.map(c => c.id === client.id ? client : c));
    } else {
      setClients([...clients, client]);
    }
    
    // Reload clients to ensure sync
    setTimeout(() => {
      loadClients();
    }, 100);
    
    setShowClientForm(false);
    setEditingClient(null);
    handleClientSelect(client);
  };

  const handleProduitSave = (produit: Produit) => {
    // Update the products list immediately
    if (editingProduit) {
      setProduits(produits.map(p => p.id === produit.id ? produit : p));
    } else {
      setProduits([...produits, produit]);
    }
    
    // Reload products to ensure sync
    setTimeout(() => {
      loadProduits();
    }, 100);
    
    setShowProduitForm(false);
    setEditingProduit(null);
  };

  const { totalHT, totalTaxes, totalTTC } = calculateTotals();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">
              {isAvoir ? 'Créer un avoir' : facture ? 'Modifier la facture' : 'Nouvelle facture'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isAvoir ? "Numéro d'avoir" : "Numéro de facture"}
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>

                <div className={`grid ${useEcheanceDate ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {useEcheanceDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date d'échéance
                      </label>
                      <input
                        type="date"
                        value={formData.dateEcheance}
                        onChange={(e) => setFormData(prev => ({ ...prev, dateEcheance: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData(prev => ({ ...prev, statut: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="envoyee">Envoyée</option>
                    <option value="payee">Payée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
              </div>

              {/* Right Column - Client with Search */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Client
                    </label>
                    <button
                      onClick={() => {
                        setEditingClient(null);
                        setShowClientForm(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    >
                      <User className="w-4 h-4 mr-1" />
                      Nouveau client
                    </button>
                  </div>
                  
                  {/* Client Search Input */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={(e) => handleClientSearch(e.target.value)}
                        onFocus={() => setShowClientDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Rechercher un client..."
                        readOnly={isAvoir && !!originalFacture}
                      />
                    </div>
                    
                    {/* Client Dropdown */}
                    {showClientDropdown && clientSearchTerm && !isAvoir && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map(client => (
                            <button
                              key={client.id}
                              onClick={() => handleClientSelect(client)}
                              className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{client.nom}</div>
                              <div className="text-sm text-gray-500">
                                {client.code} • {client.ville}
                                {client.matriculeFiscal && ` • MF: ${client.matriculeFiscal}`}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            Aucun client trouvé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedClient && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="font-medium text-gray-900">{selectedClient.nom}</h4>
                    <p className="text-sm text-gray-600">Code: {selectedClient.code}</p>
                    {selectedClient.matriculeFiscal && (
                      <p className="text-sm text-gray-600">Matricule Fiscal: {selectedClient.matriculeFiscal}</p>
                    )}
                    <p className="text-sm text-gray-600">{selectedClient.adresse}</p>
                    <p className="text-sm text-gray-600">
                      {selectedClient.codePostal} {selectedClient.ville}
                    </p>
                    {selectedClient.telephone && (
                      <p className="text-sm text-gray-600">Tél: {selectedClient.telephone}</p>
                    )}
                    {selectedClient.email && (
                      <p className="text-sm text-gray-600">Email: {selectedClient.email}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </div>
            </div>

            {/* COMPACT: Product Search and Addition */}
            {!isAvoir && (
              <div className="border-t pt-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium flex items-center">
                    <Store className="w-5 h-5 mr-2 text-green-600" />
                    Ajouter des produits de vente
                  </h3>
                  <button
                    onClick={() => {
                      setEditingProduit(null);
                      setNewProductType('vente');
                      setShowProduitForm(true);
                    }}
                    className="text-green-600 hover:text-green-800 text-sm flex items-center"
                  >
                    <Store className="w-4 h-4 mr-1" />
                    Nouveau produit de vente
                  </button>
                </div>

                {/* COMPACT: Single line search with dropdown */}
                <div className="relative mb-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={productSearchTerm}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      onFocus={() => setShowProductDropdown(true)}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Rechercher et ajouter un produit de vente..."
                    />
                    <Store className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  </div>

                  {/* COMPACT: Product dropdown */}
                  {showProductDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.slice(0, 8).map(produit => (
                          <button
                            key={produit.id}
                            onClick={() => handleAddProduct(produit)}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <Store className="w-4 h-4 text-green-600" />
                                  <div>
                                    <div className="font-medium text-gray-900 group-hover:text-blue-700">
                                      {produit.ref && (
                                        <span className="text-xs text-gray-500 mr-2">[{produit.ref}]</span>
                                      )}
                                <span className="text-sm font-medium text-gray-700">Détail des taxes:</span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {formatCurrency(produit.prixUnitaire)} • TVA {produit.tva}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-gray-500">
                          <Store className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Aucun produit de vente trouvé</p>
                          <button
                            onClick={() => {
                              setEditingProduit(null);
                              setNewProductType('vente');
                              setShowProduitForm(true);
                              setShowProductDropdown(false);
                            }}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Créer un nouveau produit de vente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Invoice Lines Table */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">
                {isAvoir ? "Lignes de l'avoir" : "Lignes de facturation"} ({lignes.length})
              </h3>

              {lignes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produit
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Qté
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Prix unit.
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Remise %
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Total HT
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          TVA
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Total TTC
                        </th>
                        {!isAvoir && (
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lignes.map((ligne, index) => (
                        <tr key={ligne.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <Store className="w-4 h-4 mr-2 text-green-600" />
                              <div>
                                {ligne.produit.ref && (
                                  <div className="text-xs text-gray-500">{ligne.produit.ref}</div>
                                )}
                                <div className="font-medium text-gray-900">{ligne.produit.nom}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.quantite}
                              onChange={(e) => handleLigneChange(index, 'quantite', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                              min={isAvoir ? undefined : "1"}
                              readOnly={isAvoir}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.prixUnitaire}
                              onChange={(e) => handleLigneChange(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                              step="0.001"
                              readOnly={isAvoir}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.remise}
                              onChange={(e) => handleLigneChange(index, 'remise', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                              min="0"
                              max="100"
                              step="0.1"
                              readOnly={isAvoir}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {formatCurrency(ligne.montantHT)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {ligne.taxCalculations && ligne.taxCalculations.length > 0 ? (
                              <div className="space-y-1">
                                {ligne.taxCalculations.map((taxCalc, idx) => (
                                  <div key={idx} className="text-xs">
                                    {taxCalc.name} {taxCalc.rateType === 'percentage' ? `${taxCalc.value}%` : 'fixe'}: {formatCurrency(taxCalc.calculatedAmount)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              formatCurrency(ligne.montantHT * ligne.produit.tva / 100)
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">
                            {formatCurrency(ligne.montantTTC)}
                          </td>
                          {!isAvoir && (
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleRemoveLigne(index)}
                                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer cette ligne"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Store className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">
                    {isAvoir 
                      ? "Aucune ligne dans l'avoir" 
                      : "Aucun produit ajouté à la facture"}
                  </p>
                  {!isAvoir && (
                    <p className="text-xs text-gray-400">Utilisez la recherche ci-dessus pour ajouter des produits</p>
                  )}
                </div>
              )}
            </div>

            {/* Totals */}
            {lignes.length > 0 && (
              <div className="mt-6 flex justify-end">
                <div className="bg-gray-50 p-4 rounded-lg w-96">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total HT:</span>
                      <span>{formatCurrency(totalHT)}</span>
                    </div>
                    
                    {/* Tax calculations */}
                    {invoiceTaxSummary.length > 0 && (
                      <>
                        <div className="border-t pt-2">
                          <div className="flex items-center mb-2">
                            <Calculator className="w-4 h-4 mr-1 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Taxes par type et taux:</span>
                          </div>
                          {invoiceTaxSummary.map((calc, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600">{calc.nom}:</span>
                              <span>{formatCurrency(calc.montant)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span>Total taxes:</span>
                          <span>{formatCurrency(totalTaxes)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total TTC:</span>
                      <span className={isAvoir ? "text-red-600" : "text-blue-600"}>
                        {formatCurrency(totalTTC)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-4 p-6 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className={`px-4 py-2 ${isAvoir ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md flex items-center`}
            >
              <Save className="w-4 h-4 mr-2" />
              {isAvoir ? "Enregistrer l'avoir" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      {/* Client Form Dialog */}
      <ClientForm
        isOpen={showClientForm}
        onClose={() => {
          setShowClientForm(false);
          setEditingClient(null);
        }}
        onSave={handleClientSave}
        client={editingClient}
      />

      {/* Product Form Dialog */}
      <ProduitForm
        isOpen={showProduitForm}
        onClose={() => {
          setShowProduitForm(false);
          setEditingProduit(null);
        }}
        onSave={handleProduitSave}
        produit={editingProduit}
        defaultType={newProductType}
      />

      {/* Click outside to close dropdowns */}
      {(showClientDropdown || showProductDropdown) && (
        <div 
          className="fixed inset-0 z-5"
          onClick={() => {
            setShowClientDropdown(false);
            setShowProductDropdown(false);
          }}
        />
      )}
    </>
  );
};

export default FactureForm;