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
