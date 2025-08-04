/**
 * Hybrid Electron/Browser Application
 * 
 * This application can run in both browser and Electron environments.
 * It automatically detects the environment and adapts its behavior accordingly.
 */

class HybridApp {
  constructor() {
    this.isElectron = false;
    this.electronAPI = null;
    this.logContainer = null;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Setup the application after DOM is ready
   */
  setup() {
    this.logContainer = document.getElementById('log-container');
    
    // Detect environment
    this.detectEnvironment();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI based on environment
    this.updateUI();
    
    this.log('Application initialized successfully');
  }

  /**
   * Safely detect if we're running in Electron
   */
  detectEnvironment() {
    try {
      // Method 1: Check for Electron-specific APIs
      this.isElectron = !!(
        typeof window !== 'undefined' && 
        window.electronAPI && 
        typeof window.electronAPI === 'object'
      );

      if (this.isElectron) {
        this.electronAPI = window.electronAPI;
        this.log('Electron environment detected');
        this.log('Available Electron APIs:', Object.keys(this.electronAPI));
      } else {
        // Method 2: Alternative detection methods (for future compatibility)
        const userAgent = navigator.userAgent.toLowerCase();
        const hasElectronUserAgent = userAgent.includes('electron');
        
        // Method 3: Check for Node.js process (if exposed)
        const hasNodeProcess = typeof process !== 'undefined' && 
                              process.versions && 
                              process.versions.electron;

        if (hasElectronUserAgent || hasNodeProcess) {
          this.log('Electron detected via alternative method, but APIs not available');
        } else {
          this.log('Browser environment detected');
        }
      }
    } catch (error) {
      this.log('Error during environment detection:', error.message);
      this.isElectron = false;
    }
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    const pingButton = document.getElementById('ping-button');
    const clearLogButton = document.getElementById('clear-log');

    if (pingButton) {
      pingButton.addEventListener('click', () => this.handlePingClick());
    }

    if (clearLogButton) {
      clearLogButton.addEventListener('click', () => this.clearLog());
    }

    // Listen for Electron responses (if available)
    if (this.isElectron && this.electronAPI.onPong) {
      this.electronAPI.onPong((message) => {
        this.log('Received pong from Electron main process:', message);
      });
    }
  }

  /**
   * Update UI based on detected environment
   */
  updateUI() {
    const statusElement = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const pingButton = document.getElementById('ping-button');

    if (this.isElectron) {
      statusElement.className = 'status-indicator electron';
      statusText.textContent = 'Running in Electron';
      pingButton.textContent = 'Send IPC Message';
    } else {
      statusElement.className = 'status-indicator browser';
      statusText.textContent = 'Running in Browser';
      pingButton.textContent = 'Test Browser Mode';
    }
  }

  /**
   * Handle ping button click
   */
  async handlePingClick() {
    if (this.isElectron) {
      this.handleElectronPing();
    } else {
      this.handleBrowserPing();
    }
  }

  /**
   * Handle ping in Electron environment
   */
  handleElectronPing() {
    try {
      this.log('Sending ping message via IPC...');
      
      // Send message to Electron main process
      if (this.electronAPI.send) {
        this.electronAPI.send('ping', { 
          timestamp: new Date().toISOString(),
          message: 'Hello from renderer process!'
        });
        this.log('IPC message sent successfully');
      } else if (this.electronAPI.ping) {
        // Alternative API structure
        this.electronAPI.ping({ 
          timestamp: new Date().toISOString(),
          message: 'Hello from renderer process!'
        });
        this.log('Ping sent via electronAPI.ping()');
      } else {
        this.log('No ping method available in electronAPI');
      }
    } catch (error) {
      this.log('Error sending IPC message:', error.message);
    }
  }

  /**
   * Handle ping in browser environment
   */
  handleBrowserPing() {
    this.log('Running in web mode - simulating Electron behavior');
    
    // Simulate some async operation
    setTimeout(() => {
      this.log('Simulated response: Pong! (Browser mode)');
      this.log('In Electron, this would be an IPC response');
    }, 500);

    // Demonstrate browser-specific features
    this.demonstrateBrowserFeatures();
  }

  /**
   * Demonstrate browser-specific features
   */
  demonstrateBrowserFeatures() {
    // Local storage
    try {
      localStorage.setItem('hybrid-app-test', new Date().toISOString());
      this.log('Browser feature: localStorage working');
    } catch (error) {
      this.log('Browser feature: localStorage not available');
    }

    // Fetch API
    if (typeof fetch !== 'undefined') {
      this.log('Browser feature: Fetch API available');
    }

    // Service Worker support
    if ('serviceWorker' in navigator) {
      this.log('Browser feature: Service Worker support detected');
    }
  }

  /**
   * Add a log entry to the console display
   */
  log(...args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    // Console log for debugging
    console.log(`[${timestamp}]`, ...args);

    // Visual log in the UI
    if (this.logContainer) {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      logEntry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span>${message}</span>
      `;
      
      this.logContainer.appendChild(logEntry);
      
      // Auto-scroll to bottom
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
      
      // Limit log entries to prevent memory issues
      const entries = this.logContainer.querySelectorAll('.log-entry');
      if (entries.length > 50) {
        entries[0].remove();
      }
    }
  }

  /**
   * Clear the log display
   */
  clearLog() {
    if (this.logContainer) {
      // Keep only the first entry (initialization message)
      const entries = this.logContainer.querySelectorAll('.log-entry');
      for (let i = 1; i < entries.length; i++) {
        entries[i].remove();
      }
    }
    this.log('Log cleared');
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    return {
      isElectron: this.isElectron,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      electronAPI: this.isElectron ? Object.keys(this.electronAPI || {}) : null
    };
  }

  /**
   * Public API for external access
   */
  getAPI() {
    return {
      isElectron: this.isElectron,
      electronAPI: this.electronAPI,
      log: (...args) => this.log(...args),
      getEnvironmentInfo: () => this.getEnvironmentInfo()
    };
  }
}

// Global app instance
let app;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app = new HybridApp();
    
    // Make app globally accessible for debugging
    window.hybridApp = app.getAPI();
  });
} else {
  app = new HybridApp();
  window.hybridApp = app.getAPI();
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridApp;
}