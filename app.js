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

// Cloudinary (upload de imagens/documentos, sem precisar de plano pago)
const CLOUDINARY_CLOUD_NAME = 'dghec1t8e';
const CLOUDINARY_UPLOAD_PRESET = 'myFriens';

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
    registarUsuarioAtual();
    const firstTab = document.querySelector('.tab-item');
    if (firstTab) switchTab('chats', firstTab);
  } else {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
});

// Regista/atualiza o utilizador atual na coleção "usuarios", para poder aparecer na lista de contactos
function registarUsuarioAtual() {
  const email = getCurrentUserEmail();
  if (!email) return;
  db.collection('usuarios').doc(email).set({
    email: email,
    ultimaEntrada: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch((err) => console.error('Erro ao registar utilizador:', err));
}

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
let unsubscribeConversas = null;

function switchTab(tabName, element) {
  document.querySelectorAll('.tab-item').forEach(tab => tab.classList.remove('active'));
  element.classList.add('active');

  const contentArea = document.getElementById('tab-content');
  const fab = document.getElementById('fab-nova-conversa');

  // Sai da escuta em tempo real da lista de conversas ao trocar de separador
  if (unsubscribeConversas) {
    unsubscribeConversas();
    unsubscribeConversas = null;
  }

  if (tabName === 'chats') {
    fab.classList.remove('hidden');
    contentArea.innerHTML = `
      <div class="chat-item" onclick="openChat('geral', 'Chat Geral da Comunidade')">
        <div class="avatar" style="background:var(--whatsapp-teal);">GG</div>
        <div class="chat-info">
          <h4>Chat Geral</h4>
          <p>Clica para entrar na conversa em tempo real.</p>
        </div>
      </div>
      <div id="lista-conversas-1v1"></div>`;
    escutarListaConversas();
  } else if (tabName === 'updates') {
    fab.classList.add('hidden');
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;"><strong>Estados</strong><br><br>Partilha atualizações com os teus amigos.</div>`;
  } else if (tabName === 'communities') {
    fab.classList.add('hidden');
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;">Comunidades unificadas do myFriens.</div>`;
  } else if (tabName === 'calls') {
    fab.classList.add('hidden');
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;">Histórico de chamadas recentes.</div>`;
  }
}

// Escuta em tempo real as conversas 1-para-1 do utilizador atual
function escutarListaConversas() {
  const myEmail = getCurrentUserEmail();
  if (!myEmail) return;

  unsubscribeConversas = db.collection('chats')
    .where('participantes', 'array-contains', myEmail)
    .onSnapshot((snapshot) => {
      const container = document.getElementById('lista-conversas-1v1');
      if (!container) return;
      container.innerHTML = '';

      snapshot.forEach((doc) => {
        const chat = doc.data();
        const outroEmail = (chat.participantes || []).find((p) => p !== myEmail) || 'Contacto';
        const nome = outroEmail.split('@')[0];

        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => openChat(doc.id, nome);
        item.innerHTML =
          '<div class="avatar" style="background:#4a90d9;">' + nome.substring(0, 2).toUpperCase() + '</div>' +
          '<div class="chat-info"><h4>' + nome + '</h4><p>' + outroEmail + '</p></div>';
        container.appendChild(item);
      });
    }, (err) => console.error('Erro ao carregar conversas:', err));
}

// ---- Nova conversa / lista de contactos ----
function abrirNovoContato() {
  const modal = document.getElementById('novo-contato-modal');
  document.getElementById('email-novo-contato').value = '';
  document.getElementById('email-novo-contato-status').innerText = '';
  document.getElementById('novo-contato-lista').innerHTML = '';
  modal.classList.remove('hidden');
}

// Inicia (ou avisa que ainda não existe) uma conversa a partir de um email escrito manualmente
function iniciarPorEmail() {
  const input = document.getElementById('email-novo-contato');
  const status = document.getElementById('email-novo-contato-status');
  const email = input.value.trim().toLowerCase();
  const myEmail = getCurrentUserEmail();

  if (!email || !email.includes('@')) {
    status.style.color = '#f15c6d';
    status.innerText = 'Escreve um email válido.';
    return;
  }
  if (email === myEmail) {
    status.style.color = '#f15c6d';
    status.innerText = 'Esse é o teu próprio email.';
    return;
  }

  status.style.color = '#8696a0';
  status.innerText = 'A verificar...';

  db.collection('usuarios').doc(email).get()
    .then((doc) => {
      if (doc.exists) {
        iniciarConversaCom(email);
        return;
      }
      status.style.color = '#f15c6d';
      status.innerHTML = '';
      const texto = document.createElement('span');
      texto.innerText = 'Este email ainda não está no myFriens. ';
      const btnConvidar = document.createElement('button');
      btnConvidar.innerText = 'Convidar';
      btnConvidar.style.cssText = 'background:var(--whatsapp-teal); color:#fff; border:none; border-radius:14px; padding:4px 12px; font-size:12px; cursor:pointer; margin-left:4px;';
      btnConvidar.onclick = () => convidarContacto(email.split('@')[0], email, '');
      status.appendChild(texto);
      status.appendChild(btnConvidar);
    })
    .catch((err) => {
      console.error('Erro ao verificar email:', err);
      status.style.color = '#f15c6d';
      status.innerText = 'Não foi possível verificar. Tenta novamente.';
    });
}

// Abre o seletor de contactos do telemóvel (Chrome Android)
function abrirContactosTelefone() {
  const lista = document.getElementById('novo-contato-lista');

  if (!('contacts' in navigator) || !('ContactsManager' in window)) {
    lista.innerHTML = '<p style="color:#f15c6d; font-size:13px; padding:16px; text-align:center;">O teu navegador não suporta aceder aos contactos do telemóvel. Esta função só funciona no Chrome para Android.</p>';
    return;
  }

  lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px;">A abrir os contactos do telemóvel...</p>';

  navigator.contacts.select(['name', 'tel', 'email'], { multiple: true })
    .then((contactos) => {
      if (!contactos || !contactos.length) {
        lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px; text-align:center;">Nenhum contacto selecionado.</p>';
        return;
      }
      renderizarContactosTelefone(contactos);
    })
    .catch((err) => {
      console.error('Erro ao aceder aos contactos:', err);
      lista.innerHTML = '';
    });
}

// Cruza os contactos do telemóvel com os utilizadores já registados no myFriens
function renderizarContactosTelefone(contactos) {
  const lista = document.getElementById('novo-contato-lista');
  lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px;">A verificar quem já está no myFriens...</p>';

  const emailsUnicos = Array.from(new Set(
    contactos.map((c) => (c.email && c.email[0]) || '').filter(Boolean).map((e) => e.toLowerCase())
  )).slice(0, 30); // limite do operador "in" do Firestore

  const buscarRegistados = emailsUnicos.length
    ? db.collection('usuarios').where('email', 'in', emailsUnicos).get()
        .then((snap) => new Set(snap.docs.map((d) => d.id)))
    : Promise.resolve(new Set());

  buscarRegistados.then((registados) => {
    lista.innerHTML = '';

    contactos.forEach((c) => {
      const nome = (c.name && c.name[0]) || 'Contacto';
      const email = (c.email && c.email[0]) || '';
      const tel = (c.tel && c.tel[0]) || '';
      const estaRegistado = !!(email && registados.has(email.toLowerCase()));

      const item = document.createElement('div');
      item.className = 'chat-item';
      item.style.cursor = estaRegistado ? 'pointer' : 'default';

      const corAvatar = estaRegistado ? '#4a90d9' : '#667781';
      item.innerHTML =
        '<div class="avatar" style="background:' + corAvatar + ';">' + nome.substring(0, 2).toUpperCase() + '</div>' +
        '<div class="chat-info" style="flex:1; min-width:0;"><h4>' + nome + '</h4><p>' + (email || tel || 'Sem contacto disponível') + '</p></div>';

      if (estaRegistado) {
        item.onclick = () => iniciarConversaCom(email);
      } else {
        const btnConvidar = document.createElement('button');
        btnConvidar.innerText = 'Convidar';
        btnConvidar.style.cssText = 'background:var(--whatsapp-teal); color:#fff; border:none; border-radius:16px; padding:6px 14px; font-size:12px; cursor:pointer; flex-shrink:0;';
        btnConvidar.onclick = (e) => {
          e.stopPropagation();
          convidarContacto(nome, email, tel);
        };
        item.appendChild(btnConvidar);
      }

      lista.appendChild(item);
    });
  }).catch((err) => {
    console.error('Erro ao verificar utilizadores registados:', err);
    lista.innerHTML = '<p style="color:#f15c6d; font-size:13px; padding:16px;">Não foi possível verificar os contactos.</p>';
  });
}

// Convida um contacto que ainda não está no myFriens
function convidarContacto(nome, email, tel) {
  const link = window.location.origin + window.location.pathname;
  const texto = 'Olá ' + nome + '! Estou a usar o myFriens, uma app de conversas. Entra também: ' + link;

  if (navigator.share) {
    navigator.share({ text: texto }).catch(() => {});
    return;
  }
  if (email) {
    window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Convite para o myFriens') + '&body=' + encodeURIComponent(texto);
    return;
  }
  if (tel) {
    window.location.href = 'sms:' + tel + '?body=' + encodeURIComponent(texto);
    return;
  }
  navigator.clipboard.writeText(texto).then(() => alert('Link copiado! Envia-o ao teu contacto.'));
}

function fecharNovoContato() {
  document.getElementById('novo-contato-modal').classList.add('hidden');
}

// Cria (se necessário) e abre a conversa 1-para-1 com outro utilizador
function iniciarConversaCom(outroEmail) {
  const myEmail = getCurrentUserEmail();
  if (!myEmail || !outroEmail) return;

  const participantes = [myEmail, outroEmail].sort();
  const chatId = participantes.join('__');

  db.collection('chats').doc(chatId).set({
    type: '1v1',
    participantes: participantes,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
    .then(() => {
      fecharNovoContato();
      openChat(chatId, outroEmail.split('@')[0]);
    })
    .catch((err) => {
      console.error('Erro ao iniciar conversa:', err);
      alert('Não foi possível iniciar a conversa.');
    });
}

// Menu Flutuante
function toggleMenu() {
  document.getElementById('dropdown-menu').classList.toggle('hidden');
}

// Abrir Chat Individual / Grupo
let chatNameAtual = '';
let chatAvatarAtual = '';

function openChat(chatId, chatName) {
  currentChatId = chatId;
  chatNameAtual = chatName;
  chatAvatarAtual = chatName.substring(0, 2).toUpperCase();

  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('chat-room-screen').style.display = 'flex';
  mensagensSelecionadas.clear();
  renderHeaderNormal();

  atualizarBotaoMicOuEnviar();
  loadMessages();
}

function closeChat() {
  document.getElementById('chat-room-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  mensagensSelecionadas.clear();
  cancelarResposta();
  fecharChatMenu();
  fecharChatMenuMais();
  fecharPesquisaMensagens();
  fecharMediaModal();
}

// Alterna o cabeçalho do chat entre o modo normal e o modo de seleção de mensagens
function renderHeaderNormal() {
  document.getElementById('chat-header').innerHTML =
    '<div style="display:flex; align-items:center; flex:1; min-width:0;">' +
      '<span class="fa-solid fa-arrow-left" onclick="closeChat()" style="margin-right:15px; cursor:pointer; color:#aebac1; flex-shrink:0;"></span>' +
      '<div class="avatar" style="width:35px; height:35px; font-size:14px; margin-right:10px; flex-shrink:0;">' + chatAvatarAtual + '</div>' +
      '<h3 style="font-size:16px; color:#e9edef; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + chatNameAtual + '</h3>' +
    '</div>' +
    '<div class="header-icons" style="display:flex; align-items:center; flex-shrink:0;">' +
      '<span class="fa-solid fa-video" onclick="startVideoCall()" style="margin-right:15px;"></span>' +
      '<span class="fa-solid fa-phone" onclick="startVoiceCall()" style="margin-right:15px;"></span>' +
      '<span class="fa-solid fa-ellipsis-vertical" onclick="toggleChatMenu()"></span>' +
    '</div>';
}

function renderHeaderSelecao() {
  const n = mensagensSelecionadas.size;
  document.getElementById('chat-header').innerHTML =
    '<div style="display:flex; align-items:center; flex:1; min-width:0;">' +
      '<span class="fa-solid fa-xmark" onclick="cancelarSelecao()" style="margin-right:18px; cursor:pointer; color:#e9edef; font-size:18px;"></span>' +
      '<span style="color:#e9edef; font-size:16px;">' + n + '</span>' +
    '</div>' +
    '<div style="display:flex; align-items:center; gap:22px;">' +
      (n === 1 ? '<span class="fa-solid fa-reply" onclick="responderSelecionada()" style="color:#aebac1; font-size:17px; cursor:pointer;"></span>' : '') +
      '<span class="fa-solid fa-copy" onclick="copiarSelecionadas()" style="color:#aebac1; font-size:17px; cursor:pointer;"></span>' +
      '<span class="fa-solid fa-trash" onclick="abrirModalApagar()" style="color:#aebac1; font-size:17px; cursor:pointer;"></span>' +
      '<span class="fa-solid fa-share" onclick="encaminharSelecionadas()" style="color:#aebac1; font-size:17px; cursor:pointer;"></span>' +
    '</div>';
}

// Constrói o conteúdo interno de um balão consoante o tipo de mensagem
function construirConteudoMensagem(msg) {
  if (msg.type === 'imagem') {
    const img = document.createElement('img');
    img.src = msg.url;
    img.style.cssText = 'max-width:100%; border-radius:8px; display:block; cursor:pointer;';
    img.onclick = () => {
      if (mensagensSelecionadas.size > 0) return;
      window.open(msg.url, '_blank');
    };
    return img;
  }

  if (msg.type === 'documento') {
    const link = document.createElement('a');
    link.href = msg.url;
    link.target = '_blank';
    link.style.cssText = 'display:flex; align-items:center; gap:8px; color:#111; text-decoration:none; font-size:14px;';
    link.innerHTML = '<i class="fa-solid fa-file-lines" style="font-size:20px;"></i><span style="word-break:break-word;">' +
      (msg.nomeFicheiro || 'Documento') + '</span>';
    return link;
  }

  if (msg.type === 'contacto') {
    const card = document.createElement('div');
    card.style.cssText = 'display:flex; align-items:center; gap:10px; min-width:150px;';
    card.innerHTML = '<i class="fa-solid fa-address-card" style="font-size:24px; color:#00a884;"></i>' +
      '<div><div style="font-weight:bold;">' + (msg.nomeContacto || 'Contacto') + '</div>' +
      '<div style="font-size:12px; color:#3b4a54;">' + (msg.telefoneContacto || '') + '</div></div>';
    return card;
  }

  if (msg.type === 'audio') {
    const audio = document.createElement('audio');
    audio.src = msg.url;
    audio.controls = true;
    audio.style.cssText = 'max-width:220px; height:36px;';
    return audio;
  }

  const span = document.createElement('span');
  span.innerText = msg.text || '';
  return span;
}

// Prévia curta de uma mensagem (usada em respostas e reencaminhamento)
function previaMensagem(msg) {
  if (msg.type === 'imagem') return '📷 Imagem';
  if (msg.type === 'audio') return '🎤 Áudio';
  if (msg.type === 'documento') return '📄 ' + (msg.nomeFicheiro || 'Documento');
  if (msg.type === 'contacto') return '👤 ' + (msg.nomeContacto || 'Contacto');
  return msg.text || '';
}

// Estado de seleção de mensagens (para responder/copiar/apagar/encaminhar)
const mensagensSelecionadas = new Map(); // id -> { ref, msg, isMe }
let respostaAtual = null; // { sender, preview }

// Firestore: Carregar Mensagens em Tempo Real
function loadMessages() {
  const container = document.getElementById('messages-container');
  const myEmail = getCurrentUserEmail();

  db.collection('chats').doc(currentChatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      container.innerHTML = '';
      const idsVisiveis = new Set();

      snapshot.forEach((doc) => {
        const msg = doc.data();
        if (msg.apagadoPara && msg.apagadoPara.includes(myEmail)) return; // apagada só para mim

        const id = doc.id;
        idsVisiveis.add(id);
        const isMe = msg.sender === myEmail;

        const linha = document.createElement('div');
        linha.dataset.msgId = id;
        linha.style.cssText = 'display:flex; width:100%; padding:2px 0; ' + (isMe ? 'justify-content:flex-end;' : 'justify-content:flex-start;');

        const bubble = document.createElement('div');
        bubble.style.cssText = `
          background: ${isMe ? 'var(--whatsapp-outgoing)' : 'var(--whatsapp-incoming)'};
          color: #111;
          padding: ${(msg.type === 'imagem' || msg.type === 'audio') ? '4px' : '8px 12px'};
          border-radius: 7px;
          max-width: 70%;
          font-size: 14px;
          word-break: break-word;
        `;

        if (msg.encaminhada) {
          const enc = document.createElement('div');
          enc.style.cssText = 'font-size:11px; color:#667781; font-style:italic; margin-bottom:2px;';
          enc.innerText = '↪ Encaminhada';
          bubble.appendChild(enc);
        }

        if (msg.replyTo) {
          const quote = document.createElement('div');
          quote.style.cssText = 'border-left:3px solid var(--whatsapp-teal); padding:4px 8px; margin-bottom:4px; background:rgba(0,0,0,0.06); border-radius:4px; font-size:12px; color:#3b4a54;';
          quote.innerHTML = '<div style="font-weight:bold; color:#00a884;">' + (msg.replyTo.sender === myEmail ? 'Tu' : msg.replyTo.sender) + '</div><div>' + msg.replyTo.preview + '</div>';
          bubble.appendChild(quote);
        }

        bubble.appendChild(construirConteudoMensagem(msg));
        linha.appendChild(bubble);
        container.appendChild(linha);

        anexarSelecaoNaLinha(linha, id, doc.ref, msg, isMe);

        if (mensagensSelecionadas.has(id)) {
          linha.style.background = 'rgba(0,168,132,0.15)';
        }
      });

      // Remove da seleção mensagens que já não existem (foram apagadas para todos)
      let mudou = false;
      mensagensSelecionadas.forEach((v, id) => {
        if (!idsVisiveis.has(id)) {
          mensagensSelecionadas.delete(id);
          mudou = true;
        }
      });
      if (mudou) {
        if (mensagensSelecionadas.size > 0) renderHeaderSelecao();
        else renderHeaderNormal();
      }

      container.scrollTop = container.scrollHeight;
    }, (error) => {
      console.error('Erro ao carregar mensagens:', error);
      container.innerHTML = '<p style="text-align:center;color:#8696a0;font-size:13px;">Não foi possível carregar as mensagens. Verifica as regras de segurança do Firestore.</p>';
    });
}

// Pressão longa (ou clique, já em modo seleção) para selecionar uma mensagem
let temporizadorPressao = null;
let pressaoLongaAcionada = false;

function anexarSelecaoNaLinha(linha, id, ref, msg, isMe) {
  const iniciar = () => {
    pressaoLongaAcionada = false;
    temporizadorPressao = setTimeout(() => {
      pressaoLongaAcionada = true;
      alternarSelecaoMensagem(linha, id, ref, msg, isMe);
    }, 450);
  };
  const cancelar = () => clearTimeout(temporizadorPressao);

  linha.addEventListener('touchstart', iniciar, { passive: true });
  linha.addEventListener('touchend', cancelar);
  linha.addEventListener('touchmove', cancelar);
  linha.addEventListener('mousedown', iniciar);
  linha.addEventListener('mouseup', cancelar);
  linha.addEventListener('mouseleave', cancelar);

  linha.addEventListener('click', () => {
    if (pressaoLongaAcionada) { pressaoLongaAcionada = false; return; }
    if (mensagensSelecionadas.size > 0) {
      alternarSelecaoMensagem(linha, id, ref, msg, isMe);
    }
  });
}

function alternarSelecaoMensagem(linha, id, ref, msg, isMe) {
  if (mensagensSelecionadas.has(id)) {
    mensagensSelecionadas.delete(id);
    linha.style.background = 'transparent';
  } else {
    mensagensSelecionadas.set(id, { ref, msg, isMe });
    linha.style.background = 'rgba(0,168,132,0.15)';
  }

  if (mensagensSelecionadas.size > 0) {
    renderHeaderSelecao();
  } else {
    renderHeaderNormal();
  }
}

function cancelarSelecao() {
  mensagensSelecionadas.forEach((v, id) => {
    const el = document.querySelector('#messages-container [data-msg-id="' + id + '"]');
    if (el) el.style.background = 'transparent';
  });
  mensagensSelecionadas.clear();
  renderHeaderNormal();
}

// Copiar mensagens selecionadas
function copiarSelecionadas() {
  const textos = Array.from(mensagensSelecionadas.values()).map((v) => previaMensagem(v.msg)).join('\n');
  navigator.clipboard.writeText(textos)
    .then(() => cancelarSelecao())
    .catch((err) => {
      console.error('Erro ao copiar:', err);
      alert('Não foi possível copiar.');
    });
}

// Apagar mensagens selecionadas
function abrirModalApagar() {
  const todasMinhas = Array.from(mensagensSelecionadas.values()).every((v) => v.isMe);
  document.getElementById('opcao-apagar-todos').classList.toggle('hidden', !todasMinhas);
  document.getElementById('delete-modal').classList.remove('hidden');
}

function fecharModalApagar() {
  document.getElementById('delete-modal').classList.add('hidden');
}

function apagarParaMim() {
  const email = getCurrentUserEmail();
  const promessas = Array.from(mensagensSelecionadas.values()).map((v) =>
    v.ref.update({ apagadoPara: firebase.firestore.FieldValue.arrayUnion(email) })
      .catch((err) => console.error('Erro ao apagar para mim:', err))
  );
  Promise.all(promessas).finally(() => {
    fecharModalApagar();
    cancelarSelecao();
  });
}

function apagarParaTodos() {
  const promessas = Array.from(mensagensSelecionadas.values()).map((v) =>
    v.ref.delete().catch((err) => console.error('Erro ao apagar para todos:', err))
  );
  Promise.all(promessas).finally(() => {
    fecharModalApagar();
    cancelarSelecao();
  });
}

// Responder à mensagem selecionada (só disponível com exatamente 1 selecionada)
function responderSelecionada() {
  const entrada = Array.from(mensagensSelecionadas.entries())[0];
  if (!entrada) return;
  const [, v] = entrada;

  respostaAtual = { sender: v.msg.sender, preview: previaMensagem(v.msg) };
  const myEmail = getCurrentUserEmail();
  document.getElementById('reply-bar-remetente').innerText = respostaAtual.sender === myEmail ? 'Tu' : respostaAtual.sender;
  document.getElementById('reply-bar-preview').innerText = respostaAtual.preview;
  document.getElementById('reply-bar').classList.remove('hidden');

  cancelarSelecao();
  const input = document.getElementById('message-input');
  if (input) input.focus();
}

function cancelarResposta() {
  respostaAtual = null;
  const barra = document.getElementById('reply-bar');
  if (barra) barra.classList.add('hidden');
}

// Reencaminhar mensagens selecionadas (reenvia para este chat, já que ainda só existe um)
function encaminharSelecionadas() {
  const myEmail = getCurrentUserEmail();
  const promessas = Array.from(mensagensSelecionadas.values()).map((v) => {
    const nova = Object.assign({}, v.msg, {
      sender: myEmail,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      encaminhada: true
    });
    delete nova.replyTo;
    delete nova.apagadoPara;
    return db.collection('chats').doc(currentChatId).collection('messages').add(nova);
  });

  Promise.all(promessas)
    .then(() => cancelarSelecao())
    .catch((err) => {
      console.error('Erro ao encaminhar:', err);
      alert('Não foi possível encaminhar a mensagem.');
    });
}

// Firestore: Enviar Mensagem
function sendFirebaseMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  const myEmail = getCurrentUserEmail();
  if (!text || !currentChatId) return;

  const dadosMensagem = {
    text: text,
    sender: myEmail,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (respostaAtual) {
    dadosMensagem.replyTo = { sender: respostaAtual.sender, preview: respostaAtual.preview };
  }

  db.collection('chats').doc(currentChatId).collection('messages').add(dadosMensagem).then(() => {
    input.value = '';
    atualizarBotaoMicOuEnviar();
    cancelarResposta();
  }).catch(err => {
    console.error('Erro ao enviar mensagem:', err);
    alert('Não foi possível enviar a mensagem. Verifica as regras de segurança do Firestore.');
  });
}

// Alterna entre o botão de microfone e o botão de enviar consoante haja texto escrito
function atualizarBotaoMicOuEnviar() {
  const input = document.getElementById('message-input');
  const btnMic = document.getElementById('btn-mic');
  const btnSend = document.getElementById('btn-send');
  if (!input || !btnMic || !btnSend) return;

  if (input.value.trim().length > 0) {
    btnMic.classList.add('hidden');
    btnSend.classList.remove('hidden');
  } else {
    btnMic.classList.remove('hidden');
    btnSend.classList.add('hidden');
  }
}

// Enviar com a tecla Enter + alternar botão mic/enviar ao escrever
document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendFirebaseMessage();
      }
    });
    messageInput.addEventListener('input', atualizarBotaoMicOuEnviar);
  }
});

