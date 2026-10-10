const get=async p=>(await fetch(p,{cache:'no-store'})).json();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
function updateConnectionStatus(){const el=document.querySelector('#connection-status');if(el)el.textContent=navigator.onLine?'online':'offline · conteúdo salvo'}
window.addEventListener('online',updateConnectionStatus);window.addEventListener('offline',updateConnectionStatus);window.addEventListener('DOMContentLoaded',updateConnectionStatus);
const views=[...document.querySelectorAll('.view')],links=[...document.querySelectorAll('nav a')];
function showView(name){const valid=['marcos','topicos','timeline'].includes(name)?name:'marcos';views.forEach(v=>v.classList.toggle('active',v.id===valid));links.forEach(a=>a.classList.toggle('active',a.dataset.view===valid));if(location.hash!=='#'+valid)history.replaceState(null,'','#'+valid)}
function route(){showView(location.hash.slice(1)||'marcos')}
links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showView(a.dataset.view);document.querySelector('main').scrollIntoView({behavior:'smooth',block:'start'})}));window.addEventListener('hashchange',route);route();
Promise.all([get('data/timeline.json'),get('data/topics.json'),get('data/events.json')]).then(([t,tp,e])=>{
document.querySelector('#updated').textContent='Última revisão: '+new Date(t.updated+'T12:00:00').toLocaleDateString('pt-BR');
document.querySelector('#timeline-data').innerHTML=t.years.map(y=>`<article class="year"><div class="year-num">${y.year}</div><div><h3>${y.title}</h3><ul>${y.items.map(i=>`<li>${i}</li>`).join('')}</ul><span class="confidence">confiança ${y.confidence}</span></div></article>`).join('');
const topicGroups=[
{label:'INTELLIGENCE & COGNITION',title:'Inteligência & Cognição',ids:['ai','neuro-alt-compute']},
{label:'EMBODIED, MOBILITY & SOCIETY',title:'Corpo, Mobilidade & Sociedade',ids:['robotics','aam','work']},
{label:'COMPUTATION & SCIENCE',title:'Computação & Ciência',ids:['quantum','quantum-biology']},
{label:'ENERGY & FRONTIER',title:'Energia & Fronteira',ids:['fusion','cislunar']}
];
const byId=Object.fromEntries(tp.topics.map(x=>[x.id,x]));
document.querySelector('#topics').innerHTML=topicGroups.map(g=>`<section class="topic-group"><div class="topic-group-head"><span>${g.label}</span><h3>${g.title}</h3></div><div class="topic-pair">${g.ids.map(id=>byId[id]).filter(Boolean).map(x=>`<article class="topic"><h3>${x.name}</h3><p>${x.watch}</p></article>`).join('')}</div></section>`).join('');
const formatDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'não confirmada';
const labels={confirms:'Confirma',accelerates:'Antecipa',delays:'Atrasa',contradicts:'Contradiz',under_review:'Em validação'};
const sortedEvents=[...e.events].sort((a,b)=>(b.published_at||b.event_date||b.recorded_at||b.date||'').localeCompare(a.published_at||a.event_date||a.recorded_at||a.date||''));
document.querySelector('#events').innerHTML=sortedEvents.length?sortedEvents.map(x=>{
const years=Array.isArray(x.timeline)?x.timeline.join(' · '):(x.timeline_year||'Marco ainda não vinculado');
const dates=[x.event_date?'Ocorrido em '+formatDate(x.event_date):'',x.published_at?'Divulgado em '+formatDate(x.published_at):'Divulgação original não confirmada',x.recorded_at?'Registrado em '+formatDate(x.recorded_at):'',x.updated_at&&x.updated_at!==x.recorded_at?'Revisado em '+formatDate(x.updated_at):''].filter(Boolean).join(' · ');
return `<article class="event"><span class="tag">${labels[x.status]||'Em acompanhamento'}</span><h3>${x.title}</h3><small>${dates} · ${x.topic}</small><p><strong>Timeline:</strong> ${years}</p><p>${x.summary}</p>${x.impact?`<p>${x.impact}</p>`:''}${x.source?.url?`<p><a href="${x.source.url}" target="_blank" rel="noopener noreferrer">Fonte: ${x.source.name||'Consultar'}</a></p>`:''}</article>`}).join(''):'<div class="empty">Nenhum marco registrado ainda.</div>';
}).catch(()=>document.querySelector('#events').innerHTML='<div class="empty">Não foi possível carregar os dados.</div>');