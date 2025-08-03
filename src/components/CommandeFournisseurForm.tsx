import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, User, Package, Calculator, Search, ShoppingCart } from 'lucide-react';
import { Fournisseur, Produit, LigneDocument, CommandeFournisseur, TaxeCalculee } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency, calculateTTC } from '../utils/currency';
import { 
  calculerTaxesProduit, 
  agregerTaxesProduits, 
  formaterTaxesPourAffichage,
  creerTaxesDefautProduit 
} from '../utils/dynamicTaxCalculator';
import { getNextDocumentNumber } from '../utils/numberGenerator';
import { v4 as uuidv4 } from 'uuid';
import FournisseurForm from './FournisseurForm';
import ProduitForm from './ProduitForm';

interface CommandeFournisseurFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (commande: CommandeFournisseur) => void;
  commande?: CommandeFournisseur;
}

const CommandeFournisseurForm: React.FC<CommandeFournisseurFormProps> = ({ isOpen, onClose, onSave, commande }) => {
  const [formData, setFormData] = useState({
    numero: '',
    date: new Date().toISOString().split('T')[0],
    dateReception: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fournisseurId: '',
    notes: '',
    statut: 'brouillon' as const
  });

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [taxesPercentage, setTaxesPercentage] = useState<TaxeCalculee[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [taxCalculations, setTaxCalculations] = useState<any[]>([]);
  
  // Search states
  const [fournisseurSearchTerm, setFournisseurSearchTerm] = useState('');
  const [showFournisseurDropdown, setShowFournisseurDropdown] = useState(false);
  
  // Product selection state
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Produit[]>([]);
  
  const [showFournisseurForm, setShowFournisseurForm] = useState(false);
  const [showProduitForm, setShowProduitForm] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [newProductType, setNewProductType] = useState<'vente' | 'achat'>('achat');

  const { query, isElectron, isReady } = useDatabase();

  const generateNumero = async () => {
    if (!isReady) return;
    
    try {
      const numero = await getNextDocumentNumber('commande_fournisseur');
      setFormData(prev => ({ ...prev, numero }));
    } catch (error) {
      console.error('Error generating numero:', error);
    }
  };

  useEffect(() => {
    if (isOpen && isReady) {
      loadFournisseurs();
      loadProduits();
      loadTaxes();
      
      if (commande) {
        setFormData({
          numero: commande.numero,
          date: commande.date.toISOString().split('T')[0],
          dateReception: commande.dateReception.toISOString().split('T')[0],
          fournisseurId: commande.fournisseur.id,
          notes: commande.notes || '',
          statut: commande.statut
        });
        setSelectedFournisseur(commande.fournisseur);
        setFournisseurSearchTerm(commande.fournisseur.nom);
        setLignes(commande.lignes);
        setTaxesPercentage(commande.taxesPercentage || []);
      } else {
        generateNumero();
        // Reset form for new commande
        setFormData({
          numero: '',
          date: new Date().toISOString().split('T')[0],
          dateReception: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          fournisseurId: '',
          notes: '',
          statut: 'brouillon'
        });
        setSelectedFournisseur(null);
        setFournisseurSearchTerm('');
        setLignes([]);
        setTaxesPercentage([]);
        setProductSearchTerm('');
        setShowProductDropdown(false);
      }
    }
  }, [isOpen, commande, isReady]);

  // Update filtered products when search term changes
  useEffect(() => {
    if (productSearchTerm.trim()) {
      const filtered = produits
        .filter(produit => produit.type === 'achat') // Only show achat products for commandes
        .filter(produit =>
          produit.nom.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (produit.ref && produit.ref.toLowerCase().includes(productSearchTerm.toLowerCase())) ||
          produit.description.toLowerCase().includes(productSearchTerm.toLowerCase())
        );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(produits
        .filter(produit => produit.type === 'achat') // Only show achat products for commandes
        .slice(0, 8));
    }
  }, [productSearchTerm, produits]);

  // Recalculate taxes when lines change
  useEffect(() => {
    recalculerTaxesCommande();
  }, [lignes]);

  const loadFournisseurs = async () => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query('SELECT * FROM fournisseurs ORDER BY nom');
        setFournisseurs(result);
      } else {
        const savedFournisseurs = localStorage.getItem('fournisseurs');
        if (savedFournisseurs) {
          setFournisseurs(JSON.parse(savedFournisseurs));
        }
      }
    } catch (error) {
      console.error('Error loading fournisseurs:', error);
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

  const recalculerTaxesCommande = () => {
    if (lignes.length === 0) {
      setTaxesPercentage([]);
      return;
    }

    // Recalculer les taxes pour chaque ligne
    const updatedLignes = lignes.map(ligne => {
      const taxesProduit = ligne.taxes && ligne.taxes.length > 0 
        ? ligne.taxes 
        : creerTaxesDefautProduit(ligne.produit.tva);
      
      const resultatTaxes = calculerTaxesProduit(
        ligne.montantHT,
        taxesProduit
      );

      return {
        ...ligne,
        taxes: taxesProduit,
        taxesCalculees: resultatTaxes.taxesCalculees,
        montantTTC: resultatTaxes.montantTTC
      };
    });

    setLignes(updatedLignes);

    // Agréger les taxes de tous les produits
    const { taxesAgregees } = agregerTaxesProduits(updatedLignes);
    const taxesFormatees = formaterTaxesPourAffichage(taxesAgregees);
    setTaxesPercentage(taxesFormatees);
  };

  // Filter fournisseurs based on search term
  const filteredFournisseurs = fournisseurs.filter(fournisseur =>
    fournisseur.nom.toLowerCase().includes(fournisseurSearchTerm.toLowerCase()) ||
    (fournisseur.email && fournisseur.email.toLowerCase().includes(fournisseurSearchTerm.toLowerCase())) ||
    (fournisseur.ville && fournisseur.ville.toLowerCase().includes(fournisseurSearchTerm.toLowerCase())) ||
    (fournisseur.matriculeFiscal && fournisseur.matriculeFiscal.toLowerCase().includes(fournisseurSearchTerm.toLowerCase()))
  );

  const handleFournisseurSearch = (value: string) => {
    setFournisseurSearchTerm(value);
    setShowFournisseurDropdown(true);
    if (!value.trim()) {
      setSelectedFournisseur(null);
      setFormData(prev => ({ ...prev, fournisseurId: '' }));
    }
  };

  const handleFournisseurSelect = (fournisseur: Fournisseur) => {
    setSelectedFournisseur(fournisseur);
    setFournisseurSearchTerm(fournisseur.nom);
    setFormData(prev => ({ ...prev, fournisseurId: fournisseur.id }));
    setShowFournisseurDropdown(false);
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
      const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - ligne.remise / 100);
      ligne.montantHT = montantHT;
      ligne.montantTTC = calculateTTC(montantHT, ligne.produit.tva);
      
      setLignes(newLignes);
    } else {
      const newLigne: LigneDocument = {
        id: uuidv4(),
        produit,
        quantite: 1,
        prixUnitaire: produit.prixUnitaire,
        remise: 0,
        montantHT: produit.prixUnitaire,
        montantTTC: calculateTTC(produit.prixUnitaire, produit.tva)
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

    const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - ligne.remise / 100);
    ligne.montantHT = montantHT;
    ligne.montantTTC = calculateTTC(montantHT, ligne.produit.tva);

    setLignes(newLignes);
  };

  const handleRemoveLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totalHT = lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
    
    // Agréger les taxes des produits
    const { totalTaxesPercentage } = agregerTaxesProduits(lignes);
    
    // Pour les commandes fournisseur, pas de taxes fixes
    const totalTTC = totalHT + totalTaxesPercentage;
    const totalTaxes = totalTaxesPercentage;
    
    return { totalHT, totalTaxesPercentage, totalTTC, totalTaxes };
  };

  const handleSave = async () => {
    if (!isReady) return;
    
    if (!selectedFournisseur || lignes.length === 0) {
      alert('Veuillez sélectionner un fournisseur et ajouter au moins une ligne');
      return;
    }

    try {
      const { totalHT, totalTaxesPercentage, totalTTC } = calculateTotals();

      const commandeData: CommandeFournisseur = {
        id: commande?.id || uuidv4(),
        numero: formData.numero,
        date: new Date(formData.date),
        dateReception: new Date(formData.dateReception),
        fournisseur: selectedFournisseur,
        lignes,
        totalHT,
        taxesPercentage,
        taxesFixes: [],
        totalTaxesPercentage,
        totalTaxesFixes: 0,
        totalTTC,
        statut: formData.statut,
        notes: formData.notes
      };

      // Save commande to database
      await query(
        `INSERT OR REPLACE INTO commandes_fournisseur 
         (id, numero, date, dateReception, fournisseurId, totalHT, totalTVA, totalTTC, statut, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commandeData.id,
          commandeData.numero,
          commandeData.date.toISOString(),
          commandeData.dateReception.toISOString(),
          commandeData.fournisseur.id,
          commandeData.totalHT,
          commandeData.totalTaxesPercentage || 0,
          commandeData.totalTTC,
          commandeData.statut,
          commandeData.notes || ''
        ]
      );

      // Delete existing lines
      await query('DELETE FROM lignes_commande_fournisseur WHERE commandeId = ?', [commandeData.id]);

      // Save lines
      for (const ligne of lignes) {
        await query(
          `INSERT INTO lignes_commande_fournisseur 
           (id, commandeId, produitId, quantite, prixUnitaire, remise, montantHT, montantTTC)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ligne.id,
            commandeData.id,
            ligne.produit.id,
            ligne.quantite,
            ligne.prixUnitaire,
            ligne.remise || 0,
            ligne.montantHT,
            ligne.montantTTC
          ]
        );
      }

      onSave(commandeData);
      onClose();
      
    } catch (error) {
      console.error('Error saving commande:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message || 'Erreur inconnue'}`);
    }
  };

  // FIXED: Fournisseur save handler
  const handleFournisseurSave = (fournisseur: Fournisseur) => {
    // Update the fournisseurs list immediately
    if (editingFournisseur) {
      setFournisseurs(prevFournisseurs => 
        prevFournisseurs.map(f => f.id === fournisseur.id ? fournisseur : f)
      );
    } else {
      setFournisseurs(prevFournisseurs => [...prevFournisseurs, fournisseur]);
    }
    
    // Save to localStorage for web version
    if (!isElectron) {
      const existingFournisseurs = JSON.parse(localStorage.getItem('fournisseurs') || '[]');
      const updatedFournisseurs = editingFournisseur 
        ? existingFournisseurs.map((f: Fournisseur) => f.id === fournisseur.id ? fournisseur : f)
        : [...existingFournisseurs, fournisseur];
      localStorage.setItem('fournisseurs', JSON.stringify(updatedFournisseurs));
    }
    
    // Reload fournisseurs to ensure sync
    setTimeout(() => {
      loadFournisseurs();
    }, 100);
    
    setShowFournisseurForm(false);
    setEditingFournisseur(null);
    
    // Auto-select the new/edited fournisseur
    handleFournisseurSelect(fournisseur);
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
              {commande ? 'Modifier la commande fournisseur' : 'Nouvelle commande fournisseur'}
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
                    Numéro de commande
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date de réception
                    </label>
                    <input
                      type="date"
                      value={formData.dateReception}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateReception: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="envoyee">Envoyée</option>
                    <option value="confirmee">Confirmée</option>
                    <option value="recue">Reçue</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
              </div>

              {/* Right Column - Fournisseur with Search */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Fournisseur
                    </label>
                    <button
                      onClick={() => {
                        setEditingFournisseur(null);
                        setShowFournisseurForm(true);
                      }}
                      className="text-purple-600 hover:text-purple-800 text-sm flex items-center"
                    >
                      <User className="w-4 h-4 mr-1" />
                      Nouveau fournisseur
                    </button>
                  </div>
                  
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={fournisseurSearchTerm}
                        onChange={(e) => handleFournisseurSearch(e.target.value)}
                        onFocus={() => setShowFournisseurDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Rechercher un fournisseur..."
                      />
                    </div>
                    
                    {showFournisseurDropdown && fournisseurSearchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredFournisseurs.length > 0 ? (
                          filteredFournisseurs.map(fournisseur => (
                            <button
                              key={fournisseur.id}
                              onClick={() => handleFournisseurSelect(fournisseur)}
                              className="w-full px-4 py-2 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{fournisseur.nom}</div>
                              <div className="text-sm text-gray-500">
                                {fournisseur.ville}
                                {fournisseur.matriculeFiscal && ` • MF: ${fournisseur.matriculeFiscal}`}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            Aucun fournisseur trouvé
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedFournisseur && (
                  <div className="bg-purple-50 p-4 rounded-md">
                    <h4 className="font-medium text-gray-900">{selectedFournisseur.nom}</h4>
                    {selectedFournisseur.matriculeFiscal && (
                      <p className="text-sm text-gray-600">Matricule Fiscal: {selectedFournisseur.matriculeFiscal}</p>
                    )}
                    <p className="text-sm text-gray-600">{selectedFournisseur.adresse}</p>
                    <p className="text-sm text-gray-600">
                      {selectedFournisseur.codePostal} {selectedFournisseur.ville}
                    </p>
                    {selectedFournisseur.telephone && (
                      <p className="text-sm text-gray-600">Tél: {selectedFournisseur.telephone}</p>
                    )}
                    {selectedFournisseur.email && (
                      <p className="text-sm text-gray-600">Email: {selectedFournisseur.email}</p>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </div>
            </div>

            {/* Product Search and Addition */}
            <div className="border-t pt-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-purple-600" />
                  Ajouter des produits d'achat
                </h3>
                <button
                  onClick={() => {
                    setEditingProduit(null);
                    setNewProductType('achat');
                    setShowProduitForm(true);
                  }}
                  className="text-purple-600 hover:text-purple-800 text-sm flex items-center"
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Nouveau produit d'achat
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
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Rechercher et ajouter un produit d'achat..."
                  />
                  <ShoppingCart className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>

                {showProductDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.slice(0, 8).map(produit => (
                        <button
                          key={produit.id}
                          onClick={() => handleAddProduct(produit)}
                          className="w-full px-4 py-3 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none border-b border-gray-100 last:border-b-0 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <ShoppingCart className="w-4 h-4 text-purple-600" />
                                <div>
                                  <div className="font-medium text-gray-900 group-hover:text-purple-700">
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
                            <Plus className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Aucun produit d'achat trouvé</p>
                        <button
                          onClick={() => {
                            setEditingProduit(null);
                            setNewProductType('achat');
                            setShowProduitForm(true);
                            setShowProductDropdown(false);
                          }}
                          className="mt-2 text-purple-600 hover:text-purple-800 text-sm"
                        >
                          Créer un nouveau produit d'achat
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lines Table */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Lignes de commande ({lignes.length})</h3>

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
                              <ShoppingCart className="w-4 h-4 mr-2 text-purple-600" />
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
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500"
                              min="1"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.prixUnitaire}
                              onChange={(e) => handleLigneChange(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500"
                              step="0.001"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={ligne.remise}
                              onChange={(e) => handleLigneChange(index, 'remise', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500"
                              min="0"
                              max="100"
                              step="0.1"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {formatCurrency(ligne.montantHT)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {formatCurrency(ligne.montantHT * ligne.produit.tva / 100)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-purple-600">
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
                  <ShoppingCart className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm">Aucun produit ajouté à la commande</p>
                  <p className="text-xs text-gray-400">Utilisez la recherche ci-dessus pour ajouter des produits</p>
                </div>
              )}
            </div>

            {/* Totals */}
            {lignes.length > 0 && (
              <div className="mt-6 flex justify-end">
                <div className="bg-purple-50 p-4 rounded-lg w-96">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total HT:</span>
                      <span>{formatCurrency(totalHT)}</span>
                    </div>
                    
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
                      <span className="text-purple-600">{formatCurrency(totalTTC)}</span>
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
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      {/* Fournisseur Form Dialog */}
      <FournisseurForm
        isOpen={showFournisseurForm}
        onClose={() => {
          setShowFournisseurForm(false);
          setEditingFournisseur(null);
        }}
        onSave={handleFournisseurSave}
        fournisseur={editingFournisseur}
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
      {(showFournisseurDropdown || showProductDropdown) && (
        <div 
          className="fixed inset-0 z-5"
          onClick={() => {
            setShowFournisseurDropdown(false);
            setShowProductDropdown(false);
          }}
        />
      )}
    </>
  );
};

export default CommandeFournisseurForm;