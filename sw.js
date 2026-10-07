const CACHE='observatorio-2030-v2';
const SHELL=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./data/timeline.json','./data/topics.json','./data/events.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  if(url.pathname.includes('/data/')||url.pathname.endsWith('/app.js')||url.pathname.endsWith('/style.css')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r})));
});
self.addEventListener('push',event=>{
  let data={title:'Observatório 2030',body:'Há um novo marco no Observatório 2030.',url:'./#marcos'};
  try{data={...data,...event.data.json()}}catch(_){}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:data.icon,badge:data.badge,data:{url:data.url||'./#marcos'},tag:data.tag||'observatorio-2030-marco'}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    const target=new URL(event.notification.data?.url||'./#marcos',self.location.href).href;
    const w=ws.find(x=>x.url.startsWith(self.location.origin));
    return w?(w.navigate(target),w.focus()):clients.openWindow(target);
  }));
});