function startVoiceCall() { alert('A iniciar chamada...'); }
function startVideoCall() { alert('A iniciar videochamada...'); }

// Menu de Anexo (Galeria / Câmara / Contactos / Documentos)
function toggleAttachMenu() {
  document.getElementById('attach-menu').classList.toggle('hidden');
}

function fecharAttachMenu() {
  document.getElementById('attach-menu').classList.add('hidden');
}

// Fecha o menu ao tocar fora dele
document.addEventListener('click', (e) => {
  const menu = document.getElementById('attach-menu');
  if (!menu || menu.classList.contains('hidden')) return;
  const dentroDoMenu = menu.contains(e.target);
  const nosBotoes = e.target.classList && (e.target.classList.contains('fa-plus') || e.target.classList.contains('fa-paperclip'));
  if (!dentroDoMenu && !nosBotoes) fecharAttachMenu();
});

function selecionarGaleria() {
  fecharAttachMenu();
  document.getElementById('input-galeria').click();
}

function selecionarCamara() {
  fecharAttachMenu();
  document.getElementById('input-camara').click();
}

function selecionarDocumento() {
  fecharAttachMenu();
  document.getElementById('input-documento').click();
}

['input-galeria', 'input-camara'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', (e) => tratarFicheiroSelecionado(e, 'imagem'));
});
{
  const elDoc = document.getElementById('input-documento');
  if (elDoc) elDoc.addEventListener('change', (e) => tratarFicheiroSelecionado(e, 'documento'));
}

