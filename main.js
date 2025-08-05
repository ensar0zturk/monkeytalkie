const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

// Uygulama bilgileri - MonkeyTalkie
app.setName('MonkeyTalkie');
app.setVersion('1.0.4'); // 1.0.0 → 1.0.4 olarak güncelle

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'MonkeyTalkie v1.0.4', // Title güncelle
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
        menuBarVisible: false,
        icon: path.join(__dirname, 'assets/icon.ico'),
        show: false,
        titleBarStyle: 'default',
        frame: true,
        backgroundColor: '#1a1a2e'
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

    // Pencere hazır olduğunda göster
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Pencere kapatıldığında uygulamayı kapat
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault(); // HTML title değişikliğini engelle
        mainWindow.setTitle('MonkeyTalkie v1.0.4');
    });
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
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

console.log('🐵 MonkeyTalkie v1.0.4 başlatıldı - Omgg Ekibinin Monkeylerine Özel!');