const PUSH_API = 'https://observatorio-2030-push.jaimejosediasnt.workers.dev';

const get = async path => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
};

const pushButton = document.querySelector('#push-toggle');
const installButton = document.querySelector('#install-app');
const pwaStatus = document.querySelector('#pwa-status');
let serviceWorkerRegistration;
let deferredInstallPrompt;

function setPwaStatus(message = '', tone = '') {
  pwaStatus.textContent = message;
  pwaStatus.dataset.tone = tone;
}

function updateConnectionStatus() {
  const element = document.querySelector('#connection-status');
  if (element) element.textContent = navigator.onLine ? 'online' : 'offline · conteúdo salvo';
}

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(base64);
  return Uint8Array.from(bytes, character => character.charCodeAt(0));
}

async function pushApi(path, options = {}) {
  const response = await fetch(`${PUSH_API}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Falha no serviço de alertas (${response.status})`);
  }
  return response.json();
}

async function getVapidPublicKey() {
  const { publicKey } = await pushApi('/vapid-public-key');
  if (!publicKey) throw new Error('Chave pública de alertas indisponível');
  return publicKey;
}

async function sendSubscription(subscription) {
  return pushApi('/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });
}

function renderPushState(subscription) {
  pushButton.hidden = false;
  pushButton.disabled = Notification.permission === 'denied';
  pushButton.dataset.subscribed = subscription ? 'true' : 'false';
  pushButton.setAttribute('aria-pressed', subscription ? 'true' : 'false');
  pushButton.textContent = Notification.permission === 'denied'
    ? 'Alertas bloqueados no navegador'
    : subscription
      ? 'Desativar alertas'
      : 'Ativar alertas de novos marcos';

  if (Notification.permission === 'denied') {
    setPwaStatus('Permita notificações nas configurações do navegador para ativar os alertas.', 'warning');
  } else if (subscription) {
    setPwaStatus('Alertas de novos marcos estão ativos neste dispositivo.', 'success');
  }
}

async function refreshPushState() {
  const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  renderPushState(subscription);
  if (subscription) await sendSubscription(subscription);
  return subscription;
}

async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    renderPushState(null);
    if (permission !== 'denied') setPwaStatus('A permissão para alertas não foi concedida.', 'warning');
    return;
  }

  const publicKey = await getVapidPublicKey();
  const applicationServerKey = base64UrlToUint8Array(publicKey);
  let subscription = await serviceWorkerRegistration.pushManager.getSubscription();

  if (subscription?.options.applicationServerKey) {
    const currentKey = new Uint8Array(subscription.options.applicationServerKey);
    const keyMatches = currentKey.length === applicationServerKey.length
      && currentKey.every((byte, index) => byte === applicationServerKey[index]);
    if (!keyMatches) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  try {
    await sendSubscription(subscription);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
  renderPushState(subscription);
}

async function disablePush() {
  const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  if (!subscription) {
    renderPushState(null);
    return;
  }

  try {
    await pushApi('/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } finally {
    await subscription.unsubscribe();
  }
  renderPushState(null);
  setPwaStatus('Alertas desativados neste dispositivo.');
}

async function handlePushToggle() {
  pushButton.disabled = true;
  setPwaStatus('Atualizando alertas…');
  try {
    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (subscription) await disablePush();
    else await enablePush();
  } catch (error) {
    console.error(error);
    setPwaStatus('Não foi possível atualizar os alertas. Tente novamente.', 'error');
    await refreshPushState().catch(() => {});
  } finally {
    if (Notification.permission !== 'denied') pushButton.disabled = false;
  }
}

async function registerPwa() {
  if (!('serviceWorker' in navigator)) {
    setPwaStatus('Este navegador não oferece suporte ao modo aplicativo.', 'warning');
    return;
  }

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if ('PushManager' in window && 'Notification' in window) {
      pushButton.addEventListener('click', handlePushToggle);
      await refreshPushState();
    } else {
      setPwaStatus('Alertas push não são compatíveis com este navegador.', 'warning');
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (isIos && !isStandalone) {
      setPwaStatus('No iPhone ou iPad, use Compartilhar › Adicionar à Tela de Início. Abra pelo ícone instalado para ativar alertas.');
    }
  } catch (error) {
    console.error(error);
    setPwaStatus('Não foi possível iniciar os recursos offline e de alertas.', 'error');
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
  setPwaStatus(outcome === 'accepted' ? 'Aplicativo instalado.' : 'A instalação pode ser feita mais tarde.', outcome === 'accepted' ? 'success' : '');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
  setPwaStatus('Observatório 2030 instalado neste dispositivo.', 'success');
});

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('DOMContentLoaded', updateConnectionStatus);
window.addEventListener('load', registerPwa);

const views = [...document.querySelectorAll('.view')];
const links = [...document.querySelectorAll('nav a')];

function showView(name) {
  const valid = ['marcos', 'topicos', 'timeline'].includes(name) ? name : 'marcos';
  views.forEach(view => view.classList.toggle('active', view.id === valid));
  links.forEach(link => link.classList.toggle('active', link.dataset.view === valid));
  if (location.hash !== `#${valid}`) history.replaceState(null, '', `#${valid}`);
}

function route() {
  showView(location.hash.slice(1) || 'marcos');
}

links.forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  showView(link.dataset.view);
  document.querySelector('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
window.addEventListener('hashchange', route);
route();

Promise.all([get('data/timeline.json'), get('data/topics.json'), get('data/events.json')]).then(([timeline, topics, events]) => {
  document.querySelector('#updated').textContent = `Última revisão: ${new Date([timeline.updated, events.updated].filter(Boolean).sort().at(-1) + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  document.querySelector('#timeline-data').innerHTML = timeline.years.map(year => `<article class="year"><div class="year-num">${year.year}</div><div><h3>${year.title}</h3><ul>${year.items.map(item => `<li>${item}</li>`).join('')}</ul><span class="confidence">confiança ${year.confidence}</span></div></article>`).join('');

  const topicGroups = [
    { label: 'INTELLIGENCE & COGNITION', title: 'Inteligência & Cognição', ids: ['ai', 'neuro-alt-compute'] },
    { label: 'EMBODIED, MOBILITY & SOCIETY', title: 'Corpo, Mobilidade & Sociedade', ids: ['robotics', 'aam', 'work'] },
    { label: 'COMPUTATION & SCIENCE', title: 'Computação & Ciência', ids: ['quantum', 'quantum-biology'] },
    { label: 'ENERGY & FRONTIER', title: 'Energia & Fronteira', ids: ['fusion', 'cislunar'] },
  ];
  const topicsById = Object.fromEntries(topics.topics.map(topic => [topic.id, topic]));
  document.querySelector('#topics').innerHTML = topicGroups.map(group => `<section class="topic-group"><div class="topic-group-head"><span>${group.label}</span><h3>${group.title}</h3></div><div class="topic-pair">${group.ids.map(id => topicsById[id]).filter(Boolean).map(topic => `<article class="topic"><h3>${topic.name}</h3><p>${topic.watch}</p></article>`).join('')}</div></section>`).join('');

  const formatDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : 'não confirmada';
  const labels = { confirms: 'Confirma', accelerates: 'Antecipa', delays: 'Atrasa', contradicts: 'Contradiz', under_review: 'Em validação' };
  const sortedEvents = [...events.events].sort((a, b) => (b.published_at || b.date || '').localeCompare(a.published_at || a.date || ''));
  document.querySelector('#events').innerHTML = sortedEvents.length ? sortedEvents.map(event => {
    const years = Array.isArray(event.timeline) ? event.timeline.join(' · ') : (event.timeline_year || 'Marco ainda não vinculado');
    const dates = [event.published_at ? `Divulgado em ${formatDate(event.published_at)}` : 'Divulgação original não confirmada', event.event_date && event.event_date !== event.published_at ? `Ocorrido em ${formatDate(event.event_date)}` : ''].filter(Boolean).join(' · ');
    return `<article class="event"><span class="tag">${labels[event.status] || 'Em acompanhamento'}</span><h3>${event.title}</h3><small>${dates} · ${event.topic}</small><p><strong>Timeline:</strong> ${years}</p><p>${event.summary}</p>${event.impact ? `<p>${event.impact}</p>` : ''}${event.source?.url ? `<p><a href="${event.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${event.source.name || 'Consultar'}</a></p>` : ''}</article>`;
  }).join('') : '<div class="empty">Nenhum marco registrado ainda.</div>';
}).catch(() => {
  document.querySelector('#events').innerHTML = '<div class="empty">Não foi possível carregar os dados.</div>';
});