function tratarFicheiroSelecionado(event, tipo) {
  const file = event.target.files[0];
  event.target.value = ''; // permite selecionar o mesmo ficheiro outra vez de seguida
  if (!file || !currentChatId) return;
  enviarFicheiroParaChat(file, tipo);
}

// Faz upload para o Cloudinary e regista a mensagem no Firestore
function enviarFicheiroParaChat(file, tipo) {
  const myEmail = getCurrentUserEmail();

  const container = document.getElementById('messages-container');
  const aviso = document.createElement('div');
  aviso.style.cssText = 'align-self:flex-end; color:#667781; font-size:12px; padding:4px;';
  aviso.innerText = 'A enviar ' + file.name + '...';
  container.appendChild(aviso);
  container.scrollTop = container.scrollHeight;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload', {
    method: 'POST',
    body: formData
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.secure_url) {
        throw new Error((data.error && data.error.message) || 'Falha no upload');
      }
      return db.collection('chats').doc(currentChatId).collection('messages').add({
        type: tipo,
        url: data.secure_url,
        nomeFicheiro: file.name,
        sender: myEmail,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .catch((err) => {
      console.error('Erro ao enviar ficheiro:', err);
      alert('Não foi possível enviar o ficheiro. Verifica a ligação e tenta novamente.');
    })
    .finally(() => {
      aviso.remove();
    });
}

// Importar contacto do telefone (Contact Picker API — só Chrome Android)
function selecionarContacto() {
  fecharAttachMenu();

  if (!('contacts' in navigator) || !('ContactsManager' in window)) {
    alert('O teu navegador não suporta importar contactos diretamente. Esta função só funciona no Chrome para Android.');
    return;
  }

  navigator.contacts.select(['name', 'tel'], { multiple: false })
    .then((contactos) => {
      if (!contactos || !contactos.length) return;
      const c = contactos[0];
      const nome = (c.name && c.name[0]) || 'Contacto';
      const telefone = (c.tel && c.tel[0]) || '';
      enviarContactoParaChat(nome, telefone);
    })
    .catch((err) => {
      console.error('Erro ao importar contacto:', err);
    });
}

function enviarContactoParaChat(nome, telefone) {
  const myEmail = getCurrentUserEmail();
  if (!currentChatId) return;

  db.collection('chats').doc(currentChatId).collection('messages').add({
    type: 'contacto',
    nomeContacto: nome,
    telefoneContacto: telefone,
    sender: myEmail,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch((err) => {
    console.error('Erro ao enviar contacto:', err);
    alert('Não foi possível enviar o contacto.');
  });
}

// Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('Erro SW:', err));
  });
}

