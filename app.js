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
  const usuarioRef = db.collection('usuarios').doc(email);

  usuarioRef.get().then((doc) => {
    const saiuDoGrupo = doc.exists && doc.data().saiuDoGrupoGeral === true;

    return usuarioRef.set({
      email: email,
      ultimaEntrada: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
      if (saiuDoGrupo) return;
      return db.collection('chats').doc('geral').set({
        type: 'grupo',
        nome: 'Chat Geral da Comunidade',
        participantes: firebase.firestore.FieldValue.arrayUnion(email)
      }, { merge: true });
    });
  }).catch((err) => console.error('Erro ao registar utilizador:', err));
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
let unsubscribeComunidades = null;

function switchTab(tabName, element) {
  document.querySelectorAll('.tab-item').forEach(tab => tab.classList.remove('active'));
  element.classList.add('active');

  const contentArea = document.getElementById('tab-content');
  const fab = document.getElementById('fab-nova-conversa');
  const fabComunidade = document.getElementById('fab-nova-comunidade');

  // Sai da escuta em tempo real da lista de conversas/comunidades ao trocar de separador
  if (unsubscribeConversas) {
    unsubscribeConversas();
    unsubscribeConversas = null;
  }
  if (unsubscribeComunidades) {
    unsubscribeComunidades();
    unsubscribeComunidades = null;
  }

  fab.classList.add('hidden');
  fabComunidade.classList.add('hidden');

  if (tabName === 'chats') {
    fab.classList.remove('hidden');
    contentArea.innerHTML = '<div id="lista-conversas"></div>';
    escutarListaConversas();
  } else if (tabName === 'updates') {
    contentArea.innerHTML = `<div style="padding: 20px; color: #8696a0; font-size:14px;"><strong>Estados</strong><br><br>Partilha atualizações com os teus amigos.</div>`;
  } else if (tabName === 'communities') {
    contentArea.innerHTML = '<div id="lista-comunidades"></div>';
    escutarListaComunidades();
  } else if (tabName === 'calls') {
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
      const container = document.getElementById('lista-conversas');
      if (!container) return;

      // O grupo "geral" aparece sempre primeiro, o resto por ordem de chegada
      const docs = snapshot.docs.slice().sort((a, b) => {
        if (a.id === 'geral') return -1;
        if (b.id === 'geral') return 1;
        return 0;
      });

      container.innerHTML = '';

      if (!docs.length) {
        container.innerHTML = '<p style="padding:24px; color:#8696a0; font-size:14px; text-align:center;">Ainda não tens conversas.</p>';
        return;
      }

      docs.forEach((doc) => {
        const chat = doc.data();
        const item = document.createElement('div');
        item.className = 'chat-item';

        if (doc.id === 'geral' || chat.type === 'grupo') {
          const nomeGrupo = chat.nome || 'Chat Geral da Comunidade';
          item.onclick = () => openChat('geral', nomeGrupo);
          item.innerHTML =
            '<div class="avatar" style="background:var(--whatsapp-teal);">GG</div>' +
            '<div class="chat-info"><h4>' + nomeGrupo + '</h4><p>Clica para entrar na conversa em tempo real.</p></div>';
        } else {
          const outroEmail = (chat.participantes || []).find((p) => p !== myEmail) || 'Contacto';
          const nome = outroEmail.split('@')[0];
          item.onclick = () => openChat(doc.id, nome, outroEmail);
          item.innerHTML =
            '<div class="avatar" style="background:#4a90d9;">' + nome.substring(0, 2).toUpperCase() + '</div>' +
            '<div class="chat-info"><h4>' + nome + '</h4><p>' + outroEmail + '</p></div>';
        }

        container.appendChild(item);
      });
    }, (err) => console.error('Erro ao carregar conversas:', err));
}

