/**
 * Electron Integration Helper
 * 
 * This file provides utilities for Electron integration.
 * It's designed to be included when running in Electron environment.
 */

/**
 * Example preload script content for Electron
 * 
 * This would go in your preload.js file when setting up Electron:
 * 
 * const { contextBridge, ipcRenderer } = require('electron');
 * 
 * contextBridge.exposeInMainWorld('electronAPI', {
 *   send: (channel, data) => {
 *     const validChannels = ['ping', 'message'];
 *     if (validChannels.includes(channel)) {
 *       ipcRenderer.send(channel, data);
 *     }
 *   },
 *   
 *   onPong: (callback) => {
 *     ipcRenderer.on('pong', (event, data) => callback(data));
 *   },
 *   
 *   ping: (data) => {
 *     return ipcRenderer.invoke('ping', data);
 *   },
 *   
 *   getAppVersion: () => {
 *     return ipcRenderer.invoke('get-app-version');
 *   }
 * });
 */

/**
 * Example main process handlers for Electron
 * 
 * This would go in your main.js file:
 * 
 * const { app, BrowserWindow, ipcMain } = require('electron');
 * 
 * // Handle ping messages
 * ipcMain.on('ping', (event, data) => {
 *   console.log('Received ping:', data);
 *   
 *   // Send response back
 *   event.reply('pong', {
 *     message: 'Pong from main process!',
 *     timestamp: new Date().toISOString(),
 *     originalData: data
 *   });
 * });
 * 
 * // Handle async ping
 * ipcMain.handle('ping', async (event, data) => {
 *   console.log('Received async ping:', data);
 *   
 *   return {
 *     message: 'Async pong from main process!',
 *     timestamp: new Date().toISOString(),
 *     originalData: data
 *   };
 * });
 * 
 * // Get app version
 * ipcMain.handle('get-app-version', () => {
 *   return app.getVersion();
 * });
 */

// Utility functions for Electron integration
const ElectronIntegration = {
  /**
   * Check if running in Electron with comprehensive detection
   */
  isElectron() {
    // Method 1: Check for exposed electronAPI
    if (typeof window !== 'undefined' && window.electronAPI) {
      return true;
    }

    // Method 2: Check user agent
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('electron')) {
        return true;
      }
    }

    // Method 3: Check for Node.js process (if exposed)
    if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
      return true;
    }

    // Method 4: Check for Electron-specific globals
    if (typeof window !== 'undefined' && window.require) {
      try {
        window.require('electron');
        return true;
      } catch (e) {
        // Not in Electron or contextIsolation is enabled
      }
    }

    return false;
  },

  /**
   * Get Electron API safely
   */
  getElectronAPI() {
    if (this.isElectron() && typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI;
    }
    return null;
  },

  /**
   * Send IPC message safely
   */
  sendIPC(channel, data) {
    const api = this.getElectronAPI();
    if (api && api.send) {
      api.send(channel, data);
      return true;
    }
    return false;
  },

  /**
   * Invoke IPC method safely
   */
  async invokeIPC(channel, data) {
    const api = this.getElectronAPI();
    if (api && api.invoke) {
      return await api.invoke(channel, data);
    }
    throw new Error('Electron IPC not available');
  },

  /**
   * Setup IPC listeners safely
   */
  onIPC(channel, callback) {
    const api = this.getElectronAPI();
    if (api && api.on) {
      api.on(channel, callback);
      return true;
    }
    return false;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ElectronIntegration = ElectronIntegration;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElectronIntegration;
}