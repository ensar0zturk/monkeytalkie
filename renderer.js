// HTML Elementleri

// bağlantıyı kur:
let socket; // adresi senin server adresinle değiştir

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authTitle = document.getElementById('auth-title');
const authErrorMessage = document.getElementById('auth-error-message');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const authButton = document.getElementById('auth-button');
const toggleAuthLink = document.getElementById('toggle-auth');

const channelsList = document.getElementById('channels-list');
const currentChannelName = document.getElementById('current-channel-name');
const chatMessages = document.getElementById('chat-messages');
const usersInChannelList = document.getElementById('users-in-channel-list');
const userCountSpan = document.getElementById('user-count');
const chatForm = document.getElementById('chat-form');
const chatInputField = document.getElementById('chat-input-field');
const micToggleButton = document.getElementById('mic-toggle-btn');
const deafenToggleButton = document.getElementById('deafen-toggle-btn');
const logoutButton = document.getElementById('logout-btn');

const SERVER_URL = 'http://78.135.85.236:3000';


let isRegistering = false;
let authToken = localStorage.getItem('authToken');
let currentUserUsername = localStorage.getItem('currentUserUsername');
let currentChannelId = null;

// WebRTC değişkenleri
let localStream = null;
let peerConnections = {};
let isAudioEnabled = false;

// --- Giriş/Kayıt Mantığı ---
if (authToken && currentUserUsername) {
    showApp();
    connectToServer();
} else {
    showAuth();
}

toggleAuthLink.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    authTitle.textContent = isRegistering ? 'Kaydol' : 'Giriş Yap';
    authButton.textContent = isRegistering ? 'Kaydol' : 'Giriş Yap';
    toggleAuthLink.innerHTML = isRegistering
        ? 'Zaten hesabın var mı? <a href="#" id="login-link">Giriş Yap</a>'
        : 'Hesabın yok mu? <a href="#" id="register-link">Kaydol</a>';
    authErrorMessage.textContent = '';
});

authButton.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        authErrorMessage.textContent = 'Kullanıcı adı ve şifre boş olamaz.';
        return;
    }

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

    try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authErrorMessage.textContent = '';
            authToken = data.token;
            currentUserUsername = data.username;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUserUsername', currentUserUsername);
            showApp();
            connectToServer();
        } else {
            authErrorMessage.textContent = data.msg || 'Bir hata oluştu.';
        }
    } catch (error) {
        console.error('Kimlik doğrulama hatası:', error);
        authErrorMessage.textContent = 'Sunucuya bağlanılamadı veya bir hata oluştu.';
    }
});

function showAuth() {
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
}

function showApp() {
    authContainer.style.display = 'none';
    appContainer.style.display = 'flex';
}
function connectToServer() {
    socket = io(SERVER_URL, {
        query: { token: authToken }
    });

    socket.on('connect', () => {
        console.log('Socket.IO bağlantısı başarılı:', socket.id);
        socket.emit('authenticate', authToken);
        // Bağlantı kurulduktan sonra kanal listesini iste
        socket.emit('request_channels_list');
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO bağlantısı kesildi.');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO bağlantı hatası:', error);
    });

    socket.on('authenticated', (response) => {
        if (response.status === 'success') {
            console.log('Kimlik doğrulaması başarılı');
            socket.emit('request_channels_list');
        } else {
            authErrorMessage.textContent = 'Kimlik doğrulama başarısız!';
            showAuth();
        }
    });

    socket.on('channels_list', (channels) => {
        renderChannels(channels);
    });

    socket.on('joined_channel', (data) => {
        currentChannelId = data.channelId;
        currentChannelName.textContent = data.channelName;
        chatMessages.innerHTML = '';
        renderUsersInChannel(data.usersInChannel);
        // Eğer varsa önceki mesajları göster:
        if (data.messages) {
            data.messages.forEach(renderMessage);
        }
    });

    socket.on('user_left_channel', (data) => {
        removeUserFromList(data.socketId);
        userCountSpan.textContent = usersInChannelList.children.length;
    });

    socket.on('chat_message', (data) => {
        renderMessage(data);
    });

    socket.on('error_message', (msg) => {
        alert('Hata: ' + msg);
    });

    // WebRTC event'lerini BURAYA taşı:
    socket.on('offer', async (data) => {
        const { senderSocketId, offer } = data;
        const peerConnection = createPeerConnection(senderSocketId);

        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('answer', {
            targetSocketId: senderSocketId,
            answer: answer
        });
    });

    socket.on('answer', async (data) => {
        const { senderSocketId, answer } = data;
        const peerConnection = peerConnections[senderSocketId];

        if (peerConnection) {
            await peerConnection.setRemoteDescription(answer);
        }
    });

    socket.on('ice-candidate', async (data) => {
        const { senderSocketId, candidate } = data;
        const peerConnection = peerConnections[senderSocketId];

        if (peerConnection) {
            await peerConnection.addIceCandidate(candidate);
        }
    });

    socket.on('user_joined_channel', async (data) => {
        addOrUpdateUserInList({ socketId: data.socketId, username: data.username });
        userCountSpan.textContent = usersInChannelList.children.length;

        // Eğer mikrofon açıksa, yeni kullanıcıya offer gönder
        if (isAudioEnabled && localStream) {
            const peerConnection = createPeerConnection(data.socketId);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.emit('offer', {
                targetSocketId: data.socketId,
                offer: offer
            });
        }
    });

    // Event listener'ları buraya taşı
    setupEventListeners();
}