// ================= COMUNIDADES =================
function escutarListaComunidades() {
  const myEmail = getCurrentUserEmail();
  if (!myEmail) return;

  unsubscribeComunidades = db.collection('comunidades')
    .where('membros', 'array-contains', myEmail)
    .onSnapshot((snapshot) => {
      const container = document.getElementById('lista-comunidades');
      if (!container) return;
      container.innerHTML = '';

      const fabComunidade = document.getElementById('fab-nova-comunidade');

      if (snapshot.empty) {
        if (fabComunidade) fabComunidade.classList.add('hidden');
        container.innerHTML =
          '<div style="padding:30px 24px; text-align:center;">' +
            '<div style="width:100px; height:100px; border-radius:20px; background:#182229; margin:20px auto; display:flex; align-items:center; justify-content:center;">' +
              '<span class="fa-solid fa-people-group" style="color:var(--whatsapp-teal); font-size:38px;"></span>' +
            '</div>' +
            '<h3 style="color:#e9edef; font-size:17px; margin-bottom:10px;">Mantém-te em contacto com uma comunidade</h3>' +
            '<p style="color:#8696a0; font-size:13px; line-height:1.5; margin-bottom:24px;">As comunidades juntam os membros em grupos organizados por tópicos e permitem receber facilmente comunicados dos administradores.</p>' +
            '<button onclick="abrirCriarComunidade()" style="width:100%; padding:13px; background:var(--whatsapp-teal); color:#fff; border:none; border-radius:24px; font-weight:bold; font-size:14px; cursor:pointer;">Criar uma comunidade</button>' +
          '</div>';
        return;
      }

      if (fabComunidade) fabComunidade.classList.remove('hidden');

      snapshot.forEach((doc) => {
        const com = doc.data();
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => abrirComunidade(doc.id, com);
        item.innerHTML =
          '<div class="avatar" style="background:#a682e3;"><i class="fa-solid fa-people-group" style="font-size:16px;"></i></div>' +
          '<div class="chat-info"><h4>' + (com.nome || 'Comunidade') + '</h4><p>Comunidade</p></div>';
        container.appendChild(item);
      });
    }, (err) => console.error('Erro ao carregar comunidades:', err));
}

let comunidadeFotoFicheiro = null;

function abrirCriarComunidade() {
  document.getElementById('comunidade-nome').value = '';
  document.getElementById('comunidade-descricao').value = 'Olá a todos! Esta comunidade é para os membros conversarem em grupos organizados por tópicos e receberem comunicados importantes.';
  document.getElementById('criar-comunidade-status').innerText = '';
  comunidadeFotoFicheiro = null;
  document.getElementById('comunidade-foto-preview').innerHTML = '<span class="fa-solid fa-users" style="color:#667781; font-size:34px;"></span>';
  atualizarContadorComunidade();
  document.getElementById('criar-comunidade-modal').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const inputFoto = document.getElementById('comunidade-foto-input');
  if (inputFoto) {
    inputFoto.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      comunidadeFotoFicheiro = file;
      const preview = document.getElementById('comunidade-foto-preview');
      preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="width:100%; height:100%; object-fit:cover;">';
    });
  }
});

function atualizarContadorComunidade() {
  const nome = document.getElementById('comunidade-nome').value;
  document.getElementById('comunidade-nome-contador').innerText = nome.length + '/100';
}

function fecharCriarComunidade() {
  document.getElementById('criar-comunidade-modal').classList.add('hidden');
}

function criarComunidade() {
  const nome = document.getElementById('comunidade-nome').value.trim();
  const descricao = document.getElementById('comunidade-descricao').value.trim();
  const status = document.getElementById('criar-comunidade-status');
  const myEmail = getCurrentUserEmail();

  if (!nome) {
    status.style.color = '#f15c6d';
    status.innerText = 'Escreve um nome para a comunidade.';
    return;
  }

  status.style.color = '#8696a0';
  status.innerText = 'A criar...';

  const comunidadeRef = db.collection('comunidades').doc();

  const enviarFoto = comunidadeFotoFicheiro
    ? (() => {
        const formData = new FormData();
        formData.append('file', comunidadeFotoFicheiro);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        return fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload', { method: 'POST', body: formData })
          .then((res) => res.json())
          .then((data) => data.secure_url || null)
          .catch(() => null);
      })()
    : Promise.resolve(null);

  enviarFoto.then((fotoUrl) => comunidadeRef.set({
    nome: nome,
    descricao: descricao,
    foto: fotoUrl || null,
    criadoPor: myEmail,
    admins: [myEmail],
    membros: [myEmail],
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }))
    .then(() => db.collection('chats').doc(comunidadeRef.id + '_comunicados').set({
      type: 'anuncio',
      nome: 'Comunicados',
      comunidadeId: comunidadeRef.id,
      apenasAdminsEscrevem: true,
      admins: [myEmail],
      participantes: [myEmail]
    }))
    .then(() => db.collection('chats').add({
      type: 'grupo',
      nome: 'Geral',
      comunidadeId: comunidadeRef.id,
      participantes: [myEmail]
    }))
    .then(() => {
      fecharCriarComunidade();
      abrirComunidade(comunidadeRef.id, { nome: nome, admins: [myEmail], membros: [myEmail] });
    })
    .catch((err) => {
      console.error('Erro ao criar comunidade:', err);
      status.style.color = '#f15c6d';
      status.innerText = 'Não foi possível criar (' + (err.code || err.message || 'erro') + '). Verifica as regras do Firestore.';
    });
}

let comunidadeAtualId = null;
let comunidadeAtualDados = null;
let unsubscribeGruposComunidade = null;

function abrirComunidade(comunidadeId, dados) {
  comunidadeAtualId = comunidadeId;
  comunidadeAtualDados = dados;

  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('community-screen').style.display = 'flex';
  document.getElementById('community-nome').innerText = dados.nome || 'Comunidade';
  document.getElementById('community-subtitulo').innerText = 'Comunidade';

  escutarGruposComunidade();
}

