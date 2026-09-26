'use strict';
(()=>{
const KEY='keise-studio-v1';
const MODULES={
 mediation:{name:'Mediação',icon:'💜',cls:'pink',desc:'Acompanhar estudantes, registrar contatos, organizar sinais de atenção e gerar relatórios.',chips:['alunos acompanhados','sinais de atenção','intervenções','relatórios']},
 learning:{name:'Learning',icon:'📚',cls:'lav',desc:'Criar aulas, quizzes, vídeos interativos, cenários ramificados, fóruns e objetos educacionais.',chips:['vídeo interativo','quiz','ramificações','SCORM futuro']},
 creative:{name:'Creative',icon:'🎬',cls:'blue',desc:'Produzir vídeos, podcasts, motion, áudio e peças institucionais com linguagem profissional.',chips:['timeline','vídeo','podcast','motion']},
 immersive:{name:'Immersive',icon:'🌐',cls:'mint',desc:'Montar 360º, 3D, hotspots, ambientes, experiências interativas e simulações.',chips:['360º','3D','hotspots','simulações']},
 characters:{name:'Characters',icon:'🧸',cls:'yellow',desc:'Criar mascotes e personagens reutilizáveis com poses, expressões, falas e identidade.',chips:['mascotes','personagens','expressões','animação futura']},
 analytics:{name:'Analytics',icon:'📊',cls:'peach',desc:'Consolidar evidências de impacto, engajamento e aprendizagem dos recursos educacionais.',chips:['impacto','engajamento','aprendizagem','relatórios']}
};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let state=load(),view='home';
function blank(){return{version:1,projects:[],createdAt:new Date().toISOString()}}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&x.version===1?x:blank()}catch{return blank()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2400)}
function id(){return'kst-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function fmtDate(v){return new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}
function areaName(k){return MODULES[k]?.name||k}
function projectCards(list=state.projects){
 if(!list.length)return `<div class="empty"><div><span>🌱</span><b>Nenhum projeto criado ainda</b><p>Use “Novo projeto” para começar. O primeiro rascunho já fica salvo neste navegador.</p></div></div>`;
 return `<div class="project-grid">${list.map(p=>`<article class="project-card"><h4>${esc(p.name)}</h4><p>${esc(p.context||'Sem contexto informado')}</p><footer><span class="area-pill">${esc(areaName(p.area))}</span><button class="tiny" data-project="${p.id}">Abrir</button></footer></article>`).join('')}</div>`;
}
function moduleCard(key){
 const m=MODULES[key],analytics=key==='analytics';
 return `<article class="module-card ${m.cls}"><div class="module-icon">${m.icon}</div><h3>${m.name}</h3><p>${m.desc}</p><div class="chips">${m.chips.map(x=>`<span class="chip">${x}</span>`).join('')}</div><div class="module-footer">${analytics?`<a href="../keise-learning-analytics/">Abrir Analytics →</a>`:`<button data-go="${key}">Explorar →</button>`}<span>✦</span></div></article>`;
}
function home(){
 return `<section class="hero"><div><h2>Seu ecossistema criativo começa aqui ✨</h2><p>O Keise Studio será a base para criar recursos educacionais, acompanhar estudantes, produzir vídeos e podcasts, montar experiências imersivas e transformar tudo em evidências profissionais.</p><div class="hero-actions"><button class="primary" data-new>＋ Criar primeiro projeto</button><a class="soft" href="../keise-learning-analytics/" style="text-decoration:none;display:inline-flex;align-items:center">Abrir Analytics</a></div></div><div class="hero-art">🎨🎬🌈</div></section>
 <div class="section-head"><div><h2>Áreas do Studio</h2><p>Uma plataforma única, construída por módulos.</p></div><span class="scribble">grande por dentro, leve por fora ♡</span></div>
 <div class="module-grid">${Object.keys(MODULES).map(moduleCard).join('')}</div>
 <section class="panel"><div class="section-head"><div><h2>Meus projetos</h2><p>Rascunhos locais desta primeira versão.</p></div><button class="soft" data-new>＋ Novo</button></div><div style="margin-top:14px">${projectCards()}</div></section>`;
}
const features={
 mediation:[
  ['👩‍🎓','Alunos acompanhados','Cadastro e histórico de acompanhamento por estudante.'],
  ['⚠️','Sinais de atenção','Pendências, ausência, queda de participação e outros sinais definidos por você.'],
  ['💬','Intervenções','Registro de contato, retorno, orientação e acompanhamento.'],
  ['📑','Relatórios','Relatórios mensais, de acompanhamento, participação e prestação de serviços.'],
  ['🗓️','Rotina da mediação','Pendências do dia, prazos, mensagens e tarefas.'],
  ['📈','Permanência e reengajamento','Histórico de ações e evolução, sem rotular automaticamente o estudante.']
 ],
 learning:[
  ['🎬','Vídeo interativo','Perguntas, pausas, ramificações e discussão contextual dentro do vídeo.'],
  ['❓','Atividades','Quiz, verdadeiro/falso, hotspot, associação, classificação e drag-and-drop.'],
  ['🧭','Cenários','Decisões que levam a caminhos diferentes.'],
  ['💬','Discussão no contexto','Dúvida vinculada exatamente ao trecho, questão ou objeto.'],
  ['📦','Publicação','HTML, ZIP, código de incorporação e SCORM em etapas futuras.'],
  ['📊','Analytics integrado','Projetos preparados para exportar dados ao Keise Learning Analytics.']
 ],
 creative:[
  ['🎞️','Timeline profissional','Múltiplas pistas de vídeo, áudio, texto e imagem.'],
  ['✂️','Edição','Cortes, transições, velocidade, keyframes e composição.'],
  ['🎨','Cinema','Cor, LUTs, títulos, motion, máscaras e efeitos conforme evoluirmos.'],
  ['🎙️','Podcast Studio','Voz, trilha, vinheta, capítulos e exportação de áudio.'],
  ['💬','Legendas','Importação e edição de legendas, com transcrição local futura.'],
  ['📱','Vídeo institucional','Templates para campanhas, datas comemorativas e comunicação acadêmica.']
 ],
 immersive:[
  ['🌐','360º','Cenas panorâmicas com hotspots e caminhos.'],
  ['🧊','3D','Ambientes, objetos, materiais, luzes e propriedades.'],
  ['🧭','Simulações','Fluxos profissionais, decisões e consequências.'],
  ['🖱️','Interações','Clique, aproximação, áudio, diálogo e ações por evento.'],
  ['🥽','VR futuro','Estrutura preparada para experiências mais imersivas.'],
  ['🧰','Biblioteca','Objetos reutilizáveis entre projetos.']
 ],
 characters:[
  ['🧸','Mascotes','Biblioteca pessoal de mascotes educacionais.'],
  ['☺️','Expressões','Poses e emoções reutilizáveis.'],
  ['💬','Falas','Diálogos e falas associados a cenas e atividades.'],
  ['🎨','Identidade','Roupas, acessórios, paletas e estilos próprios.'],
  ['🎞️','Animação futura','Timeline de ações, lip-sync e movimento.'],
  ['📚','Papéis pedagógicos','Mediador, cliente, guia, narrador, personagem de caso e outros.']
 ]
};
function areaView(area){
 const m=MODULES[area],list=state.projects.filter(p=>p.area===area);
 return `<div class="section-head"><div><h2>${m.icon} ${m.name}</h2><p>${m.desc}</p></div><button class="primary" data-new data-area="${area}">＋ Novo projeto</button></div>
 <div class="feature-grid">${(features[area]||[]).map(f=>`<article class="feature"><strong>${f[0]}</strong><b>${f[1]}</b><p>${f[2]}</p></article>`).join('')}</div>
 <section class="panel"><h3>Projetos em ${m.name}</h3>${projectCards(list)}</section>
 <section class="panel"><h3>Construção por etapas</h3><div class="roadmap"><div class="roadmap-item"><div class="num">1</div><div><b>Base funcional</b><p>Projetos locais, organização e estrutura principal.</p></div></div><div class="roadmap-item"><div class="num">2</div><div><b>Editor específico</b><p>Ferramentas reais da área, construídas de forma incremental.</p></div></div><div class="roadmap-item"><div class="num">3</div><div><b>Exportação e integração</b><p>Publicação, arquivos portáveis e conexão com Analytics.</p></div></div></div></section>`;
}
function render(){
 $('#viewRoot').innerHTML=view==='home'?home():areaView(view);
 $$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 $$('[data-go]').forEach(b=>b.onclick=()=>{view=b.dataset.go;render();scrollTo(0,0)});
 $$('[data-new]').forEach(b=>b.onclick=()=>openNew(b.dataset.area));
 $$('[data-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.project));
}
function openNew(area){
 $('#projectArea').value=area||'learning';$('#projectForm').reset();if(area)$('#projectArea').value=area;$('#projectDialog').showModal();setTimeout(()=>$('#projectName').focus(),50)
}
function openProject(pid){
 const p=state.projects.find(x=>x.id===pid);if(!p)return;
 $('#detailsContent').innerHTML=`<div class="dialog-icon">${MODULES[p.area]?.icon||'✨'}</div><h2>${esc(p.name)}</h2><p><b>Área:</b> ${esc(areaName(p.area))}<br><b>Contexto:</b> ${esc(p.context||'—')}<br><b>Criado em:</b> ${fmtDate(p.createdAt)}</p><section class="panel" style="box-shadow:none;margin-top:15px"><h3>Objetivo</h3><p style="color:var(--muted);font-size:12px;line-height:1.6">${esc(p.goal||'Nenhum objetivo informado.')}</p></section><div class="dialog-actions"><button class="soft" id="deleteProject" type="button">Excluir rascunho</button><button class="primary" data-close type="button">Fechar</button></div>`;
 $('#detailsDialog').showModal();
 $('#deleteProject').onclick=()=>{if(!confirm('Excluir este rascunho local?'))return;state.projects=state.projects.filter(x=>x.id!==pid);save();$('#detailsDialog').close();render();toast('Rascunho excluído.')};
 $$('[data-close]',$('#detailsDialog')).forEach(b=>b.onclick=()=>$('#detailsDialog').close());
}
function setup(){
 $$('.nav-item[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();scrollTo({top:0,behavior:'smooth'})});
 $$('[data-route]').forEach(a=>a.onclick=e=>{e.preventDefault();view=a.dataset.route;render()});
 $('#newProjectBtn').onclick=()=>openNew();
 $$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('#projectForm').onsubmit=e=>{e.preventDefault();const p={id:id(),name:$('#projectName').value.trim(),area:$('#projectArea').value,context:$('#projectContext').value.trim(),goal:$('#projectGoal').value.trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.projects.unshift(p);save();$('#projectDialog').close();view=p.area;render();toast('Projeto criado no Keise Studio ✨')};
 $('#backupBtn').onclick=()=>{const blob=new Blob([JSON.stringify({schema:'keise-studio/backup-v1',...state},null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='keise-studio-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup salvo.')};
 render();
}
setup();
})();