function setupEventListeners() {
    // Kanal oluşturma için tek event listener
    const newChannelInput = document.getElementById('newChannelName');
    const submitChannelBtn = document.getElementById('submitChannel');

    if (submitChannelBtn) {
        submitChannelBtn.addEventListener('click', () => {
            const channelName = newChannelInput.value.trim();
            if (channelName && socket && socket.connected) {
                socket.emit('create_channel', { name: channelName, description: '' });
                newChannelInput.value = '';
            } else if (!socket || !socket.connected) {
                alert('Sunucuya bağlı değilsiniz!');
            }
        });
    }

    // Kanal silme - tek event listener (sadece bu kalacak)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-channel-btn')) {
            const channelId = e.target.dataset.channelId;
            if (confirm('Bu kanalı silmek istediğinize emin misiniz?')) {
                if (socket && socket.connected) {
                    socket.emit('delete_channel', { channelId });
                } else {
                    alert('Sunucuya bağlı değilsiniz!');
                }
            }
        }
    });
}

// Kanal listesi render
function renderChannels(channels) {
    channelsList.innerHTML = '';
    channels.forEach(channel => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="channel-name">${channel.name} (${channel.userCount || 0})</span>
            <button class="delete-channel-btn" data-channel-id="${channel.id}" title="Sil">×</button>
        `;
        li.querySelector('.channel-name').onclick = () => joinChannel(channel.id, channel.name);
        // Silme butonuna onclick ekleme - sadece data attribute kullan
        channelsList.appendChild(li);
    });
}

// Kanala katıl
async function joinChannel(channelId, channelName) {
    if (!socket || !socket.connected) {
        alert("Sunucuya bağlı değilsiniz!");
        return;
    }
    socket.emit('join_channel', { channelId });

    // Eski mesajları yükle
    try {
        const response = await fetch(`${SERVER_URL}/api/messages/${channelId}`);
        const messages = await response.json();
        chatMessages.innerHTML = '';
        messages.forEach(msg => {
            renderMessage({
                username: msg.username,
                message: msg.message,
                timestamp: new Date(msg.timestamp).toLocaleTimeString()
            });
        });
    } catch (error) {
        console.error('Mesajları yüklerken hata:', error);
    }
}

// Kullanıcı listesi render
function renderUsersInChannel(users) {
    usersInChannelList.innerHTML = '';
    users.forEach(user => {
        addOrUpdateUserInList(user);
    });
    userCountSpan.textContent = users.length;
}

function addOrUpdateUserInList(user) {
    let li = document.getElementById(`user-${user.socketId}`);
    if (!li) {
        li = document.createElement('li');
        li.id = `user-${user.socketId}`;
        usersInChannelList.appendChild(li);
    }
    li.textContent = user.username;
    // Null check ekle:
    if (socket && socket.id && user.socketId === socket.id) {
        li.style.fontWeight = 'bold';
    }
}

function removeUserFromList(socketId) {
    const li = document.getElementById(`user-${socketId}`);
    if (li) li.remove();
}

// Mesaj gönder
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (chatInputField.value && currentChannelId) {
        socket.emit('chat_message', chatInputField.value);
        chatInputField.value = '';
    }
});

// Çıkış
logoutButton.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUserUsername');
    location.reload();
});

function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<span class="username">${msg.username}:</span> ${msg.message} <span class="timestamp">${msg.timestamp}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Mikrofon aç/kapat
document.getElementById('mic-toggle-btn').addEventListener('click', async () => {
    const micButton = document.getElementById('mic-toggle-btn');

    if (!isAudioEnabled) {
        const audioSetup = await setupAudio();
        if (audioSetup) {
            isAudioEnabled = true;
            micButton.classList.add('active');
            micButton.textContent = 'Mikrofon Kapat';
            console.log('Mikrofon açıldı');
        }
    } else {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        isAudioEnabled = false;
        micButton.classList.remove('active');
        micButton.textContent = 'Mikrofon Aç';
        console.log('Mikrofon kapatıldı');
    }
});

// Kulaklık aç/kapat
document.getElementById('deafen-toggle-btn').addEventListener('click', () => {
    const deafenButton = document.getElementById('deafen-toggle-btn');
    if (deafenButton.classList.contains('active')) {
        deafenButton.classList.remove('active');
        deafenButton.textContent = 'Kulaklık Aç';
        // Kulaklığı kapatma işlemleri
        console.log('Kulaklık kapatıldı');
    } else {
        deafenButton.classList.add('active');
        deafenButton.textContent = 'Kulaklık Kapat';
        // Kulaklığı açma işlemleri
        console.log('Kulaklık açıldı');
    }
});

// Mikrofon erişimi
async function setupAudio() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Mikrofon erişimi başarılı');
        return true;
    } catch (error) {
        console.error('Mikrofon erişimi başarısız:', error);
        alert('Mikrofon erişimi reddedildi!');
        return false;
    }
}

// Peer connection oluştur
function createPeerConnection(targetSocketId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    // Local stream ekle
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Remote stream al
    peerConnection.ontrack = (event) => {
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        document.body.appendChild(remoteAudio);
    };

    // ICE candidate gönder
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                targetSocketId: targetSocketId,
                candidate: event.candidate
            });
        }
    };

    peerConnections[targetSocketId] = peerConnection;
    return peerConnection;
}