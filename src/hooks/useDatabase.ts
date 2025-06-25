import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    electronAPI: {
      dbQuery: (query: string, params?: any[]) => Promise<any>;
      getFactures: () => Promise<any[]>;
      trackStockMovement: (movement: any) => Promise<{ success: boolean; error?: string; currentStock?: number }>;
      savePDF: (pdfData: Uint8Array, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      checkForUpdates: () => Promise<{ updateAvailable: boolean; version?: string }>;
      getAppVersion: () => Promise<string>;
      backupDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      restoreDatabase: () => Promise<{ success: boolean; error?: string }>;
      activateApp: (activationCode: string) => Promise<{ success: boolean; error?: string }>;
      checkActivation: () => Promise<{ activated: boolean }>;
      quitApp: () => void;
    };
  }
}

export function useDatabase() {
  const [isElectron, setIsElectron] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [pendingQueries, setPendingQueries] = useState(0);

  useEffect(() => {
    // Check if Electron API is available
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true);
      
      // Check activation status
      window.electronAPI.checkActivation()
        .then(result => {
          setIsActivated(result.activated);
          setIsReady(true);
          setDbError(null);
        })
        .catch(err => {
          console.error('Error checking activation:', err);
          setDbError('Erreur lors de la vérification de l\'activation');
          setIsReady(false);
        });
    } else {
      // If not available, this is running in a web browser
      console.error('Electron API not available. This application is designed to run as a desktop application.');
      setIsElectron(false);
      setIsReady(false);
      setDbError('API Electron non disponible. Cette application doit être exécutée en mode bureau.');
    }
  }, []);

  const query = useCallback(async (sql: string, params: any[] = []) => {
    if (!window.electronAPI) {
      throw new Error('Database not available. This application must run in its desktop environment.');
    }
    
    try {
      setPendingQueries(prev => prev + 1);
      
      // Add a small delay to prevent UI blocking
      if (sql.toLowerCase().includes('insert') || sql.toLowerCase().includes('update') || sql.toLowerCase().includes('delete')) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const result = await window.electronAPI.dbQuery(sql, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      setPendingQueries(prev => Math.max(0, prev - 1));
    }
  }, []);

  const getFactures = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Database not available. This application must run in its desktop environment.');
    }
    
    try {
      setPendingQueries(prev => prev + 1);
      
      // Add a small delay to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));
      
      return await window.electronAPI.getFactures();
    } catch (error) {
      console.error('Error getting factures:', error);
      throw error;
    } finally {
      setPendingQueries(prev => Math.max(0, prev - 1));
    }
  }, []);

  const trackStockMovement = useCallback(async (movement: any) => {
    if (!window.electronAPI) {
      throw new Error('Database not available. This application must run in its desktop environment.');
    }
    
    try {
      setPendingQueries(prev => prev + 1);
      return await window.electronAPI.trackStockMovement(movement);
    } catch (error) {
      console.error('Error tracking stock movement:', error);
      throw error;
    } finally {
      setPendingQueries(prev => Math.max(0, prev - 1));
    }
  }, []);

  const savePDF = useCallback(async (pdfData: Uint8Array, filename: string) => {
    if (!window.electronAPI) {
      throw new Error('PDF save not available. This application must run in its desktop environment.');
    }
    
    try {
      return await window.electronAPI.savePDF(pdfData, filename);
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw error;
    }
  }, []);

  const backupDatabase = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Database backup not available. This application must run in its desktop environment.');
    }
    
    try {
      return await window.electronAPI.backupDatabase();
    } catch (error) {
      console.error('Error backing up database:', error);
      throw error;
    }
  }, []);

  const restoreDatabase = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Database restore not available. This application must run in its desktop environment.');
    }
    
    try {
      return await window.electronAPI.restoreDatabase();
    } catch (error) {
      console.error('Error restoring database:', error);
      throw error;
    }
  }, []);

  const activateApp = useCallback(async (activationCode: string) => {
    if (!window.electronAPI) {
      throw new Error('Activation not available. This application must run in its desktop environment.');
    }
    
    try {
      return await window.electronAPI.activateApp(activationCode);
    } catch (error) {
      console.error('Error activating app:', error);
      throw error;
    }
  }, []);

  const checkActivation = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Activation check not available. This application must run in its desktop environment.');
    }
    
    try {
      const result = await window.electronAPI.checkActivation();
      setIsActivated(result.activated);
      return result;
    } catch (error) {
      console.error('Error checking activation:', error);
      throw error;
    }
  }, []);

  const quitApp = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.quitApp();
    }
  }, []);

  return {
    isElectron,
    isReady,
    isActivated,
    dbError,
    isBusy: pendingQueries > 0,
    query,
    getFactures,
    trackStockMovement,
    savePDF,
    backupDatabase,
    restoreDatabase,
    activateApp,
    checkActivation,
    quitApp
  };
}