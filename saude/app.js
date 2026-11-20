const $ = selector => document.querySelector(selector);
const views = [...document.querySelectorAll('.view')];
const links = [...document.querySelectorAll('nav a')];
const eventsContainer = $('#events');
const shareStatus = document.createElement('div');
shareStatus.className = 'share-status';
shareStatus.setAttribute('role', 'status');
shareStatus.setAttribute('aria-live', 'polite');
eventsContainer.before(shareStatus);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
let rendered = false;
function showView(name, preserveHash = false) {
  const selected = ['marcos', 'topicos', 'metodologia'].includes(name) ? name : 'marcos';
  views.forEach(view => view.classList.toggle('active', view.id === selected));
  links.forEach(link => link.classList.toggle('active', link.dataset.view === selected));
  if (!preserveHash && location.hash !== '#' + selected) history.replaceState(null, '', '#' + selected);
}
function route() {
  const hash = location.hash.slice(1);
  document.querySelectorAll('.event.targeted').forEach(event => event.classList.remove('targeted'));
  if (hash.startsWith('marco=')) {
    showView('marcos', true);
    if (!rendered) return;
    let id;
    try { id = decodeURIComponent(hash.slice('marco='.length)); } catch (_) { return; }
    const target = document.getElementById('marco-' + id);
    if (target) {
      target.classList.add('targeted');
      requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
    }
    return;
  }
  showView(hash || 'marcos');
}
links.forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  showView(link.dataset.view);
  $('main').scrollIntoView({behavior:'smooth',block:'start'});
}));
window.addEventListener('hashchange', route);
route();
async function load(path) {
  const response = await fetch(path, {cache:'no-store'});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}
const shareIcon = '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.1M8.7 13.3l6.6 4.1"/></svg>';
Promise.all([load('./data/topics.json'),load('./data/events.json')]).then(([topics,data]) => {
  $('#updated').textContent = data.updated ? 'Última revisão: ' + data.updated : 'Estrutura pronta · aguardando marcos avaliados';
  $('#topics').innerHTML = '<div class="topic-pair">' + topics.topics.map(topic => '<article class="topic"><h3>' + escapeHtml(topic.name) + '</h3><p>' + escapeHtml(topic.watch) + '</p></article>').join('') + '</div>';
  const sorted = [...data.events].sort((a,b) => String(b.published_at || b.date || '').localeCompare(String(a.published_at || a.date || '')));
  eventsContainer.innerHTML = sorted.length ? sorted.map(item => {
    const sourceUrl = item.source?.url;
    const source = typeof sourceUrl === 'string' && /^https?:\/\//i.test(sourceUrl) ? '<p><a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">Fonte: ' + escapeHtml(item.source.name || 'Consultar') + '</a></p>' : '';
    return '<article class="event" id="marco-' + escapeHtml(item.id) + '"><span class="tag">' + escapeHtml(item.stage || item.status || 'Evidência em avaliação') + '</span><div class="event-heading"><h3>' + escapeHtml(item.title) + '</h3><button type="button" class="event-share" data-event-id="' + escapeHtml(item.id) + '" aria-label="Compartilhar marco" title="Compartilhar marco">' + shareIcon + '</button></div><small>' + escapeHtml(item.published_at || item.date || '') + '</small><p>' + escapeHtml(item.summary) + '</p>' + (item.limitations ? '<p><strong>Limitações:</strong> ' + escapeHtml(item.limitations) + '</p>' : '') + source + '</article>';
  }).join('') : '<div class="empty">Nenhum marco publicado nesta linha ainda. As áreas de monitoramento já estão disponíveis.</div>';
  rendered = true;
  route();
}).catch(error => {
  console.error(error);
  eventsContainer.innerHTML = '<div class="empty">Não foi possível carregar os dados.</div>';
});
eventsContainer.addEventListener('click', async event => {
  const button = event.target.closest('button.event-share');
  if (!button) return;
  const url = new URL('./#marco=' + encodeURIComponent(button.dataset.eventId), location.href).href;
  const title = button.closest('.event')?.querySelector('h3')?.textContent || 'Observatório Saúde';
  try {
    if (navigator.share) { await navigator.share({title,url}); return; }
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    else {
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
    shareStatus.textContent = 'Link do marco copiado.';
  } catch (error) {
    if (error.name !== 'AbortError') shareStatus.textContent = 'Não foi possível compartilhar o link.';
  }
});