// ---- Menu do cabeçalho (3 pontos) ----
function toggleChatMenu() {
  fecharChatMenuMais();
  document.getElementById('chat-menu').classList.toggle('hidden');
  atualizarTextoNotificacao();
}

function fecharChatMenu() {
  const el = document.getElementById('chat-menu');
  if (el) el.classList.add('hidden');
}

function toggleChatMenuMais(event) {
  if (event) event.stopPropagation();
  document.getElementById('chat-menu').classList.add('hidden');
  document.getElementById('chat-menu-mais').classList.remove('hidden');
}

function fecharChatMenuMais() {
  const el = document.getElementById('chat-menu-mais');
  if (el) el.classList.add('hidden');
}

// Fecha os menus do cabeçalho ao tocar fora deles
document.addEventListener('click', (e) => {
  const menu = document.getElementById('chat-menu');
  const menuMais = document.getElementById('chat-menu-mais');
  const noBotao = e.target.classList && e.target.classList.contains('fa-ellipsis-vertical');

  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !noBotao) {
    fecharChatMenu();
  }
  if (menuMais && !menuMais.classList.contains('hidden') && !menuMais.contains(e.target) && !noBotao) {
    fecharChatMenuMais();
  }
});

// Pequeno aviso temporário (para funções ainda não implementadas)
function mostrarToast(texto) {
  const toast = document.createElement('div');
  toast.innerText = texto;
  toast.style.cssText = 'position:absolute; bottom:90px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:8px 16px; border-radius:20px; font-size:13px; z-index:300; box-shadow:0 2px 8px rgba(0,0,0,0.3); white-space:nowrap;';
  const tela = document.getElementById('chat-room-screen');
  tela.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function acaoMenuChat(tipo) {
  fecharChatMenu();
  fecharChatMenuMais();
  const nomes = {
    'novo-grupo': 'Novo grupo',
    'ver-contato': 'Ver Contato',
    'temporarias': 'Mensagens temporárias',
    'tema': 'Tema da conversa',
    'estrela': 'Marcar com estrelas',
    'nao-lida': 'Marcar como não lida'
  };
  mostrarToast((nomes[tipo] || 'Função') + ' — em breve');
}

function denunciarConversa() {
  fecharChatMenuMais();
  mostrarToast('Denunciar — em breve');
}

function bloquearConversa() {
  fecharChatMenuMais();
  mostrarToast('Bloquear — em breve');
}

// ---- Desativar/ativar notificação (preferência local por conversa) ----
function toggleNotificacao() {
  const chave = 'myfriens_silenciar_' + currentChatId;
  const silenciadoAgora = window.localStorage.getItem(chave) === '1';
  window.localStorage.setItem(chave, silenciadoAgora ? '0' : '1');
  fecharChatMenu();
}

function atualizarTextoNotificacao() {
  const el = document.getElementById('item-notificacao');
  if (!el || !currentChatId) return;
  const silenciado = window.localStorage.getItem('myfriens_silenciar_' + currentChatId) === '1';
  el.innerText = silenciado ? 'Ativar notificação' : 'Desativar notificação';
}

// ---- Pesquisar nesta conversa ----
function abrirPesquisaMensagens() {
  fecharChatMenu();
  document.getElementById('search-bar').classList.remove('hidden');
  const input = document.getElementById('search-input');
  input.value = '';
  input.focus();
}

function fecharPesquisaMensagens() {
  const barra = document.getElementById('search-bar');
  if (barra) barra.classList.add('hidden');
  document.querySelectorAll('#messages-container [data-msg-id]').forEach((el) => {
    el.style.display = 'flex';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const termo = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('#messages-container [data-msg-id]').forEach((el) => {
        const texto = el.innerText.toLowerCase();
        el.style.display = (!termo || texto.includes(termo)) ? 'flex' : 'none';
      });
    });
  }
});

// ---- Ficheiros, ligações e documentos ----
let itensMediaAtual = [];
let vistaMediaAtual = 'grade'; // 'grade' ou 'lista'

function abrirFicheirosLigacoes() {
  fecharChatMenu();
  const modal = document.getElementById('media-modal');
  const lista = document.getElementById('media-modal-lista');
  lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:14px;">A carregar...</p>';
  modal.classList.remove('hidden');

  db.collection('chats').doc(currentChatId).collection('messages')
    .orderBy('timestamp', 'desc')
    .get()
    .then((snapshot) => {
      itensMediaAtual = [];
      snapshot.forEach((doc) => {
        const msg = doc.data();
        if (msg.type !== 'imagem' && msg.type !== 'documento') return;
        itensMediaAtual.push({
          type: msg.type,
          url: msg.url,
          nomeFicheiro: msg.nomeFicheiro || (msg.type === 'imagem' ? 'Imagem' : 'Documento')
        });
      });
      renderizarMediaModal();
    })
    .catch((err) => {
      console.error('Erro ao carregar ficheiros:', err);
      lista.innerHTML = '<p style="color:#f15c6d; font-size:13px; padding:16px;">Não foi possível carregar os ficheiros.</p>';
    });
}

function alternarVistaMedia() {
  vistaMediaAtual = vistaMediaAtual === 'grade' ? 'lista' : 'grade';
  const btn = document.getElementById('btn-vista-media');
  if (btn) btn.className = vistaMediaAtual === 'grade' ? 'fa-solid fa-list' : 'fa-solid fa-table-cells';
  renderizarMediaModal();
}

function renderizarMediaModal() {
  const lista = document.getElementById('media-modal-lista');

  if (!itensMediaAtual.length) {
    lista.style.cssText = 'flex:1; overflow-y:auto;';
    lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px; text-align:center;">Ainda não há ficheiros ou documentos nesta conversa.</p>';
    return;
  }

  if (vistaMediaAtual === 'grade') {
    lista.style.cssText = 'flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(3, 1fr); gap:3px; padding:3px;';
    lista.innerHTML = '';
    itensMediaAtual.forEach((item) => {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.style.cssText = 'display:block; aspect-ratio:1; overflow:hidden; background:#182229; position:relative;';

      if (item.type === 'imagem') {
        link.innerHTML = '<img src="' + item.url + '" style="width:100%; height:100%; object-fit:cover; display:block;">';
      } else {
        link.innerHTML = '<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:6px; text-align:center;">' +
          '<i class="fa-solid fa-file-lines" style="font-size:22px; color:#8696a0;"></i>' +
          '<span style="font-size:10px; color:#aebac1; word-break:break-word; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">' + item.nomeFicheiro + '</span>' +
          '</div>';
      }
      lista.appendChild(link);
    });
    return;
  }

  // Vista em lista
  lista.style.cssText = 'flex:1; overflow-y:auto;';
  lista.innerHTML = '';
  itensMediaAtual.forEach((item) => {
    const linha = document.createElement('a');
    linha.href = item.url;
    linha.target = '_blank';
    linha.style.cssText = 'display:flex; align-items:center; gap:10px; padding:12px 16px; color:#e9edef; text-decoration:none; border-bottom:1px solid #182229;';
    const iconClasse = item.type === 'imagem' ? 'fa-image' : 'fa-file-lines';
    linha.innerHTML = '<i class="fa-solid ' + iconClasse + '" style="font-size:18px; color:#8696a0; width:20px; text-align:center;"></i>' +
      '<span style="font-size:14px; word-break:break-word;">' + item.nomeFicheiro + '</span>';
    lista.appendChild(linha);
  });
}

function fecharMediaModal() {
  const modal = document.getElementById('media-modal');
  if (modal) modal.classList.add('hidden');
}

// ---- Limpar conversa (apaga todas as mensagens só para mim) ----
function limparConversa() {
  fecharChatMenuMais();
  if (!window.confirm('Limpar todas as mensagens desta conversa? Isto só afeta o teu dispositivo.')) return;

  const email = getCurrentUserEmail();
  db.collection('chats').doc(currentChatId).collection('messages').get()
    .then((snapshot) => {
      const lote = db.batch();
      snapshot.forEach((doc) => {
        lote.update(doc.ref, { apagadoPara: firebase.firestore.FieldValue.arrayUnion(email) });
      });
      return lote.commit();
    })
    .catch((err) => {
      console.error('Erro ao limpar conversa:', err);
      alert('Não foi possível limpar a conversa.');
    });
}

// Gravação de áudio (mensagem de voz)
let gravadorAtual = null;
let audioChunksAtual = [];
let cronometroGravacao = null;
let segundosGravacao = 0;
let gravacaoCancelada = false;

function mostrarBarraGravacao() {
  document.getElementById('message-pill').classList.add('hidden');
  document.getElementById('btn-mic').classList.add('hidden');
  document.getElementById('btn-send').classList.add('hidden');
  document.getElementById('recording-bar').classList.remove('hidden');
}

