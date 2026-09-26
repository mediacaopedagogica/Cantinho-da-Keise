'use strict';
(()=>{
const KEY='keise-learning-author-v1';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let root=null,state=load(),mode='library',activeProjectId=null,selectedElementId=null;

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
 if(e.type==='video')return `<div class="learn-render video"><div class="video-label">🎬 ${esc(e.title||'Vídeo')}</div>${e.src?`<video controls preload="metadata" src="${esc(e.src)}"></video>`:'<div class="video-placeholder">Adicione a URL do vídeo nas propriedades.</div>'}</div>`;
 if(e.type==='button')return `<div class="learn-render button-block"><button type="button" disabled>${esc(e.label||'Continuar')}</button><small>${e.targetSlideId?'Vai para outra tela':'Sem destino definido'}</small></div>`;
 if(e.type==='quiz')return `<div class="learn-render quiz"><b>❓ ${esc(e.question||'Sua pergunta')}</b><div>${(e.options||['Opção A','Opção B']).map((o,i)=>`<label><input type="radio" disabled> ${esc(o||'Opção '+(i+1))}</label>`).join('')}</div></div>`;
 if(e.type==='reflection')return `<div class="learn-render reflection"><b>💭 ${esc(e.prompt||'Reflita sobre este ponto.')}</b><textarea disabled placeholder="${esc(e.placeholder||'Escreva sua reflexão...')}"></textarea></div>`;
 return '';
}
function editor(){
 const p=project(),s=slide();if(!p||!s){mode='library';return library()}
 return `
 <section class="learn-editor">
  <header class="learn-editor-top">
   <button class="soft" id="learnBack">← Projetos</button>
   <div><small>Keise Learning</small><h2>${esc(p.title)}</h2><p>${esc(p.context||'Sem contexto informado')}</p></div>
   <div class="learn-editor-actions"><span class="learn-save-state">● salvo localmente</span><button class="soft" id="learnPreview">▶ Visualizar</button><button class="primary" id="learnExport">Exportar HTML</button></div>
  </header>
  <div class="learn-workspace">
   <aside class="learn-slides">
    <div class="learn-side-head"><b>Telas</b><button class="tiny" id="learnAddSlide">＋</button></div>
    <div class="learn-slide-list">${p.slides.map((x,i)=>`<button class="${x.id===p.activeSlideId?'active':''}" data-learn-slide="${x.id}"><span>${i+1}</span><b>${esc(x.title||'Tela '+(i+1))}</b></button>`).join('')}</div>
    <button class="soft learn-add-screen" id="learnAddSlideBottom">＋ Nova tela</button>
   </aside>
   <main class="learn-canvas-wrap">
    <div class="learn-canvas-head"><div><span>Tela atual</span><input id="learnSlideTitle" maxlength="80" value="${esc(s.title||'')}"></div><button class="tiny danger-text" id="learnDeleteSlide" ${p.slides.length===1?'disabled':''}>Excluir tela</button></div>
    <div class="learn-canvas">
     <div class="learn-slide-stage">
      ${s.elements.length?s.elements.map(e=>`<article class="learn-element ${e.id===selectedElementId?'selected':''}" data-learn-element="${e.id}">${elementMarkup(e,p)}<div class="element-tools"><button data-move="up" title="Mover para cima">↑</button><button data-move="down" title="Mover para baixo">↓</button><button data-remove="${e.id}" title="Excluir">×</button></div></article>`).join(''):empty('✨','Tela vazia','Use a biblioteca de blocos à direita para começar.')}
     </div>
    </div>
   </main>
   <aside class="learn-properties">
    <div class="learn-side-head"><b>${element()?'Propriedades':'Adicionar bloco'}</b>${element()?'<button class="tiny" id="learnCloseProperties">×</button>':''}</div>
    ${element()?properties(element(),p):toolbox()}
   </aside>
  </div>
  <dialog class="dialog wide learn-preview-dialog" id="learnPreviewDialog"><button class="dialog-close" type="button" data-learn-close>×</button><div id="learnPreviewBody"></div></dialog>
 </section>`;
}
function toolbox(){
 return `<div class="learn-toolbox">
  <button data-add-block="heading"><span>🔠</span><b>Título</b><small>Destaque principal</small></button>
  <button data-add-block="text"><span>📝</span><b>Texto</b><small>Conteúdo e explicação</small></button>
  <button data-add-block="video"><span>🎬</span><b>Vídeo</b><small>Player HTML5</small></button>
  <button data-add-block="quiz"><span>❓</span><b>Múltipla escolha</b><small>Questão com feedback</small></button>
  <button data-add-block="reflection"><span>💭</span><b>Reflexão</b><small>Pergunta aberta</small></button>
  <button data-add-block="button"><span>🔘</span><b>Botão</b><small>Navegação entre telas</small></button>
 </div>`;
}
function properties(e,p){
 if(e.type==='heading'||e.type==='text')return `<div class="learn-props"><label>Conteúdo<textarea id="propText" rows="${e.type==='heading'?3:8}">${esc(e.text||'')}</textarea></label><small>As alterações são salvas automaticamente.</small></div>`;
 if(e.type==='video')return `<div class="learn-props"><label>Título<input id="propVideoTitle" value="${esc(e.title||'')}"></label><label>URL do vídeo<input id="propVideoSrc" value="${esc(e.src||'')}" placeholder="https://.../video.mp4"></label><p class="learn-prop-note">Nesta versão, use uma URL de vídeo acessível pelo navegador. Arquivos locais empacotados entram numa próxima etapa.</p></div>`;
 if(e.type==='button')return `<div class="learn-props"><label>Texto do botão<input id="propButtonLabel" value="${esc(e.label||'Continuar')}"></label><label>Ir para<select id="propButtonTarget"><option value="">Sem destino</option>${p.slides.filter(s=>s.id!==p.activeSlideId).map((s,i)=>`<option value="${s.id}" ${e.targetSlideId===s.id?'selected':''}>${esc(s.title||'Tela '+(i+1))}</option>`).join('')}</select></label></div>`;
 if(e.type==='reflection')return `<div class="learn-props"><label>Pergunta<textarea id="propReflection">${esc(e.prompt||'')}</textarea></label><label>Placeholder<input id="propReflectionPlaceholder" value="${esc(e.placeholder||'')}"></label></div>`;
 if(e.type==='quiz')return `<div class="learn-props"><label>Pergunta<textarea id="propQuizQuestion">${esc(e.question||'')}</textarea></label>${(e.options||[]).map((o,i)=>`<label>Alternativa ${String.fromCharCode(65+i)}<input data-quiz-option="${i}" value="${esc(o)}"></label>`).join('')}<label>Resposta correta<select id="propQuizCorrect">${(e.options||[]).map((_,i)=>`<option value="${i}" ${Number(e.correct)===i?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></label><label>Feedback ao acertar<textarea id="propQuizRight">${esc(e.feedbackRight||'Muito bem!')}</textarea></label><label>Feedback ao errar<textarea id="propQuizWrong">${esc(e.feedbackWrong||'Revise o conteúdo e tente novamente.')}</textarea></label></div>`;
 return '';
}
function newElement(type){
 if(type==='heading')return{id:uid('el'),type,text:'Novo título'};
 if(type==='text')return{id:uid('el'),type,text:'Digite aqui o conteúdo da sua aula.'};
 if(type==='video')return{id:uid('el'),type,title:'Vídeo da aula',src:''};
 if(type==='button')return{id:uid('el'),type,label:'Continuar',targetSlideId:''};
 if(type==='reflection')return{id:uid('el'),type,prompt:'O que você considera mais importante neste ponto?',placeholder:'Escreva sua reflexão...'};
 if(type==='quiz')return{id:uid('el'),type,question:'Qual alternativa está correta?',options:['Alternativa A','Alternativa B','Alternativa C','Alternativa D'],correct:0,feedbackRight:'Muito bem!',feedbackWrong:'Revise o conteúdo e tente novamente.'};
}
function createProject(title,context){
 const first={id:uid('slide'),title:'Boas-vindas',elements:[{id:uid('el'),type:'heading',text:title},{id:uid('el'),type:'text',text:'Comece a construir sua experiência educacional.'}]};
 const p={id:uid('learn'),title,context,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),activeSlideId:first.id,slides:[first]};
 state.projects.unshift(p);save();activeProjectId=p.id;selectedElementId=null;mode='editor';render();
}
function bindLibrary(){
 $('#learnNewProject',root).onclick=()=>$('#learnCreateDialog',root).showModal();
 $$('[data-learn-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('#learnCreateForm',root).onsubmit=e=>{e.preventDefault();const title=$('#learnTitle',root).value.trim(),ctx=$('#learnContext',root).value.trim();$('#learnCreateDialog',root).close();createProject(title,ctx)};
 $$('[data-learn-open]',root).forEach(b=>b.onclick=()=>{activeProjectId=b.dataset.learnOpen;const p=project();if(p&&!p.activeSlideId)p.activeSlideId=p.slides[0]?.id;selectedElementId=null;mode='editor';render()});
 $$('[data-learn-preview]',root).forEach(b=>b.onclick=()=>previewProject(b.dataset.learnPreview));
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
 $$('[data-learn-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
}
function bindProperties(){
 const e=element();if(!e)return;
 const bind=(sel,key)=>{const n=$(sel,root);if(n)n.oninput=ev=>{e[key]=ev.target.value;touch();renderCanvasLight()}};
 bind('#propText','text');bind('#propVideoTitle','title');bind('#propVideoSrc','src');bind('#propButtonLabel','label');bind('#propReflection','prompt');bind('#propReflectionPlaceholder','placeholder');bind('#propQuizQuestion','question');bind('#propQuizRight','feedbackRight');bind('#propQuizWrong','feedbackWrong');
 const target=$('#propButtonTarget',root);if(target)target.onchange=ev=>{e.targetSlideId=ev.target.value;touch();renderCanvasLight()};
 const correct=$('#propQuizCorrect',root);if(correct)correct.onchange=ev=>{e.correct=Number(ev.target.value);touch();renderCanvasLight()};
 $$('[data-quiz-option]',root).forEach(n=>n.oninput=ev=>{e.options[Number(n.dataset.quizOption)]=ev.target.value;touch();renderCanvasLight()});
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
 return `<div class="learn-runtime" data-project="${p.id}" data-current="${start.id}"><header><small>Pré-visualização</small><h2>${esc(p.title)}</h2><p>${esc(p.context||'')}</p></header><main id="learnRuntimeStage"></main><footer><button class="soft" id="runtimePrev" type="button">← Voltar</button><span id="runtimeCounter"></span><button class="primary" id="runtimeNext" type="button">Avançar →</button></footer></div>`;
}
function renderRuntime(p,dialog){
 const runtime=$('.learn-runtime',dialog),stage=$('#learnRuntimeStage',dialog),id=runtime.dataset.current,s=p.slides.find(x=>x.id===id)||p.slides[0],index=p.slides.findIndex(x=>x.id===s.id);
 stage.innerHTML=`<h3>${esc(s.title)}</h3>`+s.elements.map(e=>{
  if(e.type==='heading')return `<h2>${esc(e.text)}</h2>`;
  if(e.type==='text')return `<p>${esc(e.text).replace(/\n/g,'<br>')}</p>`;
  if(e.type==='video')return e.src?`<div class="runtime-video"><b>${esc(e.title||'Vídeo')}</b><video controls src="${esc(e.src)}"></video></div>`:`<div class="runtime-note">Vídeo ainda sem URL.</div>`;
  if(e.type==='reflection')return `<div class="runtime-reflection"><b>${esc(e.prompt)}</b><textarea placeholder="${esc(e.placeholder||'Escreva sua reflexão...')}"></textarea></div>`;
  if(e.type==='quiz')return `<form class="runtime-quiz" data-correct="${Number(e.correct)||0}" data-right="${esc(e.feedbackRight||'Muito bem!')}" data-wrong="${esc(e.feedbackWrong||'Tente novamente.')}"><b>${esc(e.question)}</b>${(e.options||[]).map((o,i)=>`<label><input type="radio" name="q" value="${i}"> ${esc(o)}</label>`).join('')}<button class="soft runtime-check" type="button">Verificar resposta</button><p class="runtime-feedback" role="status"></p></form>`;
  if(e.type==='button')return `<button class="primary runtime-jump" data-target="${esc(e.targetSlideId||'')}">${esc(e.label||'Continuar')}</button>`;
  return '';
 }).join('');
 $('#runtimeCounter',dialog).textContent=(index+1)+' / '+p.slides.length;
 $('#runtimePrev',dialog).disabled=index<=0;$('#runtimeNext',dialog).disabled=index>=p.slides.length-1;
 $('#runtimePrev',dialog).onclick=()=>{runtime.dataset.current=p.slides[index-1].id;renderRuntime(p,dialog)};
 $('#runtimeNext',dialog).onclick=()=>{runtime.dataset.current=p.slides[index+1].id;renderRuntime(p,dialog)};
 $$('.runtime-check',dialog).forEach(b=>b.onclick=()=>{const f=b.closest('.runtime-quiz'),picked=f.querySelector('input[name="q"]:checked'),out=f.querySelector('.runtime-feedback');if(!picked){out.textContent='Escolha uma alternativa.';return}out.textContent=Number(picked.value)===Number(f.dataset.correct)?f.dataset.right:f.dataset.wrong});
 $$('.runtime-jump',dialog).forEach(b=>b.onclick=()=>{if(!b.dataset.target)return;runtime.dataset.current=b.dataset.target;renderRuntime(p,dialog)});
}
function previewProject(id){
 const p=state.projects.find(x=>x.id===id);if(!p)return;let dlg=$('#learnPreviewDialog',root);if(!dlg){alert('Abra o recurso para visualizar.');return}$('#learnPreviewBody',dlg).innerHTML=previewMarkup(p);dlg.showModal();renderRuntime(p,dlg);
}
function exportedHtml(p){
 const data=JSON.stringify(p).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title><style>
 body{margin:0;background:#f7f7fc;color:#24305b;font-family:system-ui,-apple-system,Segoe UI,sans-serif}*{box-sizing:border-box}.app{max-width:920px;margin:auto;padding:24px}.card{background:#fff;border:1px solid #e9e8f1;border-radius:22px;padding:24px;box-shadow:0 16px 50px #565a8a12}.top{margin-bottom:18px}.top small{color:#7a82a3}.top h1{margin:4px 0}.screen h2{font-size:28px}.screen p{line-height:1.65}.screen video{width:100%;border-radius:15px;margin-top:8px}.quiz,.reflection{background:#f9f7ff;border-radius:16px;padding:16px;margin:15px 0}.quiz label{display:block;padding:7px}.quiz button,.jump,.nav button{border:0;border-radius:11px;padding:10px 14px;font-weight:750}.quiz button,.nav button{background:#ece8ff;color:#50438d}.jump{background:#7788ef;color:#fff;margin:10px 0}.reflection textarea{width:100%;min-height:100px;margin-top:10px;border:1px solid #dddce9;border-radius:11px;padding:10px}.feedback{font-weight:750}.nav{display:flex;justify-content:space-between;align-items:center;margin-top:20px}.nav button:disabled{opacity:.4}
 </style></head><body><div class="app"><div class="card"><div class="top"><small>Experiência criada no Keise Learning</small><h1 id="title"></h1><p id="context"></p></div><main id="screen"></main><div class="nav"><button id="prev">← Voltar</button><span id="count"></span><button id="next">Avançar →</button></div></div></div><script>
 const P=${data};let current=P.slides[0].id;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));document.getElementById('title').textContent=P.title;document.getElementById('context').textContent=P.context||'';
 function render(){const s=P.slides.find(x=>x.id===current)||P.slides[0],i=P.slides.findIndex(x=>x.id===s.id),stage=document.getElementById('screen');stage.innerHTML='<h2>'+esc(s.title)+'</h2>'+s.elements.map(e=>{if(e.type==='heading')return'<h2>'+esc(e.text)+'</h2>';if(e.type==='text')return'<p>'+esc(e.text).replace(/\\n/g,'<br>')+'</p>';if(e.type==='video')return e.src?'<div><b>'+esc(e.title||'Vídeo')+'</b><video controls src="'+esc(e.src)+'"></video></div>':'<p>Vídeo sem URL.</p>';if(e.type==='reflection')return'<div class="reflection"><b>'+esc(e.prompt)+'</b><textarea placeholder="'+esc(e.placeholder||'Escreva...')+'"></textarea></div>';if(e.type==='quiz')return'<div class="quiz" data-correct="'+e.correct+'" data-right="'+esc(e.feedbackRight)+'" data-wrong="'+esc(e.feedbackWrong)+'"><b>'+esc(e.question)+'</b>'+e.options.map((o,n)=>'<label><input type="radio" name="q-'+e.id+'" value="'+n+'"> '+esc(o)+'</label>').join('')+'<button type="button" class="check">Verificar</button><p class="feedback"></p></div>';if(e.type==='button')return'<button class="jump" data-target="'+esc(e.targetSlideId||'')+'">'+esc(e.label||'Continuar')+'</button>';return''}).join('');document.getElementById('count').textContent=(i+1)+' / '+P.slides.length;document.getElementById('prev').disabled=i<=0;document.getElementById('next').disabled=i>=P.slides.length-1;document.getElementById('prev').onclick=()=>{current=P.slides[i-1].id;render()};document.getElementById('next').onclick=()=>{current=P.slides[i+1].id;render()};document.querySelectorAll('.check').forEach(b=>b.onclick=()=>{const q=b.closest('.quiz'),picked=q.querySelector('input:checked'),f=q.querySelector('.feedback');if(!picked){f.textContent='Escolha uma alternativa.';return}f.textContent=Number(picked.value)===Number(q.dataset.correct)?q.dataset.right:q.dataset.wrong});document.querySelectorAll('.jump').forEach(b=>b.onclick=()=>{if(b.dataset.target){current=b.dataset.target;render()}})}
 render();
 <\/script></body></html>`;
}
function exportProject(p){const html=exportedHtml(p),blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(p.title||'atividade').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('HTML exportado.')}
function render(){if(!root)return;root.innerHTML=mode==='library'?library():editor();mode==='library'?bindLibrary():bindEditor()}
function mount(target){root=target;render()}
window.KeiseLearning=Object.freeze({mount,exportState:()=>JSON.parse(JSON.stringify(state)),openProject(id){activeProjectId=id;mode='editor';selectedElementId=null;if(root)render()},create(title,context){createProject(title,context||'')},showNew(){mode='library';if(root){render();setTimeout(()=>$('#learnCreateDialog',root)?.showModal(),0)}}});
})();