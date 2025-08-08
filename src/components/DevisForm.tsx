import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, User, Package, Calculator, Search, ShoppingCart, Store } from 'lucide-react';
import { Client, Produit, LigneDocument, Devis, TaxGroup, TaxGroupSummary } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency, calculateTTC } from '../utils/currency';
import { calculateTaxesByGroup, loadTaxGroups, ensureTaxGroupForProduct } from '../utils/productTaxCalculator';
import { getNextDocumentNumber } from '../utils/numberGenerator';
import { v4 as uuidv4 } from 'uuid';
import ClientForm from './ClientForm';
import ProduitForm from './ProduitForm';

interface DevisFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (devis: Devis) => void;
  devis?: Devis;
}

const DevisForm: React.FC<DevisFormProps> = ({ isOpen, onClose, onSave, devis }) => {
  const [formData, setFormData] = useState({
    numero: '',
    date: new Date().toISOString().split('T')[0],
    dateValidite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clientId: '',
    notes: '',
    statut: 'brouillon' as const
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  const [taxGroupsSummary, setTaxGroupsSummary] = useState<TaxGroupSummary[]>([]);
  
  // Search states
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Product selection state
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
      loadTaxGroupsData();
      
      if (devis) {
        setFormData({
          numero: devis.numero,
          date: devis.date.toISOString().split('T')[0],
          dateValidite: devis.dateValidite.toISOString().split('T')[0],
          clientId: devis.client.id,
          notes: devis.notes || '',
          statut: devis.statut
        });
        setSelectedClient(devis.client);
        setClientSearchTerm(devis.client.nom);
        setLignes(devis.lignes);
        setTaxGroupsSummary(devis.taxGroupsSummary || []);
      } else {
        generateNumero();
        // Reset form for new devis
        setFormData({
          numero: '',
          date: new Date().toISOString().split('T')[0],
          dateValidite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          clientId: '',
          notes: '',
          statut: 'brouillon'
        });
        setSelectedClient(null);
        setClientSearchTerm('');
        setLignes([]);
        setTaxGroupsSummary([]);
        setProductSearchTerm('');
        setShowProductDropdown(false);
      }
    }
  }, [isOpen, devis, isReady]);

  // Update filtered products when search term changes
  useEffect(() => {
    if (productSearchTerm.trim()) {
      const filtered = produits
        .filter(produit => produit.type === 'vente') // Only show vente products for devis
        .filter(produit =>
          produit.nom.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (produit.ref && produit.ref.toLowerCase().includes(productSearchTerm.toLowerCase())) ||
          produit.description.toLowerCase().includes(productSearchTerm.toLowerCase())
        );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(produits
        .filter(produit => produit.type === 'vente') // Only show vente products for devis
        .slice(0, 8));
    }
  }, [productSearchTerm, produits]);

  // Recalculate taxes when lines change
  useEffect(() => {
    recalculateTaxes();
  }, [lignes, taxGroups]);

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

  const loadTaxGroupsData = async () => {
    if (!isReady) return;
    
    if (!isElectron) {
      const savedTaxGroups = localStorage.getItem('taxGroups');
      if (savedTaxGroups) {
        setTaxGroups(JSON.parse(savedTaxGroups));
      }
      return;
    }

    try {
      const groups = await loadTaxGroups(query);
      setTaxGroups(groups);
    } catch (error) {
      console.error('Error loading tax groups:', error);
    }
  };

  const generateNumero = async () => {
    if (!isReady) return;
    
    try {
      const numero = await getNextDocumentNumber('devis', isElectron, query, false);
      setFormData(prev => ({ ...prev, numero }));
    } catch (error) {
      console.error('Error generating numero:', error);
    }
  };

  const recalculateTaxes = () => {
    if (lignes.length === 0) {
      setTaxGroupsSummary([]);
      return;
    }

    // Calculate taxes using standardized logic
    const result = calculateDocumentTotals(lignes);
    setTaxGroupsSummary(result.taxSummary);
  };

  const calculateDocumentTotals = (lignes: LigneDocument[]) => {
    // Calculate totals from product lines with proper FODEC and TVA
    const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
    
    // Calculate FODEC totals
    let totalFodec = 0;
    const fodecGroups = new Map();
    lignes.forEach(ligne => {
      if (ligne.produit.fodecApplicable && ligne.produit.tauxFodec > 0) {
        const lineFodec = ligne.montantHT * (ligne.produit.tauxFodec / 100);
        totalFodec += lineFodec;
        
        const rate = ligne.produit.tauxFodec;
        if (!fodecGroups.has(rate)) {
          fodecGroups.set(rate, { baseAmount: 0, taxAmount: 0 });
        }
        const group = fodecGroups.get(rate);
        group.baseAmount += ligne.montantHT;
        group.taxAmount += lineFodec;
      }
    });
    
    // Calculate TVA totals (on HT + FODEC base)
    let totalTVA = 0;
    const tvaGroups = new Map();
    lignes.forEach(ligne => {
      if (ligne.produit.tva > 0) {
        const lineFodec = ligne.produit.fodecApplicable ? (ligne.montantHT * ligne.produit.tauxFodec / 100) : 0;
        const lineBaseTVA = ligne.montantHT + lineFodec;
        const lineTVA = lineBaseTVA * (ligne.produit.tva / 100);
        totalTVA += lineTVA;
        
        const rate = ligne.produit.tva;
        if (!tvaGroups.has(rate)) {
          tvaGroups.set(rate, { baseAmount: 0, taxAmount: 0 });
        }
        const group = tvaGroups.get(rate);
        group.baseAmount += lineBaseTVA;
        group.taxAmount += lineTVA;
      }
    });
    
    // Create tax summary for display
    const taxSummary = [];
    
    // Add FODEC summary
    fodecGroups.forEach((group, rate) => {
      taxSummary.push({
        type: 'FODEC',
        rate,
        baseAmount: group.baseAmount,
        taxAmount: group.taxAmount,
        groupName: `FODEC ${rate}%`
      });
    });
    
    // Add TVA summary
    tvaGroups.forEach((group, rate) => {
      taxSummary.push({
        type: 'TVA',
        rate,
        baseAmount: group.baseAmount,
        taxAmount: group.taxAmount,
        groupName: `TVA ${rate}%`
      });
    });
    
    const totalTTC = totalHT + totalFodec + totalTVA;
    
    return { 
      totalHT, 
      totalFodec,
      totalTVA,
      totalTaxes: totalFodec + totalTVA,
      taxSummary, 
      totalTTC 
    };
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

  const handleProductSearch = (value: string) => {
    setProductSearchTerm(value);
    setShowProductDropdown(true);
  };

  const handleAddProduct = (produit: Produit) => {
    const existingLineIndex = lignes.findIndex(ligne => ligne.produit.id === produit.id);
    
    if (existingLineIndex !== -1) {
      const newLignes = [...lignes];
      newLignes[existingLineIndex].quantite += 1;
      
      const ligne = newLignes[existingLineIndex];
      const montantHT = ligne.quantite * ligne.prixUnitaire;
      ligne.montantHT = montantHT;
      
      // Calculate FODEC
      const montantFodec = ligne.produit.fodecApplicable ? 
        montantHT * (ligne.produit.tauxFodec / 100) : 0;
      ligne.montantFodec = montantFodec;
      
      // Calculate TVA base (HT + FODEC)
      const baseTVA = montantHT + montantFodec;
      ligne.baseTVA = baseTVA;
      
      // Calculate TVA
      const montantTVA = baseTVA * (ligne.produit.tva / 100);
      ligne.montantTVA = montantTVA;
      
      // Calculate TTC
      ligne.montantTTC = montantHT + montantFodec + montantTVA;
      
      setLignes(newLignes);
    } else {
      const montantHT = produit.prixUnitaire;
      
      // Calculate FODEC
      const montantFodec = produit.fodecApplicable ? 
        montantHT * (produit.tauxFodec / 100) : 0;
      
      // Calculate TVA base (HT + FODEC)
      const baseTVA = montantHT + montantFodec;
      
      // Calculate TVA
      const montantTVA = baseTVA * (produit.tva / 100);
      
      // Calculate TTC
      const montantTTC = montantHT + montantFodec + montantTVA;
      
      const newLigne: LigneDocument = {
        id: uuidv4(),
        produit,
        quantite: 1,
        prixUnitaire: produit.prixUnitaire,
        remise: 0,
        montantHT,
        montantFodec,
        baseTVA,
        montantTVA,
        montantTTC
      };
      setLignes([...lignes, newLigne]);
      
      // Ensure tax group exists for this product
      ensureTaxGroupForProduct(produit.tva, query);
    }
    
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
        // Ensure tax group exists for new product
        ensureTaxGroupForProduct(produit.tva, query);
      }
    } else {
      (ligne as any)[field] = value;
    }

    // Recalculate amounts
    const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - ligne.remise / 100);
    ligne.montantHT = montantHT;
    
    // Calculate FODEC
    const montantFodec = ligne.produit.fodecApplicable ? 
      montantHT * (ligne.produit.tauxFodec / 100) : 0;
    ligne.montantFodec = montantFodec;
    
    // Calculate TVA base (HT + FODEC)
    const baseTVA = montantHT + montantFodec;
    ligne.baseTVA = baseTVA;
    
    // Calculate TVA
    const montantTVA = baseTVA * (ligne.produit.tva / 100);
    ligne.montantTVA = montantTVA;
    
    // Calculate TTC
    ligne.montantTTC = montantHT + montantFodec + montantTVA;

    setLignes(newLignes);
  };

  const handleRemoveLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    // Use standardized calculation for all document types
    const result = calculateDocumentTotals(lignes);
    
    return { 
      totalHT: result.totalHT, 
      totalFodec: result.totalFodec,
      totalTVA: result.totalTVA,
      totalTaxes: result.totalFodec + result.totalTVA,
      taxSummary: result.taxSummary, 
      totalTTC: result.totalTTC 
    };
  };

  const handleSave = async () => {
    if (!isReady) return;
    
    if (!selectedClient || lignes.length === 0) {
      alert('Veuillez sélectionner un client et ajouter au moins une ligne');
      return;
    }

    try {
      // Increment document number only when actually saving
      const finalNumero = await getNextDocumentNumber('devis', isElectron, query, true);
      
      const { totalHT, totalTaxes, taxSummary, totalTTC } = calculateTotals();

      const devisData: Devis = {
        id: devis?.id || uuidv4(),
        numero: devis?.numero || finalNumero, // Use existing numero for edits, new numero for new devis
        date: new Date(formData.date),
        dateValidite: new Date(formData.dateValidite),
        client: selectedClient,
        lignes,
        totalHT,
        taxGroupsSummary: taxSummary,
        totalTaxes,
        totalTTC,
        statut: formData.statut,
        notes: formData.notes
      };

      // Save devis to database
      await query(
        `INSERT OR REPLACE INTO devis 
         (id, numero, date, dateValidite, clientId, totalHT, totalFodec, totalTVA, totalTTC, statut, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          devisData.id,
          devisData.numero,
          devisData.date.toISOString(),
          devisData.dateValidite.toISOString(),
          devisData.client.id,
          devisData.totalHT,
          devisData.totalFodec,
          devisData.totalTaxes,
          devisData.totalTTC,
          devisData.statut,
          devisData.notes || ''
        ]
      );

      // Delete existing lines
      await query('DELETE FROM lignes_devis WHERE devisId = ?', [devisData.id]);

      // Save lines
      for (const ligne of lignes) {
        await query(
          `INSERT INTO lignes_devis 
           (id, devisId, produitId, quantite, prixUnitaire, remise, montantHT, montantFodec, baseTVA, montantTVA, montantTTC)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ligne.id,
            devisData.id,
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

      onSave(devisData);
      onClose();
      
    } catch (error) {
      console.error('Error saving devis:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message || 'Erreur inconnue'}`);
    }
  };

  const handleClientSave = (client: Client) => {
    if (editingClient) {
      setClients(clients.map(c => c.id === client.id ? client : c));
    } else {
      setClients([...clients, client]);
    }
    
    setTimeout(() => {
      loadClients();
    }, 100);
    
    setShowClientForm(false);
    setEditingClient(null);
    handleClientSelect(client);
  };

  const handleProduitSave = (produit: Produit) => {
    if (editingProduit) {
      setProduits(produits.map(p => p.id === produit.id ? produit : p));
    } else {
      setProduits([...produits, produit]);
    }
    
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
              {devis ? 'Modifier le devis' : 'Nouveau devis'}
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
                    Numéro de devis
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date de validité
                    </label>
                    <input
                      type="date"
                      value={formData.dateValidite}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateValidite: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData(prev => ({ ...prev, statut: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="envoye">Envoyé</option>
                    <option value="accepte">Accepté</option>
                    <option value="refuse">Refusé</option>
                    <option value="expire">Expiré</option>
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
                      className="text-green-600 hover:text-green-800 text-sm flex items-center"
                    >
                      <User className="w-4 h-4 mr-1" />
                      Nouveau client
                    </button>
                  </div>
                  
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={(e) => handleClientSearch(e.target.value)}
                        onFocus={() => setShowClientDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Rechercher un client..."
                      />
                    </div>
                    
                    {showClientDropdown && clientSearchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map(client => (
                            <button
                              key={client.id}
                              onClick={() => handleClientSelect(client)}
                              className="w-full px-4 py-2 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none border-b border-gray-100 last:border-b-0"
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
                  <div className="bg-green-50 p-4 rounded-md">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </div>
            </div>

            {/* Product Search and Addition */}
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

              <div className="relative mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Rechercher et ajouter un produit de vente..."
                  />
                  <Store className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>

                {showProductDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.slice(0, 8).map(produit => (
                        <button
                          key={produit.id}
                          onClick={() => handleAddProduct(produit)}
                          className="w-full px-4 py-3 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none border-b border-gray-100 last:border-b-0 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Store className="w-4 h-4 text-green-600" />
                                <div>
                                  <div className="font-medium text-gray-900 group-hover:text-green-700">
                                    {produit.ref && (
                                      <span className="text-xs text-gray-500 mr-2">[{produit.ref}]</span>
                                    )}
                                    {produit.nom}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {formatCurrency(produit.prixUnitaire)} • TVA {produit.tva}%
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Plus className="w-4 h-4 text-gray-400 group-hover:text-green-600" />
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
                          className="mt-2 text-green-600 hover:text-green-800 text-sm"
                        >
                          Créer un nouveau produit de vente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lines Table */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Lignes du devis ({lignes.length})</h3>

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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
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
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500"
                              min="1"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.prixUnitaire}
                              onChange={(e) => handleLigneChange(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500"
                              step="0.001"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.remise}
                              onChange={(e) => handleLigneChange(index, 'remise', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500"
                              min="0"
                              max="100"
                              step="0.1"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {formatCurrency(ligne.montantHT)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ligne.produit.tva}%
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600">
                            {formatCurrency(ligne.montantTTC)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveLigne(index)}
                              className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer cette ligne"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Store className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">Aucun produit ajouté au devis</p>
                  <p className="text-xs text-gray-400">Utilisez la recherche ci-dessus pour ajouter des produits</p>
                </div>
              )}
            </div>

            {/* Totals */}
            {lignes.length > 0 && (
              <div className="mt-6 flex justify-end">
                <div className="bg-green-50 p-4 rounded-lg w-96">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total HT:</span>
                      <span>{formatCurrency(totalHT)}</span>
                    </div>
                    
                    {taxGroupsSummary.length > 0 && (
                      <>
                        <div className="border-t pt-2">
                          <div className="flex items-center mb-2">
                            <Calculator className="w-4 h-4 mr-1 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Taxes par groupe:</span>
                          </div>
                          {taxGroupsSummary.map((group, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {group.groupName}:
                              </span>
                              <span>{formatCurrency(group.taxAmount)}</span>
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
                      <span className="text-green-600">{formatCurrency(totalTTC)}</span>
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
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
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

export default DevisForm;