function esconderBarraGravacao() {
  document.getElementById('recording-bar').classList.add('hidden');
  document.getElementById('message-pill').classList.remove('hidden');
  document.getElementById('recording-timer').innerText = '00:00';
  atualizarBotaoMicOuEnviar();
}

function atualizarCronometroGravacao() {
  segundosGravacao++;
  const m = String(Math.floor(segundosGravacao / 60)).padStart(2, '0');
  const s = String(segundosGravacao % 60).padStart(2, '0');
  const el = document.getElementById('recording-timer');
  if (el) el.innerText = m + ':' + s;
}

function iniciarGravacao() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('O teu navegador não suporta gravação de áudio.');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      audioChunksAtual = [];
      gravacaoCancelada = false;
      gravadorAtual = new MediaRecorder(stream);

      gravadorAtual.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) audioChunksAtual.push(e.data);
      });

      gravadorAtual.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(cronometroGravacao);

        if (!gravacaoCancelada && audioChunksAtual.length) {
          const blob = new Blob(audioChunksAtual, { type: 'audio/webm' });
          const file = new File([blob], 'audio_' + Date.now() + '.webm', { type: 'audio/webm' });
          enviarFicheiroParaChat(file, 'audio');
        }
        esconderBarraGravacao();
      });

      gravadorAtual.start();
      segundosGravacao = 0;
      mostrarBarraGravacao();
      cronometroGravacao = setInterval(atualizarCronometroGravacao, 1000);
    })
    .catch((err) => {
      console.error('Erro ao aceder ao microfone:', err);
      alert('Não foi possível aceder ao microfone. Verifica as permissões do navegador.');
    });
}

function pararGravacaoEEnviar() {
  if (gravadorAtual && gravadorAtual.state !== 'inactive') {
    gravacaoCancelada = false;
    gravadorAtual.stop();
  }
}

function cancelarGravacao() {
  if (gravadorAtual && gravadorAtual.state !== 'inactive') {
    gravacaoCancelada = true;
    gravadorAtual.stop();
  }
}
