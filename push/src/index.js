import { buildPushPayload, sendPushNotification } from '@block65/webcrypto-web-push';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
const cors=env=>({'access-control-allow-origin':env.ALLOWED_ORIGIN||'https://jjdsnt.github.io','access-control-allow-methods':'POST,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization'});

export default {
 async fetch(request,env){
  const url=new URL(request.url), headers=cors(env);
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(url.pathname==='/health') return json({ok:true},200,headers);

  if(url.pathname==='/subscribe' && request.method==='POST'){
   const s=await request.json();
   if(!s?.endpoint||!s?.keys?.p256dh||!s?.keys?.auth) return json({error:'invalid subscription'},400,headers);
   await env.DB.prepare(`INSERT INTO subscriptions(endpoint,p256dh,auth,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated_at=CURRENT_TIMESTAMP`)
    .bind(s.endpoint,s.keys.p256dh,s.keys.auth).run();
   return json({ok:true},201,headers);
  }

  if(url.pathname==='/subscribe' && request.method==='DELETE'){
   const {endpoint}=await request.json(); if(endpoint) await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(endpoint).run();
   return json({ok:true},200,headers);
  }

  if(url.pathname==='/notify' && request.method==='POST'){
   if(request.headers.get('authorization')!==`Bearer ${env.PUSH_API_TOKEN}`) return json({error:'unauthorized'},401,headers);
   const event=await request.json();
   const payload=JSON.stringify({title:'Observatório 2030',body:event.title||'Novo marco registrado',url:event.url||'./#marcos',tag:event.id||'observatorio-2030-marco'});
   const rows=(await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions').all()).results||[];
   let sent=0,removed=0,failed=0;
   for(const s of rows){
    try{
     const subscription={endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}};
     const push=await buildPushPayload({data:payload,options:{ttl:86400},subscription,vapid:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
     const res=await sendPushNotification(push);
     if(res.status===404||res.status===410){await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(s.endpoint).run();removed++}
     else if(res.ok) sent++; else failed++;
    }catch(_){failed++}
   }
   return json({ok:true,sent,removed,failed},200,headers);
  }
  return json({error:'not found'},404,headers);
 }
};
