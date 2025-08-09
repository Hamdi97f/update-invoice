import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, FileDown, Printer, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, RefreshCw, FileText, Receipt, Truck, X } from 'lucide-react';
import { BonLivraison, Facture, LigneDocument } from '../types';
import { generateBonLivraisonPDF } from '../utils/pdfGenerator';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import { getNextDocumentNumber } from '../utils/numberGenerator';
import { v4 as uuidv4 } from 'uuid';
import BonLivraisonForm from './BonLivraisonForm';

interface BonLivraisonListProps {
  onCreateNew: () => void;
  onEdit: (bonLivraison: BonLivraison) => void;
  onDelete: (id: string) => void;
}

type SortField = 'numero' | 'date' | 'client';
type SortDirection = 'asc' | 'desc';

const BonLivraisonList: React.FC<BonLivraisonListProps> = ({ onCreateNew, onEdit, onDelete }) => {
  const [bonsLivraison, setBonsLivraison] = useState<BonLivraison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBonLivraison, setEditingBonLivraison] = useState<BonLivraison | null>(null);
  
  // Conversion feature states
  const [selectedBons, setSelectedBons] = useState<Set<string>>(new Set());
  const [isConversionMode, setIsConversionMode] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  
  // Error handling
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  const { query, savePDF, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadBonsLivraison();
    }
  }, [isReady]);

  useEffect(() => {
    const handleFocus = () => {
      if (isReady) {
        loadBonsLivraison();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady]);

  const loadBonsLivraison = async () => {
    if (!isReady) return;
    
    try {
      setLoading(true);
      const result = await query(`
        SELECT bl.*, c.code as clientCode, c.nom as clientNom, c.adresse, c.codePostal, c.ville, c.telephone, c.email, c.matriculeFiscal
        FROM bons_livraison bl
        JOIN clients c ON bl.clientId = c.id
        ORDER BY bl.numero DESC
      `);

      const bonsData = result.map((bl: any) => ({
        ...bl,
        date: new Date(bl.date),
        lignes: [],
        taxGroupsSummary: [],
        totalTaxes: bl.totalTVA || 0,
        client: {
          id: bl.clientId,
          code: bl.clientCode,
          nom: bl.clientNom,
          adresse: bl.adresse,
          codePostal: bl.codePostal,
          ville: bl.ville,
          telephone: bl.telephone,
          email: bl.email,
          matriculeFiscal: bl.matriculeFiscal
        }
      }));
      
      // Load lines for each bon de livraison
      for (const bon of bonsData) {
        const lignesResult = await query(`
          SELECT lbl.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.fodecApplicable, p.tauxFodec, p.stock, p.type
          FROM lignes_bon_livraison lbl
          JOIN produits p ON lbl.produitId = p.id
          WHERE lbl.bonLivraisonId = ?
        `, [bon.id]);
        
        bon.lignes = lignesResult.map((ligne: any) => ({
          id: ligne.id,
          produit: {
            id: ligne.produitId,
            ref: ligne.ref,
            nom: ligne.nom,
            description: ligne.description,
            prixUnitaire: ligne.prixUnitaire,
            tva: ligne.tva,
            fodecApplicable: Boolean(ligne.fodecApplicable),
            tauxFodec: ligne.tauxFodec || 1,
            stock: ligne.stock,
            type: ligne.type
          },
          quantite: ligne.quantite,
          prixUnitaire: ligne.prixUnitaire,
          remise: 0,
          montantHT: ligne.montantHT || (ligne.prixUnitaire * ligne.quantite),
          montantFodec: ligne.montantFodec || 0,
          baseTVA: ligne.baseTVA || 0,
          montantTVA: ligne.montantTVA || 0,
          montantTTC: ligne.montantTTC || (ligne.prixUnitaire * ligne.quantite * (1 + ligne.tva / 100))
        }));
        
        // Use stored totals or calculate if missing
        if (!bon.totalHT) {
          bon.totalHT = bon.lignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
        }
        if (!bon.totalFodec) {
          bon.totalFodec = bon.lignes.reduce((sum, ligne) => sum + (ligne.montantFodec || 0), 0);
        }
        if (!bon.totalTVA) {
          bon.totalTVA = bon.lignes.reduce((sum, ligne) => sum + (ligne.montantTVA || 0), 0);
        }
        if (!bon.totalTTC) {
          bon.totalTTC = bon.lignes.reduce((sum, ligne) => sum + ligne.montantTTC, 0);
        }
        if (!bon.totalTaxes) {
          bon.totalTaxes = (bon.totalFodec || 0) + (bon.totalTVA || 0);
        }
      }
      
      setBonsLivraison(bonsData);
    } catch (error) {
      console.error('Error loading bons de livraison:', error);
      alert('Erreur lors du chargement des bons de livraison');
    } finally {
      setLoading(false);
    }
  };

  // Sort bons de livraison
  const sortedBons = React.useMemo(() => {
    const sorted = [...bonsLivraison].sort((a, b) => {
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
  }, [bonsLivraison, sortField, sortDirection]);

  // Filter bons de livraison
  const filteredBons = sortedBons.filter(bon => {
    const matchesSearch = bon.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bon.client.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bon.statut === statusFilter;
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
      ? <ArrowUp className="w-4 h-4 text-orange-600" />
      : <ArrowDown className="w-4 h-4 text-orange-600" />;
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'prepare': return 'bg-yellow-100 text-yellow-800';
      case 'expedie': return 'bg-blue-100 text-blue-800';
      case 'livre': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'prepare': return 'Préparé';
      case 'expedie': return 'Expédié';
      case 'livre': return 'Livré';
      default: return statut;
    }
  };

  // Conversion functionality
  const toggleConversionMode = () => {
    setIsConversionMode(!isConversionMode);
    setSelectedBons(new Set());
  };

  const toggleBonSelection = (bonId: string) => {
    const newSelected = new Set(selectedBons);
    if (newSelected.has(bonId)) {
      newSelected.delete(bonId);
    } else {
      newSelected.add(bonId);
    }
    setSelectedBons(newSelected);
  };

  const selectAllBons = () => {
    if (selectedBons.size === filteredBons.length) {
      setSelectedBons(new Set());
    } else {
      setSelectedBons(new Set(filteredBons.map(b => b.id)));
    }
  };

  const getSelectedBonsData = () => {
    return filteredBons.filter(b => selectedBons.has(b.id));
  };

  // Check if selected bons have the same client
  const canConvertSelected = () => {
    const selectedData = getSelectedBonsData();
    if (selectedData.length === 0) return false;
    
    const firstClientId = selectedData[0].client.id;
    return selectedData.every(b => b.client.id === firstClientId);
  };

  const handleStartConversion = () => {
    if (selectedBons.size === 0) {
      alert('Veuillez sélectionner au moins un bon de livraison');
      return;
    }

    if (!canConvertSelected()) {
      alert('Tous les bons de livraison sélectionnés doivent avoir le même client pour être convertis ensemble');
      return;
    }

    setShowConversionModal(true);
  };

  const handleConversion = async () => {
    if (selectedBons.size === 0) return;

    setIsConverting(true);
    try {
      const selectedData = getSelectedBonsData();
      await convertToSingleFacture(selectedData);
      
      setShowConversionModal(false);
      setIsConversionMode(false);
      setSelectedBons(new Set());
      
      alert(`${selectedData.length} bon(s) de livraison converti(s) avec succès en une seule facture`);
      
      // Reload bons to reflect any changes
      loadBonsLivraison();
      
    } catch (error: any) {
      console.error('Error during conversion:', error);
      alert('Erreur lors de la conversion: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setIsConverting(false);
    }
  };

  // CRITICAL: New function to convert multiple delivery notes to a single invoice
  const convertToSingleFacture = async (bonsData: BonLivraison[]) => {
    // Load all delivery note lines and consolidate them
    const allLignes: LigneDocument[] = [];
    const bonNumbers: string[] = [];
    
    for (const bon of bonsData) {
      bonNumbers.push(bon.numero);
      
      // Load lignes from database
      const lignesResult = await query(`
        SELECT lbl.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.fodecApplicable, p.tauxFodec, p.stock, p.type
        FROM lignes_bon_livraison lbl
        JOIN produits p ON lbl.produitId = p.id
        WHERE lbl.bonLivraisonId = ?
      `, [bon.id]);
      
      const bonLignes = lignesResult.map((ligne: any) => ({
        id: ligne.id,
        produit: {
          id: ligne.produitId,
          ref: ligne.ref,
          nom: ligne.nom,
          description: ligne.description,
          prixUnitaire: ligne.prixUnitaire,
          tva: ligne.tva,
          fodecApplicable: Boolean(ligne.fodecApplicable),
          tauxFodec: ligne.tauxFodec || 1,
          stock: ligne.stock
        },
        quantite: ligne.quantite,
        prixUnitaire: ligne.prixUnitaire,
        remise: 0,
        montantHT: ligne.montantHT || (ligne.quantite * ligne.prixUnitaire),
        montantFodec: ligne.montantFodec || 0,
        baseTVA: ligne.baseTVA || 0,
        montantTVA: ligne.montantTVA || 0,
        montantTTC: ligne.montantTTC || (ligne.quantite * ligne.prixUnitaire * (1 + ligne.tva / 100))
      }));
      
      allLignes.push(...bonLignes);
    }

    // CRITICAL: Consolidate duplicate products by summing quantities
    const consolidatedLignes: LigneDocument[] = [];
    const productMap = new Map<string, LigneDocument>();

    for (const ligne of allLignes) {
      const productId = ligne.produit.id;
      
      if (productMap.has(productId)) {
        // Product already exists, sum the quantities
        const existingLigne = productMap.get(productId)!;
        existingLigne.quantite += ligne.quantite;
        
        // Recalculate amounts based on new quantity using new tax logic
        const montantHT = existingLigne.quantite * existingLigne.prixUnitaire * (1 - (existingLigne.remise || 0) / 100);
        
        // Calculate FODEC
        const montantFodec = existingLigne.produit.fodecApplicable ? 
          montantHT * (existingLigne.produit.tauxFodec / 100) : 0;
        
        // Calculate TVA base (HT + FODEC)
        const baseTVA = montantHT + montantFodec;
        
        // Calculate TVA
        const montantTVA = baseTVA * (existingLigne.produit.tva / 100);
        
        // Calculate TTC
        const montantTTC = montantHT + montantFodec + montantTVA;
        
        // Update ligne with new calculations
        existingLigne.montantHT = montantHT;
        existingLigne.montantFodec = montantFodec;
        existingLigne.baseTVA = baseTVA;
        existingLigne.montantTVA = montantTVA;
        existingLigne.montantTTC = montantTTC;
      } else {
        // New product, add to map with new ID and proper tax calculations
        const montantHT = ligne.quantite * ligne.prixUnitaire * (1 - (ligne.remise || 0) / 100);
        
        // Calculate FODEC
        const montantFodec = ligne.produit.fodecApplicable ? 
          montantHT * (ligne.produit.tauxFodec / 100) : 0;
        
        // Calculate TVA base (HT + FODEC)
        const baseTVA = montantHT + montantFodec;
        
        // Calculate TVA
        const montantTVA = baseTVA * (ligne.produit.tva / 100);
        
        // Calculate TTC
        const montantTTC = montantHT + montantFodec + montantTVA;
        
        const consolidatedLigne: LigneDocument = {
          id: uuidv4(), // New ID for the consolidated line
          produit: ligne.produit,
          quantite: ligne.quantite,
          prixUnitaire: ligne.prixUnitaire,
          remise: ligne.remise || 0,
          montantHT,
          montantFodec,
          baseTVA,
          montantTVA,
          montantTTC
        };
        productMap.set(productId, consolidatedLigne);
      }
    }

    // Convert map to array
    consolidatedLignes.push(...productMap.values());

    // Generate single invoice number
    const factureNumero = await getNextDocumentNumber('factures', true, query);
    
    // Calculate totals from consolidated lignes using new tax logic
    const totalHT = consolidatedLignes.reduce((sum, ligne) => sum + ligne.montantHT, 0);
    const totalFodec = consolidatedLignes.reduce((sum, ligne) => sum + (ligne.montantFodec || 0), 0);
    const totalTVA = consolidatedLignes.reduce((sum, ligne) => sum + (ligne.montantTVA || 0), 0);
    const totalTTC = consolidatedLignes.reduce((sum, ligne) => sum + ligne.montantTTC, 0);
    
    // CRITICAL: Do NOT copy old taxes - they will be recalculated automatically
    // The taxes are already calculated in the ligne amounts above
    
    // Create notes with all delivery note numbers
    const notesText = `Converti des bons de livraison : ${bonNumbers.join(', ')}`;
    
    const facture: Facture = {
      id: uuidv4(),
      numero: factureNumero,
      date: new Date(),
      dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      client: bonsData[0].client, // All bons have the same client
      lignes: consolidatedLignes,
      totalHT,
      totalFodec,
      totalTVA,
      totalTTC,
      statut: 'brouillon',
      notes: notesText
    };

    // Save the single consolidated facture
    await query(
      `INSERT INTO factures 
       (id, numero, date, dateEcheance, clientId, totalHT, totalTVA, totalTTC, statut, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        facture.id,
        facture.numero,
        facture.date.toISOString(),
        facture.dateEcheance.toISOString(),
        facture.client.id,
        facture.totalHT,
        facture.totalTVA,
        facture.totalTTC,
        facture.statut,
        facture.notes
      ]
    );

    // Save consolidated facture lines
    for (const ligne of facture.lignes) {
      await query(
        `INSERT INTO lignes_facture 
         (id, factureId, produitId, quantite, prixUnitaire, remise, montantHT, montantTTC)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ligne.id,
          facture.id,
          ligne.produit.id,
          ligne.quantite,
          ligne.prixUnitaire,
          ligne.remise || 0,
          ligne.montantHT,
          ligne.montantTTC
        ]
      );
    }
    
    // Update the bons de livraison to link them to the new facture
    for (const bon of bonsData) {
      await query(
        `UPDATE bons_livraison SET factureId = ? WHERE id = ?`,
        [facture.id, bon.id]
      );
    }
  };

  const handleDownloadPDF = async (bonLivraison: BonLivraison) => {
    try {
      setPdfError(null);
      const doc = await generateBonLivraisonPDF(bonLivraison);
      const pdfData = doc.output('arraybuffer');
      
      const result = await savePDF(new Uint8Array(pdfData), `BonLivraison_${bonLivraison.numero}.pdf`);
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du téléchargement du PDF');
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF');
      alert('Erreur lors de la génération du PDF: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handlePrint = async (bonLivraison: BonLivraison) => {
    try {
      setPdfError(null);
      const doc = await generateBonLivraisonPDF(bonLivraison);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (error: any) {
      console.error('Error generating PDF for print:', error);
      setPdfError(error.message || 'Erreur lors de la génération du PDF pour impression');
      alert('Erreur lors de la génération du PDF pour impression: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleCreateNew = () => {
    setEditingBonLivraison(null);
    setShowForm(true);
  };

  const handleEdit = (bonLivraison: BonLivraison) => {
    setEditingBonLivraison(bonLivraison);
    setShowForm(true);
  };

  const handleSave = async (bonLivraison: BonLivraison) => {
    try {
      if (editingBonLivraison) {
        setBonsLivraison(bonsLivraison.map(bl => bl.id === bonLivraison.id ? bonLivraison : bl));
      } else {
        setBonsLivraison([bonLivraison, ...bonsLivraison]);
      }

      setShowForm(false);
      setEditingBonLivraison(null);

      setTimeout(() => {
        loadBonsLivraison();
      }, 100);
    } catch (error) {
      console.error('Error saving bon de livraison:', error);
      alert('Erreur lors de la sauvegarde du bon de livraison');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isReady) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce bon de livraison ?')) {
      try {
        await query('DELETE FROM lignes_bon_livraison WHERE bonLivraisonId = ?', [id]);
        await query('DELETE FROM bons_livraison WHERE id = ?', [id]);
        
        setBonsLivraison(bonsLivraison.filter(bl => bl.id !== id));
      } catch (error) {
        console.error('Error deleting bon de livraison:', error);
        alert('Erreur lors de la suppression du bon de livraison');
      }
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initialisation de la base de données...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
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
                placeholder="Rechercher par numéro ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent w-64"
              />
            </div>
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="prepare">Préparé</option>
                <option value="expedie">Expédié</option>
                <option value="livre">Livré</option>
              </select>
            </div>
            <button
              onClick={loadBonsLivraison}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleConversionMode}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                isConversionMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isConversionMode ? 'Annuler conversion' : 'Convertir en facture'}</span>
            </button>
            <button
              onClick={handleCreateNew}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau bon de livraison</span>
            </button>
          </div>
        </div>

        {/* PDF Error Message */}
        {pdfError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erreur PDF</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{pdfError}</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setPdfError(null)}
                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversion toolbar */}
        {isConversionMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={selectAllBons}
                  className="flex items-center space-x-2 text-blue-700 hover:text-blue-900"
                >
                  {selectedBons.size === filteredBons.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedBons.size === filteredBons.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </span>
                </button>
                <span className="text-blue-700 font-medium">
                  {selectedBons.size} bon(s) de livraison sélectionné(s)
                </span>
                {selectedBons.size > 0 && !canConvertSelected() && (
                  <span className="text-red-600 text-sm font-medium">
                    ⚠️ Les bons de livraison sélectionnés doivent avoir le même client
                  </span>
                )}
              </div>
              
              {selectedBons.size > 0 && canConvertSelected() && (
                <button
                  onClick={handleStartConversion}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Convertir en facture unique</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-orange-800 font-medium">
                {bonsLivraison.length} bon{bonsLivraison.length > 1 ? 's' : ''} de livraison enregistré{bonsLivraison.length > 1 ? 's' : ''}
              </span>
              {sortField && (
                <span className="ml-4 text-orange-600 text-sm">
                  Triés par {sortField === 'numero' ? 'numéro' : 
                             sortField === 'date' ? 'date' : 'client'} 
                  ({sortDirection === 'asc' ? 'croissant' : 'décroissant'})
                </span>
              )}
            </div>
            {searchTerm && (
              <span className="text-orange-600 text-sm">
                {filteredBons.length} résultat{filteredBons.length > 1 ? 's' : ''} trouvé{filteredBons.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isConversionMode && (
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={selectAllBons}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {selectedBons.size === filteredBons.length ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                )}
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('numero')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Numéro</span>
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
                  Facture liée
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total TTC
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBons.map((bon) => (
                <tr 
                  key={bon.id} 
                  className={`hover:bg-gray-50 ${
                    selectedBons.has(bon.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  {isConversionMode && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleBonSelection(bon.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedBons.has(bon.id) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                    {bon.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{bon.client.nom}</div>
                      <div className="text-gray-500 text-xs">{bon.client.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bon.date.toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bon.factureId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bon.statut)}`}>
                      {getStatusLabel(bon.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(bon.totalTTC || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleDownloadPDF(bon)}
                        className="text-orange-600 hover:text-orange-900 p-1 hover:bg-orange-50 rounded transition-colors"
                        title="Télécharger PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(bon)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(bon)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bon.id)}
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
          {filteredBons.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Aucun bon de livraison trouvé avec ces critères' 
                  : 'Aucun bon de livraison créé pour le moment'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Créer le premier bon de livraison
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conversion Modal */}
      {showConversionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Convertir en facture unique</h2>
              <button 
                onClick={() => setShowConversionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  Vous allez convertir <strong>{selectedBons.size} bon(s) de livraison</strong> en une seule facture pour le client :
                </p>
                <p className="font-medium text-gray-900">
                  {getSelectedBonsData()[0]?.client.nom}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-start p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Receipt className="w-6 h-6 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Consolidation intelligente</p>
                    <p className="text-sm text-blue-700">
                      • Tous les produits seront regroupés dans une seule facture<br/>
                      • Les produits identiques seront fusionnés avec leurs quantités additionnées<br/>
                      • Les prix unitaires des produits seront utilisés pour calculer les montants
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-amber-800">
                  <strong>Exemple :</strong> Si vous avez 2 bons avec le même produit (3 unités + 2 unités), 
                  la facture contiendra une seule ligne avec 5 unités de ce produit.
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isConverting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConversion}
                  disabled={isConverting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConverting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Conversion...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Convertir en facture unique
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bon de Livraison Form Dialog */}
      <BonLivraisonForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingBonLivraison(null);
        }}
        onSave={handleSave}
        bonLivraison={editingBonLivraison}
      />
    </>
  );
};

export default BonLivraisonList;