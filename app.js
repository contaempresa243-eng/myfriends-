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

let currentChatId = null;

// Obter identificador do utilizador atual
function getCurrentUserEmail() {
  if (auth.currentUser && auth.currentUser.email) {
    return auth.currentUser.email;
  }
  return '';
}

// Detetar Estado de Autenticação
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    const firstTab = document.querySelector('.tab-item');
    if (firstTab) switchTab('chats', firstTab);
  } else {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
});

// Traduz códigos de erro comuns do Firebase Auth para mensagens em português
function mensagemErroAuth(error) {
  const mapa = {
    'auth/invalid-email': 'Email inválido.',
    'auth/missing-email': 'Insere o teu email.',
    'auth/too-many-requests': 'Demasiadas tentativas. Tenta novamente mais tarde.',
    'auth/expired-action-code': 'Este link expirou. Pede um novo.',
    'auth/invalid-action-code': 'Este link já foi usado ou é inválido. Pede um novo.'
  };
  return mapa[error.code] || (error.message || 'Ocorreu um erro. Tenta novamente.');
}

function mostrarErroLogin(texto) {
  const el = document.getElementById('login-error');
  if (el) el.innerText = texto;
}

// Definições do link de login: aponta sempre de volta para esta mesma página.
function getActionCodeSettings() {
  return {
    url: window.location.href.split('?')[0],
    handleCodeInApp: true
  };
}

// Passo 1: enviar o link de login para o email indicado
function sendLoginLink() {
  mostrarErroLogin('');
  const email = document.getElementById('email-input').value.trim();

  if (!email) {
    mostrarErroLogin('Insere o teu email.');
    return;
  }

  const btn = document.getElementById('btn-send-link');
  if (btn) { btn.disabled = true; btn.innerText = 'A enviar...'; }

  auth.sendSignInLinkToEmail(email, getActionCodeSettings())
    .then(() => {
      // Guarda o email localmente para o passo 2 (confirmação ao voltar pelo link).
      window.localStorage.setItem('myfriens_email_login', email);
      document.getElementById('email-form').classList.add('hidden');
      document.getElementById('email-sent-msg').classList.remove('hidden');
    })
    .catch((error) => {
      console.error('Erro ao enviar link:', error);
      mostrarErroLogin(mensagemErroAuth(error));
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.innerText = 'Enviar Link de Entrada'; }
    });
}

// Passo 2: se a página foi aberta a partir do link de login, completa a entrada
function completarLoginPorLink() {
  if (!auth.isSignInWithEmailLink(window.location.href)) return;

  const email = window.localStorage.getItem('myfriens_email_login');
  if (email) {
    confirmarLoginComEmail(email);
  } else {
    // Link aberto noutro dispositivo/navegador — pede o email através de um formulário na página
    // (evita window.prompt, que pode não funcionar dentro de navegadores embutidos de apps como Gmail).
    document.getElementById('email-form').classList.add('hidden');
    document.getElementById('confirm-email-form').classList.remove('hidden');
  }
}

function confirmarEmailEEntrar() {
  const email = document.getElementById('confirm-email-input').value.trim();
  mostrarErroLogin('');
  if (!email) {
    mostrarErroLogin('Insere o teu email.');
    return;
  }
  confirmarLoginComEmail(email);
}

function confirmarLoginComEmail(email) {
  mostrarErroLogin('A entrar...');
  auth.signInWithEmailLink(email, window.location.href)
    .then(() => {
      window.localStorage.removeItem('myfriens_email_login');
      // Limpa o link da barra de endereço sem recarregar a página.
      window.history.replaceState({}, document.title, window.location.pathname);
      mostrarErroLogin('');
    })
    .catch((error) => {
      console.error('Erro ao confirmar login por link:', error);
      mostrarErroLogin(mensagemErroAuth(error));
    });
}

function logoutUser() {
  auth.signOut().catch((error) => {
    console.error('Erro ao terminar sessão:', error);
  });
}

completarLoginPorLink();

// Navegação por Abas
function switchTab(tabName, element) {
  document.querySelectorAll('.tab-item').forEach(tab => tab.classList.remove('active'));
  element.classList.add('active');

  const contentArea = document.getElementById('tab-content');

  if (tabName === 'chats') {
    contentArea.innerHTML = `
      <div class="chat-item" onclick="openChat('geral', 'Chat Geral da Comunidade')">
        <div class="avatar" style="background:var(--whatsapp-teal);">GG</div>
        <div class="chat-info">
          <h4>Chat Geral</h4>
          <p>Clica para entrar na conversa em tempo real.</p>
        </div>
      </div>`;
  } else if (tabName === 'updates') {
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;"><strong>Estados</strong><br><br>Partilha atualizações com os teus amigos.</div>`;
  } else if (tabName === 'communities') {
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;">Comunidades unificadas do myFriens.</div>`;
  } else if (tabName === 'calls') {
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
  const myEmail = getCurrentUserEmail();

  db.collection('chats').doc(currentChatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      container.innerHTML = '';
      snapshot.forEach((doc) => {
        const msg = doc.data();
        const isMe = msg.sender === myEmail;

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
  const myEmail = getCurrentUserEmail();
  if (!text || !currentChatId) return;

  db.collection('chats').doc(currentChatId).collection('messages').add({
    text: text,
    sender: myEmail,
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
    navigator.serviceWorker.register('sw.js').catch(err => console.log('Erro SW:', err));
  });
}
