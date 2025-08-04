# Electron Setup Guide

This guide shows how to integrate the hybrid app with Electron.

## Quick Setup

### 1. Install Electron
```bash
npm init -y
npm install --save-dev electron
```

### 2. Create main.js
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  return mainWindow;
}

// IPC Handlers
ipcMain.on('ping', (event, data) => {
  console.log('📨 Received ping:', data);
  
  // Send response back
  event.reply('pong', {
    message: 'Pong from Electron main process! 🏓',
    timestamp: new Date().toISOString(),
    originalData: data,
    processId: process.pid
  });
});

ipcMain.handle('ping', async (event, data) => {
  console.log('📨 Received async ping:', data);
  
  // Simulate some async work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    message: 'Async pong from Electron main process! ⚡',
    timestamp: new Date().toISOString(),
    originalData: data,
    processId: process.pid,
    electronVersion: process.versions.electron
  };
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-system-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome
  };
});

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### 3. Create preload.js
```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  send: (channel, data) => {
    const validChannels = ['ping', 'message', 'log'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn('Invalid IPC channel:', channel);
    }
  },

  // Listen for messages from main process
  onPong: (callback) => {
    ipcRenderer.on('pong', (event, data) => callback(data));
  },

  // Invoke methods (async)
  ping: (data) => {
    return ipcRenderer.invoke('ping', data);
  },

  invoke: (channel, data) => {
    const validChannels = ['ping', 'get-app-version', 'get-system-info'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    } else {
      return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
    }
  },

  // Utility methods
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },

  getSystemInfo: () => {
    return ipcRenderer.invoke('get-system-info');
  }
});

// Log that preload script loaded
console.log('🔧 Preload script loaded');
```

### 4. Update package.json
```json
{
  "name": "hybrid-electron-app",
  "version": "1.0.0",
  "description": "Hybrid app that runs in browser and Electron",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "NODE_ENV=development electron .",
    "build": "electron-builder",
    "pack": "electron-builder --dir"
  },
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  }
}
```

## Advanced Features

### Adding File System Access
In `preload.js`:
```javascript
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...
  
  readFile: async (filePath) => {
    return await fs.promises.readFile(filePath, 'utf8');
  },
  
  writeFile: async (filePath, content) => {
    return await fs.promises.writeFile(filePath, content, 'utf8');
  },
  
  showSaveDialog: () => {
    return ipcRenderer.invoke('show-save-dialog');
  }
});
```

In `main.js`:
```javascript
const { dialog } = require('electron');

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result;
});
```

### Adding Menu Integration
In `main.js`:
```javascript
const { Menu } = require('electron');

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Send Ping',
        click: () => {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) {
            focusedWindow.webContents.send('menu-ping');
          }
        }
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

## 🔒 Security Best Practices

1. **Context Isolation**: Always enabled
2. **Node Integration**: Always disabled
3. **Preload Scripts**: Use for safe API exposure
4. **Channel Validation**: Validate all IPC channels
5. **Minimal API Surface**: Only expose necessary methods

## 🐛 Debugging

### Browser DevTools
- Open browser DevTools to see console logs
- Check `window.hybridApp` for debugging interface

### Electron DevTools
- Use `mainWindow.webContents.openDevTools()` in development
- Check both main process and renderer process logs

### Common Issues
1. **API not available**: Check preload script is loaded
2. **IPC not working**: Verify channel names match
3. **Context isolation**: Ensure using contextBridge properly