function fecharComunidade() {
  document.getElementById('community-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  if (unsubscribeGruposComunidade) { unsubscribeGruposComunidade(); unsubscribeGruposComunidade = null; }
  fecharComunidadeMenu();
  comunidadeAtualId = null;
}

function toggleComunidadeMenu() {
  document.getElementById('comunidade-menu').classList.toggle('hidden');
}

function fecharComunidadeMenu() {
  const el = document.getElementById('comunidade-menu');
  if (el) el.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('comunidade-menu');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !(e.target.classList && e.target.classList.contains('fa-ellipsis-vertical'))) {
    fecharComunidadeMenu();
  }
});

function escutarGruposComunidade() {
  if (unsubscribeGruposComunidade) unsubscribeGruposComunidade();

  unsubscribeGruposComunidade = db.collection('chats')
    .where('comunidadeId', '==', comunidadeAtualId)
    .onSnapshot((snapshot) => {
      const container = document.getElementById('comunidade-lista-grupos');
      if (!container) return;
      container.innerHTML = '';

      const anuncio = snapshot.docs.find((d) => d.data().type === 'anuncio');
      const grupos = snapshot.docs.filter((d) => d.data().type !== 'anuncio');

      document.getElementById('community-subtitulo').innerText = 'Comunidade · ' + grupos.length + ' grupo' + (grupos.length === 1 ? '' : 's');

      function criarItemChat(doc, ehAnuncio) {
        const chat = doc.data();
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => openChat(doc.id, chat.nome, null, {
          tipo: ehAnuncio ? 'anuncio' : 'grupo',
          comunidadeId: comunidadeAtualId,
          apenasAdmins: !!chat.apenasAdminsEscrevem,
          admins: chat.admins || []
        });
        const numMembros = (chat.participantes && chat.participantes.length) || 0;
        const subtitulo = ehAnuncio
          ? 'Só administradores enviam mensagens'
          : (numMembros <= 1 ? 'Adicione membros para começar a conversar' : numMembros + ' membros');
        item.innerHTML =
          '<div class="avatar" style="background:' + (ehAnuncio ? '#00a884' : '#667781') + ';">' +
          (ehAnuncio ? '<i class="fa-solid fa-bullhorn" style="font-size:16px;"></i>' : '<i class="fa-solid fa-comment" style="font-size:16px;"></i>') + '</div>' +
          '<div class="chat-info"><h4>' + (chat.nome || 'Grupo') + '</h4><p>' + subtitulo + '</p></div>';
        return item;
      }

      if (anuncio) {
        container.appendChild(criarItemChat(anuncio, true));
      }

      const tituloGrupos = document.createElement('p');
      tituloGrupos.innerText = 'Os seus grupos';
      tituloGrupos.style.cssText = 'padding:14px 16px 6px; color:#8696a0; font-size:12px; font-weight:bold; text-transform:uppercase;';
      container.appendChild(tituloGrupos);

      grupos.forEach((doc) => container.appendChild(criarItemChat(doc, false)));

      if (!grupos.length) {
        const vazio = document.createElement('p');
        vazio.innerText = 'Os outros grupos adicionados à comunidade aparecem aqui.';
        vazio.style.cssText = 'padding:16px; color:#8696a0; font-size:13px; text-align:center;';
        container.appendChild(vazio);
      }
    }, (err) => console.error('Erro ao carregar grupos da comunidade:', err));
}

function abrirCriarGrupoComunidade() {
  const nome = window.prompt('Nome do novo grupo:');
  if (!nome || !nome.trim()) return;
  const myEmail = getCurrentUserEmail();

  db.collection('chats').add({
    type: 'grupo',
    nome: nome.trim(),
    comunidadeId: comunidadeAtualId,
    participantes: [myEmail]
  }).catch((err) => {
    console.error('Erro ao criar grupo:', err);
    alert('Não foi possível criar o grupo.');
  });
}

function abrirMembrosComunidade() {
  fecharComunidadeMenu();
  const modal = document.getElementById('membros-comunidade-modal');
  const lista = document.getElementById('membros-comunidade-lista');
  lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px;">A carregar...</p>';
  modal.classList.remove('hidden');

  db.collection('comunidades').doc(comunidadeAtualId).get().then((doc) => {
    const dados = doc.data() || {};
    const membros = dados.membros || [];
    const admins = dados.admins || [];
    document.getElementById('membros-comunidade-titulo').innerText = 'Membros (' + membros.length + ')';
    lista.innerHTML = '';

    membros.forEach((email) => {
      const nome = email.split('@')[0];
      const ehAdmin = admins.includes(email);
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.innerHTML =
        '<div class="avatar" style="background:#4a90d9;">' + nome.substring(0, 2).toUpperCase() + '</div>' +
        '<div class="chat-info"><h4>' + nome + (ehAdmin ? ' <span style="color:var(--whatsapp-teal); font-size:11px;">· admin</span>' : '') + '</h4><p>' + email + '</p></div>';
      lista.appendChild(item);
    });
  }).catch((err) => {
    console.error('Erro ao carregar membros da comunidade:', err);
    lista.innerHTML = '<p style="color:#f15c6d; font-size:13px; padding:16px;">Não foi possível carregar.</p>';
  });
}

