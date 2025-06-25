import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';

interface ActivationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActivationDialog: React.FC<ActivationDialogProps> = ({ isOpen, onClose }) => {
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  
  const { activateApp, quitApp, isReady } = useDatabase();

  useEffect(() => {
    if (isOpen) {
      setActivationCode('');
      setError(null);
      setIsSubmitting(false);
      setIsActivated(false);
    }
  }, [isOpen]);

  const validateAndActivate = async () => {
    setError(null);
    
    // Validate code format (15 digits)
    if (!/^\d{15}$/.test(activationCode)) {
      setError('Le code doit contenir exactement 15 chiffres.');
      return;
    }
    
    // Calculate sum of digits
    const sum = activationCode.split('').reduce((acc, digit) => acc + parseInt(digit), 0);
    
    // Check if sum equals 75
    if (sum !== 75) {
      setError('Code d\'activation invalide.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await activateApp(activationCode);
      if (result.success) {
        setIsActivated(true);
        setTimeout(() => {
          onClose();
          window.location.reload(); // Reload the app to apply activation
        }, 2000);
      } else {
        setError(result.error || 'Erreur d\'activation.');
      }
    } catch (err: any) {
      setError('Erreur lors de l\'activation: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateAndActivate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <Key className="w-6 h-6 mr-2 text-blue-600" />
            Activation de Facturation Pro
          </h2>
          <button 
            onClick={() => quitApp()}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {isActivated ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-green-700 mb-2">Activation réussie!</h3>
              <p className="text-gray-600">Merci d'avoir activé Facturation Pro.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                Veuillez entrer votre code d'activation pour continuer à utiliser Facturation Pro.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code d'activation (15 chiffres)
                  </label>
                  <input
                    type="text"
                    value={activationCode}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setActivationCode(value.substring(0, 15));
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    className={`w-full px-4 py-2 border ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} rounded-md focus:outline-none focus:ring-2 focus:border-transparent`}
                    placeholder=""
                    maxLength={15}
                    disabled={isSubmitting}
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-600">{error}</p>
                  )}
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Le code d'activation vous a été fourni lors de l'achat du logiciel. 
                    Si vous n'avez pas de code, veuillez contacter notre service client.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => quitApp()}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Quitter
                </button>
                <button
                  onClick={validateAndActivate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50"
                  disabled={isSubmitting || activationCode.length !== 15}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Activation...
                    </>
                  ) : (
                    'Activer'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivationDialog;