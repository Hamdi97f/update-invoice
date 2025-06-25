const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: async (query, params) => {
    try {
      return await ipcRenderer.invoke('db-query', query, params);
    } catch (error) {
      console.error('Error in dbQuery:', error);
      throw error;
    }
  },
  getFactures: async () => {
    try {
      return await ipcRenderer.invoke('get-factures');
    } catch (error) {
      console.error('Error in getFactures:', error);
      throw error;
    }
  },
  trackStockMovement: async (movement) => {
    try {
      return await ipcRenderer.invoke('track-stock-movement', movement);
    } catch (error) {
      console.error('Error in trackStockMovement:', error);
      throw error;
    }
  },
  savePDF: async (pdfData, filename) => {
    try {
      return await ipcRenderer.invoke('save-pdf', pdfData, filename);
    } catch (error) {
      console.error('Error in savePDF:', error);
      throw error;
    }
  },
  // Add methods for checking for updates manually
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // Add methods for database backup and restore
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  // Add methods for activation
  activateApp: (activationCode) => ipcRenderer.invoke('activate-app', activationCode),
  checkActivation: () => ipcRenderer.invoke('check-activation'),
  quitApp: () => ipcRenderer.invoke('quit-app')
});