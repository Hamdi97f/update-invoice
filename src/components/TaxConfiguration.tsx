import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ArrowUp, ArrowDown, Users, Settings, Star, StarOff } from 'lucide-react';
import { Tax, TaxGroup, TaxGroupTax } from '../types';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

interface TaxConfigurationProps {
  onTaxesChange?: (taxes: Tax[]) => void;
}

const TaxConfiguration: React.FC<TaxConfigurationProps> = ({ onTaxesChange }) => {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'taxes' | 'groups'>('taxes');
  const [showForm, setShowForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [editingGroup, setEditingGroup] = useState<TaxGroup | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    type: 'percentage' as 'percentage' | 'fixed',
    valeur: 0,
    calculationBase: 'totalHT' as 'totalHT' | 'totalHTWithPreviousTaxes',
    applicableDocuments: [] as ('factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur')[],
    actif: true,
    isStandard: false
  });
  
  const [groupFormData, setGroupFormData] = useState({
    nom: '',
    description: '',
    selectedTaxes: [] as string[],
    actif: true
  });

  const { query, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isReady) {
      loadTaxes();
      loadTaxGroups();
    }
  }, [isReady]);

  const loadTaxes = async () => {
    if (!isElectron) {
      const savedTaxes = localStorage.getItem('taxes');
      if (savedTaxes) {
        const loadedTaxes = JSON.parse(savedTaxes);
        setTaxes(loadedTaxes);
        onTaxesChange?.(loadedTaxes);
      }
      return;
    }

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS taxes (
          id TEXT PRIMARY KEY,
          nom TEXT NOT NULL,
          type TEXT NOT NULL,
          valeur REAL NOT NULL,
          calculationBase TEXT NOT NULL,
          applicableDocuments TEXT NOT NULL,
          ordre INTEGER NOT NULL,
          actif BOOLEAN DEFAULT 1,
          isStandard BOOLEAN DEFAULT 0
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS tax_groups (
          id TEXT PRIMARY KEY,
          nom TEXT NOT NULL,
          description TEXT DEFAULT '',
          actif BOOLEAN DEFAULT 1
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS tax_group_taxes (
          id TEXT PRIMARY KEY,
          taxGroupId TEXT NOT NULL,
          taxId TEXT NOT NULL,
          ordreInGroup INTEGER NOT NULL,
          calculationBaseInGroup TEXT,
          FOREIGN KEY (taxGroupId) REFERENCES tax_groups (id),
          FOREIGN KEY (taxId) REFERENCES taxes (id)
        )
      `);

      const result = await query('SELECT * FROM taxes ORDER BY ordre ASC');
      const loadedTaxes = result.map((tax: any) => ({
        ...tax,
        applicableDocuments: JSON.parse(tax.applicableDocuments),
        actif: Boolean(tax.actif),
        isStandard: Boolean(tax.isStandard)
      }));
      
      setTaxes(loadedTaxes);
      onTaxesChange?.(loadedTaxes);
    } catch (error) {
      console.error('Error loading taxes:', error);
    }
  };

  const loadTaxGroups = async () => {
    if (!isElectron) {
      const savedGroups = localStorage.getItem('taxGroups');
      if (savedGroups) {
        setTaxGroups(JSON.parse(savedGroups));
      }
      return;
    }

    try {
      const result = await query('SELECT * FROM tax_groups ORDER BY nom ASC');
      const groupsWithTaxes = await Promise.all(result.map(async (group: any) => {
        const groupTaxes = await query(`
          SELECT tgt.*, t.nom, t.type, t.valeur, t.calculationBase, t.actif, t.isStandard
          FROM tax_group_taxes tgt
          JOIN taxes t ON tgt.taxId = t.id
          WHERE tgt.taxGroupId = ?
          ORDER BY tgt.ordreInGroup ASC
        `, [group.id]);
        
        return {
          ...group,
          actif: Boolean(group.actif),
          taxes: groupTaxes.map((gt: any) => ({
            taxId: gt.taxId,
            tax: {
              id: gt.taxId,
              nom: gt.nom,
              type: gt.type,
              valeur: gt.valeur,
              calculationBase: gt.calculationBase,
              actif: gt.actif,
              isStandard: gt.isStandard
            },
            ordreInGroup: gt.ordreInGroup,
            calculationBaseInGroup: gt.calculationBaseInGroup
          }))
        };
      }));
      
      setTaxGroups(groupsWithTaxes);
    } catch (error) {
      console.error('Error loading tax groups:', error);
    }
  };

  const saveTaxes = async (updatedTaxes: Tax[]) => {
    if (!isElectron) {
      localStorage.setItem('taxes', JSON.stringify(updatedTaxes));
      return;
    }

    try {
      // Clear existing taxes
      await query('DELETE FROM taxes');
      
      // Insert updated taxes
      for (const tax of updatedTaxes) {
        await query(
          `INSERT INTO taxes (id, nom, type, valeur, calculationBase, applicableDocuments, ordre, actif, isStandard)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tax.id,
            tax.nom,
            tax.type,
            tax.valeur,
            tax.calculationBase,
            JSON.stringify(tax.applicableDocuments),
            tax.ordre,
            tax.actif ? 1 : 0,
            tax.isStandard ? 1 : 0
          ]
        );
      }
    } catch (error) {
      console.error('Error saving taxes:', error);
      throw error;
    }
  };

  const saveTaxGroups = async (updatedGroups: TaxGroup[]) => {
    if (!isElectron) {
      localStorage.setItem('taxGroups', JSON.stringify(updatedGroups));
      return;
    }

    try {
      // Clear existing groups and their taxes
      await query('DELETE FROM tax_group_taxes');
      await query('DELETE FROM tax_groups');
      
      // Insert updated groups
      for (const group of updatedGroups) {
        await query(
          `INSERT INTO tax_groups (id, nom, description, actif)
           VALUES (?, ?, ?, ?)`,
          [group.id, group.nom, group.description, group.actif ? 1 : 0]
        );
        
        // Insert group taxes
        for (const groupTax of group.taxes) {
          await query(
            `INSERT INTO tax_group_taxes (id, taxGroupId, taxId, ordreInGroup, calculationBaseInGroup)
             VALUES (?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              group.id,
              groupTax.taxId,
              groupTax.ordreInGroup,
              groupTax.calculationBaseInGroup || null
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error saving tax groups:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nom.trim()) {
      alert('Le nom de la taxe est obligatoire');
      return;
    }

    if (formData.valeur <= 0) {
      alert('La valeur de la taxe doit être supérieure à 0');
      return;
    }

    if (formData.applicableDocuments.length === 0) {
      alert('Veuillez sélectionner au moins un type de document');
      return;
    }

    const taxData: Tax = {
      id: editingTax?.id || uuidv4(),
      nom: formData.nom.trim(),
      type: formData.type,
      valeur: formData.valeur,
      calculationBase: formData.calculationBase,
      applicableDocuments: formData.applicableDocuments,
      ordre: editingTax?.ordre || taxes.length + 1,
      actif: formData.actif,
      isStandard: formData.isStandard
    };

    try {
      let updatedTaxes;
      if (editingTax) {
        updatedTaxes = taxes.map(t => t.id === taxData.id ? taxData : t);
      } else {
        updatedTaxes = [...taxes, taxData];
      }

      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
      
      setShowForm(false);
      setEditingTax(null);
      resetForm();
    } catch (error) {
      alert('Erreur lors de la sauvegarde de la taxe');
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupFormData.nom.trim()) {
      alert('Le nom du groupe est obligatoire');
      return;
    }

    if (groupFormData.selectedTaxes.length === 0) {
      alert('Veuillez sélectionner au moins une taxe pour le groupe');
      return;
    }

    const groupData: TaxGroup = {
      id: editingGroup?.id || uuidv4(),
      nom: groupFormData.nom.trim(),
      description: groupFormData.description.trim(),
      actif: groupFormData.actif,
      taxes: groupFormData.selectedTaxes.map((taxId, index) => {
        const tax = taxes.find(t => t.id === taxId)!;
        return {
          taxId,
          tax,
          ordreInGroup: index + 1,
          calculationBaseInGroup: tax.calculationBase
        };
      })
    };

    try {
      let updatedGroups;
      if (editingGroup) {
        updatedGroups = taxGroups.map(g => g.id === groupData.id ? groupData : g);
      } else {
        updatedGroups = [...taxGroups, groupData];
      }

      await saveTaxGroups(updatedGroups);
      setTaxGroups(updatedGroups);
      
      setShowGroupForm(false);
      setEditingGroup(null);
      resetGroupForm();
    } catch (error) {
      alert('Erreur lors de la sauvegarde du groupe de taxes');
    }
  };

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax);
    setFormData({
      nom: tax.nom,
      type: tax.type,
      valeur: tax.valeur,
      calculationBase: tax.calculationBase,
      applicableDocuments: tax.applicableDocuments,
      actif: tax.actif,
      isStandard: tax.isStandard || false
    });
    setShowForm(true);
  };

  const handleEditGroup = (group: TaxGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      nom: group.nom,
      description: group.description,
      selectedTaxes: group.taxes.map(gt => gt.taxId),
      actif: group.actif
    });
    setShowGroupForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette taxe ?')) {
      try {
        const updatedTaxes = taxes.filter(t => t.id !== id);
        await saveTaxes(updatedTaxes);
        setTaxes(updatedTaxes);
        onTaxesChange?.(updatedTaxes);
      } catch (error) {
        alert('Erreur lors de la suppression de la taxe');
      }
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce groupe de taxes ?')) {
      try {
        const updatedGroups = taxGroups.filter(g => g.id !== id);
        await saveTaxGroups(updatedGroups);
        setTaxGroups(updatedGroups);
      } catch (error) {
        alert('Erreur lors de la suppression du groupe de taxes');
      }
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const updatedTaxes = taxes.map(t => 
        t.id === id ? { ...t, actif: !t.actif } : t
      );
      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
    } catch (error) {
      alert('Erreur lors de la mise à jour de la taxe');
    }
  };

  const handleToggleStandard = async (id: string) => {
    try {
      const updatedTaxes = taxes.map(t => 
        t.id === id ? { ...t, isStandard: !t.isStandard } : t
      );
      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
    } catch (error) {
      alert('Erreur lors de la mise à jour de la taxe');
    }
  };

  const handleToggleGroupActive = async (id: string) => {
    try {
      const updatedGroups = taxGroups.map(g => 
        g.id === id ? { ...g, actif: !g.actif } : g
      );
      await saveTaxGroups(updatedGroups);
      setTaxGroups(updatedGroups);
    } catch (error) {
      alert('Erreur lors de la mise à jour du groupe');
    }
  };

  const moveOrder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = taxes.findIndex(t => t.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === taxes.length - 1)
    ) {
      return;
    }

    const newTaxes = [...taxes];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap positions
    [newTaxes[currentIndex], newTaxes[targetIndex]] = [newTaxes[targetIndex], newTaxes[currentIndex]];
    
    // Update order numbers
    const updatedTaxes = newTaxes.map((tax, index) => ({
      ...tax,
      ordre: index + 1
    }));

    try {
      await saveTaxes(updatedTaxes);
      setTaxes(updatedTaxes);
      onTaxesChange?.(updatedTaxes);
    } catch (error) {
      alert('Erreur lors du réordonnancement des taxes');
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      type: 'percentage',
      valeur: 0,
      calculationBase: 'totalHT',
      applicableDocuments: [],
      actif: true,
      isStandard: false
    });
  };
  
  const resetGroupForm = () => {
    setGroupFormData({
      nom: '',
      description: '',
      selectedTaxes: [],
      actif: true
    });
  };

  const handleDocumentToggle = (docType: 'factures' | 'devis' | 'bonsLivraison' | 'commandesFournisseur') => {
    setFormData(prev => ({
      ...prev,
      applicableDocuments: prev.applicableDocuments.includes(docType)
        ? prev.applicableDocuments.filter(d => d !== docType)
        : [...prev.applicableDocuments, docType]
    }));
  };

  const handleTaxToggleInGroup = (taxId: string) => {
    setGroupFormData(prev => ({
      ...prev,
      selectedTaxes: prev.selectedTaxes.includes(taxId)
        ? prev.selectedTaxes.filter(id => id !== taxId)
        : [...prev.selectedTaxes, taxId]
    }));
  };

  const documentLabels = {
    factures: 'Factures',
    devis: 'Devis',
    bonsLivraison: 'Bons de livraison',
    commandesFournisseur: 'Commandes fournisseur'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Configuration des taxes</h3>
        <div className="flex space-x-3">
          {activeTab === 'taxes' ? (
            <button
              onClick={() => {
                resetForm();
                setEditingTax(null);
                setShowForm(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle taxe</span>
            </button>
          ) : (
            <button
              onClick={() => {
                resetGroupForm();
                setEditingGroup(null);
                setShowGroupForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau groupe</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('taxes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'taxes'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Taxes individuelles</span>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'groups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Groupes de taxes</span>
          </button>
        </nav>
      </div>

      {/* Tax Groups Tab */}
      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {taxGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Aucun groupe de taxes configuré.</p>
              <p className="text-sm mt-2">Créez des groupes comme "Fodec + TVA" pour simplifier la gestion des taxes.</p>
              <button
                onClick={() => {
                  resetGroupForm();
                  setEditingGroup(null);
                  setShowGroupForm(true);
                }}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Créer le premier groupe
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom du groupe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taxes incluses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
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
                {taxGroups.map((group) => (
                  <tr key={group.id} className={group.actif ? '' : 'opacity-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {group.nom}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {group.taxes.map((gt, index) => (
                          <span key={gt.taxId} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {index + 1}. {gt.tax.nom} ({gt.tax.valeur}{gt.tax.type === 'percentage' ? '%' : ' TND'})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {group.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleGroupActive(group.id)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          group.actif 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {group.actif ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
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
          )}
        </div>
      )}

      {/* Individual Taxes Tab */}
      {activeTab === 'taxes' && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {taxes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucune taxe configurée. Cliquez sur "Nouvelle taxe" pour commencer.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ordre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valeur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base de calcul
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Standard
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taxes.map((tax, index) => (
                  <tr key={tax.id} className={tax.actif ? '' : 'opacity-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-1">
                        <span>{tax.ordre}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveOrder(tax.id, 'up')}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveOrder(tax.id, 'down')}
                            disabled={index === taxes.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tax.nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tax.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tax.type === 'percentage' ? `${tax.valeur}%` : `${tax.valeur.toFixed(3)} TND`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tax.calculationBase === 'totalHT' ? 'Total HT' : 'Total HT + taxes précédentes'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {tax.applicableDocuments.map(doc => (
                          <span key={doc} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {documentLabels[doc]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(tax.id)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          tax.actif 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tax.actif ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStandard(tax.id)}
                        className={`p-1 rounded transition-colors ${
                          tax.isStandard 
                            ? 'text-yellow-600 hover:text-yellow-800' 
                            : 'text-gray-400 hover:text-yellow-600'
                        }`}
                        title={tax.isStandard ? 'Taxe standard (auto-appliquée)' : 'Marquer comme taxe standard'}
                      >
                        {tax.isStandard ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(tax)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tax.id)}
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
          )}
        </div>
      )}

      {/* Tax Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTax ? 'Modifier la taxe' : 'Nouvelle taxe'}
              </h2>
              <button 
                onClick={() => {
                  setShowForm(false);
                  setEditingTax(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de la taxe *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Taxe municipale, Timbre fiscal..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de taxe *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="percentage">Pourcentage</option>
                      <option value="fixed">Montant fixe</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valeur *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.valeur}
                        onChange={(e) => setFormData(prev => ({ ...prev, valeur: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        step="0.001"
                        min="0"
                        required
                      />
                      <span className="absolute right-3 top-2 text-gray-500 text-sm">
                        {formData.type === 'percentage' ? '%' : 'TND'}
                      </span>
                    </div>
                  </div>
                </div>

                {formData.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base de calcul *
                    </label>
                    <select
                      value={formData.calculationBase}
                      onChange={(e) => setFormData(prev => ({ ...prev, calculationBase: e.target.value as 'totalHT' | 'totalHTWithPreviousTaxes' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="totalHT">Total HT</option>
                      <option value="totalHTWithPreviousTaxes">Total HT + taxes précédentes</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.calculationBase === 'totalHT' 
                        ? 'La taxe sera calculée sur le montant HT uniquement'
                        : 'La taxe sera calculée sur le montant HT + toutes les taxes précédentes dans l\'ordre'
                      }
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documents applicables *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(documentLabels).map(([key, label]) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableDocuments.includes(key as any)}
                          onChange={() => handleDocumentToggle(key as any)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData(prev => ({ ...prev, actif: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Taxe active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTax(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Group Form Modal */}
      {showGroupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingGroup ? 'Modifier le groupe de taxes' : 'Nouveau groupe de taxes'}
              </h2>
              <button 
                onClick={() => {
                  setShowGroupForm(false);
                  setEditingGroup(null);
                  resetGroupForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleGroupSubmit} className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom du groupe *
                    </label>
                    <input
                      type="text"
                      value={groupFormData.nom}
                      onChange={(e) => setGroupFormData(prev => ({ ...prev, nom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Fodec + TVA, TVA Standard..."
                      required
                    />
                  </div>
                  <div>
                    <label className="flex items-center mt-6">
                      <input
                        type="checkbox"
                        checked={groupFormData.actif}
                        onChange={(e) => setGroupFormData(prev => ({ ...prev, actif: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Groupe actif</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Description du groupe de taxes..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Taxes à inclure dans le groupe *
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {taxes.filter(t => t.actif).length === 0 ? (
                      <p className="text-gray-500 text-sm">Aucune taxe active disponible. Créez d'abord des taxes individuelles.</p>
                    ) : (
                      <div className="space-y-2">
                        {taxes.filter(t => t.actif).map((tax, index) => (
                          <label key={tax.id} className="flex items-center p-2 hover:bg-white rounded border">
                            <input
                              type="checkbox"
                              checked={groupFormData.selectedTaxes.includes(tax.id)}
                              onChange={() => handleTaxToggleInGroup(tax.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900">{tax.nom}</span>
                                <span className="text-sm text-gray-500">
                                  {tax.type === 'percentage' ? `${tax.valeur}%` : `${tax.valeur.toFixed(3)} TND`}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Base: {tax.calculationBase === 'totalHT' ? 'Total HT' : 'Total HT + taxes précédentes'}
                              </div>
                            </div>
                            {groupFormData.selectedTaxes.includes(tax.id) && (
                              <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                #{groupFormData.selectedTaxes.indexOf(tax.id) + 1}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {groupFormData.selectedTaxes.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-2">Ordre d'application des taxes:</p>
                      <div className="flex flex-wrap gap-2">
                        {groupFormData.selectedTaxes.map((taxId, index) => {
                          const tax = taxes.find(t => t.id === taxId);
                          return (
                            <span key={taxId} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {index + 1}. {tax?.nom} ({tax?.valeur}{tax?.type === 'percentage' ? '%' : ' TND'})
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-xs text-blue-700 mt-2">
                        Les taxes seront appliquées dans cet ordre. L'ordre peut être modifié en décochant et recochant les taxes.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupForm(false);
                    setEditingGroup(null);
                    resetGroupForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer le groupe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxConfiguration;