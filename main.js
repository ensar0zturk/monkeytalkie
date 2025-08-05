const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

// Auto updater konfigürasyonu
autoUpdater.checkForUpdatesAndNotify();

// Uygulama bilgileri - MonkeyTalkie
app.setName('MonkeyTalkie');
app.setVersion('1.0.4'); // 1.0.0 → 1.0.4 olarak güncelle

// Güncelleme event'leri
autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Güncellemeler kontrol ediliyor...');
});

autoUpdater.on('update-available', (info) => {
    console.log('📥 Güncelleme mevcut:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('✅ Güncel sürüm kullanılıyor:', info.version);
});

autoUpdater.on('error', (err) => {
    console.log('❌ Güncelleme hatası:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "İndirme hızı: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - İndirilen ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);

    if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Güncelleme indirildi:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'MonkeyTalkie v1.0.4 - Omgg Ekibinin Monkeylerine Özel',
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

        // 30 saniye sonra güncelleme kontrol et
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify();
        }, 30000);
    });

    // Pencere kapatıldığında uygulamayı kapat
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // HTML title değişikliğini engelle
    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
        mainWindow.setTitle('MonkeyTalkie v1.0.4 - Omgg Ekibinin Monkeylerine Özel');
    });
}

// IPC event'leri
ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    // 5 dakikada bir güncelleme kontrol et
    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 5 * 60 * 1000);

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