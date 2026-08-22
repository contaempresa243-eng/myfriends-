// Configuração do Firebase (Substitui pelos dados da tua consola Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyBZeT7cuRX-YWMzEwiRmitgDRD4rA_sjFA",
  authDomain: "myfriens-1e47e.firebaseapp.com",
  projectId: "myfriens-1e47e",
  storageBucket: "myfriens-1e47e.firebasestorage.app",
  messagingSenderId: "141402492230",
  appId: "1:141402492230:web:d5df173f4afef4c253a947"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let confirmationResult = null;
let currentChatId = null;

// Obter número atual (funciona com Firebase real ou com o modo de teste)
function getCurrentUserPhone() {
  if (auth.currentUser && auth.currentUser.phoneNumber) {
    return auth.currentUser.phoneNumber;
  }
  return window.mockUser ? window.mockUser.phoneNumber : '+244944602099';
}

// Detetar Estado de Autenticação (Com suporte a bypass)
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    const firstTab = document.querySelector('.tab-item');
    if(firstTab) switchTab('chats', firstTab);
  }
});

// Enviar Código SMS (Ativado Bypass para desenvolvimento local)
function sendOTP() {
  const phoneNumber = document.getElementById('phone-input').value.replace(/\s+/g, '');
  
  if (!phoneNumber) {
    alert('Por favor, insere o número de telemóvel.');
    return;
  }

  // Entra diretamente para evitar o erro de SMS do Firebase em localhost
  bypassLogin();
}

// Função para pular o SMS e entrar direto no app
function bypassLogin() {
  window.mockUser = { phoneNumber: document.getElementById('phone-input').value.trim() || '+244944602099' };
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  const firstTab = document.querySelector('.tab-item');
  if(firstTab) switchTab('chats', firstTab);
}

// Verificar Código SMS
function verifyOTP() {
  const code = document.getElementById('otp-input').value;
  if (!code) return;

  if (confirmationResult) {
    confirmationResult.confirm(code).then((result) => {
      alert('Autenticação bem-sucedida!');
    }).catch((error) => {
      console.error('Código inválido:', error);
      alert('Código SMS incorreto.');
    });
  } else {
    bypassLogin();
  }
}

function logoutUser() {
  window.mockUser = null;
  auth.signOut().then(() => {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }).catch(() => {
    bypassLogin();
  });
}

// Navegação por Abas
function switchTab(tabName, element) {
  document.querySelectorAll('.tab-item').forEach(tab => tab.classList.remove('active'));
  element.classList.add('active');

  const contentArea = document.getElementById('tab-content');
  
  if(tabName === 'chats') {
    contentArea.innerHTML = `
      <div class="chat-item" onclick="openChat('geral', 'Chat Geral da Comunidade')">
        <div class="avatar" style="background:var(--whatsapp-teal);">GG</div>
        <div class="chat-info">
          <h4>Chat Geral</h4>
          <p>Clica para entrar na conversa em tempo real.</p>
        </div>
      </div>`;
  } else if(tabName === 'updates') {
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;"><strong>Estados</strong><br><br>Partilha atualizações com os teus amigos.</div>`;
  } else if(tabName === 'communities') {
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;">Comunidades unificadas do myFriens.</div>`;
  } else if(tabName === 'calls') {
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;">Histórico de chamadas recentes.</div>`;
  }
}

// Menu Flutuante
function toggleMenu() {
  document.getElementById('dropdown-menu').classList.toggle('hidden');
}

// Abrir Chat Individual / Grupo
function openChat(chatId, chatName) {
  currentChatId = chatId;
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('chat-room-screen').style.display = 'flex';
  document.getElementById('active-chat-name').innerText = chatName;
  document.getElementById('active-chat-avatar').innerText = chatName.substring(0, 2).toUpperCase();
  
  loadMessages();
}

function closeChat() {
  document.getElementById('chat-room-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
}

// Firestore: Carregar Mensagens em Tempo Real
function loadMessages() {
  const container = document.getElementById('messages-container');
  const myPhone = getCurrentUserPhone();
  
  db.collection('chats').doc(currentChatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      container.innerHTML = '';
      snapshot.forEach((doc) => {
        const msg = doc.data();
        const isMe = msg.sender === myPhone;
        
        const bubble = document.createElement('div');
        bubble.style.cssText = `
          align-self: ${isMe ? 'flex-end' : 'flex-start'};
          background: ${isMe ? 'var(--whatsapp-outgoing)' : 'var(--whatsapp-incoming)'};
          color: #111;
          padding: 8px 12px;
          border-radius: 7px;
          max-width: 70%;
          font-size: 14px;
          word-break: break-word;
        `;
        bubble.innerText = msg.text;
        container.appendChild(bubble);
      });
      container.scrollTop = container.scrollHeight;
    });
}

// Firestore: Enviar Mensagem
function sendFirebaseMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  const myPhone = getCurrentUserPhone();
  if(!text || !currentChatId) return;

  db.collection('chats').doc(currentChatId).collection('messages').add({
    text: text,
    sender: myPhone,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    input.value = '';
  }).catch(err => console.error('Erro ao enviar mensagem:', err));
}

function startVoiceCall() { alert('A iniciar chamada...'); }
function startVideoCall() { alert('A iniciar videochamada...'); }
function triggerFileUpload() { alert('Módulo Cloudinary pronto para anexar ficheiros.'); }

// Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('Erro SW:', err));
  });
}
