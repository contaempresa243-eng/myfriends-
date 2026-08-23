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
let recaptchaVerifier = null;

// Obter número atual
function getCurrentUserPhone() {
  if (auth.currentUser && auth.currentUser.phoneNumber) {
    return auth.currentUser.phoneNumber;
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

// Inicializar o reCAPTCHA invisível (uma única vez)
function getRecaptchaVerifier() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA resolvido — o envio do SMS continua normalmente.
      },
      'expired-callback': () => {
        alert('A verificação expirou. Tenta novamente.');
        resetRecaptcha();
      }
    });
  }
  return recaptchaVerifier;
}

function resetRecaptcha() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  const container = document.getElementById('recaptcha-container');
  if (container) container.innerHTML = '';
}

// Normaliza o número (aceita "9XX XXX XXX" e assume +244 se faltar o código do país)
function normalizePhoneNumber(raw) {
  let phone = raw.replace(/\s+/g, '');
  if (!phone.startsWith('+')) {
    phone = phone.startsWith('244') ? '+' + phone : '+244' + phone;
  }
  return phone;
}

// Enviar Código SMS (fluxo real via Firebase Phone Auth)
function sendOTP() {
  const phoneInputEl = document.getElementById('phone-input');
  const rawPhone = phoneInputEl.value.trim();

  if (!rawPhone) {
    alert('Por favor, insere o número de telemóvel.');
    return;
  }

  const phoneNumber = normalizePhoneNumber(rawPhone);
  const btn = document.getElementById('btn-send-code');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'A enviar...';
  }

  const appVerifier = getRecaptchaVerifier();

  auth.signInWithPhoneNumber(phoneNumber, appVerifier)
    .then((confirmation) => {
      confirmationResult = confirmation;
      document.getElementById('otp-container').classList.remove('hidden');
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Código enviado';
      }
      const otpInput = document.getElementById('otp-input');
      if (otpInput) otpInput.focus();
    })
    .catch((error) => {
      console.error('Erro ao enviar SMS:', error);
      alert('Não foi possível enviar o código. Verifica o número e tenta novamente.\n' + (error.message || ''));
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Avançar';
      }
      resetRecaptcha();
    });
}

// Verificar Código SMS
function verifyOTP() {
  const code = document.getElementById('otp-input').value.trim();
  if (!code) {
    alert('Insere o código de 6 dígitos.');
    return;
  }
  if (!confirmationResult) {
    alert('Pede primeiro o código por SMS.');
    return;
  }

  confirmationResult.confirm(code)
    .then((result) => {
      // onAuthStateChanged trata da transição de ecrã automaticamente.
    })
    .catch((error) => {
      console.error('Código inválido:', error);
      alert('Código SMS incorreto. Tenta novamente.');
    });
}

function logoutUser() {
  auth.signOut().catch((error) => {
    console.error('Erro ao terminar sessão:', error);
  });
}

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
  if (!text || !currentChatId) return;

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
