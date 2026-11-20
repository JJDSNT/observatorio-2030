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

function showView(name, preserveHash = false) {
  const valid = ['marcos', 'topicos', 'timeline'].includes(name) ? name : 'marcos';
  views.forEach(view => view.classList.toggle('active', view.id === valid));
  links.forEach(link => link.classList.toggle('active', link.dataset.view === valid));
  if (!preserveHash && location.hash !== `#${valid}`) history.replaceState(null, '', `#${valid}`);
}

let eventsRendered = false;
function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('marco=')) {
    showView('marcos', true);
    if (!eventsRendered) return;
    let eventId;
    try { eventId = decodeURIComponent(hash.slice('marco='.length)); }
    catch (_) { return; }
    const target = document.getElementById(`marco-${eventId}`);
    document.querySelectorAll('.event.targeted').forEach(item => item.classList.remove('targeted'));
    if (target) {
      target.classList.add('targeted');
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'auto' }));
    }
    return;
  }
  document.querySelectorAll('.event.targeted').forEach(item => item.classList.remove('targeted'));
  showView(hash || 'marcos');
}

links.forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  showView(link.dataset.view);
  document.querySelector('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
window.addEventListener('hashchange', route);
route();

const shareIcon = '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.1M8.7 13.3l6.6 4.1"/></svg>';
const shareStatus = document.createElement('div');
shareStatus.className = 'share-status';
shareStatus.setAttribute('role', 'status');
shareStatus.setAttribute('aria-live', 'polite');
document.querySelector('#events').before(shareStatus);
let shareStatusTimeout;
function showShareStatus(message) {
  shareStatus.textContent = message;
  clearTimeout(shareStatusTimeout);
  shareStatusTimeout = setTimeout(() => { shareStatus.textContent = ''; }, 3500);
}

document.querySelector('#events').addEventListener('click', async event => {
  const button = event.target.closest('button.event-share');
  if (!button) return;
  const article = button.closest('article.event');
  const title = article?.querySelector('h3')?.textContent || 'Marco do Observatório 2030';
  const url = new URL('./#marco=' + encodeURIComponent(button.dataset.eventId), location.href).href;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement('textarea');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('copy unavailable');
    }
    showShareStatus('Link do marco copiado.');
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Falha ao compartilhar marco:', error);
      showShareStatus('Não foi possível compartilhar o link.');
    }
  }
});


Promise.all([get('data/timeline.json'), get('data/topics.json'), get('data/events.json')]).then(([timeline, topics, events]) => {
  document.querySelector('#updated').textContent = `Última revisão: ${new Date([timeline.updated, events.updated].filter(Boolean).sort().at(-1) + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  document.querySelector('#timeline-data').innerHTML = timeline.years.map(year => `<article class="year"><div class="year-num">${year.year}</div><div><h3>${year.title}</h3><ul>${year.items.map(item => `<li>${item}</li>`).join('')}</ul><span class="confidence">confiança ${year.confidence}</span></div></article>`).join('');

  const topicGroups = topics.groups || [];
  const topicsByGroup = new Map(topicGroups.map(group => [group.id, []]));
  for (const topic of topics.topics) {
    const groupId = topicsByGroup.has(topic.group) ? topic.group : 'other';
    if (!topicsByGroup.has(groupId)) topicsByGroup.set(groupId, []);
    topicsByGroup.get(groupId).push(topic);
  }
  const allGroups = [...topicGroups, ...(topicsByGroup.has('other') ? [{ id: 'other', label: 'OTHER TOPICS', title: 'Outros tópicos' }] : [])];
  document.querySelector('#topics').innerHTML = allGroups.filter(group => topicsByGroup.get(group.id)?.length).map(group => `<section class="topic-group"><div class="topic-group-head"><span>${group.label}</span><h3>${group.title}</h3></div><div class="topic-pair">${topicsByGroup.get(group.id).map(topic => `<article class="topic"><h3>${topic.name}</h3><p>${topic.watch}</p></article>`).join('')}</div></section>`).join('');

    const formatDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : 'não confirmada';
  const labels = { confirms: 'Confirma', accelerates: 'Antecipa', delays: 'Atrasa', contradicts: 'Contradiz', under_review: 'Em validação' };
  const sortedEvents = [...events.events].sort((a, b) => (b.published_at || b.date || '').localeCompare(a.published_at || a.date || ''));
  document.querySelector('#events').innerHTML = sortedEvents.length ? sortedEvents.map(event => {
    const years = Array.isArray(event.timeline) ? event.timeline.join(' · ') : (event.timeline_year || 'Marco ainda não vinculado');
    const dates = [event.published_at ? `Divulgado em ${formatDate(event.published_at)}` : 'Divulgação original não confirmada', event.event_date && event.event_date !== event.published_at ? `Ocorrido em ${formatDate(event.event_date)}` : ''].filter(Boolean).join(' · ');
    return `<article class="event" id="marco-${event.id}"><span class="tag">${labels[event.status] || 'Em acompanhamento'}</span><div class="event-heading"><h3>${event.title}</h3><button type="button" class="event-share" data-event-id="${event.id}" aria-label="Compartilhar marco" title="Compartilhar marco">${shareIcon}</button></div><small>${dates} · ${event.topic}</small><p><strong>Timeline:</strong> ${years}</p><p>${event.summary}</p>${event.impact ? `<p>${event.impact}</p>` : ''}${event.source?.url ? `<p><a href="${event.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${event.source.name || 'Consultar'}</a></p>` : ''}</article>`;
  }).join('') : '<div class="empty">Nenhum marco registrado ainda.</div>';
  eventsRendered = true;
  route();
}).catch(() => {
  document.querySelector('#events').innerHTML = '<div class="empty">Não foi possível carregar os dados.</div>';
});
