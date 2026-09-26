'use strict';
(()=>{
const KEY='keise-learning-author-v1';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let root=null,state=load(),mode='library',activeProjectId=null,selectedElementId=null,learnMediaUrls=new Map(),recordStream=null,recordRecorder=null,recordChunks=[],previewDevice='desktop',previewMode='screen';

function blank(){return{version:1,projects:[]}}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&x.version===1?x:blank()}catch{return blank()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function uid(p='id'){return p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(msg){const t=document.querySelector('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__klToast);window.__klToast=setTimeout(()=>t.classList.remove('show'),2300)}
function project(){return state.projects.find(p=>p.id===activeProjectId)}
function slide(){const p=project();return p?.slides.find(s=>s.id===p.activeSlideId)||p?.slides[0]||null}
function element(){return slide()?.elements.find(e=>e.id===selectedElementId)||null}
function touch(){const p=project();if(p)p.updatedAt=new Date().toISOString();save()}
function fmt(v){return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v))}
function splitLines(v){return String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function ensureA11y(p){p.a11y??={fontScale:100,highContrast:false,reduceMotion:false,focusOutline:true};return p.a11y}
function accessibilityIssues(p){
 const issues=[];
 p.slides.forEach((s,si)=>(s.elements||[]).forEach((e,ei)=>{
  const where=(s.title||'Tela '+(si+1))+' · bloco '+(ei+1);
  if(e.type==='image'&&!String(e.alt||'').trim())issues.push({level:'warning',where,text:'Imagem sem texto alternativo.'});
  if(e.type==='hotspot'){if(!String(e.alt||'').trim())issues.push({level:'warning',where,text:'Imagem interativa sem texto alternativo.'});(e.hotspots||[]).forEach((h,i)=>{if(!String(h.label||'').trim())issues.push({level:'warning',where,text:'Hotspot '+(i+1)+' sem rótulo acessível.'})})}
  if(e.type==='button'&&!String(e.label||'').trim())issues.push({level:'warning',where,text:'Botão sem texto.'});
  if(e.type==='video'&&!String(e.title||'').trim())issues.push({level:'warning',where,text:'Vídeo sem título identificador.'});
  if(e.type==='popup'&&(!String(e.label||'').trim()||!String(e.title||'').trim()))issues.push({level:'warning',where,text:'Popup precisa de rótulo e título claros.'});
  if(e.type==='quiz'&&(!String(e.question||'').trim()||(e.options||[]).some(x=>!String(x||'').trim())))issues.push({level:'warning',where,text:'Questão com pergunta ou alternativa vazia.'});
 }));
 return issues;
}
function ensureProjectSupport(p){
 p.support??={endpoint:'',defaultPrivacy:'private'};
 return p.support;
}
function ensureVideoSupport(e){
 e.support??={enabled:true,start:0,end:0,pauseOnOpen:true,allowQuestion:true,allowSignals:true,allowComments:false,allowMaterial:false,materialLabel:'Acessar material agora',materialUrl:''};
 return e.support;
}
function extractIframeSrc(code){
 const raw=String(code||'').trim();if(!raw)return'';
 try{const doc=new DOMParser().parseFromString(raw,'text/html'),iframe=doc.querySelector('iframe');if(iframe?.src)return iframe.src}catch{}
 if(/^https?:\/\//i.test(raw))return raw;
 const m=raw.match(/src\s*=\s*["']([^"']+)["']/i);return m?.[1]||'';
}
function supportDraftKey(p){return 'keise-learning-support-drafts:'+p.id}
function saveLocalSupportDraft(p,payload){
 const key=supportDraftKey(p);let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
 list.push(payload);localStorage.setItem(key,JSON.stringify(list.slice(-500)));return payload;
}
async function sendSupportPayload(p,payload){
 const cfg=ensureProjectSupport(p);
 if(cfg.endpoint){
  try{
   const res=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!res.ok)throw new Error('HTTP '+res.status);
   return{sent:true,mode:'connected'};
  }catch(e){
   saveLocalSupportDraft(p,payload);return{sent:false,mode:'local',error:e.message};
  }
 }
 saveLocalSupportDraft(p,payload);return{sent:false,mode:'local'};
}

function openLearnMediaDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('keise-learning-media-v1',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putLearnMedia(id,blob){const db=await openLearnMediaDb();return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(blob,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function getLearnMedia(id){const db=await openLearnMediaDb();return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').get(id);req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function learnMediaUrl(id){if(!id)return null;if(learnMediaUrls.has(id))return learnMediaUrls.get(id);const blob=await getLearnMedia(id);if(!blob)return null;const url=URL.createObjectURL(blob);learnMediaUrls.set(id,url);return url}
async function hydrateLocalVideos(scope=root){
 const nodes=$$('[data-learn-local-asset]',scope);for(const n of nodes){const id=n.dataset.learnLocalAsset,url=await learnMediaUrl(id);if(url)n.src=url;else{n.outerHTML='<div class="runtime-note">Arquivo local não encontrado neste navegador.</div>'}}
}
function stopLearningRecordStream(){if(recordStream){recordStream.getTracks().forEach(t=>t.stop());recordStream=null}recordRecorder=null;recordChunks=[]}
async function openLearningRecorder(e,kind){
 const dlg=$('#learnRecordDialog',root),preview=$('#learnRecordPreview',root),status=$('#learnRecordStatus',root),start=$('#learnRecordStart',root),stop=$('#learnRecordStop',root),use=$('#learnRecordUse',root);
 stopLearningRecordStream();recordChunks=[];use.disabled=true;stop.disabled=true;start.disabled=false;status.textContent=kind==='screen'?'Preparando captura de tela...':'Preparando câmera e microfone...';
 try{
  recordStream=kind==='screen'?await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}):await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  preview.srcObject=recordStream;preview.muted=true;dlg.showModal();status.textContent='Pronto para gravar.';
  start.onclick=()=>{recordChunks=[];const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));recordRecorder=new MediaRecorder(recordStream,mime?{mimeType:mime}:undefined);recordRecorder.ondataavailable=ev=>{if(ev.data?.size)recordChunks.push(ev.data)};recordRecorder.onstop=()=>{use.disabled=!recordChunks.length;status.textContent=recordChunks.length?'Gravação pronta. Clique em “Usar gravação”.':'Nenhum dado gravado.'};recordRecorder.start(250);start.disabled=true;stop.disabled=false;status.textContent='● Gravando...'};
  stop.onclick=()=>{if(recordRecorder&&recordRecorder.state!=='inactive')recordRecorder.stop();stop.disabled=true};
  use.onclick=async()=>{const blob=new Blob(recordChunks,{type:recordChunks[0]?.type||'video/webm'}),assetId=uid('media');await putLearnMedia(assetId,blob);e.assetId=assetId;e.sourceMode='local';e.src='';e.embedCode='';e.embedSrc='';touch();stopLearningRecordStream();dlg.close();render();toast('Gravação adicionada ao projeto.')};
 }catch(err){stopLearningRecordStream();status.textContent='Não foi possível acessar '+(kind==='screen'?'a tela':'a câmera/microfone')+': '+err.message;dlg.showModal()}
}

function library(){
 return `
 <section class="learn-hero">
  <div><p class="learn-kicker">📚 Keise Learning</p><h2>Crie experiências educacionais sem começar pelo código.</h2><p>Telas, conteúdo, vídeo, questões e navegação em um projeto que continua seu e pode ser exportado como HTML.</p></div>
  <button class="primary" id="learnNewProject">＋ Novo recurso</button>
 </section>
 <div class="learn-section-head"><div><h2>Meus recursos Learning</h2><p>Salvos localmente neste navegador.</p></div><span class="learn-note">v1 · editor por blocos</span></div>
 ${state.projects.length?'<div class="learn-project-grid">'+state.projects.map(p=>`<article class="learn-project-card"><div class="learn-project-icon">📖</div><h3>${esc(p.title)}</h3><p>${esc(p.context||'Sem disciplina/contexto informado')}</p><div class="learn-project-meta"><span>${p.slides.length} tela(s)</span><span>Atualizado ${fmt(p.updatedAt||p.createdAt)}</span></div><div class="learn-card-actions"><button class="soft" data-learn-open="${p.id}">Editar</button><button class="tiny" data-learn-preview="${p.id}">Visualizar</button></div></article>`).join('')+'</div>':empty('🪄','Nenhum recurso criado','Crie o primeiro recurso Learning para começar a montar telas e interações.')}
 <dialog class="dialog" id="learnCreateDialog"><button class="dialog-close" type="button" data-learn-close>×</button><div class="dialog-icon">📚</div><h2>Novo recurso Learning</h2><form id="learnCreateForm"><label>Título<input id="learnTitle" required maxlength="100" placeholder="Ex.: Economia circular — atividade interativa"></label><label>Disciplina/contexto<input id="learnContext" maxlength="120" placeholder="Ex.: Design e Sustentabilidade"></label><div class="dialog-actions"><button class="soft" type="button" data-learn-close>Cancelar</button><button class="primary" type="submit">Criar recurso</button></div></form></dialog>
 <dialog class="dialog wide learn-preview-dialog" id="learnPreviewDialog"><button class="dialog-close" type="button" data-learn-close>×</button><div id="learnPreviewBody"></div></dialog>`;
}
function empty(icon,title,text){return `<div class="learn-empty"><div><span>${icon}</span><b>${title}</b><p>${text}</p></div></div>`}

function elementMarkup(e,p){
 if(e.type==='heading')return `<div class="learn-render heading"><h2>${esc(e.text||'Título')}</h2></div>`;
 if(e.type==='text')return `<div class="learn-render text"><p>${esc(e.text||'Digite seu texto.').replace(/\n/g,'<br>')}</p></div>`;
 if(e.type==='video'){
  const support=ensureVideoSupport(e),source=e.sourceMode==='embed'&&e.embedSrc
   ?`<div class="video-embed-preview"><iframe src="${esc(e.embedSrc)}" title="${esc(e.title||'Vídeo incorporado')}" loading="lazy" allowfullscreen></iframe></div>`
   :e.sourceMode==='local'&&e.assetId?`<video controls preload="metadata" data-learn-local-asset="${esc(e.assetId)}"></video>`
   :e.src?`<video controls preload="metadata" src="${esc(e.src)}"></video>`:'<div class="video-placeholder">Escolha um arquivo, grave agora, cole um link ou código de incorporação.</div>';
  const supportCount=[support.allowQuestion,support.allowSignals,support.allowComments,support.allowMaterial].filter(Boolean).length;
  return `<div class="learn-render video"><div class="video-label">🎬 ${esc(e.title||'Vídeo')} ${(e.checkpoints||[]).length?`<span class="checkpoint-count">${e.checkpoints.length} pergunta(s)</span>`:''} ${support.enabled&&supportCount?`<span class="support-count">💜 ${supportCount} apoio(s)</span>`:''}</div>${source}</div>`;
 }
 if(e.type==='button')return `<div class="learn-render button-block"><button type="button" disabled>${esc(e.label||'Continuar')}</button><small>${e.targetSlideId?'Vai para outra tela':'Sem destino definido'}</small></div>`;
 if(e.type==='quiz')return `<div class="learn-render quiz"><b>❓ ${esc(e.question||'Sua pergunta')}</b><div>${(e.options||['Opção A','Opção B']).map((o,i)=>`<label><input type="radio" disabled> ${esc(o||'Opção '+(i+1))}</label>`).join('')}</div></div>`;
 if(e.type==='reflection')return `<div class="learn-render reflection"><b>💭 ${esc(e.prompt||'Reflita sobre este ponto.')}</b><textarea disabled placeholder="${esc(e.placeholder||'Escreva sua reflexão...')}"></textarea></div>`;
 if(e.type==='image'){const src=e.assetId?`<img data-learn-local-asset="${esc(e.assetId)}" alt="${esc(e.alt||'')}">`:e.src?`<img src="${esc(e.src)}" alt="${esc(e.alt||'')}">`:'<div class="image-placeholder">🖼️ Adicione uma imagem</div>';return `<figure class="learn-image-preview">${src}${e.caption?`<figcaption>${esc(e.caption)}</figcaption>`:''}</figure>`;}
 if(e.type==='popup')return `<div class="learn-render popup-preview"><button disabled>🪟 ${esc(e.label||'Abrir')}</button><div><b>${esc(e.title||'Saiba mais')}</b><p>${esc(e.content||'Conteúdo da caixa.')}</p></div></div>`;
 if(e.type==='tabs')return `<div class="learn-render tabs-preview"><div class="tabs-preview-head">${(e.items||[]).map((it,i)=>`<span class="${i===0?'active':''}">${esc(it.title)}</span>`).join('')}</div><p>${esc(e.items?.[0]?.content||'')}</p></div>`;
 if(e.type==='hotspot'){const img=e.assetId?`<img data-learn-local-asset="${esc(e.assetId)}" alt="${esc(e.alt||'Imagem interativa')}">`:e.src?`<img src="${esc(e.src)}" alt="${esc(e.alt||'Imagem interativa')}">`:'<div class="image-placeholder">✨ Adicione a imagem do cenário</div>';return `<div class="hotspot-preview">${img}${(e.hotspots||[]).map((h,i)=>`<span class="hotspot-dot" style="left:${Number(h.x)||50}%;top:${Number(h.y)||50}%">${i+1}</span>`).join('')}</div>`;}
 if(e.type==='path')return `<div class="learn-render path-preview">${splitLines(e.stepsText).map((x,i)=>`<div><span>${i+1}</span><b>${esc(x)}</b></div>`).join('')}</div>`;
 if(e.type==='meeting')return `<div class="learn-render meeting-preview"><span>🔴</span><div><b>${esc(e.title||'Encontro ao vivo')}</b><p>${esc(e.provider||'Outro')} · abre em janela separada</p></div></div>`;
 if(e.type==='escape')return `<div class="learn-render escape-preview"><span>🔐</span><div><b>Escape room</b><p>${esc(e.prompt||'Resolva o desafio.')}</p></div></div>`;
 if(e.type==='bingo')return `<div class="learn-render bingo-preview">${splitLines(e.itemsText).slice(0,9).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`;
 if(e.type==='raffle')return `<div class="learn-render raffle-preview"><span>🎲</span><div><b>Sorteio</b><p>${splitLines(e.itemsText).length} opção(ões)</p></div></div>`;
 if(e.type==='effect')return `<div class="learn-render effect-preview"><button disabled>✨ ${esc(e.label||'Comemorar')}</button><small>${esc(e.effect||'confetti')}</small></div>`;
 return '';
}
function editor(){
 const p=project(),s=slide();if(!p||!s){mode='library';return library()}
 return `
 <section class="learn-editor">
  <header class="learn-editor-top">
   <button class="soft" id="learnBack">← Projetos</button>
   <div><small>Keise Learning</small><h2>${esc(p.title)}</h2><p>${esc(p.context||'Sem contexto informado')}</p></div>
   <div class="learn-editor-actions"><span class="learn-save-state">● salvo localmente</span><button class="soft" id="learnSupportSettingsBtn">💜 Apoios</button><button class="soft" id="learnA11yBtn">♿ Acessibilidade</button><button class="soft" id="learnCodeBtn">&lt;/&gt; Código</button><button class="soft" id="learnPreview">▶ Visualizar</button><button class="primary" id="learnExport">Exportar HTML</button></div>
  </header>
  <div class="learn-workspace">
   <aside class="learn-slides">
    <div class="learn-side-head"><b>Telas</b><button class="tiny" id="learnAddSlide">＋</button></div>
    <div class="learn-slide-list">${p.slides.map((x,i)=>`<button class="${x.id===p.activeSlideId?'active':''}" data-learn-slide="${x.id}"><span>${i+1}</span><b>${esc(x.title||'Tela '+(i+1))}</b></button>`).join('')}</div>
    <button class="soft learn-add-screen" id="learnAddSlideBottom">＋ Nova tela</button>
   </aside>
   <section class="learn-canvas-wrap">
    <div class="learn-canvas-head"><div><span>Tela atual</span><input id="learnSlideTitle" maxlength="80" value="${esc(s.title||'')}"></div><button class="tiny danger-text" id="learnDeleteSlide" ${p.slides.length===1?'disabled':''}>Excluir tela</button></div>
    <div class="learn-canvas">
     <div class="learn-slide-stage">
      ${s.elements.length?s.elements.map(e=>`<article class="learn-element ${e.id===selectedElementId?'selected':''}" data-learn-element="${e.id}">${elementMarkup(e,p)}<div class="element-tools"><button data-move="up" title="Mover para cima">↑</button><button data-move="down" title="Mover para baixo">↓</button><button data-remove="${e.id}" title="Excluir">×</button></div></article>`).join(''):empty('✨','Tela vazia','Use a biblioteca de blocos à direita para começar.')}
     </div>
    </div>
   </section>
   <aside class="learn-properties">
    <div class="learn-side-head"><b>${element()?'Propriedades':'Adicionar bloco'}</b>${element()?'<button class="tiny" id="learnCloseProperties">×</button>':''}</div>
    ${element()?properties(element(),p):toolbox()}
   </aside>
  </div>
  <dialog class="dialog wide learn-preview-dialog" id="learnPreviewDialog"><button class="dialog-close" type="button" data-learn-close>×</button><div id="learnPreviewBody"></div></dialog>
  <dialog class="dialog learn-support-settings-dialog" id="learnSupportSettingsDialog">
   <button class="dialog-close" type="button" data-learn-close>×</button>
   <div class="dialog-icon">💜</div><h2>Apoios e Mediação</h2>
   <p>Defina como dúvidas e comentários podem chegar à mediação. Sem conector, eles ficam claramente salvos como rascunho local no dispositivo do aluno.</p>
   <form id="learnSupportSettingsForm">
    <label>Endpoint do conector <span class="field-help">opcional</span><input id="learnSupportEndpoint" type="url" value="${esc(ensureProjectSupport(p).endpoint||'')}" placeholder="https://seu-conector/..."></label>
    <p class="support-security-note">🔐 Não coloque chave de API ou senha neste campo. O HTML do aluno é público; use apenas um endpoint seguro do seu conector/servidor.</p>
    <label>Privacidade padrão<select id="learnSupportPrivacy"><option value="private" ${ensureProjectSupport(p).defaultPrivacy!=='class'?'selected':''}>Privado para a mediação</option><option value="class" ${ensureProjectSupport(p).defaultPrivacy==='class'?'selected':''}>Pode integrar discussão da turma</option></select></label>
    <div class="dialog-actions"><button class="soft" type="button" data-learn-close>Cancelar</button><button class="primary" type="submit">Salvar configuração</button></div>
   </form>
  </dialog>
  <dialog class="dialog wide learn-code-dialog" id="learnCodeDialog">
   <button class="dialog-close" type="button" data-learn-close>×</button>
   <div class="dialog-icon">&lt;/&gt;</div><h2>Código e incorporação</h2>
   <p>O Studio continua visual, mas o código nunca fica escondido de você.</p>
   <div class="code-tabs">
    <label>HTML completo<textarea id="learnSourceCode" readonly spellcheck="false"></textarea></label>
    <div class="code-actions"><button class="soft" type="button" id="learnCopySource">Copiar HTML</button></div>
    <label>Código para incorporar depois de publicar<textarea id="learnIframeCode" readonly spellcheck="false"></textarea></label>
    <div class="code-actions"><button class="soft" type="button" id="learnCopyIframe">Copiar iframe</button></div>
   </div>
  </dialog>
  <dialog class="dialog wide learn-a11y-dialog" id="learnA11yDialog">
   <button class="dialog-close" type="button" data-learn-close>×</button>
   <div class="dialog-icon">♿</div><h2>Acessibilidade</h2>
   <p>Configure preferências padrão e verifique pontos que precisam de atenção antes de publicar.</p>
   <div class="a11y-config-grid">
    <label>Tamanho-base do texto <span id="a11yFontValue">${ensureA11y(p).fontScale}%</span><input id="a11yFontScale" type="range" min="85" max="140" step="5" value="${ensureA11y(p).fontScale}"></label>
    <label class="support-check"><input id="a11yHighContrast" type="checkbox" ${ensureA11y(p).highContrast?'checked':''}> Alto contraste por padrão</label>
    <label class="support-check"><input id="a11yReduceMotion" type="checkbox" ${ensureA11y(p).reduceMotion?'checked':''}> Reduzir animações</label>
    <label class="support-check"><input id="a11yFocusOutline" type="checkbox" ${ensureA11y(p).focusOutline!==false?'checked':''}> Destacar foco do teclado</label>
   </div>
   <div class="a11y-audit"><div class="checkpoint-head"><b>Verificação do projeto</b><button class="soft" id="a11yRunAudit" type="button">Verificar agora</button></div><div id="a11yAuditResults"></div></div>
  </dialog>
  <dialog class="dialog wide learn-record-dialog" id="learnRecordDialog">
   <button class="dialog-close" type="button" id="learnRecordClose">×</button>
   <div class="dialog-icon">🎥</div><h2>Gravar agora</h2>
   <p id="learnRecordStatus">Preparando...</p>
   <video id="learnRecordPreview" autoplay playsinline muted></video>
   <div class="record-actions"><button class="soft" type="button" id="learnRecordStart">● Iniciar gravação</button><button class="soft" type="button" id="learnRecordStop" disabled>■ Parar</button><button class="primary" type="button" id="learnRecordUse" disabled>Usar gravação</button></div>
  </dialog>
 </section>`;
}
function toolbox(){
 return `<div class="learn-toolbox advanced">
  <section class="tool-group"><h4>🧱 Conteúdo</h4><div>
   <button data-add-block="heading"><span>🔠</span><b>Título</b><small>Destaque principal</small></button>
   <button data-add-block="text"><span>📝</span><b>Texto</b><small>Conteúdo e explicação</small></button>
   <button data-add-block="image"><span>🖼️</span><b>Imagem</b><small>Com texto alternativo</small></button>
   <button data-add-block="video"><span>🎬</span><b>Vídeo / Live</b><small>Upload, gravação, link ou embed</small></button>
   <button data-add-block="button"><span>🔘</span><b>Botão</b><small>Navegação entre telas</small></button>
  </div></section>
  <section class="tool-group"><h4>✨ Interação</h4><div>
   <button data-add-block="quiz"><span>❓</span><b>Múltipla escolha</b><small>Questão com feedback</small></button>
   <button data-add-block="reflection"><span>💭</span><b>Reflexão</b><small>Pergunta aberta</small></button>
   <button data-add-block="popup"><span>🪟</span><b>Caixa / Popup</b><small>Abre conteúdo sem sair da tela</small></button>
   <button data-add-block="tabs"><span>🗂️</span><b>Abas</b><small>Conteúdo organizado</small></button>
  </div></section>
  <section class="tool-group"><h4>🌐 Imersão</h4><div>
   <button data-add-block="hotspot"><span>✨</span><b>Imagem interativa</b><small>Pontos brilhantes e cenas</small></button>
   <button data-add-block="path"><span>🧭</span><b>Trilha</b><small>Etapas e percurso</small></button>
   <button data-add-block="meeting"><span>🔴</span><b>Encontro ao vivo</b><small>Meet, Teams ou outro</small></button>
  </div></section>
  <section class="tool-group"><h4>🎮 Jogos</h4><div>
   <button data-add-block="escape"><span>🔐</span><b>Escape room</b><small>Desafio com senha/resposta</small></button>
   <button data-add-block="bingo"><span>🎯</span><b>Bingo</b><small>Cartela interativa</small></button>
   <button data-add-block="raffle"><span>🎲</span><b>Sorteio</b><small>Roleta de opções</small></button>
  </div></section>
  <section class="tool-group"><h4>🎉 Efeitos</h4><div>
   <button data-add-block="effect"><span>🎊</span><b>Botão de efeito</b><small>Confete, aplausos, presente...</small></button>
  </div></section>
 </div>`;
}
function properties(e,p){
 if(e.type==='heading'||e.type==='text')return `<div class="learn-props"><label>Conteúdo<textarea id="propText" rows="${e.type==='heading'?3:8}">${esc(e.text||'')}</textarea></label><small>As alterações são salvas automaticamente.</small></div>`;
 if(e.type==='video'){
  const support=ensureVideoSupport(e);
  return `<div class="learn-props">
   <label>Título<input id="propVideoTitle" value="${esc(e.title||'')}"></label>
   <label>Origem do vídeo<select id="propVideoSourceMode"><option value="url" ${e.sourceMode==='url'||(!e.sourceMode&&!e.assetId)?'selected':''}>🔗 Link direto / MP4</option><option value="local" ${e.sourceMode==='local'?'selected':''}>📁 Arquivo ou gravação local</option><option value="embed" ${e.sourceMode==='embed'?'selected':''}>⌘ Código de incorporação</option></select></label>
   ${e.sourceMode==='embed'
    ?`<label>Código de incorporação<textarea id="propVideoEmbed" rows="5" placeholder='<iframe src="..."></iframe>'>${esc(e.embedCode||'')}</textarea></label><label>Endereço detectado<input id="propVideoEmbedSrc" value="${esc(e.embedSrc||'')}" readonly></label>`
    :e.sourceMode==='local'
      ?`<div class="local-video-actions"><input id="propVideoFile" type="file" accept="video/*" hidden><button class="soft" type="button" id="propChooseVideo">📁 Escolher vídeo</button><button class="soft" type="button" id="propRecordCamera">🎥 Gravar câmera</button><button class="soft" type="button" id="propRecordScreen">🖥 Gravar tela</button></div><p class="learn-prop-note">${e.assetId?'✓ Vídeo local vinculado a este projeto neste navegador.':'Nenhum arquivo local escolhido.'} Para compartilhar em outro dispositivo, futuramente usaremos “Empacotar projeto”.</p>`
      :`<label>URL do vídeo<input id="propVideoSrc" value="${esc(e.src||'')}" placeholder="https://.../video.mp4"></label>`}
   <div class="support-editor">
    <div class="support-editor-head"><b>💜 Apoios e Mediação</b><label class="support-switch"><input id="supportEnabled" type="checkbox" ${support.enabled?'checked':''}> Ativar</label></div>
    <p class="learn-prop-note">Você decide o que o aluno pode fazer neste vídeo e em qual trecho.</p>
    <div class="support-time-grid"><label>Disponível a partir de (s)<input id="supportStart" type="number" min="0" step="1" value="${Number(support.start)||0}"></label><label>Até (s) <small>0 = até o fim</small><input id="supportEnd" type="number" min="0" step="1" value="${Number(support.end)||0}"></label></div>
    <label class="support-check"><input id="supportPause" type="checkbox" ${support.pauseOnOpen?'checked':''}> Pausar o vídeo ao abrir ajuda</label>
    <label class="support-check"><input id="supportQuestion" type="checkbox" ${support.allowQuestion?'checked':''}> 💬 Dúvida no Ponto</label>
    <label class="support-check"><input id="supportSignals" type="checkbox" ${support.allowSignals?'checked':''}> 🤔 Entendi / Tenho dúvida / Me perdi / Quero aprofundar</label>
    <label class="support-check"><input id="supportComments" type="checkbox" ${support.allowComments?'checked':''}> 💭 Permitir comentário neste trecho</label>
    <label class="support-check"><input id="supportMaterial" type="checkbox" ${support.allowMaterial?'checked':''}> 🔎 Acessar material agora</label>
    <label>Texto do material<input id="supportMaterialLabel" value="${esc(support.materialLabel||'Acessar material agora')}"></label>
    <label>Link do material<input id="supportMaterialUrl" value="${esc(support.materialUrl||'')}" placeholder="https://... ou PDF"></label>
   </div>
   <div class="checkpoint-editor"><div class="checkpoint-head"><b>❓ Perguntas programadas</b><button class="tiny" type="button" id="propAddCheckpoint">＋ Pergunta no vídeo</button></div>
   ${(e.checkpoints||[]).length?(e.checkpoints||[]).map((cp,n)=>`<section class="checkpoint-item" data-cp="${cp.id}"><div class="checkpoint-item-head"><b>Ponto ${n+1}</b><button class="tiny danger-text" type="button" data-cp-delete="${cp.id}">Excluir</button></div><label>Tempo em segundos<input type="number" min="0" step="1" data-cp-field="at" data-cp-id="${cp.id}" value="${Number(cp.at)||0}"></label><label>Pergunta<textarea data-cp-field="question" data-cp-id="${cp.id}">${esc(cp.question||'')}</textarea></label>${(cp.options||[]).map((o,i)=>`<label>Alternativa ${String.fromCharCode(65+i)}<input data-cp-option="${i}" data-cp-id="${cp.id}" value="${esc(o)}"></label>`).join('')}<label>Resposta correta<select data-cp-field="correct" data-cp-id="${cp.id}">${(cp.options||[]).map((_,i)=>`<option value="${i}" ${Number(cp.correct)===i?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></label><label>Se acertar, ir para<select data-cp-field="correctTargetSlideId" data-cp-id="${cp.id}"><option value="">Continuar o vídeo</option>${p.slides.filter(s=>s.id!==p.activeSlideId).map(s=>`<option value="${s.id}" ${cp.correctTargetSlideId===s.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label><label>Se errar, ir para<select data-cp-field="wrongTargetSlideId" data-cp-id="${cp.id}"><option value="">Continuar o vídeo</option>${p.slides.filter(s=>s.id!==p.activeSlideId).map(s=>`<option value="${s.id}" ${cp.wrongTargetSlideId===s.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label><label>Feedback ao acertar<textarea data-cp-field="feedbackRight" data-cp-id="${cp.id}">${esc(cp.feedbackRight||'Muito bem!')}</textarea></label><label>Feedback ao errar<textarea data-cp-field="feedbackWrong" data-cp-id="${cp.id}">${esc(cp.feedbackWrong||'Revise este trecho e tente novamente.')}</textarea></label></section>`).join(''):'<p class="learn-prop-note">Nenhuma pergunta programada ainda.</p>'}</div>
  </div>`;
 }
 if(e.type==='button')return `<div class="learn-props"><label>Texto do botão<input id="propButtonLabel" value="${esc(e.label||'Continuar')}"></label><label>Ir para<select id="propButtonTarget"><option value="">Sem destino</option>${p.slides.filter(s=>s.id!==p.activeSlideId).map((s,i)=>`<option value="${s.id}" ${e.targetSlideId===s.id?'selected':''}>${esc(s.title||'Tela '+(i+1))}</option>`).join('')}</select></label></div>`;
 if(e.type==='reflection')return `<div class="learn-props"><label>Pergunta<textarea id="propReflection">${esc(e.prompt||'')}</textarea></label><label>Placeholder<input id="propReflectionPlaceholder" value="${esc(e.placeholder||'')}"></label></div>`;
 if(e.type==='quiz')return `<div class="learn-props"><label>Pergunta<textarea id="propQuizQuestion">${esc(e.question||'')}</textarea></label>${(e.options||[]).map((o,i)=>`<label>Alternativa ${String.fromCharCode(65+i)}<input data-quiz-option="${i}" value="${esc(o)}"></label>`).join('')}<label>Resposta correta<select id="propQuizCorrect">${(e.options||[]).map((_,i)=>`<option value="${i}" ${Number(e.correct)===i?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></label><label>Feedback ao acertar<textarea id="propQuizRight">${esc(e.feedbackRight||'Muito bem!')}</textarea></label><label>Feedback ao errar<textarea id="propQuizWrong">${esc(e.feedbackWrong||'Revise o conteúdo e tente novamente.')}</textarea></label></div>`;
 if(e.type==='image')return `<div class="learn-props"><input id="propImageFile" type="file" accept="image/*" hidden><button class="soft" id="propChooseImage" type="button">📁 Escolher imagem</button><label>Ou URL<input id="propImageSrc" value="${esc(e.src||'')}" placeholder="https://..."></label><label>Texto alternativo<input id="propImageAlt" value="${esc(e.alt||'')}" placeholder="Descreva o que a imagem comunica"></label><label>Legenda<input id="propImageCaption" value="${esc(e.caption||'')}"></label></div>`;
 if(e.type==='popup')return `<div class="learn-props"><label>Texto do botão<input id="propPopupLabel" value="${esc(e.label||'')}"></label><label>Título da caixa<input id="propPopupTitle" value="${esc(e.title||'')}"></label><label>Conteúdo<textarea id="propPopupContent" rows="8">${esc(e.content||'')}</textarea></label></div>`;
 if(e.type==='tabs')return `<div class="learn-props">${(e.items||[]).map((it,i)=>`<section class="mini-prop-card"><label>Título da aba ${i+1}<input data-tab-title="${i}" value="${esc(it.title||'')}"></label><label>Conteúdo<textarea data-tab-content="${i}">${esc(it.content||'')}</textarea></label></section>`).join('')}</div>`;
 if(e.type==='hotspot')return `<div class="learn-props"><input id="propHotspotImageFile" type="file" accept="image/*" hidden><button class="soft" id="propChooseHotspotImage" type="button">📁 Escolher imagem/cenário</button><label>Ou URL da imagem<input id="propHotspotSrc" value="${esc(e.src||'')}"></label><label>Texto alternativo<input id="propHotspotAlt" value="${esc(e.alt||'')}"></label><div class="checkpoint-head"><b>Pontos brilhantes</b><button class="tiny" id="propAddHotspot" type="button">＋ Ponto</button></div>${(e.hotspots||[]).map((h,i)=>`<section class="mini-prop-card" data-hot-id="${h.id}"><div class="checkpoint-item-head"><b>Ponto ${i+1}</b><button class="tiny danger-text" data-hot-delete="${h.id}" type="button">Excluir</button></div><div class="support-time-grid"><label>X (%)<input data-hot-field="x" data-hot-id="${h.id}" type="number" min="0" max="100" value="${Number(h.x)||50}"></label><label>Y (%)<input data-hot-field="y" data-hot-id="${h.id}" type="number" min="0" max="100" value="${Number(h.y)||50}"></label></div><label>Rótulo<input data-hot-field="label" data-hot-id="${h.id}" value="${esc(h.label||'Explorar')}"></label><label>Ação<select data-hot-field="action" data-hot-id="${h.id}"><option value="popup" ${h.action==='popup'?'selected':''}>Abrir caixa</option><option value="scene" ${h.action==='scene'?'selected':''}>Ir para outra tela</option><option value="effect" ${h.action==='effect'?'selected':''}>Disparar efeito</option><option value="link" ${h.action==='link'?'selected':''}>Abrir link</option></select></label><label>Conteúdo da caixa<textarea data-hot-field="content" data-hot-id="${h.id}">${esc(h.content||'')}</textarea></label><label>Tela de destino<select data-hot-field="targetSlideId" data-hot-id="${h.id}"><option value="">Nenhuma</option>${p.slides.map(s=>`<option value="${s.id}" ${h.targetSlideId===s.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label><label>Efeito<select data-hot-field="effect" data-hot-id="${h.id}">${['confetti','applause','gift','stars','balloons','boo'].map(x=>`<option value="${x}" ${h.effect===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Link<input data-hot-field="url" data-hot-id="${h.id}" value="${esc(h.url||'')}"></label></section>`).join('')}</div>`;
 if(e.type==='path')return `<div class="learn-props"><label>Título<input id="propPathTitle" value="${esc(e.title||'')}"></label><label>Etapas <span class="field-help">uma por linha</span><textarea id="propPathSteps" rows="10">${esc(e.stepsText||'')}</textarea></label></div>`;
 if(e.type==='meeting')return `<div class="learn-props"><label>Título<input id="propMeetingTitle" value="${esc(e.title||'')}"></label><label>Plataforma<select id="propMeetingProvider"><option ${e.provider==='Google Meet'?'selected':''}>Google Meet</option><option ${e.provider==='Microsoft Teams'?'selected':''}>Microsoft Teams</option><option ${e.provider==='Zoom'?'selected':''}>Zoom</option><option ${e.provider==='Outro'?'selected':''}>Outro</option></select></label><label>Link da reunião<input id="propMeetingUrl" value="${esc(e.url||'')}" placeholder="https://..."></label><label>Orientação<textarea id="propMeetingNote">${esc(e.note||'')}</textarea></label><p class="learn-prop-note">O encontro abre em outra janela para evitar bloqueios de segurança do Meet/Teams. O Keise Studio pode permanecer aberto ao lado com dúvidas e Live Assist.</p></div>`;
 if(e.type==='escape')return `<div class="learn-props"><label>Desafio<textarea id="propEscapePrompt">${esc(e.prompt||'')}</textarea></label><label>Resposta correta<input id="propEscapeAnswer" value="${esc(e.answer||'')}"></label><label>Dica<input id="propEscapeHint" value="${esc(e.hint||'')}"></label><label>Mensagem ao concluir<input id="propEscapeSuccess" value="${esc(e.success||'')}"></label><label>Ir para<select id="propEscapeTarget"><option value="">Continuar nesta tela</option>${p.slides.map(s=>`<option value="${s.id}" ${e.targetSlideId===s.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label><label>Efeito<select id="propEscapeEffect">${['confetti','applause','gift','stars','balloons'].map(x=>`<option value="${x}" ${e.effect===x?'selected':''}>${x}</option>`).join('')}</select></label></div>`;
 if(e.type==='bingo')return `<div class="learn-props"><label>Título<input id="propBingoTitle" value="${esc(e.title||'')}"></label><label>Itens <span class="field-help">um por linha</span><textarea id="propBingoItems" rows="12">${esc(e.itemsText||'')}</textarea></label><label>Tamanho<select id="propBingoGrid"><option value="3" ${Number(e.grid)===3?'selected':''}>3 × 3</option><option value="4" ${Number(e.grid)===4?'selected':''}>4 × 4</option></select></label></div>`;
 if(e.type==='raffle')return `<div class="learn-props"><label>Título<input id="propRaffleTitle" value="${esc(e.title||'')}"></label><label>Opções <span class="field-help">uma por linha</span><textarea id="propRaffleItems" rows="12">${esc(e.itemsText||'')}</textarea></label></div>`;
 if(e.type==='effect')return `<div class="learn-props"><label>Texto do botão<input id="propEffectLabel" value="${esc(e.label||'')}"></label><label>Efeito<select id="propEffectType">${['confetti','applause','gift','stars','balloons','boo'].map(x=>`<option value="${x}" ${e.effect===x?'selected':''}>${x}</option>`).join('')}</select></label></div>`;
 return '';
}
function newElement(type){
 if(type==='heading')return{id:uid('el'),type,text:'Novo título'};
 if(type==='text')return{id:uid('el'),type,text:'Digite aqui o conteúdo da sua aula.'};
 if(type==='video')return{id:uid('el'),type,title:'Vídeo da aula',sourceMode:'url',src:'',assetId:'',embedCode:'',embedSrc:'',checkpoints:[],support:{enabled:true,start:0,end:0,pauseOnOpen:true,allowQuestion:true,allowSignals:true,allowComments:false,allowMaterial:false,materialLabel:'Acessar material agora',materialUrl:''}};
 if(type==='button')return{id:uid('el'),type,label:'Continuar',targetSlideId:''};
 if(type==='reflection')return{id:uid('el'),type,prompt:'O que você considera mais importante neste ponto?',placeholder:'Escreva sua reflexão...'};
 if(type==='quiz')return{id:uid('el'),type,question:'Qual alternativa está correta?',options:['Alternativa A','Alternativa B','Alternativa C','Alternativa D'],correct:0,feedbackRight:'Muito bem!',feedbackWrong:'Revise o conteúdo e tente novamente.'};
 if(type==='image')return{id:uid('el'),type,src:'',assetId:'',alt:'',caption:''};
 if(type==='popup')return{id:uid('el'),type,label:'Abrir explicação',title:'Saiba mais',content:'Escreva aqui o conteúdo que aparecerá na caixa.'};
 if(type==='tabs')return{id:uid('el'),type,items:[{title:'Conceito',content:'Conteúdo da primeira aba.'},{title:'Exemplo',content:'Conteúdo da segunda aba.'},{title:'Aplicação',content:'Conteúdo da terceira aba.'}]};
 if(type==='hotspot')return{id:uid('el'),type,src:'',assetId:'',alt:'Imagem interativa',hotspots:[{id:uid('hot'),x:28,y:35,label:'Explorar',action:'popup',content:'Conteúdo deste ponto.',targetSlideId:'',effect:'confetti',url:''}]};
 if(type==='path')return{id:uid('el'),type,title:'Minha trilha',stepsText:'Descobrir\nExplorar\nPraticar\nConcluir'};
 if(type==='meeting')return{id:uid('el'),type,title:'Encontro ao vivo',provider:'Google Meet',url:'',note:'Abra a reunião e mantenha a Central da Live disponível para perguntas e marcações.'};
 if(type==='escape')return{id:uid('el'),type,prompt:'Resolva a pista para abrir a próxima etapa.',answer:'resposta',hint:'Observe os detalhes do cenário.',success:'Você conseguiu!',targetSlideId:'',effect:'confetti'};
 if(type==='bingo')return{id:uid('el'),type,title:'Bingo da aula',itemsText:'Conceito 1\nConceito 2\nConceito 3\nConceito 4\nConceito 5\nConceito 6\nConceito 7\nConceito 8\nConceito 9',grid:3};
 if(type==='raffle')return{id:uid('el'),type,title:'Sorteio',itemsText:'Opção 1\nOpção 2\nOpção 3\nOpção 4'};
 if(type==='effect')return{id:uid('el'),type,label:'Parabéns!',effect:'confetti'};
}
function createProject(title,context){
 const first={id:uid('slide'),title:'Boas-vindas',elements:[{id:uid('el'),type:'heading',text:title},{id:uid('el'),type:'text',text:'Comece a construir sua experiência educacional.'}]};
 const p={id:uid('learn'),title,context,support:{endpoint:'',defaultPrivacy:'private'},a11y:{fontScale:100,highContrast:false,reduceMotion:false,focusOutline:true},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),activeSlideId:first.id,slides:[first]};
 state.projects.unshift(p);save();activeProjectId=p.id;selectedElementId=null;mode='editor';render();
}
function bindLibrary(){
 $('#learnNewProject',root).onclick=()=>$('#learnCreateDialog',root).showModal();
 $$('[data-learn-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('#learnCreateForm',root).onsubmit=e=>{e.preventDefault();const title=$('#learnTitle',root).value.trim(),ctx=$('#learnContext',root).value.trim();$('#learnCreateDialog',root).close();createProject(title,ctx)};
 $$('[data-learn-open]',root).forEach(b=>b.onclick=()=>{activeProjectId=b.dataset.learnOpen;const p=project();if(p&&!p.activeSlideId)p.activeSlideId=p.slides[0]?.id;selectedElementId=null;mode='editor';render()});
 $$('[data-learn-preview]',root).forEach(b=>b.onclick=()=>previewProject(b.dataset.learnPreview));
}
function renderA11yAudit(p){
 const box=$('#a11yAuditResults',root);if(!box)return;const issues=accessibilityIssues(p);
 box.innerHTML=issues.length?`<div class="a11y-issues">${issues.map(i=>`<article><span>⚠️</span><div><b>${esc(i.where)}</b><p>${esc(i.text)}</p></div></article>`).join('')}</div>`:'<div class="a11y-ok">✅ Nenhum problema básico detectado nesta verificação.</div>';
}
function bindEditor(){
 const p=project(),s=slide();if(!p||!s)return;
 $('#learnBack',root).onclick=()=>{mode='library';selectedElementId=null;render()};
 $('#learnAddSlide',root).onclick=$('#learnAddSlideBottom',root).onclick=()=>{const n={id:uid('slide'),title:'Nova tela',elements:[]};p.slides.push(n);p.activeSlideId=n.id;selectedElementId=null;touch();render()};
 $$('[data-learn-slide]',root).forEach(b=>b.onclick=()=>{p.activeSlideId=b.dataset.learnSlide;selectedElementId=null;touch();render()});
 $('#learnSlideTitle',root).oninput=e=>{s.title=e.target.value;touch()};
 $('#learnDeleteSlide',root).onclick=()=>{if(p.slides.length===1)return;if(!confirm('Excluir esta tela e seus blocos?'))return;const i=p.slides.findIndex(x=>x.id===s.id);p.slides.splice(i,1);p.activeSlideId=p.slides[Math.max(0,i-1)].id;selectedElementId=null;touch();render()};
 $$('[data-add-block]',root).forEach(b=>b.onclick=()=>{const e=newElement(b.dataset.addBlock);s.elements.push(e);selectedElementId=e.id;touch();render()});
 $$('[data-learn-element]',root).forEach(card=>card.onclick=e=>{if(e.target.closest('.element-tools'))return;selectedElementId=card.dataset.learnElement;render()});
 $$('[data-remove]',root).forEach(b=>b.onclick=e=>{e.stopPropagation();s.elements=s.elements.filter(x=>x.id!==b.dataset.remove);if(selectedElementId===b.dataset.remove)selectedElementId=null;touch();render()});
 $$('[data-move]',root).forEach(b=>b.onclick=e=>{e.stopPropagation();const card=b.closest('[data-learn-element]'),id=card.dataset.learnElement,i=s.elements.findIndex(x=>x.id===id),dir=b.dataset.move==='up'?-1:1,j=i+dir;if(j<0||j>=s.elements.length)return;[s.elements[i],s.elements[j]]=[s.elements[j],s.elements[i]];touch();render()});
 $('#learnCloseProperties',root)?.addEventListener('click',()=>{selectedElementId=null;render()});
 bindProperties();
 $('#learnPreview',root).onclick=()=>previewProject(p.id);
 $('#learnExport',root).onclick=()=>exportProject(p);
 $('#learnA11yBtn',root).onclick=()=>{renderA11yAudit(p);$('#learnA11yDialog',root).showModal()};
 const a11y=ensureA11y(p);
 const fs=$('#a11yFontScale',root);if(fs)fs.oninput=()=>{a11y.fontScale=Number(fs.value);$('#a11yFontValue',root).textContent=fs.value+'%';touch()};
 const hc=$('#a11yHighContrast',root);if(hc)hc.onchange=()=>{a11y.highContrast=hc.checked;touch()};
 const rm=$('#a11yReduceMotion',root);if(rm)rm.onchange=()=>{a11y.reduceMotion=rm.checked;touch()};
 const fo=$('#a11yFocusOutline',root);if(fo)fo.onchange=()=>{a11y.focusOutline=fo.checked;touch()};
 $('#a11yRunAudit',root)?.addEventListener('click',()=>renderA11yAudit(p));
 $('#learnSupportSettingsBtn',root).onclick=()=>$('#learnSupportSettingsDialog',root).showModal();
 $('#learnSupportSettingsForm',root).onsubmit=ev=>{ev.preventDefault();const cfg=ensureProjectSupport(p);cfg.endpoint=$('#learnSupportEndpoint',root).value.trim();cfg.defaultPrivacy=$('#learnSupportPrivacy',root).value;touch();$('#learnSupportSettingsDialog',root).close();toast('Apoios e mediação atualizados.')};
 $('#learnCodeBtn',root).onclick=()=>{const source=exportedHtml(p),iframe='<iframe src="COLE_A_URL_PUBLICADA_AQUI" title="'+p.title.replace(/"/g,'&quot;')+'" width="100%" height="720" style="border:0" allowfullscreen></iframe>';$('#learnSourceCode',root).value=source;$('#learnIframeCode',root).value=iframe;$('#learnCodeDialog',root).showModal()};
 $('#learnCopySource',root).onclick=async()=>{await navigator.clipboard.writeText($('#learnSourceCode',root).value);toast('HTML copiado.')};
 $('#learnCopyIframe',root).onclick=async()=>{await navigator.clipboard.writeText($('#learnIframeCode',root).value);toast('Código de incorporação copiado.')};
 $$('[data-learn-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
 const recClose=$('#learnRecordClose',root);if(recClose)recClose.onclick=()=>{stopLearningRecordStream();$('#learnRecordDialog',root).close()};
}
function bindProperties(){
 const e=element();if(!e)return;
 const bind=(sel,key)=>{const n=$(sel,root);if(n)n.oninput=ev=>{e[key]=ev.target.value;touch();renderCanvasLight()}};
 bind('#propText','text');bind('#propVideoTitle','title');bind('#propVideoSrc','src');bind('#propButtonLabel','label');bind('#propReflection','prompt');bind('#propReflectionPlaceholder','placeholder');bind('#propQuizQuestion','question');bind('#propQuizRight','feedbackRight');bind('#propQuizWrong','feedbackWrong');
 const target=$('#propButtonTarget',root);if(target)target.onchange=ev=>{e.targetSlideId=ev.target.value;touch();renderCanvasLight()};
 const correct=$('#propQuizCorrect',root);if(correct)correct.onchange=ev=>{e.correct=Number(ev.target.value);touch();renderCanvasLight()};
 $$('[data-quiz-option]',root).forEach(n=>n.oninput=ev=>{e.options[Number(n.dataset.quizOption)]=ev.target.value;touch();renderCanvasLight()});
 if(e.type==='video'){
  e.checkpoints??=[];
  const support=ensureVideoSupport(e),sourceMode=$('#propVideoSourceMode',root);
  const choose=$('#propChooseVideo',root),file=$('#propVideoFile',root);
  if(choose&&file){choose.onclick=()=>file.click();file.onchange=async ev=>{const picked=ev.target.files?.[0];if(!picked)return;const assetId=uid('media');await putLearnMedia(assetId,picked);e.assetId=assetId;e.sourceMode='local';touch();render();toast('Vídeo local adicionado.');}};
  const recCamera=$('#propRecordCamera',root);if(recCamera)recCamera.onclick=()=>openLearningRecorder(e,'camera');
  const recScreen=$('#propRecordScreen',root);if(recScreen)recScreen.onclick=()=>openLearningRecorder(e,'screen');
  if(sourceMode)sourceMode.onchange=ev=>{e.sourceMode=ev.target.value;touch();render()};
  const embed=$('#propVideoEmbed',root);if(embed)embed.oninput=ev=>{e.embedCode=ev.target.value;e.embedSrc=extractIframeSrc(ev.target.value);touch();const detected=$('#propVideoEmbedSrc',root);if(detected)detected.value=e.embedSrc||'';renderCanvasLight()};
  const supportBinds=[
   ['#supportEnabled','enabled','checked'],['#supportPause','pauseOnOpen','checked'],['#supportQuestion','allowQuestion','checked'],['#supportSignals','allowSignals','checked'],['#supportComments','allowComments','checked'],['#supportMaterial','allowMaterial','checked'],
   ['#supportStart','start','number'],['#supportEnd','end','number'],['#supportMaterialLabel','materialLabel','value'],['#supportMaterialUrl','materialUrl','value']
  ];
  supportBinds.forEach(([sel,key,type])=>{const n=$(sel,root);if(!n)return;const apply=()=>{support[key]=type==='checked'?n.checked:type==='number'?Number(n.value||0):n.value;touch();renderCanvasLight()};n.oninput=apply;n.onchange=apply});
  const add=$('#propAddCheckpoint',root);
  if(add)add.onclick=()=>{e.checkpoints.push({id:uid('cp'),at:30,question:'Qual alternativa explica melhor o trecho que você acabou de assistir?',options:['Alternativa A','Alternativa B','Alternativa C','Alternativa D'],correct:0,feedbackRight:'Muito bem!',feedbackWrong:'Revise este trecho e tente novamente.',correctTargetSlideId:'',wrongTargetSlideId:''});touch();render()};
  $$('[data-cp-delete]',root).forEach(n=>n.onclick=()=>{e.checkpoints=e.checkpoints.filter(cp=>cp.id!==n.dataset.cpDelete);touch();render()});
  $$('[data-cp-field]',root).forEach(n=>{const apply=()=>{const cp=e.checkpoints.find(x=>x.id===n.dataset.cpId);if(!cp)return;const key=n.dataset.cpField;cp[key]=key==='at'||key==='correct'?Number(n.value):n.value;touch();renderCanvasLight()};n.oninput=apply;n.onchange=apply});
  $$('[data-cp-option]',root).forEach(n=>n.oninput=()=>{const cp=e.checkpoints.find(x=>x.id===n.dataset.cpId);if(!cp)return;cp.options[Number(n.dataset.cpOption)]=n.value;touch()});
 }
 if(e.type==='image'){
  bind('#propImageSrc','src');bind('#propImageAlt','alt');bind('#propImageCaption','caption');
  const choose=$('#propChooseImage',root),file=$('#propImageFile',root);if(choose&&file){choose.onclick=()=>file.click();file.onchange=async ev=>{const picked=ev.target.files?.[0];if(!picked)return;const assetId=uid('img');await putLearnMedia(assetId,picked);e.assetId=assetId;touch();render();toast('Imagem adicionada.')}};
 }
 if(e.type==='popup'){bind('#propPopupLabel','label');bind('#propPopupTitle','title');bind('#propPopupContent','content')}
 if(e.type==='tabs'){
  $$('[data-tab-title]',root).forEach(n=>n.oninput=()=>{e.items[Number(n.dataset.tabTitle)].title=n.value;touch();renderCanvasLight()});
  $$('[data-tab-content]',root).forEach(n=>n.oninput=()=>{e.items[Number(n.dataset.tabContent)].content=n.value;touch();renderCanvasLight()});
 }
 if(e.type==='hotspot'){
  bind('#propHotspotSrc','src');bind('#propHotspotAlt','alt');
  const choose=$('#propChooseHotspotImage',root),file=$('#propHotspotImageFile',root);if(choose&&file){choose.onclick=()=>file.click();file.onchange=async ev=>{const picked=ev.target.files?.[0];if(!picked)return;const assetId=uid('img');await putLearnMedia(assetId,picked);e.assetId=assetId;touch();render();toast('Cenário adicionado.')}};
  $('#propAddHotspot',root)?.addEventListener('click',()=>{e.hotspots.push({id:uid('hot'),x:50,y:50,label:'Explorar',action:'popup',content:'Conteúdo deste ponto.',targetSlideId:'',effect:'confetti',url:''});touch();render()});
  $$('[data-hot-delete]',root).forEach(n=>n.onclick=()=>{e.hotspots=e.hotspots.filter(h=>h.id!==n.dataset.hotDelete);touch();render()});
  $$('[data-hot-field]',root).forEach(n=>{const apply=()=>{const h=e.hotspots.find(x=>x.id===n.dataset.hotId);if(!h)return;h[n.dataset.hotField]=['x','y'].includes(n.dataset.hotField)?Number(n.value):n.value;touch();renderCanvasLight()};n.oninput=apply;n.onchange=apply});
 }
 if(e.type==='path'){bind('#propPathTitle','title');bind('#propPathSteps','stepsText')}
 if(e.type==='meeting'){bind('#propMeetingTitle','title');bind('#propMeetingUrl','url');bind('#propMeetingNote','note');const n=$('#propMeetingProvider',root);if(n)n.onchange=()=>{e.provider=n.value;touch();renderCanvasLight()}}
 if(e.type==='escape'){bind('#propEscapePrompt','prompt');bind('#propEscapeAnswer','answer');bind('#propEscapeHint','hint');bind('#propEscapeSuccess','success');const t=$('#propEscapeTarget',root);if(t)t.onchange=()=>{e.targetSlideId=t.value;touch()};const fx=$('#propEscapeEffect',root);if(fx)fx.onchange=()=>{e.effect=fx.value;touch()}}
 if(e.type==='bingo'){bind('#propBingoTitle','title');bind('#propBingoItems','itemsText');const g=$('#propBingoGrid',root);if(g)g.onchange=()=>{e.grid=Number(g.value);touch();renderCanvasLight()}}
 if(e.type==='raffle'){bind('#propRaffleTitle','title');bind('#propRaffleItems','itemsText')}
 if(e.type==='effect'){bind('#propEffectLabel','label');const fx=$('#propEffectType',root);if(fx)fx.onchange=()=>{e.effect=fx.value;touch();renderCanvasLight()}}
}
function renderCanvasLight(){
 const s=slide(),stage=$('.learn-slide-stage',root);if(!s||!stage)return;
 stage.innerHTML=s.elements.length?s.elements.map(e=>`<article class="learn-element ${e.id===selectedElementId?'selected':''}" data-learn-element="${e.id}">${elementMarkup(e,project())}<div class="element-tools"><button data-move="up">↑</button><button data-move="down">↓</button><button data-remove="${e.id}">×</button></div></article>`).join(''):empty('✨','Tela vazia','Use a biblioteca de blocos à direita para começar.');
 $$('[data-learn-element]',stage).forEach(card=>card.onclick=e=>{if(e.target.closest('.element-tools'))return;selectedElementId=card.dataset.learnElement;render()});
 $$('[data-remove]',stage).forEach(b=>b.onclick=e=>{e.stopPropagation();const s=slide();s.elements=s.elements.filter(x=>x.id!==b.dataset.remove);selectedElementId=null;touch();render()});
 $$('[data-move]',stage).forEach(b=>b.onclick=e=>{e.stopPropagation();const s=slide(),id=b.closest('[data-learn-element]').dataset.learnElement,i=s.elements.findIndex(x=>x.id===id),j=i+(b.dataset.move==='up'?-1:1);if(j<0||j>=s.elements.length)return;[s.elements[i],s.elements[j]]=[s.elements[j],s.elements[i]];touch();render()});
}
function previewMarkup(p){
 const start=p.slides[0];
 return `<div class="learn-preview-shell">
  <div class="learn-preview-toolbar">
   <div class="preview-tool-group"><b>Dispositivo</b><button data-preview-device="desktop" class="${previewDevice==='desktop'?'active':''}">💻 Computador</button><button data-preview-device="tablet" class="${previewDevice==='tablet'?'active':''}">📟 Tablet</button><button data-preview-device="mobile" class="${previewDevice==='mobile'?'active':''}">📱 Celular</button></div>
   <div class="preview-tool-group"><b>Leitura</b><button data-preview-mode="screen" class="${previewMode==='screen'?'active':''}">✨ Interativa</button><button data-preview-mode="book" class="${previewMode==='book'?'active':''}">📖 Livro</button><button data-preview-mode="magazine" class="${previewMode==='magazine'?'active':''}">📰 Revista</button><button data-preview-mode="reader" class="${previewMode==='reader'?'active':''}">🔤 Leitura limpa</button></div>
  </div>
  <div class="preview-device preview-${previewDevice}">
   <div class="learn-runtime mode-${previewMode} ${ensureA11y(p).highContrast?'a11y-high-contrast':''} ${ensureA11y(p).reduceMotion?'a11y-reduce-motion':''} ${ensureA11y(p).focusOutline!==false?'a11y-focus':''}" style="--a11y-scale:${ensureA11y(p).fontScale/100}" data-project="${p.id}" data-current="${start.id}" data-mode="${previewMode}">
    <header><small>Pré-visualização</small><h2>${esc(p.title)}</h2><p>${esc(p.context||'')}</p></header>
    <main id="learnRuntimeStage"></main>
    <footer><button class="soft" id="runtimePrev" type="button">← Voltar</button><span id="runtimeCounter"></span><button class="primary" id="runtimeNext" type="button">Avançar →</button></footer>
   </div>
  </div>
 </div>`;
}
function readingElementMarkup(e){
 if(e.type==='heading')return `<h2>${esc(e.text||'')}</h2>`;
 if(e.type==='text')return `<p>${esc(e.text||'').replace(/\n/g,'<br>')}</p>`;
 if(e.type==='video')return `<figure class="reading-media"><div class="reading-media-icon">🎬</div><figcaption>${esc(e.title||'Vídeo')}</figcaption></figure>`;
 if(e.type==='reflection')return `<aside class="reading-callout"><b>💭 Para refletir</b><p>${esc(e.prompt||'')}</p></aside>`;
 if(e.type==='quiz')return `<aside class="reading-callout"><b>❓ Para pensar</b><p>${esc(e.question||'')}</p></aside>`;
 if(e.type==='button')return '';
 return '';
}
function renderReadingRuntime(p,dialog,mode){
 const stage=$('#learnRuntimeStage',dialog),runtime=$('.learn-runtime',dialog),footer=$('footer',runtime),counter=$('#runtimeCounter',dialog);
 runtime.className='learn-runtime mode-'+mode;
 stage.innerHTML=`<div class="reading-experience reading-${mode}">${p.slides.map((s,i)=>`<article class="reading-page"><header><span>Capítulo ${i+1}</span><h1>${esc(s.title||'')}</h1></header><div class="reading-content">${s.elements.map(readingElementMarkup).join('')}</div></article>`).join('')}</div>`;
 footer.hidden=true;if(counter)counter.textContent='';hydrateLocalVideos(dialog).catch(()=>{});
}
function setupRuntimeVideos(p,s,dialog,runtime){
 $$('.runtime-video',dialog).forEach(wrap=>{
  const e=s.elements.find(x=>x.id===wrap.dataset.videoId),video=$('video',wrap),host=$('.runtime-checkpoint-host',wrap);
  if(!e||!video||!host)return;
  const checkpoints=[...(e.checkpoints||[])].sort((a,b)=>Number(a.at||0)-Number(b.at||0)),seen=new Set();
  function showCheckpoint(cp){
   video.pause();
   host.hidden=false;
   host.innerHTML=`<div class="runtime-video-question"><span class="runtime-time">⏱ ${Math.floor(Number(cp.at)||0)}s</span><b>${esc(cp.question||'Pergunta sobre o trecho')}</b><div class="runtime-video-options">${(cp.options||[]).map((o,i)=>`<label><input type="radio" name="video-${esc(cp.id)}" value="${i}"> ${esc(o)}</label>`).join('')}</div><button class="soft runtime-video-check" type="button">Responder</button><p class="runtime-feedback" role="status"></p><button class="primary runtime-video-continue" type="button" hidden>Continuar</button></div>`;
   const check=$('.runtime-video-check',host),out=$('.runtime-feedback',host),next=$('.runtime-video-continue',host);
   check.onclick=()=>{
    const picked=$('input[type="radio"]:checked',host);if(!picked){out.textContent='Escolha uma alternativa.';return;}
    const correct=Number(picked.value)===Number(cp.correct),target=correct?cp.correctTargetSlideId:cp.wrongTargetSlideId;
    out.textContent=correct?(cp.feedbackRight||'Muito bem!'):(cp.feedbackWrong||'Revise este trecho e tente novamente.');
    check.disabled=true;$$('input',host).forEach(n=>n.disabled=true);next.hidden=false;next.textContent=target?'Seguir para a tela indicada →':'Continuar vídeo ▶';
    next.onclick=()=>{if(target&&p.slides.some(x=>x.id===target)){runtime.dataset.current=target;renderRuntime(p,dialog);return;}host.hidden=true;video.play().catch(()=>{});};
   };
  }
  video.addEventListener('timeupdate',()=>{
   const cp=checkpoints.find(x=>!seen.has(x.id)&&video.currentTime+0.15>=Number(x.at||0));
   if(!cp)return;seen.add(cp.id);showCheckpoint(cp);
  });
 });
}
function runtimeSupportMarkup(e){
 const s=ensureVideoSupport(e);if(!s.enabled)return'';
 const actions=[];
 if(s.allowQuestion)actions.push('<button type="button" data-support-action="question">💬 Tirar dúvida neste ponto</button>');
 if(s.allowMaterial&&s.materialUrl)actions.push('<button type="button" data-support-action="material">🔎 '+esc(s.materialLabel||'Acessar material agora')+'</button>');
 if(s.allowComments)actions.push('<button type="button" data-support-action="comment">💭 Comentar neste trecho</button>');
 if(s.allowSignals){
  actions.push('<button type="button" data-support-signal="understood">😊 Entendi</button>');
  actions.push('<button type="button" data-support-signal="doubt">🤔 Tenho dúvida</button>');
  actions.push('<button type="button" data-support-signal="lost">🧭 Me perdi</button>');
  actions.push('<button type="button" data-support-signal="deepen">🚀 Quero aprofundar</button>');
 }
 if(!actions.length)return'';
 return `<div class="runtime-support" data-support-start="${Number(s.start)||0}" data-support-end="${Number(s.end)||0}"><div class="runtime-support-bar">${actions.join('')}</div><div class="runtime-support-drawer" hidden></div></div>`;
}
function supportTimestamp(wrap){
 const video=$('video',wrap);return video&&Number.isFinite(video.currentTime)?Math.round(video.currentTime*10)/10:null;
}
function supportPayload(p,s,e,wrap,kind,message=''){
 return{id:uid('support'),schema:'keise-learning/support-v1',projectId:p.id,projectTitle:p.title,context:p.context||'',slideId:s.id,slideTitle:s.title||'',videoId:e.id,videoTitle:e.title||'',timestamp:supportTimestamp(wrap),kind,message,privacy:ensureProjectSupport(p).defaultPrivacy||'private',createdAt:new Date().toISOString()};
}
function openRuntimeSupportDrawer(p,s,e,wrap,kind){
 const cfg=ensureVideoSupport(e),drawer=$('.runtime-support-drawer',wrap),video=$('video',wrap);
 if(!drawer)return;if(video&&cfg.pauseOnOpen)video.pause();drawer.hidden=false;
 if(kind==='material'){
  const url=cfg.materialUrl||'';
  drawer.innerHTML=`<div class="support-drawer-card"><div class="support-drawer-head"><b>🔎 ${esc(cfg.materialLabel||'Material de apoio')}</b><button type="button" data-support-close>×</button></div><iframe class="support-material-frame" src="${esc(url)}" title="${esc(cfg.materialLabel||'Material de apoio')}"></iframe><p class="support-fallback">Se o material não abrir aqui, <a href="${esc(url)}" target="_blank" rel="noopener">abrir em nova guia ↗</a>.</p></div>`;
 }else{
  const label=kind==='comment'?'💭 Comentário neste trecho':'💬 Dúvida no Ponto';
  const placeholder=kind==='comment'?'Compartilhe um comentário sobre este trecho...':'Escreva o que não ficou claro ou o que você quer aprofundar...';
  drawer.innerHTML=`<div class="support-drawer-card"><div class="support-drawer-head"><b>${label}</b><button type="button" data-support-close>×</button></div><div class="support-context"><span>📍 ${esc(s.title||'Tela')}</span><span>${supportTimestamp(wrap)!=null?'⏱ '+supportTimestamp(wrap)+'s':'⏱ ponto do vídeo incorporado'}</span></div><textarea class="support-message" placeholder="${placeholder}"></textarea><button class="primary support-send" type="button">Enviar</button><p class="support-send-status" role="status"></p></div>`;
  const send=$('.support-send',drawer);if(send)send.onclick=async()=>{const msg=$('.support-message',drawer).value.trim(),status=$('.support-send-status',drawer);if(!msg){status.textContent='Escreva uma mensagem antes de enviar.';return}send.disabled=true;status.textContent='Enviando...';const result=await sendSupportPayload(p,supportPayload(p,s,e,wrap,kind,msg));status.textContent=result.sent?'Enviado para a mediação.':'Rascunho salvo neste dispositivo. Configure um conector para envio entre dispositivos.';send.disabled=false};
 }
 $('[data-support-close]',drawer)?.addEventListener('click',()=>{drawer.hidden=true;drawer.innerHTML='';});
}
function setupRuntimeSupport(p,s,dialog){
 $('.runtime-video',dialog).forEach(wrap=>{
  const e=s.elements.find(x=>x.id===wrap.dataset.videoId);if(!e)return;
  const cfg=ensureVideoSupport(e),support=$('.runtime-support',wrap),video=$('video',wrap);if(!support)return;
  const updateVisibility=()=>{if(!video){support.hidden=false;return}const t=video.currentTime||0,start=Number(cfg.start)||0,end=Number(cfg.end)||0;support.hidden=t<start||(end>0&&t>end)};
  updateVisibility();if(video)video.addEventListener('timeupdate',updateVisibility);
  $('[data-support-action]',support).forEach(b=>b.onclick=()=>openRuntimeSupportDrawer(p,s,e,wrap,b.dataset.supportAction));
  $('[data-support-signal]',support).forEach(b=>b.onclick=async()=>{const result=await sendSupportPayload(p,supportPayload(p,s,e,wrap,'signal',b.dataset.supportSignal));b.classList.add('sent');const old=b.textContent;b.textContent=result.sent?'✓ Enviado':'✓ Registrado';setTimeout(()=>{b.textContent=old;b.classList.remove('sent')},1800)});
 });
}
function launchRuntimeEffect(type,host){
 const layer=document.createElement('div');layer.className='keise-effect-layer';(host||document.body).append(layer);
 const sets={confetti:['🎉','✨','🟣','🟡','🩷','🟢'],applause:['👏','👏','✨'],gift:['🎁','✨','💝'],stars:['⭐','🌟','✨'],balloons:['🎈','🎈','✨'],boo:['📣','🙃','💨']},items=sets[type]||sets.confetti;
 for(let i=0;i<34;i++){const s=document.createElement('span');s.textContent=items[i%items.length];s.style.left=(Math.random()*100)+'%';s.style.setProperty('--dx',((Math.random()-.5)*260)+'px');s.style.animationDelay=(Math.random()*.35)+'s';s.style.fontSize=(16+Math.random()*24)+'px';layer.append(s)}
 setTimeout(()=>layer.remove(),2600);
}
function runtimeImageSource(e){return e.assetId?`<img data-learn-local-asset="${esc(e.assetId)}" alt="${esc(e.alt||'')}">`:e.src?`<img src="${esc(e.src)}" alt="${esc(e.alt||'')}">`:'<div class="runtime-note">Imagem ainda não adicionada.</div>'}
function advancedRuntimeMarkup(e,p){
 if(e.type==='image')return `<figure class="runtime-image">${runtimeImageSource(e)}${e.caption?`<figcaption>${esc(e.caption)}</figcaption>`:''}</figure>`;
 if(e.type==='popup')return `<div class="runtime-popup"><button class="soft runtime-popup-open" type="button">🪟 ${esc(e.label||'Abrir')}</button><div class="runtime-popup-panel" hidden><div><b>${esc(e.title||'Saiba mais')}</b><button class="runtime-popup-close" type="button">×</button></div><p>${esc(e.content||'')}</p></div></div>`;
 if(e.type==='tabs')return `<div class="runtime-tabs"><div class="runtime-tab-buttons">${(e.items||[]).map((it,i)=>`<button type="button" data-tab-index="${i}" class="${i===0?'active':''}">${esc(it.title)}</button>`).join('')}</div><div class="runtime-tab-panel">${esc(e.items?.[0]?.content||'')}</div></div>`;
 if(e.type==='hotspot'){const image=runtimeImageSource(e);return `<div class="runtime-hotspot" data-hotspot-root="${esc(e.id)}"><div class="runtime-hotspot-image">${image}${(e.hotspots||[]).map((h,i)=>`<button type="button" class="runtime-hotspot-dot" style="left:${Number(h.x)||50}%;top:${Number(h.y)||50}%" data-hot-index="${i}" aria-label="${esc(h.label||'Explorar ponto')}"><span>✦</span></button>`).join('')}</div><div class="runtime-hotspot-panel" hidden></div></div>`;}
 if(e.type==='path')return `<div class="runtime-path"><h3>${esc(e.title||'Minha trilha')}</h3><div>${splitLines(e.stepsText).map((x,i)=>`<button type="button" data-path-step="${i}"><span>${i+1}</span><b>${esc(x)}</b><small>marcar etapa</small></button>`).join('')}</div></div>`;
 if(e.type==='meeting')return `<div class="runtime-meeting"><span>🔴</span><div><h3>${esc(e.title||'Encontro ao vivo')}</h3><p>${esc(e.note||'')}</p><button class="primary runtime-meeting-open" type="button" data-url="${esc(e.url||'')}">Abrir ${esc(e.provider||'reunião')} ↗</button><small>O encontro abre em outra janela para o Keise Studio continuar disponível ao lado.</small></div></div>`;
 if(e.type==='escape')return `<div class="runtime-escape" data-answer="${esc(String(e.answer||'').toLowerCase())}" data-target="${esc(e.targetSlideId||'')}" data-effect="${esc(e.effect||'confetti')}"><div class="escape-lock">🔐</div><h3>${esc(e.prompt||'Resolva o desafio.')}</h3><input class="escape-answer" placeholder="Digite sua resposta"><div class="escape-actions"><button class="soft escape-hint" type="button">💡 Dica</button><button class="primary escape-check" type="button">Desbloquear</button></div><p class="escape-feedback"></p><p class="escape-hint-text" hidden>${esc(e.hint||'')}</p><button class="primary escape-continue" type="button" hidden>${e.targetSlideId?'Ir para próxima cena →':'Continuar'}</button></div>`;
 if(e.type==='bingo'){const items=splitLines(e.itemsText),count=Math.min(items.length,Number(e.grid||3)**2);return `<div class="runtime-bingo" data-grid="${Number(e.grid)||3}"><h3>🎯 ${esc(e.title||'Bingo')}</h3><div class="bingo-grid" style="--grid:${Number(e.grid)||3}">${items.slice(0,count).map((x,i)=>`<button type="button" data-bingo-cell="${i}">${esc(x)}</button>`).join('')}</div><div class="bingo-actions"><button class="soft bingo-draw" type="button">🎲 Sortear um item</button><button class="soft bingo-reset" type="button">↺ Limpar</button></div><p class="bingo-result"></p></div>`;}
 if(e.type==='raffle')return `<div class="runtime-raffle" data-items="${esc(JSON.stringify(splitLines(e.itemsText)))}"><span>🎲</span><h3>${esc(e.title||'Sorteio')}</h3><div class="raffle-result">Pronto para sortear</div><button class="primary raffle-run" type="button">Sortear</button></div>`;
 if(e.type==='effect')return `<button class="runtime-effect-button" type="button" data-effect="${esc(e.effect||'confetti')}">✨ ${esc(e.label||'Comemorar')}</button>`;
 return '';
}
function wireAdvancedRuntime(p,s,dialog,runtime){
 $('.runtime-popup',dialog).forEach(box=>{const panel=$('.runtime-popup-panel',box);$('.runtime-popup-open',box).onclick=()=>panel.hidden=false;$('.runtime-popup-close',box).onclick=()=>panel.hidden=true});
 $('.runtime-tabs',dialog).forEach(box=>{const e=s.elements.find(x=>x.type==='tabs'&&(x.items||[]).some(it=>box.textContent.includes(it.title)))||null;const buttons=$('[data-tab-index]',box),panel=$('.runtime-tab-panel',box);buttons.forEach(b=>b.onclick=()=>{buttons.forEach(x=>x.classList.remove('active'));b.classList.add('active');const idx=Number(b.dataset.tabIndex);if(e)panel.textContent=e.items?.[idx]?.content||''})});
 $('.runtime-hotspot',dialog).forEach(box=>{const e=s.elements.find(x=>x.id===box.dataset.hotspotRoot),panel=$('.runtime-hotspot-panel',box);if(!e)return;$('[data-hot-index]',box).forEach(b=>b.onclick=()=>{const h=e.hotspots?.[Number(b.dataset.hotIndex)];if(!h)return;if(h.action==='scene'&&h.targetSlideId){runtime.dataset.current=h.targetSlideId;renderRuntime(p,dialog);return}if(h.action==='effect'){launchRuntimeEffect(h.effect||'confetti',dialog);return}if(h.action==='link'&&h.url){window.open(h.url,'_blank','noopener');return}panel.hidden=false;panel.innerHTML=`<div><b>${esc(h.label||'Explorar')}</b><button type="button">×</button></div><p>${esc(h.content||'')}</p>`;panel.querySelector('button').onclick=()=>panel.hidden=true})});
 $('.runtime-path [data-path-step]',dialog).forEach(b=>b.onclick=()=>b.classList.toggle('done'));
 $('.runtime-meeting-open',dialog).forEach(b=>b.onclick=()=>{if(!b.dataset.url){alert('Adicione o link da reunião no editor.');return}window.open(b.dataset.url,'keise-meeting','popup=yes,width=1100,height=760')});
 $('.runtime-escape',dialog).forEach(box=>{const input=$('.escape-answer',box),feedback=$('.escape-feedback',box),cont=$('.escape-continue',box);$('.escape-hint',box).onclick=()=>$('.escape-hint-text',box).hidden=false;$('.escape-check',box).onclick=()=>{const ok=input.value.trim().toLowerCase()===box.dataset.answer.trim().toLowerCase();feedback.textContent=ok?'✅ '+(s.elements.find(x=>x.type==='escape'&&String(x.answer||'').toLowerCase()===box.dataset.answer)?.success||'Você conseguiu!'):'Ainda não. Observe a pista e tente novamente.';if(ok){launchRuntimeEffect(box.dataset.effect||'confetti',dialog);cont.hidden=false}};cont.onclick=()=>{if(box.dataset.target){runtime.dataset.current=box.dataset.target;renderRuntime(p,dialog)}}});
 $('.runtime-bingo',dialog).forEach(box=>{const cells=$('[data-bingo-cell]',box),result=$('.bingo-result',box);cells.forEach(b=>b.onclick=()=>b.classList.toggle('marked'));$('.bingo-draw',box).onclick=()=>{const available=cells.filter(x=>!x.classList.contains('marked'));if(!available.length){result.textContent='Todos os itens já foram marcados.';return}const pick=available[Math.floor(Math.random()*available.length)];pick.classList.add('marked');result.textContent='Saiu: '+pick.textContent;launchRuntimeEffect('stars',dialog)};$('.bingo-reset',box).onclick=()=>{cells.forEach(x=>x.classList.remove('marked'));result.textContent=''}});
 $('.runtime-raffle',dialog).forEach(box=>{$('.raffle-run',box).onclick=()=>{let items=[];try{items=JSON.parse(box.dataset.items||'[]')}catch{};if(!items.length)return;const pick=items[Math.floor(Math.random()*items.length)];$('.raffle-result',box).textContent=pick;launchRuntimeEffect('confetti',dialog)}});
 $('.runtime-effect-button',dialog).forEach(b=>b.onclick=()=>launchRuntimeEffect(b.dataset.effect||'confetti',dialog));
}function renderRuntime(p,dialog){
 const runtime=$('.learn-runtime',dialog),stage=$('#learnRuntimeStage',dialog),mode=runtime?.dataset.mode||'screen';
 if(mode!=='screen'){renderReadingRuntime(p,dialog,mode);return}
 runtime.className='learn-runtime mode-screen';const footer=$('footer',runtime);if(footer)footer.hidden=false;
 const id=runtime.dataset.current,s=p.slides.find(x=>x.id===id)||p.slides[0],index=p.slides.findIndex(x=>x.id===s.id);
 stage.innerHTML=`<h3>${esc(s.title)}</h3>`+s.elements.map(e=>{
  if(e.type==='heading')return `<h2>${esc(e.text)}</h2>`;
  if(e.type==='text')return `<p>${esc(e.text).replace(/\n/g,'<br>')}</p>`;
  if(e.type==='video'){const source=e.sourceMode==='embed'&&e.embedSrc?`<iframe class="runtime-video-embed" src="${esc(e.embedSrc)}" title="${esc(e.title||'Vídeo incorporado')}" allowfullscreen loading="lazy"></iframe>`:e.sourceMode==='local'&&e.assetId?`<video controls preload="metadata" data-learn-local-asset="${esc(e.assetId)}"></video>`:e.src?`<video controls preload="metadata" src="${esc(e.src)}"></video>`:'<div class="runtime-note">Vídeo ainda sem origem.</div>';return `<div class="runtime-video" data-video-id="${esc(e.id)}"><b>${esc(e.title||'Vídeo')}</b>${source}<div class="runtime-checkpoint-host" hidden></div>${runtimeSupportMarkup(e)}</div>`;}
  if(e.type==='reflection')return `<div class="runtime-reflection"><b>${esc(e.prompt)}</b><textarea placeholder="${esc(e.placeholder||'Escreva sua reflexão...')}"></textarea></div>`;
  if(e.type==='quiz')return `<form class="runtime-quiz" data-correct="${Number(e.correct)||0}" data-right="${esc(e.feedbackRight||'Muito bem!')}" data-wrong="${esc(e.feedbackWrong||'Tente novamente.')}"><b>${esc(e.question)}</b>${(e.options||[]).map((o,i)=>`<label><input type="radio" name="q-${esc(e.id)}" value="${i}"> ${esc(o)}</label>`).join('')}<button class="soft runtime-check" type="button">Verificar resposta</button><p class="runtime-feedback" role="status"></p></form>`;
  if(e.type==='button')return `<button class="primary runtime-jump" data-target="${esc(e.targetSlideId||'')}">${esc(e.label||'Continuar')}</button>`;
  return advancedRuntimeMarkup(e,p);

 }).join('');
 $('#runtimeCounter',dialog).textContent=(index+1)+' / '+p.slides.length;
 $('#runtimePrev',dialog).disabled=index<=0;$('#runtimeNext',dialog).disabled=index>=p.slides.length-1;
 $('#runtimePrev',dialog).onclick=()=>{runtime.dataset.current=p.slides[index-1].id;renderRuntime(p,dialog)};
 $('#runtimeNext',dialog).onclick=()=>{runtime.dataset.current=p.slides[index+1].id;renderRuntime(p,dialog)};
 $$('.runtime-check',dialog).forEach(b=>b.onclick=()=>{const f=b.closest('.runtime-quiz'),picked=f.querySelector('input[type="radio"]:checked'),out=f.querySelector('.runtime-feedback');if(!picked){out.textContent='Escolha uma alternativa.';return}out.textContent=Number(picked.value)===Number(f.dataset.correct)?f.dataset.right:f.dataset.wrong});
 $$('.runtime-jump',dialog).forEach(b=>b.onclick=()=>{if(!b.dataset.target)return;runtime.dataset.current=b.dataset.target;renderRuntime(p,dialog)});
 setupRuntimeVideos(p,s,dialog,runtime);
 setupRuntimeSupport(p,s,dialog);
 wireAdvancedRuntime(p,s,dialog,runtime);
 hydrateLocalVideos(dialog).catch(()=>{});
}
function previewProject(id){
 const p=state.projects.find(x=>x.id===id);if(!p)return;const dlg=$('#learnPreviewDialog',root);if(!dlg){alert('Abra o recurso para visualizar.');return}
 $('#learnPreviewBody',dlg).innerHTML=previewMarkup(p);dlg.showModal();renderRuntime(p,dlg);
 $$('[data-preview-device]',dlg).forEach(b=>b.onclick=()=>{previewDevice=b.dataset.previewDevice;const frame=$('.preview-device',dlg);frame.className='preview-device preview-'+previewDevice;$$('[data-preview-device]',dlg).forEach(x=>x.classList.toggle('active',x.dataset.previewDevice===previewDevice))});
 $$('[data-preview-mode]',dlg).forEach(b=>b.onclick=()=>{previewMode=b.dataset.previewMode;const runtime=$('.learn-runtime',dlg);runtime.dataset.mode=previewMode;$$('[data-preview-mode]',dlg).forEach(x=>x.classList.toggle('active',x.dataset.previewMode===previewMode));renderRuntime(p,dlg)});
}
function exportedHtml(p){
 const data=JSON.stringify(p).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title><style>
 :root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#26325b;background:#f7f7fc}*{box-sizing:border-box}body{margin:0}.app{max-width:980px;margin:auto;padding:24px}.card{background:#fff;border:1px solid #e7e7f0;border-radius:22px;padding:24px;box-shadow:0 18px 50px #545b8912}.top small{color:#7e86a4}.top h1{margin:4px 0}.top p{color:#6d7697}.screen{min-height:420px;margin-top:18px}.screen>h2:first-child{font-size:13px;text-transform:uppercase;color:#8b91aa}.screen h2{font-size:28px}.screen p{line-height:1.65}.video-wrap{margin:18px 0}.video-wrap>b{display:block;margin-bottom:8px}.video-wrap video,.video-wrap iframe{width:100%;border:0;border-radius:15px;background:#111}.video-wrap video{max-height:520px}.video-wrap iframe{aspect-ratio:16/9;min-height:360px}.checkpoint-host{margin-top:10px}.checkpoint-card,.quiz,.reflection{background:#f8f6ff;border:1px solid #ece7f8;border-radius:16px;padding:16px;margin:12px 0}.checkpoint-card label,.quiz label{display:block;padding:6px}.checkpoint-card .time{font-size:12px;color:#725ba3;font-weight:800}.feedback{font-weight:750}.reflection textarea,.support-card textarea{width:100%;min-height:100px;border:1px solid #dcddea;border-radius:11px;padding:10px;margin-top:9px;font:inherit}.jump,.nav button,.quiz button,.checkpoint-card button,.support-bar button,.support-card button{border:0;border-radius:11px;padding:10px 13px;font-weight:750;cursor:pointer}.jump,.primary{background:#7788ef!important;color:#fff!important}.nav{display:flex;justify-content:space-between;align-items:center;margin-top:20px}.nav button{background:#ece9ff;color:#51448a}.nav button:disabled{opacity:.4}.support-wrap{margin-top:10px}.support-bar{display:flex;flex-wrap:wrap;gap:6px;background:linear-gradient(135deg,#fff6fb,#f5f2ff);border:1px solid #ece2f1;border-radius:14px;padding:8px}.support-bar button{background:#fff;color:#55618a;border:1px solid #ebe8f2;font-size:12px}.support-bar button:hover{background:#f7f3ff}.support-bar button.sent{background:#e5f7ef;color:#31765f}.support-drawer{margin-top:8px}.support-card{background:#fff;border:1px solid #e7e3ef;border-radius:15px;padding:14px;box-shadow:0 12px 35px #50547b12}.support-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.support-head button{background:#f2f0f6;color:#69708b;padding:6px 9px}.support-context{display:flex;gap:8px;flex-wrap:wrap;color:#7f86a2;font-size:12px;margin:8px 0}.support-status{font-size:12px;font-weight:700;color:#66718e}.material-frame{width:100%;height:430px;border:1px solid #e1dfeb;border-radius:12px;margin-top:10px}.fallback{font-size:12px;color:#78809a}.fallback a{color:#596fd1}.runtime-note{background:#fff2ce;border-radius:11px;padding:12px}.screen-embed-note{font-size:11px;color:#858ca4}.signal-note{font-size:11px;color:#7a8099}
 .runtime-image img{width:100%;max-height:520px;object-fit:contain;border-radius:14px}.runtime-image figcaption{text-align:center;color:#7d849c;font-size:12px}.popup-panel,.hot-panel{background:#fff;border:1px solid #e2deeb;border-radius:14px;padding:14px;margin-top:8px;box-shadow:0 10px 30px #4d547818}.popup-panel>div,.hot-panel>div{display:flex;justify-content:space-between}.popup-panel button,.hot-panel button{border:0;background:#f1eff6;border-radius:8px}.tabs{border:1px solid #e7e3ef;border-radius:14px;overflow:hidden;margin:14px 0}.tab-head{display:flex;gap:5px;background:#f6f3fb;padding:7px}.tab-head button{border:0;background:transparent;border-radius:9px;padding:8px 10px;font-weight:750}.tab-head button.active{background:#fff;color:#5e4d93}.tab-panel{padding:14px}.hotspot{position:relative;margin:14px 0}.hot-image{position:relative;border-radius:15px;overflow:hidden;background:#181b24}.hot-image img{width:100%;display:block}.hot-dot{position:absolute;transform:translate(-50%,-50%);width:42px;height:42px;border:0;border-radius:50%;background:#fff;color:#765bbb;box-shadow:0 0 0 7px #fff4,0 0 28px #b889ff;animation:hotPulse 1.8s infinite}.path>div{display:grid;gap:8px}.path button{display:grid;grid-template-columns:34px 1fr;align-items:center;gap:9px;border:1px solid #e7e4ef;background:#fff;border-radius:12px;padding:9px;text-align:left}.path button span{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#eee9ff}.path button.done{background:#e5f7ef}.meeting{display:grid;grid-template-columns:42px 1fr;gap:10px;background:#fff6f8;border:1px solid #ece4ec;border-radius:15px;padding:15px}.meeting>span{font-size:32px}.meeting small{display:block;color:#7f87a1;margin-top:6px}.escape{background:#171c28;color:#f4f6ff;border-radius:17px;padding:20px;text-align:center}.escape input{width:min(420px,100%);padding:10px;border-radius:10px;border:1px solid #384259;background:#222a3a;color:#fff}.escape-actions,.bingo-actions{display:flex;gap:7px;justify-content:center;margin-top:8px;flex-wrap:wrap}.bingo{border:1px solid #e7e4ef;border-radius:16px;padding:15px}.bingo-grid{display:grid;grid-template-columns:repeat(var(--grid),1fr);gap:5px;margin:10px 0}.bingo-grid button{min-height:65px;border:1px solid #e3def1;background:#f8f5ff;border-radius:9px}.bingo-grid button.marked{background:#8374d6;color:#fff}.raffle{text-align:center;background:linear-gradient(135deg,#fff8e7,#f6efff);border-radius:16px;padding:18px}.raffle-result{font-size:22px;font-weight:900;margin:12px}.effect-btn{border:0;border-radius:14px;padding:12px 18px;background:linear-gradient(135deg,#ff8fb9,#8578df);color:#fff;font-weight:900}.fx-layer{position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden}.fx-layer span{position:absolute;top:-50px;animation:fall 2.2s forwards}@keyframes hotPulse{50%{transform:translate(-50%,-50%) scale(1.12)}}@keyframes fall{to{top:110vh;transform:translateX(var(--dx)) rotate(720deg);opacity:.2}}  @media(max-width:650px){.app{padding:10px}.card{padding:15px}.video-wrap iframe{min-height:230px}.material-frame{height:320px}.support-bar button{flex:1 1 46%}}
 </style></head><body><div class="app"><div class="card"><header class="top"><small>Experiência criada no Keise Learning</small><h1 id="title"></h1><p id="context"></p></header><main class="screen" id="screen"></main><footer class="nav"><button id="prev">← Voltar</button><span id="count"></span><button id="next">Avançar →</button></footer></div></div><script>
 const P=${data};let current=P.slides[0]?.id||'';const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const supportCfg=e=>e.support||{enabled:false};const projectSupport=()=>P.support||{endpoint:'',defaultPrivacy:'private'};
 function draftKey(){return'keise-learning-support-drafts:'+P.id}
 function saveDraft(payload){let list=[];try{list=JSON.parse(localStorage.getItem(draftKey())||'[]')}catch{}list.push(payload);localStorage.setItem(draftKey(),JSON.stringify(list.slice(-500)))}
 async function sendPayload(payload){const endpoint=projectSupport().endpoint||'';if(endpoint){try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error('HTTP '+r.status);return{sent:true}}catch(e){saveDraft(payload);return{sent:false,error:e.message}}}saveDraft(payload);return{sent:false}}
 function sourceMarkup(e){if(e.sourceMode==='embed'&&e.embedSrc)return'<iframe src="'+esc(e.embedSrc)+'" title="'+esc(e.title||'Vídeo incorporado')+'" loading="lazy" allowfullscreen></iframe><p class="screen-embed-note">Em vídeos incorporados, o segundo exato pode depender da plataforma de origem.</p>';if(e.sourceMode==='local'&&e.assetId)return'<div class="runtime-note">Este vídeo estava salvo apenas no navegador de quem criou. Use uma URL/incorporação ou o futuro recurso “Empacotar projeto” para publicar a mídia junto.</div>';if(e.src)return'<video controls preload="metadata" src="'+esc(e.src)+'"></video>';return'<div class="runtime-note">Vídeo ainda sem origem.</div>'}
 function supportMarkup(e){const s=supportCfg(e);if(!s.enabled)return'';const a=[];if(s.allowQuestion)a.push('<button type="button" data-support-action="question">💬 Tirar dúvida neste ponto</button>');if(s.allowMaterial&&s.materialUrl)a.push('<button type="button" data-support-action="material">🔎 '+esc(s.materialLabel||'Acessar material agora')+'</button>');if(s.allowComments)a.push('<button type="button" data-support-action="comment">💭 Comentar neste trecho</button>');if(s.allowSignals){a.push('<button type="button" data-support-signal="understood">😊 Entendi</button>','<button type="button" data-support-signal="doubt">🤔 Tenho dúvida</button>','<button type="button" data-support-signal="lost">🧭 Me perdi</button>','<button type="button" data-support-signal="deepen">🚀 Quero aprofundar</button>')}if(!a.length)return'';return'<div class="support-wrap" data-start="'+(Number(s.start)||0)+'" data-end="'+(Number(s.end)||0)+'"><div class="support-bar">'+a.join('')+'</div><div class="support-drawer" hidden></div></div>'}
 function videoMarkup(e){return'<div class="video-wrap" data-video-id="'+esc(e.id)+'"><b>'+esc(e.title||'Vídeo')+'</b>'+sourceMarkup(e)+'<div class="checkpoint-host" hidden></div>'+supportMarkup(e)+'</div>'}
 function lines(v){return String(v||'').split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean)}
 function fx(type){const layer=document.createElement('div');layer.className='fx-layer';document.body.append(layer);const sets={confetti:['🎉','✨','🟣','🟡','🩷'],applause:['👏','✨'],gift:['🎁','💝','✨'],stars:['⭐','🌟','✨'],balloons:['🎈','✨'],boo:['📣','🙃','💨']},a=sets[type]||sets.confetti;for(let i=0;i<34;i++){const s=document.createElement('span');s.textContent=a[i%a.length];s.style.left=(Math.random()*100)+'%';s.style.setProperty('--dx',((Math.random()-.5)*260)+'px');s.style.animationDelay=(Math.random()*.35)+'s';s.style.fontSize=(16+Math.random()*24)+'px';layer.append(s)}setTimeout(()=>layer.remove(),2600)}
 function imgMarkup(e){if(e.assetId&&!e.src)return'<div class="runtime-note">Imagem local não foi empacotada neste HTML.</div>';return e.src?'<img src="'+esc(e.src)+'" alt="'+esc(e.alt||'')+'">':'<div class="runtime-note">Imagem ainda não adicionada.</div>'}
 function advElem(e){
  if(e.type==='image')return'<figure class="runtime-image">'+imgMarkup(e)+(e.caption?'<figcaption>'+esc(e.caption)+'</figcaption>':'')+'</figure>';
  if(e.type==='popup')return'<div class="popup" data-el-id="'+esc(e.id)+'"><button type="button" class="popup-open">🪟 '+esc(e.label||'Abrir')+'</button><div class="popup-panel" hidden><div><b>'+esc(e.title||'Saiba mais')+'</b><button type="button" class="popup-close">×</button></div><p>'+esc(e.content||'')+'</p></div></div>';
  if(e.type==='tabs')return'<div class="tabs" data-el-id="'+esc(e.id)+'"><div class="tab-head">'+((e.items||[]).map((it,i)=>'<button type="button" data-tab="'+i+'" class="'+(i===0?'active':'')+'">'+esc(it.title)+'</button>').join(''))+'</div><div class="tab-panel">'+esc(e.items?.[0]?.content||'')+'</div></div>';
  if(e.type==='hotspot')return'<div class="hotspot" data-el-id="'+esc(e.id)+'"><div class="hot-image">'+imgMarkup(e)+((e.hotspots||[]).map((h,i)=>'<button type="button" class="hot-dot" data-hot="'+i+'" style="left:'+(Number(h.x)||50)+'%;top:'+(Number(h.y)||50)+'%" aria-label="'+esc(h.label||'Explorar')+'">✦</button>').join(''))+'</div><div class="hot-panel" hidden></div></div>';
  if(e.type==='path')return'<div class="path"><h3>'+esc(e.title||'Minha trilha')+'</h3><div>'+lines(e.stepsText).map((x,i)=>'<button type="button"><span>'+(i+1)+'</span><b>'+esc(x)+'</b></button>').join('')+'</div></div>';
  if(e.type==='meeting')return'<div class="meeting"><span>🔴</span><div><h3>'+esc(e.title||'Encontro ao vivo')+'</h3><p>'+esc(e.note||'')+'</p><button type="button" class="meeting-open primary" data-url="'+esc(e.url||'')+'">Abrir '+esc(e.provider||'reunião')+' ↗</button><small>Abre em outra janela para esta experiência continuar disponível.</small></div></div>';
  if(e.type==='escape')return'<div class="escape" data-answer="'+esc(String(e.answer||'').toLowerCase())+'" data-target="'+esc(e.targetSlideId||'')+'" data-effect="'+esc(e.effect||'confetti')+'"><div style="font-size:42px">🔐</div><h3>'+esc(e.prompt||'Resolva o desafio.')+'</h3><input class="escape-answer" placeholder="Digite sua resposta"><div class="escape-actions"><button type="button" class="escape-hint">💡 Dica</button><button type="button" class="escape-check primary">Desbloquear</button></div><p class="escape-feedback"></p><p class="escape-hint-text" hidden>'+esc(e.hint||'')+'</p><button type="button" class="escape-continue primary" hidden>Continuar →</button></div>';
  if(e.type==='bingo'){const items=lines(e.itemsText),g=Number(e.grid)||3;return'<div class="bingo"><h3>🎯 '+esc(e.title||'Bingo')+'</h3><div class="bingo-grid" style="--grid:'+g+'">'+items.slice(0,g*g).map((x,i)=>'<button type="button" data-cell="'+i+'">'+esc(x)+'</button>').join('')+'</div><div class="bingo-actions"><button type="button" class="bingo-draw">🎲 Sortear</button><button type="button" class="bingo-reset">↺ Limpar</button></div><p class="bingo-result"></p></div>'}
  if(e.type==='raffle')return'<div class="raffle" data-items="'+esc(JSON.stringify(lines(e.itemsText)))+'"><div style="font-size:38px">🎲</div><h3>'+esc(e.title||'Sorteio')+'</h3><div class="raffle-result">Pronto para sortear</div><button type="button" class="raffle-run primary">Sortear</button></div>';
  if(e.type==='effect')return'<button type="button" class="effect-btn" data-effect="'+esc(e.effect||'confetti')+'">✨ '+esc(e.label||'Comemorar')+'</button>';
  return''
 }
 function elem(e){if(e.type==='heading')return'<h2>'+esc(e.text||'')+'</h2>';if(e.type==='text')return'<p>'+esc(e.text||'').replace(/\\n/g,'<br>')+'</p>';if(e.type==='video')return videoMarkup(e);if(e.type==='reflection')return'<div class="reflection"><b>'+esc(e.prompt||'')+'</b><textarea placeholder="'+esc(e.placeholder||'Escreva...')+'"></textarea></div>';if(e.type==='quiz')return'<div class="quiz" data-correct="'+Number(e.correct||0)+'" data-right="'+esc(e.feedbackRight||'Muito bem!')+'" data-wrong="'+esc(e.feedbackWrong||'Tente novamente.')+'"><b>'+esc(e.question||'')+'</b>'+((e.options||[]).map((o,n)=>'<label><input type="radio" name="q-'+esc(e.id)+'" value="'+n+'"> '+esc(o)+'</label>').join(''))+'<button type="button" class="check">Verificar</button><p class="feedback"></p></div>';if(e.type==='button')return'<button class="jump primary" data-target="'+esc(e.targetSlideId||'')+'">'+esc(e.label||'Continuar')+'</button>';return advElem(e)}
 function timestamp(w){const v=q('video',w);return v&&Number.isFinite(v.currentTime)?Math.round(v.currentTime*10)/10:null}
 function payload(s,e,w,kind,message){return{id:'support-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),schema:'keise-learning/support-v1',projectId:P.id,projectTitle:P.title,context:P.context||'',slideId:s.id,slideTitle:s.title||'',videoId:e.id,videoTitle:e.title||'',timestamp:timestamp(w),kind,message,privacy:projectSupport().defaultPrivacy||'private',createdAt:new Date().toISOString()}}
 function closeDrawer(d){d.hidden=true;d.innerHTML=''}
 function openDrawer(s,e,w,kind){const cfg=supportCfg(e),d=q('.support-drawer',w),v=q('video',w);if(!d)return;if(v&&cfg.pauseOnOpen)v.pause();d.hidden=false;if(kind==='material'){const u=cfg.materialUrl||'';d.innerHTML='<div class="support-card"><div class="support-head"><b>🔎 '+esc(cfg.materialLabel||'Material de apoio')+'</b><button type="button" class="support-close">×</button></div><iframe class="material-frame" src="'+esc(u)+'" title="'+esc(cfg.materialLabel||'Material de apoio')+'"></iframe><p class="fallback">Se o material não abrir aqui, <a href="'+esc(u)+'" target="_blank" rel="noopener">abrir em nova guia ↗</a>.</p></div>'}else{const label=kind==='comment'?'💭 Comentário neste trecho':'💬 Dúvida no Ponto',ph=kind==='comment'?'Compartilhe um comentário sobre este trecho...':'Escreva o que não ficou claro ou o que você quer aprofundar...';d.innerHTML='<div class="support-card"><div class="support-head"><b>'+label+'</b><button type="button" class="support-close">×</button></div><div class="support-context"><span>📍 '+esc(s.title||'Tela')+'</span><span>'+(timestamp(w)!=null?'⏱ '+timestamp(w)+'s':'⏱ vídeo incorporado')+'</span></div><textarea class="support-message" placeholder="'+ph+'"></textarea><button class="support-send primary" type="button">Enviar</button><p class="support-status" role="status"></p></div>';q('.support-send',d).onclick=async()=>{const msg=q('.support-message',d).value.trim(),status=q('.support-status',d);if(!msg){status.textContent='Escreva uma mensagem antes de enviar.';return}status.textContent='Enviando...';const result=await sendPayload(payload(s,e,w,kind,msg));status.textContent=result.sent?'Enviado para a mediação.':'Rascunho salvo neste dispositivo. O envio entre dispositivos precisa de um conector.'}}q('.support-close',d)?.addEventListener('click',()=>closeDrawer(d))}
 function wireSupport(s){qa('.video-wrap').forEach(w=>{const e=s.elements.find(x=>x.id===w.dataset.videoId);if(!e)return;const cfg=supportCfg(e),sup=q('.support-wrap',w),v=q('video',w);if(!sup)return;const vis=()=>{if(!v){sup.hidden=false;return}const t=v.currentTime||0,st=Number(cfg.start)||0,en=Number(cfg.end)||0;sup.hidden=t<st||(en>0&&t>en)};vis();if(v)v.addEventListener('timeupdate',vis);qa('[data-support-action]',sup).forEach(b=>b.onclick=()=>openDrawer(s,e,w,b.dataset.supportAction));qa('[data-support-signal]',sup).forEach(b=>b.onclick=async()=>{const result=await sendPayload(payload(s,e,w,'signal',b.dataset.supportSignal));const old=b.textContent;b.textContent=result.sent?'✓ Enviado':'✓ Registrado';b.classList.add('sent');setTimeout(()=>{b.textContent=old;b.classList.remove('sent')},1700)})})}
 function wireVideos(s){qa('.video-wrap').forEach(w=>{const e=s.elements.find(x=>x.id===w.dataset.videoId),v=q('video',w),host=q('.checkpoint-host',w);if(!e||!v||!host)return;const cps=[...(e.checkpoints||[])].sort((a,b)=>Number(a.at||0)-Number(b.at||0)),seen=new Set();function ask(cp){v.pause();host.hidden=false;host.innerHTML='<div class="checkpoint-card"><span class="time">⏱ '+Math.floor(Number(cp.at)||0)+'s</span><b>'+esc(cp.question||'Pergunta sobre o trecho')+'</b>'+((cp.options||[]).map((o,n)=>'<label><input type="radio" name="v-'+esc(cp.id)+'" value="'+n+'"> '+esc(o)+'</label>').join(''))+'<button type="button" class="vcheck">Responder</button><p class="feedback"></p><button type="button" class="vcontinue primary" hidden>Continuar</button></div>';const check=q('.vcheck',host),out=q('.feedback',host),next=q('.vcontinue',host);check.onclick=()=>{const picked=q('input:checked',host);if(!picked){out.textContent='Escolha uma alternativa.';return}const ok=Number(picked.value)===Number(cp.correct),target=ok?cp.correctTargetSlideId:cp.wrongTargetSlideId;out.textContent=ok?(cp.feedbackRight||'Muito bem!'):(cp.feedbackWrong||'Revise este trecho e tente novamente.');check.disabled=true;qa('input',host).forEach(n=>n.disabled=true);next.hidden=false;next.textContent=target?'Seguir para a tela indicada →':'Continuar vídeo ▶';next.onclick=()=>{if(target&&P.slides.some(x=>x.id===target)){current=target;render();return}host.hidden=true;v.play().catch(()=>{})}}}v.addEventListener('timeupdate',()=>{const cp=cps.find(x=>!seen.has(x.id)&&v.currentTime+.15>=Number(x.at||0));if(cp){seen.add(cp.id);ask(cp)}})})}
 function wireAdv(s){
  qa('.popup').forEach(b=>{q('.popup-open',b).onclick=()=>q('.popup-panel',b).hidden=false;q('.popup-close',b).onclick=()=>q('.popup-panel',b).hidden=true});
  qa('.tabs').forEach(b=>{const e=s.elements.find(x=>x.id===b.dataset.elId),panel=q('.tab-panel',b);qa('[data-tab]',b).forEach(btn=>btn.onclick=()=>{qa('[data-tab]',b).forEach(x=>x.classList.remove('active'));btn.classList.add('active');panel.textContent=e?.items?.[Number(btn.dataset.tab)]?.content||''})});
  qa('.hotspot').forEach(b=>{const e=s.elements.find(x=>x.id===b.dataset.elId),panel=q('.hot-panel',b);qa('[data-hot]',b).forEach(btn=>btn.onclick=()=>{const h=e?.hotspots?.[Number(btn.dataset.hot)];if(!h)return;if(h.action==='scene'&&h.targetSlideId){current=h.targetSlideId;render();return}if(h.action==='effect'){fx(h.effect||'confetti');return}if(h.action==='link'&&h.url){window.open(h.url,'_blank','noopener');return}panel.hidden=false;panel.innerHTML='<div><b>'+esc(h.label||'Explorar')+'</b><button type="button">×</button></div><p>'+esc(h.content||'')+'</p>';q('button',panel).onclick=()=>panel.hidden=true})});
  qa('.path button').forEach(b=>b.onclick=()=>b.classList.toggle('done'));
  qa('.meeting-open').forEach(b=>b.onclick=()=>{if(!b.dataset.url){alert('Link da reunião não configurado.');return}window.open(b.dataset.url,'keise-meeting','popup=yes,width=1100,height=760')});
  qa('.escape').forEach(b=>{const input=q('.escape-answer',b),out=q('.escape-feedback',b),cont=q('.escape-continue',b);q('.escape-hint',b).onclick=()=>q('.escape-hint-text',b).hidden=false;q('.escape-check',b).onclick=()=>{const ok=input.value.trim().toLowerCase()===b.dataset.answer.trim().toLowerCase();out.textContent=ok?'✅ Você conseguiu!':'Ainda não. Tente novamente.';if(ok){fx(b.dataset.effect||'confetti');cont.hidden=false}};cont.onclick=()=>{if(b.dataset.target){current=b.dataset.target;render()}}});
  qa('.bingo').forEach(b=>{const cells=qa('[data-cell]',b),out=q('.bingo-result',b);cells.forEach(x=>x.onclick=()=>x.classList.toggle('marked'));q('.bingo-draw',b).onclick=()=>{const a=cells.filter(x=>!x.classList.contains('marked'));if(!a.length){out.textContent='Todos os itens foram marcados.';return}const p=a[Math.floor(Math.random()*a.length)];p.classList.add('marked');out.textContent='Saiu: '+p.textContent;fx('stars')};q('.bingo-reset',b).onclick=()=>{cells.forEach(x=>x.classList.remove('marked'));out.textContent=''}});
  qa('.raffle').forEach(b=>q('.raffle-run',b).onclick=()=>{let a=[];try{a=JSON.parse(b.dataset.items||'[]')}catch{};if(!a.length)return;q('.raffle-result',b).textContent=a[Math.floor(Math.random()*a.length)];fx('confetti')});
  qa('.effect-btn').forEach(b=>b.onclick=()=>fx(b.dataset.effect||'confetti'))
 }
 function render(){const s=P.slides.find(x=>x.id===current)||P.slides[0],i=P.slides.findIndex(x=>x.id===s.id),stage=q('#screen');stage.innerHTML='<h2>'+esc(s.title||'')+'</h2>'+s.elements.map(elem).join('');q('#count').textContent=(i+1)+' / '+P.slides.length;q('#prev').disabled=i<=0;q('#next').disabled=i>=P.slides.length-1;q('#prev').onclick=()=>{current=P.slides[i-1].id;render()};q('#next').onclick=()=>{current=P.slides[i+1].id;render()};qa('.check').forEach(b=>b.onclick=()=>{const box=b.closest('.quiz'),picked=q('input:checked',box),out=q('.feedback',box);if(!picked){out.textContent='Escolha uma alternativa.';return}out.textContent=Number(picked.value)===Number(box.dataset.correct)?box.dataset.right:box.dataset.wrong});qa('.jump').forEach(b=>b.onclick=()=>{if(b.dataset.target){current=b.dataset.target;render()}});wireVideos(s);wireSupport(s);wireAdv(s)}
 q('#title').textContent=P.title||'';q('#context').textContent=P.context||'';render();
 <\/script></body></html>`;
}
function exportProject(p){const html=exportedHtml(p),blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(p.title||'atividade').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('HTML exportado.')}
function render(){if(!root)return;root.innerHTML=mode==='library'?library():editor();mode==='library'?bindLibrary():bindEditor();hydrateLocalVideos(root).catch(()=>{})}
function mount(target){root=target;render()}
window.KeiseLearning=Object.freeze({mount,exportState:()=>JSON.parse(JSON.stringify(state)),openProject(id){activeProjectId=id;mode='editor';selectedElementId=null;if(root)render()},create(title,context){createProject(title,context||'')},showNew(){mode='library';if(root){render();setTimeout(()=>$('#learnCreateDialog',root)?.showModal(),0)}}});
})();