import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';

interface PasswordProtectionProps {
  isOpen: boolean;
  onUnlock: () => void;
}

const PasswordProtection: React.FC<PasswordProtectionProps> = ({ isOpen, onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const { query, isReady } = useDatabase();

  useEffect(() => {
    if (attempts >= 3) {
      setIsLocked(true);
      setTimeout(() => {
        setIsLocked(false);
        setAttempts(0);
      }, 30000); // Lock for 30 seconds after 3 failed attempts
    }
  }, [attempts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setError('Trop de tentatives. Veuillez attendre 30 secondes.');
      return;
    }

    if (!password.trim()) {
      setError('Veuillez entrer le mot de passe');
      return;
    }

    try {
      // Check master password first
      if (password === 'TOPPACK') {
        onUnlock();
        return;
      }

      // Check user-defined password
      if (isReady && query) {
        const result = await query('SELECT value FROM settings WHERE key = ?', ['appPassword']);
        if (result.length > 0) {
          const savedPassword = result[0].value;
          if (password === savedPassword) {
            onUnlock();
            return;
          }
        }
      } else {
        // For web version, check localStorage
        const savedPassword = localStorage.getItem('appPassword');
        if (savedPassword && password === savedPassword) {
          onUnlock();
          return;
        }
      }

      // If we get here, password is incorrect
      setError('Mot de passe incorrect');
      setAttempts(prev => prev + 1);
      setPassword('');
    } catch (error) {
      console.error('Error checking password:', error);
      setError('Erreur lors de la vérification du mot de passe');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Protégée</h2>
          <p className="text-gray-600">Veuillez entrer le mot de passe pour accéder à Facturation Pro</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 ${
                  error ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Entrez votre mot de passe"
                disabled={isLocked}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLocked}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            {attempts > 0 && attempts < 3 && (
              <p className="mt-2 text-sm text-orange-600">
                Tentative {attempts}/3. {3 - attempts} essai(s) restant(s).
              </p>
            )}
            {isLocked && (
              <p className="mt-2 text-sm text-red-600">
                Compte temporairement verrouillé. Veuillez attendre 30 secondes.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLocked || !password.trim()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLocked ? 'Verrouillé...' : 'Déverrouiller'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800 font-medium">Information de sécurité</p>
              <p className="text-xs text-blue-700 mt-1">
                Votre mot de passe protège l'accès à toutes vos données commerciales. 
                Après 3 tentatives incorrectes, l'accès sera temporairement bloqué.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordProtection;