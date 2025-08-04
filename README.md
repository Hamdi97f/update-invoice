# Hybrid Electron/Browser Application

This is a JavaScript application that runs perfectly in both browser and Electron environments, automatically detecting and adapting to each environment.

## 🌟 Features

- ✅ **Dual Environment Support**: Runs in browser and Electron seamlessly
- ✅ **Automatic Detection**: Safely detects Electron without breaking in browser
- ✅ **Safe API Access**: Uses Electron APIs only when available
- ✅ **No Dependencies**: Pure JavaScript, no external libraries required
- ✅ **Ready for Electron**: Easy to integrate with Electron main/preload processes

## 🚀 Running the Application

### Browser Mode
Simply open `index.html` in any modern web browser. The application will:
- Detect it's running in browser mode
- Show "Running in Browser" status
- Log "Running in web mode" when testing features
- Provide fallback behavior for all Electron-specific features

### Electron Mode
To run in Electron, you'll need to add these files:

#### 1. Create `main.js` (Electron main process):
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

// Handle ping messages
ipcMain.on('ping', (event, data) => {
  console.log('Received ping:', data);
  
  event.reply('pong', {
    message: 'Pong from main process!',
    timestamp: new Date().toISOString(),
    originalData: data
  });
});

// Handle async ping
ipcMain.handle('ping', async (event, data) => {
  console.log('Received async ping:', data);
  
  return {
    message: 'Async pong from main process!',
    timestamp: new Date().toISOString(),
    originalData: data
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

#### 2. Create `preload.js` (Electron preload script):
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    const validChannels = ['ping', 'message'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  onPong: (callback) => {
    ipcRenderer.on('pong', (event, data) => callback(data));
  },
  
  ping: (data) => {
    return ipcRenderer.invoke('ping', data);
  },
  
  invoke: (channel, data) => {
    return ipcRenderer.invoke(channel, data);
  }
});
```

#### 3. Create `package.json` for Electron:
```json
{
  "name": "hybrid-electron-app",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev"
  },
  "devDependencies": {
    "electron": "^latest"
  }
}
```

Then run:
```bash
npm install
npm start
```

## 🏗️ Architecture

### Environment Detection
The app uses multiple detection methods:
1. **Primary**: Check for `window.electronAPI` (exposed via preload script)
2. **Secondary**: Check user agent for 'electron'
3. **Fallback**: Check for Node.js process variables

### Safe API Usage
```javascript
// The app safely checks for Electron APIs before using them
if (this.isElectron && this.electronAPI.send) {
  this.electronAPI.send('ping', data);
} else {
  console.log('Running in web mode');
}
```

### Modular Design
- `js/app.js`: Main application logic
- `js/electron-integration.js`: Electron-specific utilities
- Clean separation between browser and Electron code

## 🔧 Customization

### Adding New Electron Features
1. Add the API to your `preload.js`
2. Update the detection logic in `app.js`
3. Add fallback behavior for browser mode

### Styling
The app uses modern CSS with:
- CSS Grid and Flexbox layouts
- CSS animations and transitions
- Responsive design
- Dark theme console

## 🛡️ Security

- Uses Electron's recommended security practices
- Context isolation enabled
- Node integration disabled
- Safe IPC communication patterns

## 📱 Browser Compatibility

Works in all modern browsers:
- Chrome/Chromium
- Firefox
- Safari
- Edge

No polyfills or transpilation required.