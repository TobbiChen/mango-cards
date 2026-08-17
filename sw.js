const C='mango-cards-v26-shell';
const A=['./','./index.html','./manifest.webmanifest','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./v26.js'];
const PATCH='<script src="./v26.js?v=26"></script>';

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(A)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});

async function injectPatch(response){
  if(!response)return response;
  let text=await response.text();
  if(!text.includes('v26.js?v=26'))text=text.replace('</body>',PATCH+'</body>');
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(text,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  const isPage=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('/index.html');
  if(isPage){
    e.respondWith((async()=>{
      try{
        const net=await fetch(e.request);
        const copy=net.clone();
        caches.open(C).then(c=>c.put('./index.html',copy));
        return injectPatch(net);
      }catch(err){
        const cached=await caches.match('./index.html');
        return injectPatch(cached);
      }
    })());
    return;
  }
  e.respondWith(fetch(e.request).then(x=>{
    const y=x.clone();caches.open(C).then(c=>c.put(e.request,y));return x;
  }).catch(()=>caches.match(e.request)));
});
