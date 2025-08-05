// =================== TAMAMEN YENİLENMİŞ RENDERER.JS ===================

// --- GLOBAL YAPILANDIRMA ---
const CONFIG = {
    SERVER_URL: 'http://78.135.85.236:3000',
    TYPING_TIMEOUT: 1000,
    NOTIFICATION_DURATION: 3000,
    PROFILE_UPDATE_DELAY: 500
};

// --- ELEMENT YÖNETİCİSİ ---
const elements = {
    // Auth elements
    authContainer: () => document.getElementById('auth-container'),
    appContainer: () => document.getElementById('app-container'),
    authTitle: () => document.getElementById('auth-title'),
    authErrorMessage: () => document.getElementById('auth-error-message'),
    usernameInput: () => document.getElementById('username-input'),
    passwordInput: () => document.getElementById('password-input'),
    authButton: () => document.getElementById('auth-button'),
    toggleAuthLink: () => document.getElementById('toggle-auth'),

    // App elements
    channelsList: () => document.getElementById('channels-list'),
    currentChannelName: () => document.getElementById('current-channel-name'),
    chatMessages: () => document.getElementById('chat-messages'),
    usersInChannelList: () => document.getElementById('users-in-channel-list'),
    userCountSpan: () => document.getElementById('user-count'),
    chatForm: () => document.getElementById('chat-form'),
    chatInputField: () => document.getElementById('chat-input-field'),

    // Profile elements
    profileAvatar: () => document.getElementById('profile-avatar'),
    profileUsername: () => document.getElementById('profile-username'),
    profileMenu: () => document.getElementById('profile-menu'),

    // Avatar selector
    avatarSelector: () => document.getElementById('avatar-selector'),
    avatarGrid: () => document.getElementById('avatar-grid'),
    saveAvatarBtn: () => document.getElementById('save-avatar'),
    cancelAvatarBtn: () => document.getElementById('cancel-avatar'),

    // Channel creation
    newChannelInput: () => document.getElementById('newChannelName'),
    submitChannelBtn: () => document.getElementById('submitChannel'),

    // Voice controls - ÇÖZÜM 3
    micToggleBtn: () => document.getElementById('mic-toggle-btn'),
    deafenToggleBtn: () => document.getElementById('deafen-toggle-btn')
};

// --- DURUM YÖNETİMİ ---
const state = {
    socket: null,
    isRegistering: false,
    authToken: localStorage.getItem('authToken'),
    currentUserUsername: localStorage.getItem('currentUserUsername'),
    currentUserDisplayName: localStorage.getItem('currentUserDisplayName'),
    currentChannelId: null,
    isJoiningChannel: false,
    listenersInitialized: false,
    typingTimeout: null,
    isTyping: false,
    selectedAvatar: null,
    localStream: null,
    peerConnections: {},
    isAudioEnabled: false,
    isDeafened: false, // ÇÖZÜM 3

    reset() {
        this.currentChannelId = null;
        this.isJoiningChannel = false;
        this.isTyping = false;
        this.selectedAvatar = null;
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        Object.values(this.peerConnections).forEach(pc => pc.close());
        this.peerConnections = {};
        this.isAudioEnabled = false;
        this.isDeafened = false;
    },

    clearAuth() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUserUsername');
        localStorage.removeItem('currentUserDisplayName');
        this.authToken = null;
        this.currentUserUsername = null;
        this.currentUserDisplayName = null;
    }
};

// --- AVATAR SİSTEMİ ---
const avatarSystem = {
    AVATARS: ['🐵', '🙈', '🙉', '🙊', '🦍', '🦧', '🐒', '🐴', '🦄', '🐺', '🦊', '🐱', '🐸', '🐢', '🦎', '🐍', '🐲', '🦁'],
    COLORS: ['#8a2be2', '#9966cc', '#ff6b9d', '#00ff88', '#ff4757', '#3742fa', '#2ed573', '#ffa502', '#ff3838', '#18dcff', '#7bed9f', '#70a1ff'],

    getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

    getUserAvatar(username) {
        if (!username) return this.AVATARS[0];
        let avatar = localStorage.getItem(`avatar_${username}`);
        if (!avatar) {
            avatar = this.getRandom(this.AVATARS);
            localStorage.setItem(`avatar_${username}`, avatar);
        }
        return avatar;
    },

    getUserColor(username) {
        if (!username) return this.COLORS[0];
        let color = localStorage.getItem(`color_${username}`);
        if (!color) {
            color = this.getRandom(this.COLORS);
            localStorage.setItem(`color_${username}`, color);
        }
        return color;
    },

    // ÇÖZÜM 1: Avatar güncellemesi - TÜM yerlerde güncelle
    updateAllAvatars(username) {
        const newAvatar = this.getUserAvatar(username);

        // Mesajlardaki avatarları güncelle
        document.querySelectorAll('.message').forEach(messageEl => {
            const usernameEl = messageEl.querySelector('.username');
            const avatarEl = messageEl.querySelector('.message-avatar');
            if (usernameEl && avatarEl &&
                (usernameEl.textContent.includes(username) ||
                    usernameEl.textContent.includes(state.currentUserDisplayName))) {
                avatarEl.textContent = newAvatar;
            }
        });

        // Kullanıcı listesindeki avatarları güncelle
        document.querySelectorAll('.user-list-avatar').forEach(avatarEl => {
            const parentLi = avatarEl.closest('li');
            const usernameSpan = parentLi?.querySelector('span');
            if (usernameSpan &&
                (usernameSpan.textContent.includes(username) ||
                    usernameSpan.textContent.includes(state.currentUserDisplayName))) {
                avatarEl.textContent = newAvatar;
            }
        });

        // Profil avatarını güncelle
        const profileAvatar = elements.profileAvatar();
        if (profileAvatar && username === state.currentUserUsername) {
            profileAvatar.textContent = newAvatar;
        }
    }
};

