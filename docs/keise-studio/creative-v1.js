'use strict';
(()=>{
const META_KEY='keise-creative-v1';
const DB_NAME='keise-creative-media-v1';
const STORE='assets';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let root=null,state=load(),mode='library',activeProjectId=null,activeClipId=null,urlCache=new Map(),teleRaf=null,teleLast=0,teleRunning=false,teleKeyHandler=null;

function blank(){return{version:1,projects:[]}}
function load(){try{const x=JSON.parse(localStorage.getItem(META_KEY)||'null');return x&&x.version===1?x:blank()}catch{return blank()}}
function save(){localStorage.setItem(META_KEY,JSON.stringify(state))}
function uid(p='id'){return p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(msg){const t=document.querySelector('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__kcToast);window.__kcToast=setTimeout(()=>t.classList.remove('show'),2600)}
function fmt(v){return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v))}
function project(){return state.projects.find(p=>p.id===activeProjectId)}
function clip(){return project()?.clips.find(c=>c.id===activeClipId)||project()?.clips[0]||null}
function touch(){const p=project();if(p)p.updatedAt=new Date().toISOString();save()}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putAsset(id,blob){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(blob,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function getAsset(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(id);req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function deleteAsset(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function assetUrl(id){if(urlCache.has(id))return urlCache.get(id);const blob=await getAsset(id);if(!blob)return null;const url=URL.createObjectURL(blob);urlCache.set(id,url);return url}
function dimensions(aspect){if(aspect==='9:16')return[720,1280];if(aspect==='1:1')return[1080,1080];return[1280,720]}
function filterCss(p){return `brightness(${p.brightness||100}%) contrast(${p.contrast||100}%) saturate(${p.saturation||100}%)`}
function applyPreset(p,name){
 const presets={natural:[100,100,100],cinema:[94,112,88],warm:[103,106,112],cool:[98,108,92],mono:[100,112,0]};
 const v=presets[name]||presets.natural;p.preset=name;p.brightness=v[0];p.contrast=v[1];p.saturation=v[2];touch();
}
function library(){
 return `
 <section class="creative-hero"><div><p class="creative-kicker">🎬 Keise Creative</p><h2>Do vídeo simples ao projeto cinematográfico — por etapas.</h2><p>A V1 trabalha localmente: os arquivos de vídeo ficam no IndexedDB deste navegador, sem upload automático para servidor.</p></div><button class="primary" id="creativeNew">＋ Novo projeto de vídeo</button></section>
 <div class="creative-section-head"><div><h2>Meus projetos Creative</h2><p>Projetos locais deste navegador.</p></div><span class="creative-local">🎞️ mídia local</span></div>
 ${state.projects.length?'<div class="creative-project-grid">'+state.projects.map(p=>`<article class="creative-project-card"><span>🎥</span><h3>${esc(p.title)}</h3><p>${esc(p.context||'Projeto audiovisual')}</p><div><small>${p.clips.length} clipe(s)</small><small>${esc(p.aspect)}</small></div><button class="soft" data-creative-open="${p.id}">Editar</button></article>`).join('')+'</div>':empty('🎬','Nenhum projeto de vídeo ainda','Crie o primeiro projeto e importe um vídeo do computador.')}
 <dialog class="dialog" id="creativeDialog"><button class="dialog-close" type="button" data-creative-close>×</button><div class="dialog-icon">🎬</div><h2>Novo projeto Creative</h2><form id="creativeForm"><label>Nome do projeto<input id="creativeTitle" required maxlength="100" placeholder="Ex.: Dia do Aluno 2026"></label><label>Contexto<input id="creativeContext" maxlength="120" placeholder="Ex.: vídeo institucional"></label><label>Formato<select id="creativeAspect"><option value="16:9">16:9 · Horizontal</option><option value="9:16">9:16 · Vertical</option><option value="1:1">1:1 · Quadrado</option></select></label><div class="dialog-actions"><button class="soft" type="button" data-creative-close>Cancelar</button><button class="primary" type="submit">Criar projeto</button></div></form></dialog>`;
}
function empty(icon,title,text){return `<div class="creative-empty"><div><span>${icon}</span><b>${title}</b><p>${text}</p></div></div>`}
function editor(){
 const p=project(),c=clip();if(!p){mode='library';return library()}
 return `
 <section class="creative-editor">
  <header class="creative-top"><button class="soft" id="creativeBack">← Projetos</button><div><small>Keise Creative</small><h2>${esc(p.title)}</h2><p>${esc(p.context||'Projeto audiovisual')}</p></div><div class="creative-top-actions"><span>● salvo localmente</span><button class="soft" id="creativeTeleprompter">📝 Teleprompter</button><button class="soft" id="creativeProjectBackup">Salvar projeto</button><button class="primary" id="creativeRender" ${c?'':'disabled'}>Renderizar clipe</button></div></header>
  <div class="creative-workspace">
   <aside class="creative-media"><div class="creative-side-head"><b>Mídia</b><button class="tiny" id="creativeImport">＋ Importar</button></div><input id="creativeFile" type="file" accept="video/*" hidden><div class="creative-clip-list">${p.clips.length?p.clips.map(x=>`<button class="${x.id===activeClipId?'active':''}" data-creative-clip="${x.id}"><span>🎞️</span><span><b>${esc(x.name)}</b><small>${Number(x.duration||0).toFixed(1)}s</small></span></button>`).join(''):empty('📥','Sem mídia','Importe um vídeo para começar.')}</div></aside>
   <section class="creative-stage-area">
    <div class="creative-stage-toolbar"><span>Preview · ${esc(p.aspect)}</span><button class="tiny" id="creativePlayTrim" ${c?'':'disabled'}>▶ Reproduzir trecho</button></div>
    <div class="creative-stage ratio-${p.aspect.replace(':','-')}">
     ${c?`<video id="creativeVideo" playsinline controls></video><div class="creative-overlay pos-${esc(p.textPosition||'bottom')}" id="creativeOverlay">${esc(p.overlayText||'')}</div>${p.cinemaBars?'<div class="cinema-bar top"></div><div class="cinema-bar bottom"></div>':''}`:empty('🎞️','Importe um clipe','O preview aparecerá aqui.')}
    </div>
    <div class="creative-timeline"><div class="timeline-label"><b>Timeline</b><span>${p.clips.length} clipe(s)</span></div><div class="timeline-track">${p.clips.map((x,i)=>`<button class="${x.id===activeClipId?'active':''}" data-creative-clip="${x.id}" style="--w:${Math.max(70,Math.min(240,(x.duration||5)*8))}px"><span>${i+1}</span><b>${esc(x.name)}</b></button>`).join('')}</div></div>
   </section>
   <aside class="creative-props"><div class="creative-side-head"><b>Propriedades</b></div>
    <label>Formato<select id="creativeAspectProp"><option value="16:9" ${p.aspect==='16:9'?'selected':''}>16:9 Horizontal</option><option value="9:16" ${p.aspect==='9:16'?'selected':''}>9:16 Vertical</option><option value="1:1" ${p.aspect==='1:1'?'selected':''}>1:1 Quadrado</option></select></label>
    ${c?`<div class="creative-prop-group"><h4>✂️ Corte</h4><label>Início (s)<input id="creativeTrimStart" type="number" min="0" step=".1" value="${Number(c.trimStart||0).toFixed(1)}"></label><label>Fim (s)<input id="creativeTrimEnd" type="number" min="0" step=".1" value="${Number(c.trimEnd||c.duration||0).toFixed(1)}"></label></div>`:''}
    <div class="creative-prop-group"><h4>📝 Texto sobreposto</h4><label>Texto<textarea id="creativeOverlayText" rows="3">${esc(p.overlayText||'')}</textarea></label><label>Posição<select id="creativeTextPosition"><option value="top" ${p.textPosition==='top'?'selected':''}>Topo</option><option value="center" ${p.textPosition==='center'?'selected':''}>Centro</option><option value="bottom" ${(!p.textPosition||p.textPosition==='bottom')?'selected':''}>Rodapé</option></select></label><label>Tamanho<input id="creativeTextSize" type="range" min="24" max="76" value="${p.textSize||42}"></label></div>
    <div class="creative-prop-group"><h4>🎨 Imagem</h4><label>Preset<select id="creativePreset"><option value="natural" ${p.preset==='natural'||!p.preset?'selected':''}>Natural</option><option value="cinema" ${p.preset==='cinema'?'selected':''}>Cinema suave</option><option value="warm" ${p.preset==='warm'?'selected':''}>Quente</option><option value="cool" ${p.preset==='cool'?'selected':''}>Frio</option><option value="mono" ${p.preset==='mono'?'selected':''}>Preto e branco</option></select></label><label>Brilho <span id="brightValue">${p.brightness||100}%</span><input id="creativeBrightness" type="range" min="50" max="150" value="${p.brightness||100}"></label><label>Contraste <span id="contrastValue">${p.contrast||100}%</span><input id="creativeContrast" type="range" min="50" max="160" value="${p.contrast||100}"></label><label>Saturação <span id="satValue">${p.saturation??100}%</span><input id="creativeSaturation" type="range" min="0" max="180" value="${p.saturation??100}"></label><label class="creative-check"><input id="creativeCinemaBars" type="checkbox" ${p.cinemaBars?'checked':''}> Barras cinematográficas</label></div>
    ${c?'<button class="tiny danger-text" id="creativeDeleteClip">Excluir clipe deste projeto</button>':''}
   </aside>
  </div>
  <dialog class="dialog wide creative-teleprompter-dialog" id="creativeTeleprompterDialog">
   <button class="dialog-close" type="button" data-creative-close>×</button>
   <div class="dialog-icon">📝</div><h2>Teleprompter</h2>
   <p>O roteiro fica salvo neste projeto. Ajuste como prefere ler e abra o modo de apresentação quando estiver pronta.</p>
   <div class="tele-form-grid">
    <label>Roteiro<textarea id="teleScript" rows="14" placeholder="Cole ou escreva aqui o que deseja falar...">${esc(p.teleprompter?.script||'')}</textarea></label>
    <div class="tele-settings">
     <label>Velocidade <span id="teleSpeedValue">${p.teleprompter?.speed||32}</span><input id="teleSpeed" type="range" min="8" max="120" value="${p.teleprompter?.speed||32}"></label>
     <label>Tamanho da letra <span id="teleFontValue">${p.teleprompter?.fontSize||52}px</span><input id="teleFont" type="range" min="28" max="90" value="${p.teleprompter?.fontSize||52}"></label>
     <label>Espaçamento <span id="teleLineValue">${p.teleprompter?.lineHeight||1.55}</span><input id="teleLine" type="range" min="1.2" max="2.2" step=".05" value="${p.teleprompter?.lineHeight||1.55}"></label>
     <label>Contagem antes de começar<select id="teleCountdown"><option value="0" ${Number(p.teleprompter?.countdown||3)===0?'selected':''}>Sem contagem</option><option value="3" ${Number(p.teleprompter?.countdown??3)===3?'selected':''}>3 segundos</option><option value="5" ${Number(p.teleprompter?.countdown||3)===5?'selected':''}>5 segundos</option><option value="10" ${Number(p.teleprompter?.countdown||3)===10?'selected':''}>10 segundos</option></select></label>
     <label class="creative-check"><input id="teleMirror" type="checkbox" ${p.teleprompter?.mirror?'checked':''}> Espelhar texto</label>
     <label class="creative-check"><input id="teleCenterGuide" type="checkbox" ${p.teleprompter?.centerGuide!==false?'checked':''}> Mostrar linha-guia central</label>
     <div class="tele-shortcuts"><b>Atalhos</b><small>Espaço: pausar/continuar · ↑/↓: ajustar velocidade · Home: voltar ao início · Esc: sair</small></div>
    </div>
   </div>
   <div class="dialog-actions"><button class="soft" type="button" data-creative-close>Fechar</button><button class="primary" type="button" id="teleOpenRun">▶ Abrir teleprompter</button></div>
  </dialog>
  <dialog id="creativeTeleRun" class="creative-tele-run">
   <div class="tele-run-toolbar">
    <div><b>📝 Teleprompter</b><small id="teleRunStatus">pronto</small></div>
    <div class="tele-run-buttons"><button type="button" id="teleRunSlower">− Velocidade</button><button type="button" id="teleRunToggle">▶ Iniciar</button><button type="button" id="teleRunFaster">＋ Velocidade</button><button type="button" id="teleRunRestart">↺ Início</button><button type="button" id="teleRunClose">Fechar</button></div>
   </div>
   <div class="tele-countdown" id="teleCountdownOverlay" hidden></div>
   <div class="tele-guide" id="teleGuide"></div>
   <div class="tele-scroll" id="teleScroll"><div class="tele-text" id="teleText"></div></div>
  </dialog>
  <dialog class="dialog" id="creativeRenderDialog"><button class="dialog-close" type="button" data-creative-close>×</button><div class="dialog-icon">🎞️</div><h2>Renderização local</h2><p id="creativeRenderStatus">Preparando...</p><progress id="creativeRenderProgress" max="100" value="0"></progress></dialog>
 </section>`;
}
async function attachVideo(){
 const c=clip(),video=$('#creativeVideo',root);if(!c||!video)return;const url=await assetUrl(c.assetId);if(!url){video.replaceWith(document.createTextNode('Arquivo de vídeo não encontrado neste navegador.'));return}video.src=url;video.style.filter=filterCss(project());video.onloadedmetadata=()=>{if(!c.duration)c.duration=video.duration;if(!c.trimEnd)c.trimEnd=video.duration;touch()};video.ontimeupdate=()=>{if(c.trimEnd&&video.currentTime>=c.trimEnd)video.pause()};
}
function bindLibrary(){
 $('#creativeNew',root).onclick=()=>$('#creativeDialog',root).showModal();
 $$('[data-creative-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('#creativeForm',root).onsubmit=e=>{e.preventDefault();createProject($('#creativeTitle',root).value.trim(),$('#creativeContext',root).value.trim(),$('#creativeAspect',root).value);};
 $$('[data-creative-open]',root).forEach(b=>b.onclick=()=>{activeProjectId=b.dataset.creativeOpen;activeClipId=project()?.clips[0]?.id||null;mode='editor';render()});
}
function createProject(title,context,aspect='16:9'){
 const p={id:uid('creative'),title,context,aspect,clips:[],overlayText:'',textPosition:'bottom',textSize:42,preset:'natural',brightness:100,contrast:100,saturation:100,cinemaBars:false,teleprompter:{script:'',speed:32,fontSize:52,lineHeight:1.55,countdown:3,mirror:false,centerGuide:true},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 state.projects.unshift(p);save();activeProjectId=p.id;activeClipId=null;mode='editor';render();
}
async function importFile(file){
 if(!file||!file.type.startsWith('video/'))return toast('Escolha um arquivo de vídeo.');
 const p=project(),assetId=uid('asset');await putAsset(assetId,file);
 const meta={id:uid('clip'),assetId,name:file.name,duration:0,trimStart:0,trimEnd:0,createdAt:new Date().toISOString()};
 p.clips.push(meta);activeClipId=meta.id;touch();render();toast('Vídeo importado localmente.');
}
function updatePreview(){
 const p=project(),video=$('#creativeVideo',root),overlay=$('#creativeOverlay',root);if(video)video.style.filter=filterCss(p);if(overlay){overlay.textContent=p.overlayText||'';overlay.className='creative-overlay pos-'+(p.textPosition||'bottom');overlay.style.fontSize=(p.textSize||42)+'px'}
}
function ensureTele(p){
 p.teleprompter??={script:'',speed:32,fontSize:52,lineHeight:1.55,countdown:3,mirror:false,centerGuide:true};
 return p.teleprompter;
}
function stopTeleprompter(){
 teleRunning=false;
 if(teleRaf){cancelAnimationFrame(teleRaf);teleRaf=null}
 const btn=$('#teleRunToggle',root),status=$('#teleRunStatus',root);
 if(btn)btn.textContent='▶ Continuar';
 if(status)status.textContent='pausado';
}
function teleStep(ts){
 const p=project(),cfg=p?ensureTele(p):null,scroll=$('#teleScroll',root);
 if(!teleRunning||!cfg||!scroll)return;
 if(!teleLast)teleLast=ts;
 const dt=(ts-teleLast)/1000;teleLast=ts;
 scroll.scrollTop+=Number(cfg.speed||32)*dt;
 if(scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-2){stopTeleprompter();const s=$('#teleRunStatus',root);if(s)s.textContent='fim do roteiro';return}
 teleRaf=requestAnimationFrame(teleStep);
}
function startTeleprompter(){
 if(teleRunning)return;
 teleRunning=true;teleLast=0;
 const btn=$('#teleRunToggle',root),status=$('#teleRunStatus',root);
 if(btn)btn.textContent='⏸ Pausar';
 if(status)status.textContent='rolando';
 teleRaf=requestAnimationFrame(teleStep);
}
function applyTeleRunAppearance(p){
 const cfg=ensureTele(p),text=$('#teleText',root),scroll=$('#teleScroll',root),guide=$('#teleGuide',root);
 if(text){text.textContent=cfg.script||'Escreva o roteiro antes de iniciar.';text.style.fontSize=(cfg.fontSize||52)+'px';text.style.lineHeight=String(cfg.lineHeight||1.55);text.style.transform=cfg.mirror?'scaleX(-1)':'none';}
 if(scroll)scroll.scrollTop=0;
 if(guide)guide.hidden=cfg.centerGuide===false;
}
async function openTeleprompterRun(p){
 const cfg=ensureTele(p),dlg=$('#creativeTeleRun',root),count=$('#teleCountdownOverlay',root);
 applyTeleRunAppearance(p);stopTeleprompter();teleLast=0;
 dlg.showModal();
 try{if(dlg.requestFullscreen)await dlg.requestFullscreen()}catch{}
 const seconds=Number(cfg.countdown||0);
 if(seconds>0){
  count.hidden=false;
  for(let n=seconds;n>0;n--){count.textContent=n;await new Promise(r=>setTimeout(r,1000));if(!dlg.open)return}
  count.textContent='COMEÇAR';await new Promise(r=>setTimeout(r,500));count.hidden=true;startTeleprompter();
 }else{count.hidden=true}
}
function closeTeleprompterRun(){
 stopTeleprompter();
 const dlg=$('#creativeTeleRun',root);
 try{if(document.fullscreenElement)document.exitFullscreen()}catch{}
 if(dlg?.open)dlg.close();
 if(teleKeyHandler){document.removeEventListener('keydown',teleKeyHandler);teleKeyHandler=null}
}
function bindTeleprompter(p){
 const cfg=ensureTele(p),dlg=$('#creativeTeleprompterDialog',root);
 $('#creativeTeleprompter',root).onclick=()=>dlg.showModal();
 const script=$('#teleScript',root);if(script)script.oninput=e=>{cfg.script=e.target.value;touch()};
 const speed=$('#teleSpeed',root);if(speed)speed.oninput=e=>{cfg.speed=Number(e.target.value);$('#teleSpeedValue',root).textContent=e.target.value;touch()};
 const font=$('#teleFont',root);if(font)font.oninput=e=>{cfg.fontSize=Number(e.target.value);$('#teleFontValue',root).textContent=e.target.value+'px';touch()};
 const line=$('#teleLine',root);if(line)line.oninput=e=>{cfg.lineHeight=Number(e.target.value);$('#teleLineValue',root).textContent=e.target.value;touch()};
 const cd=$('#teleCountdown',root);if(cd)cd.onchange=e=>{cfg.countdown=Number(e.target.value);touch()};
 const mir=$('#teleMirror',root);if(mir)mir.onchange=e=>{cfg.mirror=e.target.checked;touch()};
 const guide=$('#teleCenterGuide',root);if(guide)guide.onchange=e=>{cfg.centerGuide=e.target.checked;touch()};
 $('#teleOpenRun',root).onclick=()=>{dlg.close();openTeleprompterRun(p)};
 $('#teleRunToggle',root).onclick=()=>teleRunning?stopTeleprompter():startTeleprompter();
 $('#teleRunSlower',root).onclick=()=>{cfg.speed=Math.max(8,Number(cfg.speed||32)-5);touch();$('#teleRunStatus',root).textContent='velocidade '+cfg.speed};
 $('#teleRunFaster',root).onclick=()=>{cfg.speed=Math.min(120,Number(cfg.speed||32)+5);touch();$('#teleRunStatus',root).textContent='velocidade '+cfg.speed};
 $('#teleRunRestart',root).onclick=()=>{const s=$('#teleScroll',root);if(s)s.scrollTop=0;teleLast=0;$('#teleRunStatus',root).textContent='início'};
 $('#teleRunClose',root).onclick=closeTeleprompterRun;
 teleKeyHandler=e=>{
  const run=$('#creativeTeleRun',root);if(!run?.open)return;
  if(e.code==='Space'){e.preventDefault();teleRunning?stopTeleprompter():startTeleprompter()}
  else if(e.key==='ArrowUp'){e.preventDefault();cfg.speed=Math.min(120,Number(cfg.speed||32)+5);touch();$('#teleRunStatus',root).textContent='velocidade '+cfg.speed}
  else if(e.key==='ArrowDown'){e.preventDefault();cfg.speed=Math.max(8,Number(cfg.speed||32)-5);touch();$('#teleRunStatus',root).textContent='velocidade '+cfg.speed}
  else if(e.key==='Home'){e.preventDefault();const s=$('#teleScroll',root);if(s)s.scrollTop=0}
  else if(e.key==='Escape'){closeTeleprompterRun()}
 };
 document.addEventListener('keydown',teleKeyHandler);
}
function bindEditor(){
 const p=project(),c=clip();
 bindTeleprompter(p);
 $('#creativeBack',root).onclick=()=>{stopTeleprompter();if(teleKeyHandler){document.removeEventListener('keydown',teleKeyHandler);teleKeyHandler=null}mode='library';render()};
 $('#creativeImport',root).onclick=()=>$('#creativeFile',root).click();$('#creativeFile',root).onchange=e=>{importFile(e.target.files?.[0]);e.target.value=''};
 $$('[data-creative-clip]',root).forEach(b=>b.onclick=()=>{activeClipId=b.dataset.creativeClip;render()});
 $('#creativeAspectProp',root).onchange=e=>{p.aspect=e.target.value;touch();render()};
 const text=$('#creativeOverlayText',root);if(text)text.oninput=e=>{p.overlayText=e.target.value;touch();updatePreview()};
 const pos=$('#creativeTextPosition',root);if(pos)pos.onchange=e=>{p.textPosition=e.target.value;touch();updatePreview()};
 const size=$('#creativeTextSize',root);if(size)size.oninput=e=>{p.textSize=Number(e.target.value);touch();updatePreview()};
 const preset=$('#creativePreset',root);if(preset)preset.onchange=e=>{applyPreset(p,e.target.value);render()};
 for(const [sel,key,out] of [['#creativeBrightness','brightness','#brightValue'],['#creativeContrast','contrast','#contrastValue'],['#creativeSaturation','saturation','#satValue']]){const n=$(sel,root);if(n)n.oninput=e=>{p[key]=Number(e.target.value);$(out,root).textContent=e.target.value+'%';touch();updatePreview()}}
 const bars=$('#creativeCinemaBars',root);if(bars)bars.onchange=e=>{p.cinemaBars=e.target.checked;touch();render()};
 if(c){
  $('#creativeTrimStart',root).onchange=e=>{c.trimStart=Math.max(0,Number(e.target.value)||0);touch()};
  $('#creativeTrimEnd',root).onchange=e=>{c.trimEnd=Math.min(c.duration||Infinity,Number(e.target.value)||c.duration||0);touch()};
  $('#creativePlayTrim',root).onclick=async()=>{const v=$('#creativeVideo',root);if(!v)return;v.currentTime=Math.max(0,c.trimStart||0);await v.play().catch(()=>{})};
  $('#creativeDeleteClip',root).onclick=async()=>{if(!confirm('Excluir este clipe do projeto e apagar a cópia local armazenada no navegador?'))return;await deleteAsset(c.assetId).catch(()=>{});const u=urlCache.get(c.assetId);if(u)URL.revokeObjectURL(u);urlCache.delete(c.assetId);p.clips=p.clips.filter(x=>x.id!==c.id);activeClipId=p.clips[0]?.id||null;touch();render()};
  $('#creativeRender',root).onclick=()=>renderClip(p,c);
 }
 $('#creativeProjectBackup',root).onclick=()=>downloadProject(p);
 $$('[data-creative-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
 attachVideo();
}
function drawOverlay(ctx,p,w,h){
 if(p.cinemaBars){const bar=Math.round(h*.09);ctx.fillStyle='#000';ctx.fillRect(0,0,w,bar);ctx.fillRect(0,h-bar,w,bar)}
 const text=(p.overlayText||'').trim();if(!text)return;
 const size=Math.max(18,Math.round((p.textSize||42)*(w/1280)));ctx.font='700 '+size+'px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 const y=p.textPosition==='top'?h*.17:p.textPosition==='center'?h*.5:h*.82;
 const metrics=ctx.measureText(text),pad=size*.45;ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(w/2-metrics.width/2-pad,y-size*.72,metrics.width+pad*2,size*1.44);ctx.fillStyle='#fff';ctx.fillText(text,w/2,y);
}
async function renderClip(p,c){
 const dlg=$('#creativeRenderDialog',root),status=$('#creativeRenderStatus',root),progress=$('#creativeRenderProgress',root);dlg.showModal();status.textContent='Carregando mídia local...';progress.value=2;
 try{
  const blob=await getAsset(c.assetId);if(!blob)throw new Error('Arquivo de vídeo não encontrado neste navegador.');
  const url=URL.createObjectURL(blob),v=document.createElement('video');v.src=url;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';
  await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('Não foi possível abrir o vídeo.'))});
  const [w,h]=dimensions(p.aspect),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  const stream=canvas.captureStream?.(30);if(!stream)throw new Error('Este navegador não oferece renderização local por canvas.');
  const mediaStream=v.captureStream?.()||v.mozCaptureStream?.();if(mediaStream)mediaStream.getAudioTracks().forEach(t=>stream.addTrack(t));
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw new Error('Este navegador não possui codificador WebM compatível.');
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6_000_000}),chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
  const start=Math.max(0,Number(c.trimStart)||0),end=Math.min(v.duration,Number(c.trimEnd)||v.duration),duration=Math.max(.1,end-start);
  v.currentTime=start;await new Promise(res=>{const done=()=>{v.removeEventListener('seeked',done);res()};v.addEventListener('seeked',done)});
  const finished=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(recorder.error||new Error('Falha na renderização.'))});
  recorder.start(250);status.textContent='Renderizando localmente...';await v.play();
  let stopped=false;
  const frame=()=>{if(stopped)return;const elapsed=Math.max(0,v.currentTime-start);progress.value=Math.min(99,elapsed/duration*100);ctx.save();ctx.filter=filterCss(p);ctx.drawImage(v,0,0,w,h);ctx.restore();drawOverlay(ctx,p,w,h);if(v.currentTime>=end||v.ended){stopped=true;v.pause();recorder.stop();return}requestAnimationFrame(frame)};requestAnimationFrame(frame);
  await finished;progress.value=100;status.textContent='Renderização concluída.';
  const out=new Blob(chunks,{type:mime}),outUrl=URL.createObjectURL(out),a=document.createElement('a');a.href=outUrl;a.download=(p.title||'keise-video').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.webm';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(outUrl),2000);URL.revokeObjectURL(url);
 }catch(e){status.textContent='Não foi possível renderizar: '+e.message;progress.value=0}
}
function downloadProject(p){const meta={schema:'keise-creative/project-v1',project:p,exportedAt:new Date().toISOString(),note:'Os arquivos de vídeo permanecem no navegador e não estão incluídos neste JSON.'},blob=new Blob([JSON.stringify(meta,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(p.title||'projeto')+'.keisevideo.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Projeto salvo.')}
function render(){if(!root)return;root.innerHTML=mode==='library'?library():editor();mode==='library'?bindLibrary():bindEditor()}
function mount(target){root=target;render()}
window.KeiseCreative=Object.freeze({mount,exportState:()=>JSON.parse(JSON.stringify(state)),create(title,context,aspect='16:9'){createProject(title,context||'',aspect)},showNew(){mode='library';if(root){render();setTimeout(()=>$('#creativeDialog',root)?.showModal(),0)}}});
})();