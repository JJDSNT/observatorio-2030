const get=async p=>(await fetch(p)).json();
const views=[...document.querySelectorAll('.view')],links=[...document.querySelectorAll('nav a')];
function showView(name){const valid=['marcos','topicos','timeline'].includes(name)?name:'marcos';views.forEach(v=>v.classList.toggle('active',v.id===valid));links.forEach(a=>a.classList.toggle('active',a.dataset.view===valid));if(location.hash!=='#'+valid)history.replaceState(null,'','#'+valid)}
function route(){showView(location.hash.slice(1)||'marcos')}
links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showView(a.dataset.view);document.querySelector('main').scrollIntoView({behavior:'smooth',block:'start'})}));window.addEventListener('hashchange',route);route();
Promise.all([get('data/timeline.json'),get('data/topics.json'),get('data/events.json')]).then(([t,tp,e])=>{
document.querySelector('#updated').textContent='Última revisão: '+new Date(t.updated+'T12:00:00').toLocaleDateString('pt-BR');
document.querySelector('#timeline-data').innerHTML=t.years.map(y=>`<article class="year"><div class="year-num">${y.year}</div><div><h3>${y.title}</h3><ul>${y.items.map(i=>`<li>${i}</li>`).join('')}</ul><span class="confidence">confiança ${y.confidence}</span></div></article>`).join('');
const topicGroups=[
{label:'INTELLIGENCE & COGNITION',title:'Inteligência & Cognição',ids:['ai','neuro-alt-compute']},
{label:'EMBODIED & SOCIETY',title:'Corpo & Sociedade',ids:['robotics','work']},
{label:'COMPUTATION & SCIENCE',title:'Computação & Ciência',ids:['quantum','quantum-biology']},
{label:'ENERGY & FRONTIER',title:'Energia & Fronteira',ids:['fusion','cislunar']}
];
const byId=Object.fromEntries(tp.topics.map(x=>[x.id,x]));
document.querySelector('#topics').innerHTML=topicGroups.map(g=>`<section class="topic-group"><div class="topic-group-head"><span>${g.label}</span><h3>${g.title}</h3></div><div class="topic-pair">${g.ids.map(id=>byId[id]).filter(Boolean).map(x=>`<article class="topic"><h3>${x.name}</h3><p>${x.watch}</p></article>`).join('')}</div></section>`).join('');
document.querySelector('#events').innerHTML=e.events.length?e.events.map(x=>`<article class="event"><span class="tag">${x.impact}</span><h3>${x.title}</h3><small>${x.date} · ${x.topic} · timeline ${x.timeline_year}</small><p>${x.summary}</p></article>`).join(''):'<div class="empty">Nenhum marco registrado ainda. O histórico começa em 2 de outubro de 2026.</div>'
}).catch(()=>document.querySelector('#events').innerHTML='<div class="empty">Não foi possível carregar os dados.</div>');