// --- YARDıMCı FONKSİYONLAR ---
const utils = {
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    formatTime(date = new Date()) {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// --- BİLDİRİM SİSTEMİ ---
const notification = {
    show(message, type = 'info') {
        document.querySelectorAll('.custom-notification').forEach(el => el.remove());

        const colors = {
            info: 'linear-gradient(45deg, #8a2be2, #9966cc)',
            success: 'linear-gradient(45deg, #2ed573, #26de81)',
            error: 'linear-gradient(45deg, #ff4757, #ff3742)',
            warning: 'linear-gradient(45deg, #ffa502, #ff6348)'
        };

        const notificationEl = document.createElement('div');
        notificationEl.className = 'custom-notification';
        notificationEl.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            background: ${colors[type] || colors.info};
            color: white; padding: 16px 24px; border-radius: 12px;
            font-weight: 600; max-width: 320px; word-wrap: break-word;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateX(100%); opacity: 0;
        `;
        notificationEl.textContent = message;
        document.body.appendChild(notificationEl);

        requestAnimationFrame(() => {
            notificationEl.style.transform = 'translateX(0)';
            notificationEl.style.opacity = '1';
        });

        setTimeout(() => {
            notificationEl.style.transform = 'translateX(100%)';
            notificationEl.style.opacity = '0';
            setTimeout(() => notificationEl.remove(), 400);
        }, CONFIG.NOTIFICATION_DURATION);
    }
};

// --- CUSTOM DIALOG SİSTEMİ ---
const customDialog = {
    show(title, message, buttons = []) {
        return new Promise((resolve) => {
            document.querySelectorAll('.custom-dialog').forEach(el => el.remove());

            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; align-items: center;
                justify-content: center; z-index: 10000; animation: fadeIn 0.3s ease;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: rgba(22, 33, 62, 0.95); backdrop-filter: blur(20px);
                padding: 30px; border-radius: 20px; max-width: 450px; margin: 20px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                box-shadow: 0 20px 60px rgba(138, 43, 226, 0.3);
                text-align: center; animation: slideIn 0.3s ease;
            `;

            dialog.innerHTML = `
                <h3 style="color: #e8e8ff; margin: 0 0 15px 0; font-size: 20px;">${title}</h3>
                <p style="color: rgba(232, 232, 255, 0.8); margin: 0 0 25px 0; line-height: 1.5;">${message}</p>
                <div class="dialog-buttons" style="display: flex; gap: 15px; justify-content: center;"></div>
            `;

            const buttonsContainer = dialog.querySelector('.dialog-buttons');
            buttons.forEach((btn, index) => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                button.style.cssText = `
                    padding: 12px 24px; border: none; border-radius: 10px;
                    font-size: 14px; font-weight: 600; cursor: pointer;
                    transition: all 0.3s ease; min-width: 100px;
                    ${btn.primary ?
                        'background: linear-gradient(45deg, #8a2be2, #9966cc); color: white;' :
                        'background: linear-gradient(45deg, #ff4757, #ff3742); color: white;'
                    }
                `;
                button.onmouseover = () => button.style.transform = 'translateY(-2px)';
                button.onmouseout = () => button.style.transform = 'translateY(0)';
                button.onclick = () => {
                    overlay.remove();
                    resolve(btn.value);
                };
                buttonsContainer.appendChild(button);
            });

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `;
            document.head.appendChild(style);
        });
    },

    confirm(title, message) {
        return this.show(title, message, [
            { text: 'İptal', value: false, primary: false },
            { text: 'Evet', value: true, primary: true }
        ]);
    }
};

// --- CUSTOM PROMPT SİSTEMİ ---
const customPrompt = {
    show(title, message, defaultValue = '', placeholder = '') {
        return new Promise((resolve) => {
            document.querySelectorAll('.custom-prompt').forEach(el => el.remove());

            const overlay = document.createElement('div');
            overlay.className = 'custom-prompt';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; align-items: center;
                justify-content: center; z-index: 10000; animation: fadeIn 0.3s ease;
            `;

            const prompt = document.createElement('div');
            prompt.style.cssText = `
                background: rgba(22, 33, 62, 0.95); backdrop-filter: blur(20px);
                padding: 30px; border-radius: 20px; max-width: 450px; margin: 20px;
                border: 1px solid rgba(138, 43, 226, 0.3);
                box-shadow: 0 20px 60px rgba(138, 43, 226, 0.3);
                text-align: center; animation: slideIn 0.3s ease;
            `;

            prompt.innerHTML = `
                <h3 style="color: #e8e8ff; margin: 0 0 15px 0; font-size: 20px;">${title}</h3>
                <p style="color: rgba(232, 232, 255, 0.8); margin: 0 0 20px 0; line-height: 1.5;">${message}</p>
                <input type="text" class="prompt-input" value="${defaultValue}" placeholder="${placeholder}" 
                       style="width: 100%; padding: 12px 16px; border: 2px solid rgba(138, 43, 226, 0.3);
                              border-radius: 10px; background: rgba(26, 26, 46, 0.8); color: #e8e8ff;
                              font-size: 14px; outline: none; margin-bottom: 20px; box-sizing: border-box;">
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button class="cancel-btn" style="padding: 12px 24px; border: none; border-radius: 10px;
                            background: linear-gradient(45deg, #ff4757, #ff3742); color: white;
                            font-size: 14px; font-weight: 600; cursor: pointer; min-width: 100px;">İptal</button>
                    <button class="ok-btn" style="padding: 12px 24px; border: none; border-radius: 10px;
                            background: linear-gradient(45deg, #8a2be2, #9966cc); color: white;
                            font-size: 14px; font-weight: 600; cursor: pointer; min-width: 100px;">Tamam</button>
                </div>
            `;

            const input = prompt.querySelector('.prompt-input');
            const cancelBtn = prompt.querySelector('.cancel-btn');
            const okBtn = prompt.querySelector('.ok-btn');

            input.focus();
            input.select();

            const handleSubmit = () => {
                const value = input.value.trim();
                overlay.remove();
                resolve(value || null);
            };

            const handleCancel = () => {
                overlay.remove();
                resolve(null);
            };

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') handleCancel();
            });

            okBtn.onclick = handleSubmit;
            cancelBtn.onclick = handleCancel;

            overlay.appendChild(prompt);
            document.body.appendChild(overlay);
        });
    }
};

