import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, User, Package, Search, Truck, Store, Calculator } from 'lucide-react';
import { Client, Produit, LigneDocument, BonLivraison, Tax, TaxCalculation } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency, calculateTTC } from '../utils/currency';
import { calculateTaxes } from '../utils/taxCalculator';
import { getNextDocumentNumber } from '../utils/numberGenerator';
import { v4 as uuidv4 } from 'uuid';
import ClientForm from './ClientForm';
import ProduitForm from './ProduitForm';

interface BonLivraisonFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bonLivraison: BonLivraison) => void;
  bonLivraison?: BonLivraison;
}

const BonLivraisonForm: React.FC<BonLivraisonFormProps> = ({ isOpen, onClose, onSave, bonLivraison }) => {
  const [formData, setFormData] = useState({
    numero: '',
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    notes: '',
    statut: 'prepare' as const,
    factureId: ''
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [taxCalculations, setTaxCalculations] = useState<TaxCalculation[]>([]);
  
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
      loadTaxes();
      
      if (bonLivraison) {
        setFormData({
          numero: bonLivraison.numero,
          date: bonLivraison.date.toISOString().split('T')[0],
          clientId: bonLivraison.client.id,
          notes: bonLivraison.notes || '',
          statut: bonLivraison.statut,
          factureId: bonLivraison.factureId || ''
        });
        setSelectedClient(bonLivraison.client);
        setClientSearchTerm(bonLivraison.client.nom);
        setLignes(bonLivraison.lignes);
        setTaxCalculations(bonLivraison.taxes || []);
      } else {
        generateNumero();
        // Reset form for new bon de livraison
        setFormData({
          numero: '',
          date: new Date().toISOString().split('T')[0],
          clientId: '',
          notes: '',
          statut: 'prepare',
          factureId: ''
        });
        setSelectedClient(null);
        setClientSearchTerm('');
        setLignes([]);
        setTaxCalculations([]);
        setProductSearchTerm('');
        setShowProductDropdown(false);
      }
    }
  }, [isOpen, bonLivraison, isReady]);

  // Update filtered products when search term changes
  useEffect(() => {
    if (productSearchTerm.trim()) {
      const filtered = produits
        .filter(produit => produit.type === 'vente') // Only show vente products for bon de livraison
        .filter(produit =>
          produit.nom.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (produit.ref && produit.ref.toLowerCase().includes(productSearchTerm.toLowerCase())) ||
          produit.description.toLowerCase().includes(productSearchTerm.toLowerCase())
        );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(produits
        .filter(produit => produit.type === 'vente') // Only show vente products for bon de livraison
        .slice(0, 8));
    }
  }, [productSearchTerm, produits]);

  // Recalculate taxes when lines change
  useEffect(() => {
    if (lignes.length > 0 && taxes.length > 0) {
      const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
      const { taxes: newTaxCalculations, totalTaxes } = calculateTaxes(totalHT, taxes, 'bonsLivraison');
      setTaxCalculations(newTaxCalculations);
    } else {
      setTaxCalculations([]);
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

  const generateNumero = async () => {
    if (!isReady) return;
    
    try {
      const numero = await getNextDocumentNumber('bonsLivraison', isElectron, query);
      setFormData(prev => ({ ...prev, numero }));
    } catch (error) {
      console.error('Error generating numero:', error);
      // Fallback to simple numbering
      const year = new Date().getFullYear();
      const count = Math.floor(Math.random() * 1000) + 1;
      setFormData(prev => ({
        ...prev,
        numero: `BL-${year}-${String(count).padStart(3, '0')}`
      }));
    }
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
      
      // Calculate amounts for bon de livraison
      const ligne = newLignes[existingLineIndex];
      const montantHT = ligne.quantite * produit.prixUnitaire;
      ligne.montantHT = montantHT;
      ligne.montantTTC = calculateTTC(montantHT, produit.tva);
      
      setLignes(newLignes);
    } else {
      // For bon de livraison, include prices for display
      const montantHT = produit.prixUnitaire;
      const montantTTC = calculateTTC(montantHT, produit.tva);
      
      const newLigne: LigneDocument = {
        id: uuidv4(),
        produit,
        quantite: 1,
        prixUnitaire: produit.prixUnitaire,
        remise: 0,
        montantHT: montantHT,
        montantTTC: montantTTC
      };
      setLignes([...lignes, newLigne]);
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
      }
    } else {
      (ligne as any)[field] = value;
    }

    // Calculate amounts for bon de livraison
    const montantHT = ligne.quantite * ligne.produit.prixUnitaire;
    ligne.montantHT = montantHT;
    ligne.montantTTC = calculateTTC(montantHT, ligne.produit.tva);

    setLignes(newLignes);
  };

  const handleRemoveLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totalHT = lignes.reduce((sum, ligne) => sum + (ligne.quantite * ligne.produit.prixUnitaire), 0);
    
    // Calculate taxes from settings, not from product TVA
    const { totalTaxes } = calculateTaxes(totalHT, taxes, 'bonsLivraison');
    
    // Calculate total TTC as sum of HT + taxes
    const totalTTC = totalHT + totalTaxes;
    
    return { totalHT, totalTaxes, totalTTC };
  };

  const handleSave = async () => {
    if (!isReady) return;
    
    if (!selectedClient || lignes.length === 0) {
      alert('Veuillez sélectionner un client et ajouter au moins une ligne');
      return;
    }

    // Calculate totals for display purposes
    const { totalHT, totalTaxes, totalTTC } = calculateTotals();

    const bonLivraisonData: BonLivraison = {
      id: bonLivraison?.id || uuidv4(),
      numero: formData.numero,
      date: new Date(formData.date),
      client: selectedClient,
      lignes,
      statut: formData.statut,
      factureId: formData.factureId || undefined,
      notes: formData.notes,
      totalHT,
      totalTVA: 0, // Set to 0 as we're not using product TVA
      totalTTC,
      taxes: taxCalculations,
      totalTaxes
    };

    if (isElectron) {
      try {
        await query(
          `INSERT OR REPLACE INTO bons_livraison 
           (id, numero, date, clientId, statut, factureId, notes, totalHT, totalTVA, totalTTC)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bonLivraisonData.id,
            bonLivraisonData.numero,
            bonLivraisonData.date.toISOString(),
            bonLivraisonData.client.id,
            bonLivraisonData.statut,
            bonLivraisonData.factureId || null,
            bonLivraisonData.notes,
            bonLivraisonData.totalHT,
            bonLivraisonData.totalTVA,
            bonLivraisonData.totalTTC
          ]
        );

        await query('DELETE FROM lignes_bon_livraison WHERE bonLivraisonId = ?', [bonLivraisonData.id]);

        for (const ligne of lignes) {
          await query(
            `INSERT INTO lignes_bon_livraison 
             (id, bonLivraisonId, produitId, quantite)
             VALUES (?, ?, ?, ?)`,
            [
              ligne.id,
              bonLivraisonData.id,
              ligne.produit.id,
              ligne.quantite
            ]
          );
        }
      } catch (error) {
        console.error('Error saving bon de livraison:', error);
        alert('Erreur lors de la sauvegarde');
        return;
      }
    }

    onSave(bonLivraisonData);
    onClose();
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
              {bonLivraison ? 'Modifier le bon de livraison' : 'Nouveau bon de livraison'}
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
                    Numéro de bon de livraison
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData(prev => ({ ...prev, statut: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="prepare">Préparé</option>
                    <option value="expedie">Expédié</option>
                    <option value="livre">Livré</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facture liée (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.factureId}
                    onChange={(e) => setFormData(prev => ({ ...prev, factureId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Numéro de facture"
                  />
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
                      className="text-orange-600 hover:text-orange-800 text-sm flex items-center"
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
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                              className="w-full px-4 py-2 text-left hover:bg-orange-50 focus:bg-orange-50 focus:outline-none border-b border-gray-100 last:border-b-0"
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
                  <div className="bg-orange-50 p-4 rounded-md">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  className="text-orange-600 hover:text-orange-800 text-sm flex items-center"
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
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Rechercher et ajouter un produit de vente..."
                  />
                  <Truck className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>

                {showProductDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.slice(0, 8).map(produit => (
                        <button
                          key={produit.id}
                          onClick={() => handleAddProduct(produit)}
                          className="w-full px-4 py-3 text-left hover:bg-orange-50 focus:bg-orange-50 focus:outline-none border-b border-gray-100 last:border-b-0 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Store className="w-4 h-4 text-green-600" />
                                <div>
                                  <div className="font-medium text-gray-900 group-hover:text-orange-700">
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
                            <Plus className="w-4 h-4 text-gray-400 group-hover:text-orange-600" />
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
                          className="mt-2 text-orange-600 hover:text-orange-800 text-sm"
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
              <h3 className="text-lg font-medium mb-4">Produits à livrer ({lignes.length})</h3>

              {lignes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Référence
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produit
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantité
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Prix unit.
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Total HT
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
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {ligne.produit.ref || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <Store className="w-4 h-4 mr-2 text-green-600" />
                              <div>
                                <div className="font-medium text-gray-900">{ligne.produit.nom}</div>
                                {ligne.produit.description && (
                                  <div className="text-sm text-gray-500">{ligne.produit.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-500"
                              min="1"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatCurrency(ligne.produit.prixUnitaire)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatCurrency(ligne.produit.prixUnitaire * ligne.quantite)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {ligne.produit.tva}%
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-orange-600">
                            {formatCurrency(ligne.produit.prixUnitaire * ligne.quantite * (1 + ligne.produit.tva / 100))}
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
                  <Truck className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">Aucun produit ajouté au bon de livraison</p>
                  <p className="text-xs text-gray-400">Utilisez la recherche ci-dessus pour ajouter des produits</p>
                </div>
              )}
            </div>

            {/* Totals */}
            {lignes.length > 0 && (
                    {/* Tax calculations */}
                    {taxCalculations.length > 0 && (
                      <>
                        <div className="border-t pt-2">
                          <div className="flex items-center mb-2">
                            <Calculator className="w-4 h-4 mr-1 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Taxes additionnelles:</span>
                          </div>
                          {taxCalculations.map((calc, index) => (
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
                      <span className="text-orange-600">{formatCurrency(totalTTC)}</span>
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
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center"
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

export default BonLivraisonForm;