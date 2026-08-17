(()=>{
'use strict';

const style=document.createElement('style');
style.textContent=`
.ripple-guide{z-index:8!important;filter:drop-shadow(0 0 12px rgba(58,153,255,.72))!important;animation:ripplePulseV26 2.35s ease-out forwards!important}
.ripple-guide:before,.ripple-guide:after{border-width:5px!important;border-color:rgba(65,161,255,.92)!important;box-shadow:inset 0 0 14px rgba(255,255,255,.35)}
.ripple-guide:after{inset:25%!important;border-width:4px!important;border-color:rgba(255,255,255,.98)!important;animation:rippleInnerV26 2.35s ease-out forwards!important}
.ripple-dot{width:22px!important;height:22px!important;margin:-11px!important;background:rgba(255,255,255,.98)!important;border:3px solid rgba(69,164,255,.95);box-shadow:0 0 0 10px rgba(74,165,255,.16),0 0 26px rgba(52,149,255,.95)!important;animation:rippleDotV26 1.15s ease-in-out infinite alternate}
@keyframes ripplePulseV26{0%{transform:scale(.28);opacity:0}10%{opacity:1}68%{opacity:.95}100%{transform:scale(1.32);opacity:0}}
@keyframes rippleInnerV26{0%{transform:scale(.55);opacity:1}100%{transform:scale(2.05);opacity:0}}
@keyframes rippleDotV26{from{transform:scale(.82)}to{transform:scale(1.18)}}
`;
document.head.appendChild(style);

function clearGuideTimer(){
 if(rippleTimer){clearTimeout(rippleTimer);rippleTimer=null}
}
stopRipple=function(){
 clearGuideTimer();
 document.querySelectorAll('.ripple-guide').forEach(x=>x.remove());
};
showRipple=function(){
 if(mode!=='read'||isPlaying||isTransitioning||!groupItems.length)return;
 document.querySelectorAll('.ripple-guide').forEach(x=>x.remove());
 const r=document.createElement('div'),dot=document.createElement('span');
 const x=22+Math.random()*56,y=20+Math.random()*42;
 const s=(document.body.classList.contains('child-mode')?150:120)+Math.random()*54;
 r.className='ripple-guide';dot.className='ripple-dot';r.appendChild(dot);
 r.style.setProperty('--x',x+'%');r.style.setProperty('--y',y+'%');r.style.setProperty('--s',s+'px');
 document.getElementById('viewer').appendChild(r);
 setTimeout(()=>{if(r.isConnected)r.remove()},2400);
};
scheduleRipple=function(first=true){
 clearGuideTimer();
 if(mode!=='read'||isPlaying||isTransitioning||!groupItems.length)return;
 const delay=first?(900+Math.random()*700):(4200+Math.random()*2200);
 rippleTimer=setTimeout(()=>{
  rippleTimer=null;
  showRipple();
  rippleTimer=setTimeout(()=>{rippleTimer=null;scheduleRipple(false)},2500);
 },delay);
};

const choose=document.getElementById('chooseFolder');
const rescan=document.getElementById('rescanFolder');
if(choose){
 choose.textContent='选择文件夹并对比更新';
 choose.onclick=()=>document.getElementById('folderPicker').click();
}
if(rescan)rescan.remove();

updateFolderHint=async function(){
 const hint=document.getElementById('folderHint');if(!hint||!db)return;
 const name=await getMeta('folderName').catch(()=>null);
 hint.textContent=name
  ?`上次对比：${name}。iPad 每次重新选择同一文件夹即可；已存在素材只统计数量，只展开新增/减少明细。`
  :'首次请选择素材文件夹。之后重新选择同一文件夹即可做差集更新。';
};

syncFiles=async function(files,{folderMode=false,folderName=''}={}){
 const raw=[...files].filter(extOK),status=document.getElementById('syncStatus'),list=document.getElementById('syncList');
 list.innerHTML='';
 if(!raw.length){status.innerHTML='<div class="sync-summary bad">没有识别到视频。</div>';return}
 if(folderMode&&!folderName){
  const first=raw.find(f=>f.webkitRelativePath);
  if(first)folderName=first.webkitRelativePath.split('/')[0]||'';
 }
 const valid=[],nested=[],duplicate=[],seen=new Set();
 for(const f of raw){
  if(folderMode&&!isTopLevel(f)&&f.webkitRelativePath){nested.push({f,reason:'多级目录'});continue}
  const meta=parseName(f.name);
  if(seen.has(meta.key)){duplicate.push({f,reason:'同名重复'});continue}
  seen.add(meta.key);valid.push({f,meta});
 }
 try{
  const old=await getAll(),oldMap=new Map(old.map(x=>[x.key,x]));
  const nextKeys=new Set(valid.map(x=>x.meta.key));
  const added=valid.filter(x=>!oldMap.has(x.meta.key));
  const existing=valid.filter(x=>oldMap.has(x.meta.key));
  const changed=existing.filter(({f,meta})=>{
   const p=oldMap.get(meta.key);
   return !(p.size===f.size&&p.lastModified===f.lastModified&&p.filename===f.name);
  });
  const previousFolderKeys=folderMode?await getMeta('folderKeys').catch(()=>null):null;
  const removalBase=folderMode
   ?(Array.isArray(previousFolderKeys)?previousFolderKeys.map(k=>oldMap.get(k)).filter(Boolean):old.filter(x=>x.source!=='photo'))
   :[];
  const removed=folderMode?removalBase.filter(x=>!nextKeys.has(x.key)):[];
  const ignored=nested.length+duplicate.length;

  const addRows=added.map(x=>({kind:'新增',cls:'good',meta:x.meta,filename:x.f.name}));
  const removeRows=removed.map(x=>({kind:'减少',cls:'bad',meta:x,filename:x.filename||x.key}));
  [...addRows,...removeRows].slice(0,160).forEach(x=>{
   const r=document.createElement('div');r.className='file-row';
   const name=x.meta?`${esc(x.meta.group)} / ${esc(x.meta.name)}${x.meta.alias?' / '+esc(x.meta.alias):''}`:'';
   r.innerHTML=`<span><b class="${x.cls}">${x.kind}</b>　${name}</span><span>${esc(x.filename)}</span>`;
   list.appendChild(r);
  });
  if(!addRows.length&&!removeRows.length){
   list.innerHTML='<div class="small" style="padding:12px 0">没有新增或减少素材。</div>';
  }

  const folderLine=folderName?`<br><span class="small">${esc(folderName)}</span>`:'';
  status.innerHTML=`<div class="sync-summary"><b>对比完成。</b>${folderLine}<br>新增 <b class="good">${added.length}</b>；已存在 <b>${existing.length}</b>${changed.length?`（其中内容更新 ${changed.length}）`:''}${folderMode?`；减少 <b class="bad">${removed.length}</b>`:''}${ignored?`；忽略异常 ${ignored}`:''}。<br>下方只列新增${folderMode?'和减少':''}。</div>`;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  let skipped=0,imported=0,deleted=0;
  for(let i=0;i<valid.length;i++){
   const{f,meta}=valid[i],prev=oldMap.get(meta.key);
   const unchanged=prev&&prev.size===f.size&&prev.lastModified===f.lastModified&&prev.filename===f.name;
   if(unchanged){skipped++;continue}
   const ex=await fileToCoverAndDuration(f);
   await putItem({
    key:meta.key,group:meta.group,name:meta.name,alias:meta.alias||'',filename:f.name,
    size:f.size,lastModified:f.lastModified,video:f,cover:ex.cover,duration:ex.duration,width:ex.width,height:ex.height,
    source:folderMode?'folder':'photo',addedAt:prev?.addedAt||Date.now(),updatedAt:Date.now()
   });
   imported++;
  }
  if(folderMode){
   for(const oldItem of removed){await deleteKey(oldItem.key);deleted++}
   await setMeta('folderKeys',[...nextKeys]);
   if(folderName)await setMeta('folderName',folderName);
  }
  currentGroup=added.length?'最近添加':currentGroup;idx=0;await loadLibrary();
  status.innerHTML=`<div class="sync-summary good"><b>同步完成。</b><br>新增 ${added.length}；已存在 ${existing.length}${changed.length?`（更新 ${changed.length}）`:''}${folderMode?`；减少 ${deleted}`:''}；未变化 ${skipped}${ignored?`；忽略异常 ${ignored}`:''}。</div>`;
 }catch(e){
  console.error(e);
  status.innerHTML=`<div class="sync-summary bad"><b>同步失败：</b>${esc(e.message||String(e))}<br>建议优先使用 H.264/AAC 的 MP4/MOV。</div>`;
 }
};

try{updateFolderHint()}catch(e){}
})();
