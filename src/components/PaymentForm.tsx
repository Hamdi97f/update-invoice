import React, { useState, useEffect } from 'react';
import { X, Save, Search, CreditCard, FileText, User, Calculator } from 'lucide-react';
import { Payment, Facture, Client } from '../types';
import { formatCurrency } from '../utils/currency';
import { useDatabase } from '../hooks/useDatabase';
import { v4 as uuidv4 } from 'uuid';

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: Payment) => void;
  payment?: Payment | null;
  preselectedFacture?: Facture | null;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  payment, 
  preselectedFacture 
}) => {
  const [formData, setFormData] = useState({
    factureId: '',
    montant: 0,
    date: new Date().toISOString().split('T')[0],
    methode: 'virement' as 'especes' | 'cheque' | 'virement' | 'carte' | 'autre',
    reference: '',
    notes: '',
    statut: 'valide' as 'valide' | 'en_attente' | 'annule'
  });

  const [factures, setFactures] = useState<Facture[]>([]);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [factureSearchTerm, setFactureSearchTerm] = useState('');
  const [showFactureDropdown, setShowFactureDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(true);

  const { query, isElectron, isReady } = useDatabase();

  useEffect(() => {
    if (isOpen && isReady) {
      loadFactures();
      
      if (payment) {
        // Editing existing payment
        setFormData({
          factureId: payment.factureId,
          montant: payment.montant,
          date: payment.date.toISOString().split('T')[0],
          methode: payment.methode,
          reference: payment.reference || '',
          notes: payment.notes || '',
          statut: payment.statut
        });
        setFactureSearchTerm(payment.factureNumero);
        setSearchEnabled(false);
        // Load the selected facture details
        loadSelectedFacture(payment.factureId);
      } else if (preselectedFacture) {
        // New payment with preselected facture
        setFormData({
          factureId: preselectedFacture.id,
          montant: preselectedFacture.totalTTC,
          date: new Date().toISOString().split('T')[0],
          methode: 'virement',
          reference: '',
          notes: '',
          statut: 'valide'
        });
        setSelectedFacture(preselectedFacture);
        setFactureSearchTerm(preselectedFacture.numero);
        setSearchEnabled(false);
      } else {
        // New payment without preselection
        resetForm();
        setSearchEnabled(true);
      }
    }
  }, [isOpen, payment, preselectedFacture, isReady]);

  const resetForm = () => {
    setFormData({
      factureId: '',
      montant: 0,
      date: new Date().toISOString().split('T')[0],
      methode: 'virement',
      reference: '',
      notes: '',
      statut: 'valide'
    });
    setSelectedFacture(null);
    setFactureSearchTerm('');
    setShowFactureDropdown(false);
    setSearchEnabled(true);
  };

  const loadFactures = async () => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query(`
          SELECT f.*, c.code as clientCode, c.nom as clientNom, c.adresse, c.codePostal, c.ville, c.telephone, c.email
          FROM factures f
          JOIN clients c ON f.clientId = c.id
          WHERE f.statut IN ('envoyee', 'brouillon')
          ORDER BY f.date DESC
        `);

        const facturesData = result.map((f: any) => ({
          ...f,
          date: new Date(f.date),
          dateEcheance: new Date(f.dateEcheance),
          taxes: [],
          totalTaxes: 0,
          lignes: [],
          client: {
            id: f.clientId,
            code: f.clientCode,
            nom: f.clientNom,
            adresse: f.adresse,
            codePostal: f.codePostal,
            ville: f.ville,
            telephone: f.telephone,
            email: f.email
          }
        }));
        setFactures(facturesData);
      } else {
        const savedFactures = localStorage.getItem('factures');
        if (savedFactures) {
          const parsedFactures = JSON.parse(savedFactures)
            .map((f: any) => ({
              ...f,
              date: new Date(f.date),
              dateEcheance: new Date(f.dateEcheance)
            }))
            .filter((f: Facture) => f.statut === 'envoyee' || f.statut === 'brouillon');
          setFactures(parsedFactures);
        }
      }
    } catch (error) {
      console.error('Error loading factures:', error);
    }
  };

  const loadSelectedFacture = async (factureId: string) => {
    if (!isReady) return;
    
    try {
      if (isElectron) {
        const result = await query(`
          SELECT f.*, c.code as clientCode, c.nom as clientNom, c.adresse, c.codePostal, c.ville, c.telephone, c.email
          FROM factures f
          JOIN clients c ON f.clientId = c.id
          WHERE f.id = ?
        `, [factureId]);
        
        if (result && result.length > 0) {
          const factureData = {
            ...result[0],
            date: new Date(result[0].date),
            dateEcheance: new Date(result[0].dateEcheance),
            taxes: [],
            totalTaxes: 0,
            lignes: [],
            client: {
              id: result[0].clientId,
              code: result[0].clientCode,
              nom: result[0].clientNom,
              adresse: result[0].adresse,
              codePostal: result[0].codePostal,
              ville: result[0].ville,
              telephone: result[0].telephone,
              email: result[0].email
            }
          };
          setSelectedFacture(factureData);
        }
      } else {
        const facture = factures.find(f => f.id === factureId);
        if (facture) {
          setSelectedFacture(facture);
        }
      }
    } catch (error) {
      console.error('Error loading selected facture:', error);
    }
  };

  // Filter factures based on search term
  const filteredFactures = factures.filter(facture =>
    facture.numero.toLowerCase().includes(factureSearchTerm.toLowerCase()) ||
    facture.client.nom.toLowerCase().includes(factureSearchTerm.toLowerCase()) ||
    facture.client.code.toLowerCase().includes(factureSearchTerm.toLowerCase())
  );

  const handleFactureSearch = (value: string) => {
    setFactureSearchTerm(value);
    setShowFactureDropdown(true);
    if (!value.trim()) {
      setSelectedFacture(null);
      setFormData(prev => ({ ...prev, factureId: '', montant: 0 }));
    }
  };

  const handleFactureSelect = (facture: Facture) => {
    setSelectedFacture(facture);
    setFactureSearchTerm(facture.numero);
    setFormData(prev => ({ 
      ...prev, 
      factureId: facture.id,
      montant: facture.totalTTC // Default to full amount
    }));
    setShowFactureDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || !isReady) return;
    
    if (!selectedFacture) {
      alert('Veuillez sélectionner une facture');
      return;
    }

    if (formData.montant <= 0) {
      alert('Le montant doit être supérieur à 0');
      return;
    }

    if (formData.montant > selectedFacture.totalTTC) {
      alert('Le montant ne peut pas être supérieur au montant de la facture');
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentData: Payment = {
        id: payment?.id || uuidv4(),
        factureId: selectedFacture.id,
        factureNumero: selectedFacture.numero,
        clientId: selectedFacture.client.id,
        clientNom: selectedFacture.client.nom,
        montant: formData.montant,
        montantFacture: selectedFacture.totalTTC,
        date: new Date(formData.date),
        methode: formData.methode,
        reference: formData.reference.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        statut: formData.statut
      };

      // Save payment to database
      if (isElectron) {
        await query(
          `INSERT OR REPLACE INTO payments 
           (id, factureId, factureNumero, clientId, clientNom, montant, montantFacture, date, methode, reference, notes, statut)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentData.id,
            paymentData.factureId,
            paymentData.factureNumero,
            paymentData.clientId,
            paymentData.clientNom,
            paymentData.montant,
            paymentData.montantFacture,
            paymentData.date.toISOString(),
            paymentData.methode,
            paymentData.reference || null,
            paymentData.notes || null,
            paymentData.statut
          ]
        );

        // Update facture status if fully paid
        if (paymentData.montant >= paymentData.montantFacture && paymentData.statut === 'valide') {
          await query('UPDATE factures SET statut = ? WHERE id = ?', ['payee', paymentData.factureId]);
        }
      } else {
        // Save to localStorage for web version
        const existingPayments = JSON.parse(localStorage.getItem('payments') || '[]');
        const updatedPayments = payment 
          ? existingPayments.map((p: Payment) => p.id === paymentData.id ? paymentData : p)
          : [...existingPayments, paymentData];
        localStorage.setItem('payments', JSON.stringify(updatedPayments));

        // Update facture status in localStorage
        if (paymentData.montant >= paymentData.montantFacture && paymentData.statut === 'valide') {
          const existingFactures = JSON.parse(localStorage.getItem('factures') || '[]');
          const updatedFactures = existingFactures.map((f: Facture) => 
            f.id === paymentData.factureId ? { ...f, statut: 'payee' } : f
          );
          localStorage.setItem('factures', JSON.stringify(updatedFactures));
        }
      }

      onSave(paymentData);
      resetForm();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Erreur lors de la sauvegarde du paiement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getMethodLabel = (methode: string) => {
    switch (methode) {
      case 'especes': return 'Espèces';
      case 'cheque': return 'Chèque';
      case 'virement': return 'Virement bancaire';
      case 'carte': return 'Carte bancaire';
      case 'autre': return 'Autre';
      default: return methode;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <CreditCard className="w-6 h-6 mr-2 text-green-600" />
            {payment ? 'Modifier le paiement' : 'Nouveau paiement'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Facture Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Facture à payer *
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={factureSearchTerm}
                    onChange={(e) => handleFactureSearch(e.target.value)}
                    onFocus={() => setShowFactureDropdown(true)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Rechercher une facture..."
                    disabled={isSubmitting || !searchEnabled}
                    required
                  />
                </div>
                
                {showFactureDropdown && factureSearchTerm && searchEnabled && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredFactures.length > 0 ? (
                      filteredFactures.map(facture => (
                        <button
                          key={facture.id}
                          type="button"
                          onClick={() => handleFactureSelect(facture)}
                          className="w-full px-4 py-3 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{facture.numero}</div>
                              <div className="text-sm text-gray-600">{facture.client.nom}</div>
                              <div className="text-xs text-gray-500">
                                Échéance: {facture.dateEcheance.toLocaleDateString('fr-FR')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-green-600">
                                {formatCurrency(facture.totalTTC)}
                              </div>
                              <div className={`text-xs ${
                                facture.dateEcheance < new Date() ? 'text-red-500' : 'text-gray-500'
                              }`}>
                                {facture.dateEcheance < new Date() ? 'En retard' : 'À échoir'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        Aucune facture trouvée
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Facture Details */}
            {selectedFacture && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <h4 className="font-medium text-green-900">{selectedFacture.numero}</h4>
                      <p className="text-sm text-green-700">
                        <User className="w-4 h-4 inline mr-1" />
                        {selectedFacture.client.nom}
                      </p>
                      <p className="text-xs text-green-600">
                        Échéance: {selectedFacture.dateEcheance.toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-700">
                      {formatCurrency(selectedFacture.totalTTC)}
                    </div>
                    <div className="text-xs text-green-600">Montant total</div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant du paiement *
                </label>
                <div className="relative">
                  <Calculator className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={formData.montant}
                    onChange={(e) => handleChange('montant', parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    step="0.001"
                    min="0"
                    max={selectedFacture?.totalTTC}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                {selectedFacture && formData.montant > 0 && formData.montant < selectedFacture.totalTTC && (
                  <p className="text-xs text-orange-600 mt-1">
                    Paiement partiel ({Math.round((formData.montant / selectedFacture.totalTTC) * 100)}%)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date du paiement *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Méthode de paiement *
                </label>
                <select
                  value={formData.methode}
                  onChange={(e) => handleChange('methode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                >
                  <option value="virement">Virement bancaire</option>
                  <option value="cheque">Chèque</option>
                  <option value="especes">Espèces</option>
                  <option value="carte">Carte bancaire</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={formData.statut}
                  onChange={(e) => handleChange('statut', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="valide">Validé</option>
                  <option value="en_attente">En attente</option>
                  <option value="annule">Annulé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Référence de paiement
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => handleChange('reference', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Numéro de chèque, référence virement, etc."
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Notes additionnelles..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !isReady || !selectedFacture}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </button>
          </div>
        </form>
      </div>

      {/* Click outside to close dropdown */}
      {showFactureDropdown && (
        <div 
          className="fixed inset-0 z-5"
          onClick={() => setShowFactureDropdown(false)}
        />
      )}
    </div>
  );
};

export default PaymentForm;