// --- EKRAN YÖNETİMİ ---
const screen = {
    showAuth() {
        const authContainer = elements.authContainer();
        const appContainer = elements.appContainer();
        if (authContainer) authContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        this.clearAuthInputs();
        this.enableAuthInputs();
    },

    showApp() {
        const authContainer = elements.authContainer();
        const appContainer = elements.appContainer();
        if (authContainer) authContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
        const chatInput = elements.chatInputField();
        if (chatInput) {
            chatInput.value = '';
            chatInput.focus();
        }
        // ÇÖZÜM 4: Başlangıçta welcome mesajını göster
        this.showWelcomeMessage();
    },

    clearAuthInputs() {
        const usernameInput = elements.usernameInput();
        const passwordInput = elements.passwordInput();
        const errorMessage = elements.authErrorMessage();
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (errorMessage) errorMessage.textContent = '';
    },

    enableAuthInputs() {
        const usernameInput = elements.usernameInput();
        const passwordInput = elements.passwordInput();
        const authButton = elements.authButton();
        if (usernameInput) {
            usernameInput.disabled = false;
            usernameInput.style.opacity = '1';
            usernameInput.style.pointerEvents = 'auto';
        }
        if (passwordInput) {
            passwordInput.disabled = false;
            passwordInput.style.opacity = '1';
            passwordInput.style.pointerEvents = 'auto';
        }
        if (authButton) {
            authButton.disabled = false;
            authButton.style.opacity = '1';
            authButton.style.pointerEvents = 'auto';
        }
    },

    clearChatArea() {
        const chatMessages = elements.chatMessages();
        const chatInput = elements.chatInputField();
        const usersList = elements.usersInChannelList();
        const userCount = elements.userCountSpan();
        const channelName = elements.currentChannelName();

        if (chatMessages) chatMessages.innerHTML = '';
        if (chatInput) chatInput.value = '';
        if (usersList) usersList.innerHTML = '';
        if (userCount) userCount.textContent = '0';
        if (channelName) channelName.textContent = 'Bir kanala katılın';
    },

    // ÇÖZÜM 4: Welcome mesajı göster
    showWelcomeMessage() {
        const chatMessages = elements.chatMessages();
        if (!chatMessages) return;

        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.style.cssText = `
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            height: 100%; padding: 40px; text-align: center; background: rgba(26, 26, 46, 0.3);
            border-radius: 20px; margin: 20px; border: 2px dashed rgba(138, 43, 226, 0.3);
        `;

        welcomeDiv.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 20px;">🐵</div>
            <h2 style="color: #8a2be2; margin: 0 0 15px 0; font-size: 28px; font-weight: 700;">
                MonkeyTalkie'ye Hoş Geldiniz!
            </h2>
            <p style="color: rgba(232, 232, 255, 0.8); font-size: 16px; line-height: 1.6; max-width: 500px; margin: 0 0 20px 0;">
                <strong>Omgg ekibi</strong> için özel geliştirilmiş sesli sohbet uygulaması. 
                Soldaki kanallardan birine girip sohbete başlayabilir veya yeni kanal oluşturabilirsiniz.
            </p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin-top: 20px;">
                <div style="background: rgba(138, 43, 226, 0.2); padding: 12px 20px; border-radius: 10px; border: 1px solid rgba(138, 43, 226, 0.4);">
                    <span style="color: #00ff88;">🎤</span> Sesli sohbet
                </div>
                <div style="background: rgba(138, 43, 226, 0.2); padding: 12px 20px; border-radius: 10px; border: 1px solid rgba(138, 43, 226, 0.4);">
                    <span style="color: #ff6b9d;">💬</span> Metin sohbet
                </div>
                <div style="background: rgba(138, 43, 226, 0.2); padding: 12px 20px; border-radius: 10px; border: 1px solid rgba(138, 43, 226, 0.4);">
                    <span style="color: #ffa502;">🎨</span> Avatar sistemi
                </div>
            </div>
        `;

        chatMessages.appendChild(welcomeDiv);
    }
};

// --- KİMLİK DOĞRULAMA ---
const auth = {
    async authenticate(username, password, isRegistering) {
        // Input validasyonu ve hata mesajlarını göster
        const errorMsg = elements.authErrorMessage();

        if (!username || username.length < 3) {
            if (errorMsg) {
                errorMsg.textContent = 'Kullanıcı adı en az 3 karakter olmalı!';
                errorMsg.classList.add('show');
            }
            notification.show('❌ Kullanıcı adı en az 3 karakter olmalı!', 'error');
            return;
        }
        if (!password || password.length < 6) {
            if (errorMsg) {
                errorMsg.textContent = 'Şifre en az 6 karakter olmalı!';
                errorMsg.classList.add('show');
            }
            notification.show('❌ Şifre en az 6 karakter olmalı!', 'error');
            return;
        }

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password: password.trim() })
            });

            const data = await response.json();

            if (response.ok) {
                state.authToken = data.token;
                state.currentUserUsername = data.username;
                state.currentUserDisplayName = data.displayName || data.username;

                localStorage.setItem('authToken', state.authToken);
                localStorage.setItem('currentUserUsername', state.currentUserUsername);
                localStorage.setItem('currentUserDisplayName', state.currentUserDisplayName);

                if (errorMsg) {
                    errorMsg.textContent = '';
                    errorMsg.classList.remove('show');
                }

                screen.showApp();
                socket.connect();
                notification.show('🎉 Başarıyla giriş yapıldı!', 'success');
            } else {
                if (errorMsg) {
                    errorMsg.textContent = data.msg || 'Bir hata oluştu.';
                    errorMsg.classList.add('show');
                }
                const passwordInput = elements.passwordInput();
                if (passwordInput) passwordInput.value = '';
                notification.show('❌ ' + (data.msg || 'Giriş başarısız!'), 'error');
            }
        } catch (error) {
            console.error('Auth error:', error);
            if (errorMsg) {
                errorMsg.textContent = 'Sunucuya bağlanılamadı!';
                errorMsg.classList.add('show');
            }
            notification.show('❌ Bağlantı hatası!', 'error');
        }
    },

    async logout() {
        const confirm = await customDialog.confirm(
            'Çıkış Yap',
            'Çıkış yapmak istediğinize emin misiniz?'
        );

        if (!confirm) return;

        // Tüm event listener'ları temizle
        eventManager.removeAll();

        // Socket bağlantısını kapat
        socket.disconnect();

        // State'i temizle
        state.reset();
        state.clearAuth();

        // Chat alanını temizle
        screen.clearChatArea();

        // Auth formunu sıfırla ve aktif et
        screen.showAuth();

        // Input alanlarını temizle ve aktif et
        const usernameInput = elements.usernameInput();
        const passwordInput = elements.passwordInput();
        const authButton = elements.authButton();
        const errorMsg = elements.authErrorMessage();

        if (usernameInput) {
            usernameInput.value = '';
            usernameInput.disabled = false;
            usernameInput.style.opacity = '1';
            usernameInput.style.pointerEvents = 'auto';
        }

        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.disabled = false;
            passwordInput.style.opacity = '1';
            passwordInput.style.pointerEvents = 'auto';
        }

        if (authButton) {
            authButton.disabled = false;
            authButton.style.opacity = '1';
            authButton.style.pointerEvents = 'auto';
        }

        if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.classList.remove('show');
        }

        // Event manager'ı yeniden başlat
        setTimeout(() => {
            eventManager.init();
        }, 100);

        notification.show('👋 Başarıyla çıkış yapıldı!', 'success');
    }
};

// --- SOCKET YÖNETİMİ ---
const socket = {
    connect() {
        if (state.socket) state.socket.disconnect();

        state.socket = io(CONFIG.SERVER_URL, {
            query: { token: state.authToken },
            transports: ['websocket', 'polling']
        });

        this.setupEventListeners();
    },

    disconnect() {
        if (state.socket) {
            state.socket.removeAllListeners();
            state.socket.disconnect();
            state.socket = null;
        }
    },

    setupEventListeners() {
        const s = state.socket;

        s.on('connect', () => {
            s.emit('authenticate', state.authToken);
            s.emit('request_channels_list');
            setTimeout(() => profile.updateDisplay(), CONFIG.PROFILE_UPDATE_DELAY);
        });

        s.on('disconnect', () => {
            screen.showAuth();
            notification.show('🔌 Sunucu bağlantısı koptu!', 'warning');
        });

        s.on('connect_error', () => {
            notification.show('❌ Sunucuya bağlanılamadı!', 'error');
        });

        s.on('authenticated', (response) => {
            if (response.status === 'success') {
                s.emit('request_channels_list');
                profile.updateDisplay();
            } else {
                const errorMsg = elements.authErrorMessage();
                if (errorMsg) errorMsg.textContent = 'Kimlik doğrulama başarısız!';
                screen.showAuth();
            }
        });

        s.on('channels_list', (channels) => channel.renderList(channels));

        s.on('joined_channel', (data) => {
            state.currentChannelId = data.channelId;
            state.isJoiningChannel = false;

            const channelName = elements.currentChannelName();
            if (channelName) channelName.textContent = data.channelName;

            const chatMessages = elements.chatMessages();
            if (chatMessages) chatMessages.innerHTML = '';

            users.renderList(data.usersInChannel);

            // ÇÖZÜM 2: Kanal mesajlarını getir
            message.loadChannelMessages(data.channelId);

            const chatInput = elements.chatInputField();
            if (chatInput) {
                chatInput.value = '';
                chatInput.disabled = false;
                chatInput.focus();
            }
        });

        s.on('user_joined_channel', (data) => {
            users.add({ socketId: data.socketId, username: data.username });
            users.updateCount();
        });

        s.on('user_left_channel', (data) => {
            users.remove(data.socketId);
            users.updateCount();
        });

        s.on('chat_message', (data) => message.render(data));

        // ÇÖZÜM 2: Kanal mesajları geldiğinde render et
        s.on('channel_messages', (messages) => {
            messages.forEach(msg => message.render(msg));
        });

        // ÇÖZÜM 1: Display name değişikliği - localStorage'a kaydet
        s.on('display_name_changed', (data) => {
            if (data.success && data.username === state.currentUserUsername) {
                state.currentUserDisplayName = data.newDisplayName;
                localStorage.setItem('currentUserDisplayName', state.currentUserDisplayName);
                profile.updateDisplay();
                message.updateAllDisplayNames(state.currentUserUsername, data.newDisplayName);
                users.updateDisplayName(state.socket.id, data.newDisplayName);
                notification.show(`🐵 İsminiz "${data.newDisplayName}" olarak değiştirildi!`, 'success');
            }
        });

        s.on('display_name_change_error', (data) => {
            notification.show(`❌ İsim değiştirme hatası: ${data.message}`, 'error');
        });

        s.on('user_display_name_changed', (data) => {
            users.updateDisplayName(data.socketId, data.newDisplayName);
            message.updateAllDisplayNames(data.username, data.newDisplayName);
        });

        s.on('user_typing', (data) => typing.show(data.username));
        s.on('user_stopped_typing', (data) => typing.hide(data.username));
        s.on('error_message', (msg) => notification.show('❌ ' + msg, 'error'));

        // ÇÖZÜM 4: Kanal silindikten sonra welcome mesajı göster
        s.on('channel_deleted', (data) => {
            s.emit('request_channels_list');
            if (data.deletedChannelId === state.currentChannelId) {
                state.currentChannelId = null;
                const channelName = elements.currentChannelName();
                if (channelName) channelName.textContent = 'Bir kanala katılın';
                screen.clearChatArea();
                screen.showWelcomeMessage();
                notification.show('⚠️ Bulunduğunuz kanal silindi!', 'warning');
            }
        });

        s.on('channel_users', (userList) => users.renderList(userList));
    }
};

// --- KANAL YÖNETİMİ ---
const channel = {
    renderList(channels) {
        const channelsList = elements.channelsList();
        if (!channelsList) return;

        channelsList.innerHTML = '';

        channels.forEach(ch => {
            const li = document.createElement('li');
            li.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin: 4px 0; border-radius: 8px; cursor: pointer; transition: background 0.2s;';

            // Genel Sohbet kanalını silinemeyen yap
            const isDefault = ch.name === 'Genel Sohbet';

            li.innerHTML = `
                <span class="channel-name" style="flex: 1;">${utils.sanitizeHTML(ch.name)} (${ch.userCount || 0})</span>
                ${!isDefault ? `<button class="delete-channel-btn" data-channel-id="${ch.id}" 
                        style="background: #ff4757; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 14px; cursor: pointer;">×</button>` : ''}
            `;

            li.querySelector('.channel-name').onclick = () => this.join(ch.id, ch.name);
            li.onmouseenter = () => li.style.background = 'rgba(138, 43, 226, 0.1)';
            li.onmouseleave = () => li.style.background = 'transparent';

            channelsList.appendChild(li);
        });
    },

    join(channelId, channelName) {
        if (state.isJoiningChannel || !state.socket?.connected) return;

        state.isJoiningChannel = true;
        state.currentChannelId = null;

        screen.clearChatArea();
        const channelNameEl = elements.currentChannelName();
        if (channelNameEl) channelNameEl.textContent = channelName;

        const chatInput = elements.chatInputField();
        if (chatInput) chatInput.disabled = true;

        state.socket.emit('join_channel', { channelId });
    },

    create(name) {
        if (!name?.trim() || !state.socket?.connected) return;

        state.socket.emit('create_channel', { name: name.trim(), description: '' });
        notification.show('📝 Kanal oluşturuluyor...', 'info');
    },

    async delete(channelId, channelName) {
        const confirm = await customDialog.confirm(
            'Kanal Sil',
            `"${channelName}" kanalını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`
        );

        if (!confirm) return;

        if (state.socket?.connected) {
            state.socket.emit('delete_channel', { channelId });
            notification.show('🗑️ Kanal siliniyor...', 'info');
        }
    }
};

// --- KULLANICI YÖNETİMİ ---
const users = {
    renderList(userList) {
        const usersListEl = elements.usersInChannelList();
        if (!usersListEl) return;

        usersListEl.innerHTML = '';
        userList.forEach(user => this.add(user));
        this.updateCount();
    },

    add(user) {
        const usersListEl = elements.usersInChannelList();
        if (!usersListEl) return;

        let li = document.getElementById(`user-${user.socketId}`);
        if (!li) {
            li = document.createElement('li');
            li.id = `user-${user.socketId}`;
            li.style.cssText = 'display: flex; align-items: center; padding: 8px 12px; margin: 2px 0; border-radius: 8px;';
            usersListEl.appendChild(li);
        }

        const avatar = avatarSystem.getUserAvatar(user.username);
        const color = avatarSystem.getUserColor(user.username);

        li.innerHTML = `
            <div class="user-list-avatar" style="
                border: 2px solid ${color}; border-radius: 50%; 
                width: 32px; height: 32px; display: flex; align-items: center; 
                justify-content: center; margin-right: 12px; font-size: 16px;
            ">${avatar}</div>
            <span style="color: ${color}; font-weight: 500;">${utils.sanitizeHTML(user.displayName || user.username)}</span>
        `;

        if (state.socket?.id === user.socketId) {
            li.style.background = 'rgba(138, 43, 226, 0.2)';
            li.style.fontWeight = 'bold';
        }
    },

    remove(socketId) {
        const li = document.getElementById(`user-${socketId}`);
        if (li) li.remove();
    },

    updateCount() {
        const userCountEl = elements.userCountSpan();
        const usersListEl = elements.usersInChannelList();
        if (userCountEl && usersListEl) {
            userCountEl.textContent = usersListEl.children.length;
        }
    },

    updateDisplayName(socketId, newDisplayName) {
        const userEl = document.getElementById(`user-${socketId}`);
        if (userEl) {
            const span = userEl.querySelector('span');
            if (span) span.textContent = utils.sanitizeHTML(newDisplayName);
        }
    }
};

// --- MESAJ SİSTEMİ ---
const message = {
    render(msg) {
        const chatMessages = elements.chatMessages();
        if (!chatMessages) return;

        // Welcome mesajını kaldır
        const welcomeMsg = chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        const div = document.createElement('div');
        div.className = 'message';
        div.style.cssText = `
            display: flex; margin: 12px 0; padding: 12px; border-radius: 12px;
            background: rgba(255,255,255,0.05); transition: all 0.3s ease;
            opacity: 0; transform: translateY(20px);
        `;

        const avatar = avatarSystem.getUserAvatar(msg.username);
        const color = avatarSystem.getUserColor(msg.username);
        const displayName = utils.sanitizeHTML(msg.displayName || msg.username);
        const content = utils.sanitizeHTML(msg.message);
        const timestamp = utils.formatTime(msg.timestamp ? new Date(msg.timestamp) : undefined);

        div.innerHTML = `
            <div class="message-avatar" style="
                border: 2px solid ${color}; border-radius: 50%; 
                width: 40px; height: 40px; display: flex; align-items: center; 
                justify-content: center; margin-right: 16px; font-size: 18px; flex-shrink: 0;
            ">${avatar}</div>
            <div class="message-content" style="flex: 1;">
                <div class="message-header" style="display: flex; align-items: center; margin-bottom: 4px;">
                    <span class="username" style="color: ${color}; font-weight: 600; margin-right: 8px;">${displayName}</span>
                    <span class="timestamp" style="color: rgba(255,255,255,0.5); font-size: 12px;">${timestamp}</span>
                </div>
                <div class="message-text" style="color: rgba(255,255,255,0.9); line-height: 1.4;">${content}</div>
            </div>
        `;

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        requestAnimationFrame(() => {
            div.style.opacity = '1';
            div.style.transform = 'translateY(0)';
        });
    },

    send(content) {
        if (!content?.trim() || !state.socket?.connected || !state.currentChannelId) return;

        state.socket.emit('chat_message', content.trim());
        const chatInput = elements.chatInputField();
        if (chatInput) chatInput.value = '';
    },

    // ÇÖZÜM 2: Kanal mesajlarını yükle
    loadChannelMessages(channelId) {
        if (!state.socket?.connected) return;
        state.socket.emit('get_channel_messages', { channelId });
    },

    updateAllDisplayNames(username, newDisplayName) {
        document.querySelectorAll('.message .username').forEach(el => {
            if (el.textContent.trim() === username ||
                el.textContent.includes(username)) {
                const timestampEl = el.parentElement.querySelector('.timestamp');
                const timestamp = timestampEl ? timestampEl.outerHTML : '';
                el.innerHTML = utils.sanitizeHTML(newDisplayName);
                if (timestamp && timestampEl) {
                    el.parentElement.appendChild(timestampEl);
                }
            }
        });
    }
};

// --- YAZMA GÖSTERGESİ ---
const typing = {
    show(username) {
        const id = `typing-${username}`;
        if (document.getElementById(id)) return;

        const div = document.createElement('div');
        div.id = id;
        div.className = 'typing-indicator';
        div.style.cssText = `
            display: flex; align-items: center; padding: 8px 16px; 
            margin: 8px 0; font-style: italic; color: rgba(255,255,255,0.7);
            background: rgba(255,255,255,0.05); border-radius: 8px;
        `;

        const avatar = avatarSystem.getUserAvatar(username);
        div.innerHTML = `${avatar} ${utils.sanitizeHTML(username)} yazıyor...`;

        const chatMessages = elements.chatMessages();
        if (chatMessages) {
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    },

    hide(username) {
        const indicator = document.getElementById(`typing-${username}`);
        if (indicator) indicator.remove();
    }
};

// --- SES KONTROLLERİ (ÇÖZÜM 3) ---
const voiceControls = {
    async toggleMicrophone() {
        const micBtn = elements.micToggleBtn();
        if (!micBtn) return;

        if (!state.isAudioEnabled) {
            try {
                state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                state.isAudioEnabled = true;
                micBtn.textContent = '🎤 Mikrofon Kapat';
                micBtn.style.background = 'linear-gradient(45deg, #2ed573, #26de81)';
                micBtn.classList.remove('danger');
                notification.show('🎤 Mikrofon açıldı!', 'success');
            } catch (error) {
                console.error('Mikrofon erişim hatası:', error);
                notification.show('❌ Mikrofon erişimi reddedildi!', 'error');
            }
        } else {
            if (state.localStream) {
                state.localStream.getTracks().forEach(track => track.stop());
                state.localStream = null;
            }
            state.isAudioEnabled = false;
            micBtn.textContent = '🎤 Mikrofon Aç';
            micBtn.style.background = 'linear-gradient(45deg, #ff4757, #ff3742)';
            micBtn.classList.add('danger');
            notification.show('🔇 Mikrofon kapatıldı!', 'info');
        }
    },

    toggleDeafen() {
        const deafenBtn = elements.deafenToggleBtn();
        if (!deafenBtn) return;

        if (!state.isDeafened) {
            state.isDeafened = true;
            deafenBtn.textContent = '🔇 Kulaklık Aç';
            deafenBtn.style.background = 'linear-gradient(45deg, #ff4757, #ff3742)';
            deafenBtn.classList.add('danger');
            document.querySelectorAll('audio').forEach(audio => { audio.muted = true; });
            notification.show('🔇 Kulaklık kapatıldı!', 'info');
        } else {
            state.isDeafened = false;
            deafenBtn.textContent = '🔊 Kulaklık Kapat';
            deafenBtn.style.background = 'linear-gradient(45deg, #2ed573, #26de81)';
            deafenBtn.classList.remove('danger');
            document.querySelectorAll('audio').forEach(audio => { audio.muted = false; });
            notification.show('🔊 Kulaklık açıldı!', 'success');
        }
    }
};

// --- PROFİL YÖNETİMİ ---
const profile = {
    updateDisplay() {
        const profileAvatar = elements.profileAvatar();
        const profileUsername = elements.profileUsername();

        if (profileAvatar && state.currentUserUsername) {
            const avatar = avatarSystem.getUserAvatar(state.currentUserUsername);
            const color = avatarSystem.getUserColor(state.currentUserUsername);
            profileAvatar.textContent = avatar;
            profileAvatar.style.borderColor = color;
        }

        if (profileUsername && state.currentUserUsername) {
            const color = avatarSystem.getUserColor(state.currentUserUsername);
            profileUsername.textContent = state.currentUserDisplayName || state.currentUserUsername;
            profileUsername.style.color = color;
        }
    },

    async changeDisplayName() {
        const newName = await customPrompt.show(
            'Görünen İsim Değiştir',
            `Yeni görünen isminizi girin:\n(Mevcut: ${state.currentUserDisplayName || state.currentUserUsername})`,
            state.currentUserDisplayName || state.currentUserUsername,
            'Yeni isminizi yazın...'
        );

        if (!newName) return;

        const trimmed = newName.trim();
        if (trimmed === state.currentUserDisplayName) {
            notification.show('💡 Aynı ismi girdiniz.', 'info');
            return;
        }

        if (trimmed.length < 2 || trimmed.length > 30) {
            notification.show('❌ İsim 2-30 karakter arası olmalı!', 'error');
            return;
        }

        if (!state.socket?.connected) {
            notification.show('❌ Sunucuya bağlı değilsiniz!', 'error');
            return;
        }

        state.socket.emit('change_display_name', { newDisplayName: trimmed });
        notification.show('🐵 İsim değiştiriliyor...', 'info');
    },

    changeAvatar() {
        const selector = elements.avatarSelector();
        const grid = elements.avatarGrid();
        if (!selector || !grid) return;

        grid.innerHTML = '';
        avatarSystem.AVATARS.forEach(avatar => {
            const option = document.createElement('div');
            option.className = 'avatar-option';
            option.style.cssText = `
                width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;
                font-size: 32px; border: 3px solid transparent; border-radius: 12px;
                cursor: pointer; transition: all 0.2s; margin: 4px;
            `;
            option.textContent = avatar;

            option.onclick = () => {
                grid.querySelectorAll('.avatar-option').forEach(opt => opt.style.borderColor = 'transparent');
                option.style.borderColor = '#8a2be2';
                state.selectedAvatar = avatar;
            };

            grid.appendChild(option);
        });

        setTimeout(() => {
            const current = avatarSystem.getUserAvatar(state.currentUserUsername);
            const currentOption = [...grid.children].find(opt => opt.textContent === current);
            if (currentOption) {
                currentOption.style.borderColor = '#8a2be2';
                state.selectedAvatar = current;
            }
        }, 100);

        selector.style.display = 'flex';
        this.hideMenu();
    },

    saveAvatar() {
        if (!state.selectedAvatar || !state.currentUserUsername) {
            notification.show('❌ Lütfen bir avatar seçin!', 'error');
            return;
        }

        localStorage.setItem(`avatar_${state.currentUserUsername}`, state.selectedAvatar);
        this.updateDisplay();

        avatarSystem.updateAllAvatars(state.currentUserUsername);

        if (state.currentChannelId && state.socket?.connected) {
            state.socket.emit('request_channel_users', { channelId: state.currentChannelId });
        }

        this.closeAvatarSelector();
        notification.show('🐵 Avatar değiştirildi!', 'success');
    },

    closeAvatarSelector() {
        const selector = elements.avatarSelector();
        if (selector) selector.style.display = 'none';
        state.selectedAvatar = null;
    },

    toggleMenu() {
        const menu = elements.profileMenu();
        if (!menu) return;
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    },

    hideMenu() {
        const menu = elements.profileMenu();
        if (menu) menu.style.display = 'none';
    }
};

// --- EVENT YÖNETİCİSİ ---
const eventManager = {
    init() {
        this.setupAuthEvents();
        this.setupChatEvents();
        this.setupChannelEvents();
        this.setupProfileEvents();
        this.setupVoiceEvents(); // ÇÖZÜM 3
        this.setupGlobalEvents();
    },

    setupAuthEvents() {
        const toggleAuthLink = elements.toggleAuthLink();
        if (toggleAuthLink) {
            toggleAuthLink.onclick = (e) => {
                e.preventDefault();
                state.isRegistering = !state.isRegistering;
                const authTitle = elements.authTitle();
                const authButton = elements.authButton();
                if (authTitle) authTitle.textContent = state.isRegistering ? 'Kaydol' : 'Giriş Yap';
                if (authButton) authButton.textContent = state.isRegistering ? 'Kaydol' : 'Giriş Yap';
                toggleAuthLink.innerHTML = state.isRegistering
                    ? 'Zaten hesabın var mı? <a href="#">Giriş Yap</a>'
                    : 'Hesabın yok mu? <a href="#">Kaydol</a>';
                screen.clearAuthInputs();
            };
        }

        const authButton = elements.authButton();
        if (authButton) {
            authButton.onclick = () => {
                const username = elements.usernameInput()?.value?.trim();
                const password = elements.passwordInput()?.value?.trim();

                if (!username || !password) {
                    const errorMsg = elements.authErrorMessage();
                    if (errorMsg) errorMsg.textContent = 'Kullanıcı adı ve şifre boş olamaz.';
                    return;
                }

                auth.authenticate(username, password, state.isRegistering);
            };
        }

        [elements.usernameInput(), elements.passwordInput()].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        authButton?.click();
                    }
                });
            }
        });
    },

    setupChatEvents() {
        const chatForm = elements.chatForm();
        if (chatForm) {
            chatForm.onsubmit = (e) => {
                e.preventDefault();

                if (!state.socket?.connected) {
                    notification.show('❌ Sunucuya bağlı değilsiniz!', 'error');
                    return;
                }

                if (!state.currentChannelId || state.isJoiningChannel) {
                    notification.show('❌ Bir kanal seçmelisiniz!', 'warning');
                    return;
                }

                const chatInput = elements.chatInputField();
                message.send(chatInput?.value);
            };
        }

        const chatInput = elements.chatInputField();
        if (chatInput) {
            chatInput.oninput = utils.debounce(() => {
                if (!state.isTyping && state.currentChannelId && state.socket?.connected) {
                    state.isTyping = true;
                    state.socket.emit('typing_start', { channelId: state.currentChannelId });
                }

                clearTimeout(state.typingTimeout);
                state.typingTimeout = setTimeout(() => {
                    if (state.isTyping && state.socket?.connected) {
                        state.isTyping = false;
                        state.socket.emit('typing_stop', { channelId: state.currentChannelId });
                    }
                }, CONFIG.TYPING_TIMEOUT);
            }, 100);
        }
    },

    setupChannelEvents() {
        const submitChannelBtn = elements.submitChannelBtn();
        const newChannelInput = elements.newChannelInput();

        if (submitChannelBtn) {
            submitChannelBtn.onclick = () => {
                const name = newChannelInput?.value?.trim();
                if (name) {
                    channel.create(name);
                    if (newChannelInput) newChannelInput.value = '';
                }
            };
        }

        if (newChannelInput) {
            newChannelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    submitChannelBtn?.click();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-channel-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const channelId = e.target.dataset.channelId;
                const channelElement = e.target.closest('li');
                const channelName = channelElement?.querySelector('.channel-name')?.textContent || 'Bu kanal';

                channel.delete(channelId, channelName);
            }
        });
    },

    setupProfileEvents() {
        window.toggleProfileMenu = () => profile.toggleMenu();
        window.openAvatarSelector = () => profile.changeAvatar();
        window.openDisplayNameChanger = () => profile.changeDisplayName();
        window.openSettings = () => notification.show('⚙️ Ayarlar yakında eklenecek!', 'info');
        window.logout = () => auth.logout();

        const saveAvatarBtn = elements.saveAvatarBtn();
        const cancelAvatarBtn = elements.cancelAvatarBtn();

        if (saveAvatarBtn) saveAvatarBtn.onclick = () => profile.saveAvatar();
        if (cancelAvatarBtn) cancelAvatarBtn.onclick = () => profile.closeAvatarSelector();
    },

    // ÇÖZÜM 3: Ses kontrolleri
    setupVoiceEvents() {
        const micBtn = elements.micToggleBtn();
        const deafenBtn = elements.deafenToggleBtn();

        if (micBtn) {
            micBtn.onclick = () => voiceControls.toggleMicrophone();
        }

        if (deafenBtn) {
            deafenBtn.onclick = () => voiceControls.toggleDeafen();
        }
    },

    setupGlobalEvents() {
        document.addEventListener('click', (e) => {
            const profileSection = document.querySelector('.profile-section');
            const profileMenu = elements.profileMenu();
            const avatarSelector = elements.avatarSelector();

            if (profileMenu && profileSection &&
                !profileSection.contains(e.target) && !profileMenu.contains(e.target)) {
                profile.hideMenu();
            }

            if (avatarSelector && e.target === avatarSelector) {
                profile.closeAvatarSelector();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                profile.hideMenu();
                profile.closeAvatarSelector();
            }
        });
    },

    removeAll() {
        state.listenersInitialized = false;

        const chatForm = elements.chatForm();
        const chatInput = elements.chatInputField();

        if (chatForm) {
            const newForm = chatForm.cloneNode(true);
            chatForm.parentNode.replaceChild(newForm, chatForm);
        }

        if (chatInput) {
            const newInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newInput, chatInput);
        }
    }
};

// --- BAŞLATMA ---
const app = {
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    },

    start() {
        eventManager.init();

        if (state.authToken && state.currentUserUsername) {
            screen.showApp();
            socket.connect();
        } else {
            screen.showAuth();
        }

        console.log('🐵 MonkeyTalkie başarıyla yüklendi!');
    }
};

app.init();

// =================== renderer.js SONU ===================