function fecharMembrosComunidade() {
  document.getElementById('membros-comunidade-modal').classList.add('hidden');
}

function sairDaComunidade() {
  fecharComunidadeMenu();
  if (!window.confirm('Sair desta comunidade? Também sais de todos os grupos dela.')) return;

  const email = getCurrentUserEmail();
  db.collection('comunidades').doc(comunidadeAtualId).update({
    membros: firebase.firestore.FieldValue.arrayRemove(email),
    admins: firebase.firestore.FieldValue.arrayRemove(email)
  }).then(() => fecharComunidade())
    .catch((err) => {
      console.error('Erro ao sair da comunidade:', err);
      alert('Não foi possível sair da comunidade.');
    });
}

// ---- Nova conversa / lista de contactos ----
function abrirNovoContato() {
  const modal = document.getElementById('novo-contato-modal');
  modal.classList.remove('hidden');
  abrirContactosTelefone();
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

  // Traz todos os utilizadores registados uma vez, para cruzar por email OU por telefone
  db.collection('usuarios').get().then((snapshot) => {
    const emailsRegistados = new Set();
    const telefonesRegistados = new Map(); // telefoneNormalizado -> email

    snapshot.forEach((doc) => {
      const u = doc.data();
      if (u.email) emailsRegistados.add(u.email.toLowerCase());
      if (u.telefoneNormalizado) telefonesRegistados.set(u.telefoneNormalizado, u.email);
    });

    lista.innerHTML = '';

    contactos.forEach((c) => {
      const nome = (c.name && c.name[0]) || 'Contacto';
      const email = (c.email && c.email[0]) || '';
      const tel = (c.tel && c.tel[0]) || '';
      const telNormalizado = normalizarTelefone(tel);

      let emailEncontrado = '';
      if (email && emailsRegistados.has(email.toLowerCase())) {
        emailEncontrado = email.toLowerCase();
      } else if (telNormalizado && telefonesRegistados.has(telNormalizado)) {
        emailEncontrado = telefonesRegistados.get(telNormalizado);
      }
      const estaRegistado = !!emailEncontrado;

      const item = document.createElement('div');
      item.className = 'chat-item';
      item.style.cursor = estaRegistado ? 'pointer' : 'default';

      const corAvatar = estaRegistado ? '#4a90d9' : '#667781';
      item.innerHTML =
        '<div class="avatar" style="background:' + corAvatar + ';">' + nome.substring(0, 2).toUpperCase() + '</div>' +
        '<div class="chat-info" style="flex:1; min-width:0;"><h4>' + nome + '</h4><p>' + (email || tel || 'Sem contacto disponível') + '</p></div>';

      if (estaRegistado) {
        item.onclick = () => iniciarConversaCom(emailEncontrado);
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
      openChat(chatId, outroEmail.split('@')[0], outroEmail);
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

// ---- Definições ----
function openSettings() {
  document.getElementById('dropdown-menu').classList.add('hidden');
  document.getElementById('settings-email').innerText = getCurrentUserEmail();
  document.getElementById('settings-telefone-status').innerText = '';

  const input = document.getElementById('settings-telefone');
  input.value = '';

  const myEmail = getCurrentUserEmail();
  db.collection('usuarios').doc(myEmail).get().then((doc) => {
    if (doc.exists && doc.data().telefone) {
      input.value = doc.data().telefone;
    }
  }).catch((err) => console.error('Erro ao carregar telefone:', err));

  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function guardarTelefonePerfil() {
  const input = document.getElementById('settings-telefone');
  const status = document.getElementById('settings-telefone-status');
  const telefone = input.value.trim();
  const myEmail = getCurrentUserEmail();

  if (!telefone) {
    status.style.color = '#f15c6d';
    status.innerText = 'Escreve um número de telefone.';
    return;
  }

  status.style.color = '#8696a0';
  status.innerText = 'A guardar...';

  db.collection('usuarios').doc(myEmail).set({
    telefone: telefone,
    telefoneNormalizado: normalizarTelefone(telefone)
  }, { merge: true })
    .then(() => {
      status.style.color = '#00a884';
      status.innerText = 'Número guardado.';
    })
    .catch((err) => {
      console.error('Erro ao guardar telefone:', err);
      status.style.color = '#f15c6d';
      status.innerText = 'Não foi possível guardar. Tenta novamente.';
    });
}

// Normaliza um número de telefone para os últimos 9 dígitos, para comparar formatos diferentes
// (ex: "+244 924 308 868", "924308868" e "00244924308868" tornam-se todos "924308868")
function normalizarTelefone(numero) {
  const apenasDigitos = (numero || '').replace(/\D/g, '');
  return apenasDigitos.slice(-9);
}

// Abrir Chat Individual / Grupo
let chatNameAtual = '';
let chatTipoAtual = 'grupo'; // 'grupo' | '1v1' | 'anuncio'
let comunidadeIdAtual = null;
let chatApenasAdminsAtual = false;
let chatAdminsAtual = [];
let chatAvatarAtual = '';

function openChat(chatId, chatName, outroEmail, extra) {
  currentChatId = chatId;
  chatNameAtual = chatName;
  chatAvatarAtual = chatName.substring(0, 2).toUpperCase();
  chamadaOutroEmail = outroEmail || null;

  chatTipoAtual = (extra && extra.tipo) || (outroEmail ? '1v1' : 'grupo');
  comunidadeIdAtual = (extra && extra.comunidadeId) || null;
  chatApenasAdminsAtual = !!(extra && extra.apenasAdmins);
  chatAdminsAtual = (extra && extra.admins) || [];

  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('community-screen').style.display = 'none';
  document.getElementById('chat-room-screen').style.display = 'flex';
  mensagensSelecionadas.clear();
  renderHeaderNormal();

  atualizarBotaoMicOuEnviar();
  loadMessages();

  if (chamadaOutroEmail) {
    escutarChamadasRecebidas();
  }
}

function closeChat() {
  document.getElementById('chat-room-screen').style.display = 'none';

  if (comunidadeIdAtual) {
    document.getElementById('community-screen').style.display = 'flex';
  } else {
    document.getElementById('main-screen').style.display = 'flex';
  }

  mensagensSelecionadas.clear();
  cancelarResposta();
  fecharChatMenu();
  fecharChatMenuMais();
  fecharPesquisaMensagens();
  fecharMediaModal();
  pararEscutaChamadasRecebidas();
  terminarChamadaLocal();
  chamadaOutroEmail = null;
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
    img.style.cssText = 'max-width:100%; border-radius:8px; display:block; cursor:pointer; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none;';
    img.draggable = false;
    img.oncontextmenu = () => false;
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

// Formata o timestamp do Firestore para "HH:MM"
function formatarHora(timestamp) {
  if (!timestamp || !timestamp.toDate) return '';
  const d = timestamp.toDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

// Linha com a hora de envio + "vistos" (só mostra os checks nas mensagens minhas)
function construirMetaMensagem(msg, isMe, myEmail) {
  const meta = document.createElement('div');
  meta.style.cssText = 'display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:2px;';

  const hora = document.createElement('span');
  hora.innerText = formatarHora(msg.timestamp);
  hora.style.cssText = 'font-size:10px; color:rgba(0,0,0,0.45);';
  meta.appendChild(hora);

  if (isMe) {
    const lidoPor = msg.lidoPor || [];
    const foiLida = lidoPor.some((e) => e !== myEmail);

    const check = document.createElement('span');
    check.className = foiLida ? 'fa-solid fa-check-double' : 'fa-solid fa-check';
    check.style.cssText = 'font-size:11px; color:' + (foiLida ? '#4a90d9' : 'rgba(0,0,0,0.45)') + ';';
    meta.appendChild(check);
  }

  return meta;
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
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        `;
        bubble.oncontextmenu = () => false;

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
        bubble.appendChild(construirMetaMensagem(msg, isMe, myEmail));
        linha.appendChild(bubble);
        container.appendChild(linha);

        // Marca como lida (uma vez) qualquer mensagem de outra pessoa que eu veja
        if (!isMe) {
          const lidoPor = msg.lidoPor || [];
          if (!lidoPor.includes(myEmail)) {
            doc.ref.update({ lidoPor: firebase.firestore.FieldValue.arrayUnion(myEmail) }).catch(() => {});
          }
        }

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
    delete nova.lidoPor;
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

  if (chatApenasAdminsAtual && !chatAdminsAtual.includes(myEmail)) {
    mostrarToast('Só administradores podem enviar mensagens neste grupo de anúncios.');
    return;
  }

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

// ================= CHAMADAS (voz e vídeo) =================
// Só disponível em conversas 1-para-1 (chamadaOutroEmail é definido em openChat).
// Sinalização via Firestore (chats/{chatId}/chamadas/ativa), WebRTC com STUN público
// (sem servidor TURN próprio — chamadas podem falhar em redes muito restritivas).

const configuracaoRTC = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

let chamadaOutroEmail = null;
let peerConnection = null;
let localStream = null;
let souChamador = false;
let chamadaTipoAtual = 'audio';
let unsubscribeChamada = null;
let unsubscribeChamadaRecebida = null;
let unsubscribeCandidatosRemoto = null;
let cronometroChamada = null;
let segundosChamada = 0;

function startVoiceCall() { iniciarChamada('audio'); }
function startVideoCall() { iniciarChamada('video'); }

function iniciarChamada(tipo) {
  if (!chamadaOutroEmail) {
    mostrarToast('Chamadas só estão disponíveis em conversas individuais.');
    return;
  }
  if (peerConnection) {
    mostrarToast('Já tens uma chamada em curso.');
    return;
  }

  chamadaTipoAtual = tipo;
  souChamador = true;
  const constraints = tipo === 'video' ? { audio: true, video: true } : { audio: true, video: false };

  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      localStream = stream;
      mostrarEcraChamada(tipo);
      criarPeerConnection();
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      return peerConnection.createOffer();
    })
    .then((offer) => peerConnection.setLocalDescription(offer).then(() => offer))
    .then((offer) => db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa').set({
      tipo: tipo,
      chamador: getCurrentUserEmail(),
      recetor: chamadaOutroEmail,
      estado: 'a_chamar',
      oferta: { type: offer.type, sdp: offer.sdp },
      resposta: null,
      iniciadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }))
    .then(() => {
      escutarEstadoChamada();
      escutarCandidatosRemotos('candidatosRecetor');
    })
    .catch((err) => {
      console.error('Erro ao iniciar chamada:', err);
      alert('Não foi possível iniciar a chamada. Verifica as permissões de câmara/microfone.');
      terminarChamadaLocal();
    });
}

function criarPeerConnection() {
  peerConnection = new RTCPeerConnection(configuracaoRTC);

  peerConnection.onicecandidate = (event) => {
    if (!event.candidate) return;
    const subcolecao = souChamador ? 'candidatosChamador' : 'candidatosRecetor';
    db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa')
      .collection(subcolecao).add(event.candidate.toJSON())
      .catch((err) => console.error('Erro ao enviar candidato ICE:', err));
  };

  peerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    if (chamadaTipoAtual === 'video') {
      const remoteVideo = document.getElementById('call-remote-video');
      if (remoteVideo) remoteVideo.srcObject = stream;
    } else {
      const remoteAudio = document.getElementById('call-remote-audio');
      if (remoteAudio) remoteAudio.srcObject = stream;
    }
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection && (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed')) {
      terminarChamada();
    }
  };
}

// Escuta chamadas a chegar (ligado enquanto o chat 1-para-1 está aberto)
function escutarChamadasRecebidas() {
  pararEscutaChamadasRecebidas();
  const chatIdAoEscutar = currentChatId;

  unsubscribeChamadaRecebida = db.collection('chats').doc(chatIdAoEscutar).collection('chamadas').doc('ativa')
    .onSnapshot((doc) => {
      if (!doc.exists) return;
      const chamada = doc.data();
      const myEmail = getCurrentUserEmail();

      if (chamada.estado === 'a_chamar' && chamada.recetor === myEmail && !peerConnection) {
        souChamador = false;
        chamadaTipoAtual = chamada.tipo;
        mostrarEcraChamadaRecebida(chamada);
      }
    });
}

function pararEscutaChamadasRecebidas() {
  if (unsubscribeChamadaRecebida) { unsubscribeChamadaRecebida(); unsubscribeChamadaRecebida = null; }
}

function mostrarEcraChamadaRecebida(chamada) {
  document.getElementById('call-screen').classList.remove('hidden');
  document.getElementById('call-avatar').innerText = chamada.chamador.substring(0, 2).toUpperCase();
  document.getElementById('call-nome').innerText = chamada.chamador.split('@')[0];
  document.getElementById('call-status').innerText = chamada.tipo === 'video' ? 'Videochamada recebida' : 'Chamada recebida';
  document.getElementById('call-video-area').classList.add('hidden');
  document.getElementById('call-botoes-normal').classList.add('hidden');
  document.getElementById('call-botoes-receber').classList.remove('hidden');
}

function aceitarChamada() {
  const constraints = chamadaTipoAtual === 'video' ? { audio: true, video: true } : { audio: true, video: false };
  const chamadaRef = db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa');

  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      localStream = stream;
      criarPeerConnection();
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      if (chamadaTipoAtual === 'video') {
        document.getElementById('call-video-area').classList.remove('hidden');
        const localVideo = document.getElementById('call-local-video');
        if (localVideo) localVideo.srcObject = stream;
      }

      return chamadaRef.get();
    })
    .then((doc) => {
      const chamada = doc.data();
      return peerConnection.setRemoteDescription(new RTCSessionDescription(chamada.oferta))
        .then(() => peerConnection.createAnswer())
        .then((answer) => peerConnection.setLocalDescription(answer).then(() => answer))
        .then((answer) => chamadaRef.update({
          estado: 'aceite',
          resposta: { type: answer.type, sdp: answer.sdp }
        }));
    })
    .then(() => {
      document.getElementById('call-botoes-receber').classList.add('hidden');
      document.getElementById('call-botoes-normal').classList.remove('hidden');
      iniciarCronometroChamada();
      escutarEstadoChamada();
      escutarCandidatosRemotos('candidatosChamador');
    })
    .catch((err) => {
      console.error('Erro ao aceitar chamada:', err);
      alert('Não foi possível aceitar a chamada.');
      terminarChamadaLocal();
    });
}

function recusarChamada() {
  db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa')
    .update({ estado: 'recusada' }).catch(() => {});
  terminarChamadaLocal();
}

function escutarEstadoChamada() {
  pararEscutaEstadoChamada();
  unsubscribeChamada = db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa')
    .onSnapshot((doc) => {
      if (!doc.exists) return;
      const chamada = doc.data();

      if (souChamador && chamada.estado === 'aceite' && chamada.resposta && peerConnection && !peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(chamada.resposta))
          .then(() => {
            document.getElementById('call-status').innerText = 'Em chamada';
            if (chamadaTipoAtual === 'video') {
              document.getElementById('call-video-area').classList.remove('hidden');
            }
            iniciarCronometroChamada();
          })
          .catch((err) => console.error('Erro ao aplicar resposta:', err));
      }

      if (chamada.estado === 'recusada' || chamada.estado === 'terminada') {
        terminarChamadaLocal();
      }
    });
}

function pararEscutaEstadoChamada() {
  if (unsubscribeChamada) { unsubscribeChamada(); unsubscribeChamada = null; }
}

function escutarCandidatosRemotos(subcolecao) {
  if (unsubscribeCandidatosRemoto) { unsubscribeCandidatosRemoto(); }
  unsubscribeCandidatosRemoto = db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa')
    .collection(subcolecao)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && peerConnection) {
          peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()))
            .catch((err) => console.error('Erro ao adicionar candidato ICE:', err));
        }
      });
    });
}

function mostrarEcraChamada(tipo) {
  document.getElementById('call-screen').classList.remove('hidden');
  document.getElementById('call-avatar').innerText = chamadaOutroEmail ? chamadaOutroEmail.substring(0, 2).toUpperCase() : '--';
  document.getElementById('call-nome').innerText = chamadaOutroEmail ? chamadaOutroEmail.split('@')[0] : '';
  document.getElementById('call-status').innerText = tipo === 'video' ? 'A vídeo chamar...' : 'A chamar...';
  document.getElementById('call-botoes-normal').classList.remove('hidden');
  document.getElementById('call-botoes-receber').classList.add('hidden');
  document.getElementById('call-video-area').classList.add('hidden');

  if (tipo === 'video' && localStream) {
    const localVideo = document.getElementById('call-local-video');
    if (localVideo) {
      localVideo.srcObject = localStream;
      document.getElementById('call-video-area').classList.remove('hidden');
    }
  }
}

function terminarChamada() {
  db.collection('chats').doc(currentChatId).collection('chamadas').doc('ativa')
    .update({ estado: 'terminada' }).catch(() => {});
  terminarChamadaLocal();
}

function terminarChamadaLocal() {
  clearInterval(cronometroChamada);
  cronometroChamada = null;
  segundosChamada = 0;

  if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
  pararEscutaEstadoChamada();
  if (unsubscribeCandidatosRemoto) { unsubscribeCandidatosRemoto(); unsubscribeCandidatosRemoto = null; }

  const tela = document.getElementById('call-screen');
  if (tela) tela.classList.add('hidden');
  const localVideo = document.getElementById('call-local-video');
  const remoteVideo = document.getElementById('call-remote-video');
  const remoteAudio = document.getElementById('call-remote-audio');
  if (localVideo) localVideo.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;
  if (remoteAudio) remoteAudio.srcObject = null;
}

function iniciarCronometroChamada() {
  segundosChamada = 0;
  cronometroChamada = setInterval(() => {
    segundosChamada++;
    const m = String(Math.floor(segundosChamada / 60)).padStart(2, '0');
    const s = String(segundosChamada % 60).padStart(2, '0');
    const status = document.getElementById('call-status');
    if (status) status.innerText = m + ':' + s;
  }, 1000);
}

function alternarMudo() {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  const btn = document.getElementById('call-btn-mudo');
  if (btn) btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.15)' : '#f15c6d';
}

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
  atualizarItensMenuGrupo();
}

// Ajusta rótulos/itens do menu consoante o chat aberto seja o grupo "geral" ou uma conversa 1-para-1
function atualizarItensMenuGrupo() {
  const ehGrupo = chatTipoAtual === 'grupo' || chatTipoAtual === 'anuncio';
  const itemSair = document.getElementById('item-sair-grupo');
  const itemVerContato = document.getElementById('item-ver-contato');
  const itemAdicionar = document.getElementById('item-adicionar-membro');
  if (itemSair) itemSair.classList.toggle('hidden', !ehGrupo);
  if (itemVerContato) itemVerContato.innerText = ehGrupo ? 'Ver membros' : 'Ver Contato';
  if (itemAdicionar) itemAdicionar.classList.toggle('hidden', !(ehGrupo && comunidadeIdAtual));
}

function verContatoOuMembros() {
  fecharChatMenu();
  if (chatTipoAtual === 'grupo' || chatTipoAtual === 'anuncio') {
    abrirMembrosGrupo();
  } else {
    mostrarToast('Ver Contato — em breve');
  }
}

function abrirMembrosGrupo() {
  const modal = document.getElementById('membros-modal');
  const lista = document.getElementById('membros-modal-lista');
  lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px;">A carregar...</p>';
  modal.classList.remove('hidden');

  db.collection('chats').doc(currentChatId).get().then((doc) => {
    const membros = (doc.exists && doc.data().participantes) || [];
    document.getElementById('membros-modal-titulo').innerText = 'Membros (' + membros.length + ')';
    lista.innerHTML = '';

    membros.forEach((email) => {
      const nome = email.split('@')[0];
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.innerHTML =
        '<div class="avatar" style="background:#4a90d9;">' + nome.substring(0, 2).toUpperCase() + '</div>' +
        '<div class="chat-info"><h4>' + nome + '</h4><p>' + email + '</p></div>';
      lista.appendChild(item);
    });

    if (!membros.length) {
      lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px; text-align:center;">Nenhum membro encontrado.</p>';
    }
  }).catch((err) => {
    console.error('Erro ao carregar membros:', err);

    lista.innerHTML = '<p style="color:#f15c6d; font-size:13px; padding:16px;">Não foi possível carregar os membros.</p>';
  });
}

function fecharMembrosModal() {
  document.getElementById('membros-modal').classList.add('hidden');
}

function sairDoGrupo() {
  fecharChatMenu();
  if (!window.confirm('Sair de "' + chatNameAtual + '"? Deixarás de ver as mensagens deste grupo.')) return;

  const email = getCurrentUserEmail();
  const chatIdASair = currentChatId;

  db.collection('chats').doc(chatIdASair).update({
    participantes: firebase.firestore.FieldValue.arrayRemove(email)
  }).then(() => {
    if (chatIdASair === 'geral') {
      return db.collection('usuarios').doc(email).set({ saiuDoGrupoGeral: true }, { merge: true });
    }
  }).then(() => closeChat())
    .catch((err) => {
      console.error('Erro ao sair do grupo:', err);
      alert('Não foi possível sair do grupo.');
    });
}

// Adicionar membro da comunidade a este grupo específico
function abrirAdicionarMembro() {
  fecharChatMenu();
  if (!comunidadeIdAtual) return;

  const modal = document.getElementById('adicionar-membro-modal');
  const lista = document.getElementById('adicionar-membro-lista');
  lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px;">A carregar...</p>';
  modal.classList.remove('hidden');

  Promise.all([
    db.collection('comunidades').doc(comunidadeIdAtual).get(),
    db.collection('chats').doc(currentChatId).get()
  ]).then(([comunidadeDoc, chatDoc]) => {
    const membrosComunidade = (comunidadeDoc.exists && comunidadeDoc.data().membros) || [];
    const membrosGrupo = (chatDoc.exists && chatDoc.data().participantes) || [];
    const disponiveis = membrosComunidade.filter((e) => !membrosGrupo.includes(e));

    lista.innerHTML = '';
    if (!disponiveis.length) {
      lista.innerHTML = '<p style="color:#8696a0; font-size:13px; padding:16px; text-align:center;">Todos os membros da comunidade já estão neste grupo.</p>';
      return;
    }

    disponiveis.forEach((email) => {
      const nome = email.split('@')[0];
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.style.cursor = 'pointer';
      item.onclick = () => {
        db.collection('chats').doc(currentChatId).update({
          participantes: firebase.firestore.FieldValue.arrayUnion(email)
        }).then(() => abrirAdicionarMembro()).catch((err) => console.error('Erro ao adicionar membro:', err));
      };
      item.innerHTML =
        '<div class="avatar" style="background:#a682e3;">' + nome.substring(0, 2).toUpperCase() + '</div>' +
        '<div class="chat-info"><h4>' + nome + '</h4><p>' + email + '</p></div>' +
        '<i class="fa-solid fa-plus" style="color:var(--whatsapp-teal); font-size:16px;"></i>';
      lista.appendChild(item);
    });
  }).catch((err) => {
    console.error('Erro ao carregar membros disponíveis:', err);
    lista.innerHTML = '<p style="color:#f15c6d; font-size:13px; padding:16px;">Não foi possível carregar.</p>';
  });
}

function fecharAdicionarMembro() {
  document.getElementById('adicionar-membro-modal').classList.add('hidden');
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
