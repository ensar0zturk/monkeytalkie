const { app, BrowserWindow, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

// Otomatik güncelleme ayarları
autoUpdater.checkForUpdatesAndNotify();

// Uygulama bilgileri - MonkeyTalkie
app.setName('MonkeyTalkie');
app.setVersion('1.0.0');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'MonkeyTalkie - Omgg Ekibinin Monkeylerine Özel',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
        menuBarVisible: false,
        icon: path.join(__dirname, 'assets/icon.ico'),
        show: false, // Başlangıçta gizli
        titleBarStyle: 'default',
        frame: true,
        backgroundColor: '#1a1a2e' // MonkeyTalkie teması
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

    // Development sırasında DevTools açmak için (isteğe bağlı)
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    // 3 saniye sonra güncelleme kontrolü
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 3000);

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

// Otomatik güncelleme event'leri
autoUpdater.on('checking-for-update', () => {
    console.log('MonkeyTalkie güncelleme kontrol ediliyor...');
});

autoUpdater.on('update-available', (info) => {
    console.log('MonkeyTalkie güncelleme mevcut:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('MonkeyTalkie güncel');
});

autoUpdater.on('error', (err) => {
    console.log('MonkeyTalkie güncelleme hatası:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = `MonkeyTalkie indiriliyor ${Math.round(progressObj.percent)}%`;
    console.log(log_message);
    if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('MonkeyTalkie güncelleme indirildi, yeniden başlatılacak...');
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
    // 5 saniye sonra yeniden başlat
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 5000);
});