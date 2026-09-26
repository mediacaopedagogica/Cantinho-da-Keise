'use strict';
(()=>{
const KEY='keise-mediation-v1';
const STATUS={
 acompanhando:{label:'Acompanhando',cls:'ok'},
 atencao:{label:'Sinais de atenção',cls:'warn'},
 aguardando:{label:'Aguardando retorno',cls:'wait'},
 reengajado:{label:'Reengajado',cls:'good'},
 encaminhado:{label:'Encaminhado',cls:'info'}
};
const SIGNALS={
 sem_acesso:'Período sem acesso/atividade',
 atividade_pendente:'Atividade pendente',
 baixa_participacao:'Baixa participação',
 forum_ausente:'Sem participação esperada no fórum',
 sem_retorno:'Contato realizado sem retorno',
 desempenho:'Desempenho requer acompanhamento',
 outro:'Outro sinal observado'
};
const CHANNELS=['AVA','E-mail','Mensagem','Telefone','Videochamada','Fórum','Outro'];
const TYPES=['Orientação','Lembrete de prazo','Acolhimento','Feedback','Retomada de contato','Encaminhamento','Plantão','Outro'];
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let root=null,state=load(),tab='overview',filterStatus='all',filterDiscipline='all',editingId=null;

function defaultTemplates(){
  return [
    {id:'tpl-welcome',title:'Boas-vindas',category:'Acolhimento',subject:'Boas-vindas à disciplina',body:'Olá, {nome}! Seja bem-vindo(a). Estou passando para me colocar à disposição durante a disciplina. Sempre que precisar, você pode utilizar os canais de comunicação disponíveis no ambiente.'},
    {id:'tpl-deadline',title:'Lembrete de prazo',category:'Prazo',subject:'Lembrete sobre prazo',body:'Olá, {nome}! Passando para lembrar que o prazo de {atividade} está se aproximando. Se puder, confira o calendário da disciplina para organizar sua entrega com tranquilidade.'},
    {id:'tpl-followup',title:'Retomada de contato',category:'Acompanhamento',subject:'Acompanhamento',body:'Olá, {nome}! Estou retomando nosso contato para saber se conseguiu avançar em {atividade}. Caso ainda tenha alguma dificuldade, me sinalize pelo canal da disciplina para que eu possa orientar.'},
    {id:'tpl-feedback',title:'Feedback acolhedor',category:'Feedback',subject:'Retorno sobre sua atividade',body:'Olá, {nome}! Obrigada pela sua participação. Seu trabalho apresenta pontos importantes e, para fortalecer ainda mais a entrega, vale observar: {observacao}.'}
  ];
}
function blank(){return{version:1,students:[],interventions:[],activities:[],meetings:[],templates:defaultTemplates(),communications:[],updatedAt:null}}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.version===1){x.students??=[];x.interventions??=[];x.activities??=[];x.meetings??=[];x.communications??=[];if(!Array.isArray(x.templates)||!x.templates.length)x.templates=defaultTemplates();return x}return blank()}catch{return blank()}}
function save(){state.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(p='m'){return p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function fmtDate(v,withTime=false){if(!v)return'—';try{return new Intl.DateTimeFormat('pt-BR',withTime?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v))}catch{return'—'}}
function todayISO(){const d=new Date(),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10)}
function daysAgo(v){if(!v)return null;return Math.floor((Date.now()-new Date(v).getTime())/864e5)}
function studentInterventions(id){return state.interventions.filter(x=>x.studentId===id).sort((a,b)=>new Date(b.at)-new Date(a.at))}
function disciplines(){return [...new Set(state.students.map(s=>s.discipline).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
function activeSignals(s){return Array.isArray(s.signals)?s.signals:[]}
function due(s){return !!s.nextFollowUpAt&&new Date(s.nextFollowUpAt+'T23:59:59').getTime()<=Date.now()}
function needsAttention(s){return s.status==='atencao'||s.status==='aguardando'||activeSignals(s).length>0||due(s)}
const CONTENT_SUPPORT_PREFIX='keise-learning-support-drafts:';
const CONTENT_STATUS_KEY='keise-mediation-content-status-v1';
function contentStatusMap(){try{return JSON.parse(localStorage.getItem(CONTENT_STATUS_KEY)||'{}')}catch{return{}}}
function saveContentStatus(map){localStorage.setItem(CONTENT_STATUS_KEY,JSON.stringify(map))}
function contentSupportItems(){
 const out=[],status=contentStatusMap();
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key||!key.startsWith(CONTENT_SUPPORT_PREFIX))continue;
  let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
  if(!Array.isArray(list))continue;
  list.forEach(item=>out.push({...item,_storageKey:key,_reviewed:!!status[item.id]}));
 }
 return out.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
}
function contentKindLabel(item){
 if(item.kind==='question')return'💬 Dúvida no Ponto';
 if(item.kind==='comment')return'💭 Comentário';
 if(item.kind==='signal'){
  const labels={understood:'😊 Entendi',doubt:'🤔 Tenho dúvida',lost:'🧭 Me perdi',deepen:'🚀 Quero aprofundar'};
  return labels[item.message]||'🧭 Sinal de compreensão';
 }
 return item.kind||'Registro';
}
function contentContextText(item){
 const time=item.timestamp!=null?' · '+Number(item.timestamp).toFixed(1)+'s':'';
 return [item.projectTitle||'Projeto',item.slideTitle||'Tela',(item.videoTitle||'Vídeo')+time].join(' · ');
}

function activityState(a){
 if(a.status==='concluida')return'done';
 if(!a.dueDate)return'normal';
 const due=new Date(a.dueDate+'T23:59:59').getTime(),diff=(due-Date.now())/864e5;
 if(diff<0)return'late';if(diff<=2)return'soon';return'normal'
}
function upcomingActivities(){return [...state.activities].filter(a=>a.status!=='concluida').sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')))}
function upcomingMeetings(){return [...state.meetings].filter(m=>m.status!=='concluido'&&m.status!=='cancelado').sort((a,b)=>new Date(a.at||'2999')-new Date(b.at||'2999'))}
function signalCounts(){
 const out={};Object.keys(SIGNALS).forEach(k=>out[k]=0);state.students.forEach(s=>activeSignals(s).forEach(k=>out[k]=(out[k]||0)+1));return out
}
function historyItems(){
 const items=[];
 state.interventions.forEach(x=>{const s=state.students.find(a=>a.id===x.studentId);items.push({at:x.at,icon:'💬',title:x.type,meta:s?.name||'Estudante',text:x.note||'',kind:'intervention'})});
 state.activities.forEach(x=>items.push({at:x.updatedAt||x.createdAt,icon:x.status==='concluida'?'✅':'📌',title:x.title,meta:x.discipline||x.type||'Atividade',text:x.status==='concluida'?'Concluída':'Atualizada',kind:'activity'}));
 state.meetings.forEach(x=>items.push({at:x.updatedAt||x.createdAt,icon:'🗓️',title:x.title,meta:x.discipline||x.provider||'Encontro',text:x.status==='concluido'?'Concluído':x.status==='cancelado'?'Cancelado':'Agendado',kind:'meeting'}));
 state.communications.forEach(x=>items.push({at:x.at,icon:'✉️',title:'Comunicação realizada',meta:x.name||x.channel||'Registro',text:x.message||'',kind:'communication'}));
 return items.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0))
}
function filteredStudents(){
 return state.students.filter(s=>(filterStatus==='all'||s.status===filterStatus)&&(filterDiscipline==='all'||s.discipline===filterDiscipline)).sort((a,b)=>{
  const aa=needsAttention(a)?0:1,bb=needsAttention(b)?0:1;if(aa!==bb)return aa-bb;return (a.name||'').localeCompare(b.name||'','pt-BR')
 });
}
function counts(){
 const total=state.students.length,attention=state.students.filter(needsAttention).length,waiting=state.students.filter(s=>s.status==='aguardando').length,reengaged=state.students.filter(s=>s.status==='reengajado').length,dueCount=state.students.filter(due).length;
 return{total,attention,waiting,reengaged,due:dueCount,interventions:state.interventions.length}
}
function toast(msg){
 let t=document.querySelector('#toast');
 if(t){t.textContent=msg;t.classList.add('show');clearTimeout(window.__kmToast);window.__kmToast=setTimeout(()=>t.classList.remove('show'),2400)}
}
function statusPill(k){const s=STATUS[k]||STATUS.acompanhando;return '<span class="med-status '+s.cls+'">'+esc(s.label)+'</span>'}
function signalTags(s){
 const list=activeSignals(s);
 if(!list.length)return '<span class="med-muted">Nenhum sinal registrado</span>';
 return '<div class="signal-tags">'+list.map(x=>'<span>'+esc(SIGNALS[x]||x)+'</span>').join('')+'</div>';
}
function overview(){
 const c=counts(),attention=state.students.filter(needsAttention).slice(0,6),recent=[...state.interventions].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,6);
 return `
 <section class="med-hero">
  <div><p class="med-eyebrow">💜 Central de Mediação</p><h2>Acompanhamento com contexto, não com rótulos.</h2><p>Registre apenas o necessário, acompanhe sinais verificáveis e documente suas intervenções pedagógicas.</p></div>
  <div class="med-hero-actions"><button class="primary" data-add-student>＋ Adicionar estudante</button><button class="soft" data-tab="reports">Gerar relatório</button></div>
 </section>
 <div class="med-stats">
  <article class="med-stat pink"><small>Estudantes</small><b>${c.total}</b><span>acompanhados</span></article>
  <article class="med-stat yellow"><small>Precisam de atenção</small><b>${c.attention}</b><span>sinais ou retorno pendente</span></article>
  <article class="med-stat blue"><small>Aguardando retorno</small><b>${c.waiting}</b><span>contatos em acompanhamento</span></article>
  <article class="med-stat mint"><small>Reengajados</small><b>${c.reengaged}</b><span>situações retomadas</span></article>
  <article class="med-stat lav"><small>Retornos previstos</small><b>${c.due}</b><span>para hoje ou em atraso</span></article>
 </div>
 <div class="med-grid-2">
  <section class="panel"><div class="med-panel-head"><div><h3>🌱 Para olhar hoje</h3><p>Prioridades construídas a partir dos registros feitos por você.</p></div><button class="tiny" data-tab="students">Ver estudantes</button></div>
   ${attention.length?'<div class="attention-list">'+attention.map(s=>`<button class="attention-item" data-student="${s.id}"><span class="attention-avatar">${esc((s.name||'?').slice(0,1).toUpperCase())}</span><span><b>${esc(s.name)}</b><small>${esc(s.discipline||'Sem disciplina')} · ${activeSignals(s).length} sinal(is)${due(s)?' · retorno previsto':''}</small></span><i>›</i></button>`).join('')+'</div>':empty('🌷','Nada sinalizado agora','Quando você registrar um sinal ou retorno previsto, ele aparece aqui.')}
  </section>
  <section class="panel"><div class="med-panel-head"><div><h3>📝 Intervenções recentes</h3><p>Histórico das ações registradas.</p></div><button class="tiny" data-tab="followups">Ver histórico</button></div>
   ${recent.length?'<div class="intervention-list">'+recent.map(x=>{const s=state.students.find(a=>a.id===x.studentId);return `<div class="intervention-row"><span>💬</span><div><b>${esc(s?.name||'Estudante')}</b><small>${esc(x.type)} · ${esc(x.channel)} · ${fmtDate(x.at,true)}</small><p>${esc(x.note||'Sem observação')}</p></div></div>`}).join('')+'</div>':empty('📝','Nenhuma intervenção registrada','Registre contatos, feedbacks, orientações e outros acompanhamentos quando ocorrerem.')}
  </section>
 </div>`;
}
function studentsView(){
 const list=filteredStudents();
 return `
 <div class="med-section-head"><div><h2>👩‍🎓 Estudantes acompanhados</h2><p>Lista local de acompanhamento pedagógico.</p></div><button class="primary" data-add-student>＋ Adicionar estudante</button></div>
 <section class="med-toolbar">
  <label>Situação<select id="medStatusFilter"><option value="all">Todas</option>${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${filterStatus===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
  <label>Disciplina<select id="medDisciplineFilter"><option value="all">Todas</option>${disciplines().map(d=>`<option ${filterDiscipline===d?'selected':''} value="${esc(d)}">${esc(d)}</option>`).join('')}</select></label>
  <span class="med-toolbar-note">${list.length} exibido(s)</span>
 </section>
 <section class="panel">${list.length?`
  <div class="med-table-wrap"><table class="med-table"><thead><tr><th>Estudante</th><th>Disciplina/turma</th><th>Situação</th><th>Sinais</th><th>Última atividade</th><th>Próximo retorno</th><th></th></tr></thead><tbody>
  ${list.map(s=>`<tr class="${needsAttention(s)?'row-attention':''}"><td><b>${esc(s.name)}</b>${s.reference?'<small>'+esc(s.reference)+'</small>':''}</td><td>${esc(s.discipline||'—')}${s.group?'<small>'+esc(s.group)+'</small>':''}</td><td>${statusPill(s.status)}</td><td>${signalTags(s)}</td><td>${fmtDate(s.lastActivityAt)}</td><td>${fmtDate(s.nextFollowUpAt)}${due(s)?'<small class="due-label">atenção</small>':''}</td><td><button class="tiny" data-student="${s.id}">Abrir</button></td></tr>`).join('')}
  </tbody></table></div>`:empty('👩‍🎓','Nenhum estudante nesta visualização','Adicione um estudante ou ajuste os filtros.')}</section>`;
}
function followupsView(){
 const rows=[...state.interventions].sort((a,b)=>new Date(b.at)-new Date(a.at));
 return `
 <div class="med-section-head"><div><h2>💬 Intervenções e acompanhamentos</h2><p>Registro cronológico das ações realizadas pela mediação.</p></div><button class="soft" data-tab="students">Abrir estudantes</button></div>
 <section class="panel">${rows.length?'<div class="med-timeline">'+rows.map(x=>{const s=state.students.find(a=>a.id===x.studentId);return `<article><div class="timeline-dot"></div><div><small>${fmtDate(x.at,true)}</small><h4>${esc(s?.name||'Estudante')} · ${esc(x.type)}</h4><p><b>Canal:</b> ${esc(x.channel)}${x.outcome?' · <b>Resultado:</b> '+esc(x.outcome):''}</p><p>${esc(x.note||'Sem observação adicional.')}</p></div></article>`}).join('')+'</div>':empty('💬','Ainda não há intervenções','Os registros aparecerão aqui em ordem cronológica.')}</section>`;
}
function signalsView(){
 const counts=signalCounts(),students=state.students.filter(s=>activeSignals(s).length||s.status==='atencao'||s.status==='aguardando'||due(s));
 return `
 <div class="med-section-head"><div><h2>⚠️ Sinais e permanência</h2><p>Visualize padrões de atenção sem transformar sinais em rótulos permanentes.</p></div><button class="primary" data-add-student>＋ Adicionar estudante</button></div>
 <div class="signal-summary-grid">${Object.entries(SIGNALS).map(([k,label])=>`<article><span>${counts[k]||0}</span><div><b>${esc(label)}</b><small>registro(s)</small></div></article>`).join('')}</div>
 <section class="panel"><div class="med-panel-head"><div><h3>Estudantes para acompanhamento</h3><p>Ordenados pelos registros que pedem atenção.</p></div><span class="content-pending-pill">${students.length} estudante(s)</span></div>
 ${students.length?'<div class="signal-student-grid">'+students.map(s=>`<button data-student="${s.id}"><span class="attention-avatar">${esc((s.name||'?').slice(0,1).toUpperCase())}</span><span><b>${esc(s.name)}</b><small>${esc(s.discipline||'Sem disciplina')}</small>${signalTags(s)}</span><i>›</i></button>`).join('')+'</div>':empty('🌷','Nenhum sinal ativo','Quando você registrar sinais de acompanhamento, eles aparecem aqui.')}</section>`;
}
function activitiesView(){
 const list=[...state.activities].sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))),pending=list.filter(x=>x.status!=='concluida'),late=pending.filter(x=>activityState(x)==='late');
 return `
 <div class="med-section-head"><div><h2>📌 Atividades e prazos</h2><p>Calendário operacional da mediação: entregas, avaliações, avisos e ações importantes.</p></div><button class="primary" id="medAddActivity">＋ Novo prazo</button></div>
 <div class="ops-stats"><article><b>${pending.length}</b><small>pendentes</small></article><article><b>${late.length}</b><small>atrasados</small></article><article><b>${list.filter(x=>x.status==='concluida').length}</b><small>concluídos</small></article></div>
 <section class="panel">${list.length?'<div class="activity-list">'+list.map(a=>`<article class="activity-card ${activityState(a)}"><div class="activity-date"><span>${a.dueDate?new Date(a.dueDate+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit'}):'—'}</span><small>${a.dueDate?new Date(a.dueDate+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}):'sem data'}</small></div><div><div class="activity-meta"><span>${esc(a.type||'Atividade')}</span><span>${esc(a.discipline||'Geral')}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.notes||'')}</p></div><div class="activity-actions"><button class="tiny" data-activity-toggle="${a.id}">${a.status==='concluida'?'Reabrir':'Concluir'}</button><button class="tiny" data-activity-edit="${a.id}">Editar</button><button class="tiny danger-text" data-activity-delete="${a.id}">Excluir</button></div></article>`).join('')+'</div>':empty('📌','Nenhum prazo cadastrado','Adicione atividades, avaliações, avisos ou prazos que você precisa acompanhar.')}</section>`;
}
function meetingsView(){
 const list=[...state.meetings].sort((a,b)=>new Date(a.at||'2999')-new Date(b.at||'2999'));
 return `
 <div class="med-section-head"><div><h2>🗓️ Plantões e encontros</h2><p>Organize orientação, plantão de dúvidas, webconferência e outros encontros pedagógicos.</p></div><button class="primary" id="medAddMeeting">＋ Novo encontro</button></div>
 <section class="panel">${list.length?'<div class="meeting-list">'+list.map(m=>`<article class="meeting-card ${m.status||'agendado'}"><div class="meeting-icon">🗓️</div><div><span class="meeting-status">${m.status==='concluido'?'Concluído':m.status==='cancelado'?'Cancelado':'Agendado'}</span><h3>${esc(m.title)}</h3><p>${fmtDate(m.at,true)} · ${esc(m.discipline||'Geral')} · ${esc(m.provider||'Outro')}</p>${m.notes?`<small>${esc(m.notes)}</small>`:''}</div><div class="meeting-actions">${m.url?`<button class="tiny" data-meeting-open="${m.id}">Abrir ↗</button>`:''}<button class="tiny" data-meeting-toggle="${m.id}">${m.status==='concluido'?'Reabrir':'Concluir'}</button><button class="tiny" data-meeting-edit="${m.id}">Editar</button></div></article>`).join('')+'</div>':empty('🗓️','Nenhum encontro registrado','Cadastre plantões, orientações e webconferências para manter o histórico organizado.')}</section>`;
}
function communicationsView(){
 return `
 <div class="med-section-head"><div><h2>✉️ Comunicação e modelos</h2><p>Mensagens reutilizáveis para acolhimento, prazos, feedback e acompanhamento.</p></div><button class="primary" id="medAddTemplate">＋ Novo modelo</button></div>
 <section class="communication-builder panel"><div class="med-panel-head"><div><h3>Montar mensagem</h3><p>Escolha um modelo, personalize e copie para o canal que você utiliza.</p></div></div><div class="comm-builder-grid"><label>Modelo<select id="commTemplateSelect"><option value="">Começar em branco</option>${state.templates.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></label><label>Nome do estudante<input id="commStudentName" placeholder="Ex.: Maria"></label><label>Atividade/assunto<input id="commActivity" placeholder="Ex.: Atividade Dissertativa"></label><label class="comm-full">Observação<input id="commObservation" placeholder="Ponto de melhoria, orientação ou contexto"></label><label class="comm-full">Mensagem<textarea id="commMessage" rows="7"></textarea></label><div class="comm-full med-actions"><button class="soft" id="commCopy">Copiar mensagem</button><button class="soft" id="commSaveHistory">Registrar como comunicação realizada</button></div></div></section>
 <div class="template-grid">${state.templates.map(t=>`<article class="template-card"><span>${esc(t.category||'Modelo')}</span><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p><div><button class="tiny" data-template-use="${t.id}">Usar</button><button class="tiny" data-template-edit="${t.id}">Editar</button>${!String(t.id).startsWith('tpl-')?`<button class="tiny danger-text" data-template-delete="${t.id}">Excluir</button>`:''}</div></article>`).join('')}</div>`;
}
function historyView(){
 const items=historyItems();
 return `
 <div class="med-section-head"><div><h2>🕘 Histórico da mediação</h2><p>Linha do tempo das ações registradas no Studio.</p></div><span class="content-pending-pill">${items.length} registro(s)</span></div>
 <section class="panel">${items.length?'<div class="med-timeline">'+items.map(x=>`<article><div class="timeline-dot"></div><div><small>${fmtDate(x.at,true)}</small><h4>${x.icon} ${esc(x.title)}</h4><p><b>${esc(x.meta||'')}</b></p>${x.text?`<p>${esc(x.text)}</p>`:''}</div></article>`).join('')+'</div>':empty('🕘','Histórico vazio','Intervenções, atividades e encontros aparecerão aqui conforme forem registrados.')}</section>`;
}
function reportData(){
 const students=state.students,ints=state.interventions;
 const c=counts(),disc=disciplines();
 return{c,disc,students,ints}
}
function reportText(){
 const {c,disc,ints}=reportData();
 const byType={};ints.forEach(x=>byType[x.type]=(byType[x.type]||0)+1);
 const typeText=Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v} ${k.toLowerCase()}`).join(', ');
 const parts=[
  `No período registrado no Keise Studio, foram acompanhados ${c.total} estudante(s)${disc.length?' em '+disc.length+' disciplina(s)/contexto(s)':''}.`,
  c.attention?`${c.attention} estudante(s) apresentam sinais de atenção ou acompanhamento pendente, definidos a partir dos registros realizados pela mediação.`:'',
  c.waiting?`${c.waiting} estudante(s) estão com retorno aguardado.`:'',
  c.reengaged?`${c.reengaged} estudante(s) foram marcados como reengajados após acompanhamento.`:'',
  ints.length?`Foram registradas ${ints.length} intervenção(ões) pedagógica(s)${typeText?', incluindo '+typeText:''}.`:'',
  'Os registros têm finalidade de organização do acompanhamento pedagógico e devem ser interpretados em conjunto com o contexto de cada estudante.'
 ].filter(Boolean);
 return parts.join(' ');
}
function contentSupportView(){
 const items=contentSupportItems(),pending=items.filter(x=>!x._reviewed).length;
 return `
 <div class="med-section-head"><div><h2>💬 Dúvidas do conteúdo</h2><p>Fila contextual do Learning: projeto, tela, vídeo e ponto exato da experiência.</p></div><div class="med-actions"><span class="content-pending-pill">${pending} para revisar</span><button class="soft" id="medExportContent">Exportar fila</button></div></div>
 <section class="content-support-note">ℹ️ Nesta fase, esta fila lê registros locais do próprio navegador. Quando o conector online estiver ativo, a mesma estrutura poderá receber dúvidas enviadas de outros dispositivos em tempo real.</section>
 <section class="panel">
 ${items.length?`<div class="content-support-list">${items.map(item=>`<article class="content-support-item ${item._reviewed?'reviewed':''}"><div class="content-support-top"><div><span class="content-kind">${contentKindLabel(item)}</span><h3>${esc(item.projectTitle||'Projeto Learning')}</h3><p>${esc(contentContextText(item))}</p></div><time>${fmtDate(item.createdAt,true)}</time></div>${item.kind!=='signal'?'<blockquote>'+esc(item.message||'Sem mensagem')+'</blockquote>':'<div class="content-signal">'+esc(contentKindLabel(item))+'</div>'}<div class="content-support-actions"><button class="tiny" data-content-copy="${esc(item.id)}">Copiar contexto</button><button class="tiny" data-content-review="${esc(item.id)}">${item._reviewed?'Reabrir':'Marcar revisada'}</button></div></article>`).join('')}</div>`:empty('💬','Nenhuma dúvida contextual registrada','Quando uma experiência Learning registrar dúvida, comentário ou sinal local, ele aparece aqui.')}</section>`;
}
function reportsView(){
 return `
 <div class="med-section-head"><div><h2>📑 Relatórios da mediação</h2><p>Geração local a partir do que você registrou no Studio.</p></div><div class="med-actions"><button class="soft" id="medExportBtn">Exportar dados</button><button class="soft" id="medImportBtn">Importar backup</button></div></div>
 <section class="med-report-card">
  <div class="med-report-top"><span>✨</span><div><b>Resumo de acompanhamento</b><small>Você pode editar o texto depois de copiar ou salvar.</small></div></div>
  <textarea id="medReportText" readonly>${esc(reportText())}</textarea>
  <div class="med-report-actions"><button class="soft" id="medCopyReport">Copiar relatório</button><button class="primary" id="medSaveReport">Salvar .txt</button></div>
 </section>
 <div class="med-grid-2">
  <section class="panel"><h3>Indicadores do período registrado</h3><div class="med-mini-grid">${Object.entries({Acompanhados:counts().total,'Com sinais/retorno':counts().attention,'Aguardando retorno':counts().waiting,Reengajados:counts().reengaged,Intervenções:counts().interventions}).map(([k,v])=>`<div><b>${v}</b><small>${k}</small></div>`).join('')}</div></section>
  <section class="panel"><h3>Privacidade e uso responsável</h3><p class="med-note">Use apenas dados necessários ao acompanhamento. Evite registrar informações sensíveis que não sejam indispensáveis. “Sinais de atenção” são registros de acompanhamento, não diagnósticos nem rótulos permanentes.</p></section>
 </div>
 <input type="file" id="medImportFile" accept=".json,application/json" hidden>`;
}
function empty(icon,title,text){return `<div class="med-empty"><div><span>${icon}</span><b>${title}</b><p>${text}</p></div></div>`}

function shell(){
 const contentCount=contentSupportItems().filter(x=>!x._reviewed).length,attention=state.students.filter(needsAttention).length,activityPending=state.activities.filter(x=>x.status!=='concluida').length,meetingPending=upcomingMeetings().length;
 const nav=[
  ['overview','☀️','Hoje','prioridades'],
  ['students','👩‍🎓','Estudantes',state.students.length+' acompanhados'],
  ['signals','⚠️','Sinais',attention+' atenção'],
  ['activities','📌','Atividades',activityPending+' pendentes'],
  ['followups','💬','Intervenções',state.interventions.length+' registros'],
  ['content','🎬','Dúvidas do conteúdo',contentCount+' novas'],
  ['meetings','🗓️','Plantões',meetingPending+' agendados'],
  ['communications','✉️','Comunicação',state.templates.length+' modelos'],
  ['reports','📑','Relatórios','evidências'],
  ['history','🕘','Histórico',historyItems().length+' eventos']
 ];
 return `
 <div class="med-command-nav">${nav.map(([k,icon,label,meta])=>`<button class="${tab===k?'active':''}" data-tab="${k}"><span>${icon}</span><div><b>${label}</b><small>${meta}</small></div></button>`).join('')}</div>
 <div id="mediationBody">${tab==='overview'?overview():tab==='students'?studentsView():tab==='signals'?signalsView():tab==='activities'?activitiesView():tab==='followups'?followupsView():tab==='content'?contentSupportView():tab==='meetings'?meetingsView():tab==='communications'?communicationsView():tab==='history'?historyView():reportsView()}</div>
 <dialog class="dialog med-dialog" id="medStudentDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medStudentDialogBody"></div></dialog>
 <dialog class="dialog med-dialog" id="medInterventionDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medInterventionDialogBody"></div></dialog>
 <dialog class="dialog med-dialog" id="medActivityDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medActivityDialogBody"></div></dialog>
 <dialog class="dialog med-dialog" id="medMeetingDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medMeetingDialogBody"></div></dialog>
 <dialog class="dialog med-dialog" id="medTemplateDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medTemplateDialogBody"></div></dialog>`;
}
function render(){
 if(!root)return;root.innerHTML=shell();bind();
}
function bind(){
 $$('[data-tab]',root).forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
 $$('[data-add-student]',root).forEach(b=>b.onclick=()=>openStudentForm());
 $$('[data-student]',root).forEach(b=>b.onclick=()=>openStudent(b.dataset.student));
 $$('[data-med-close]',root).forEach(b=>b.onclick=()=>b.closest('dialog').close());
 const sf=$('#medStatusFilter',root);if(sf)sf.onchange=()=>{filterStatus=sf.value;render()};
 const df=$('#medDisciplineFilter',root);if(df)df.onchange=()=>{filterDiscipline=df.value;render()};
 const copy=$('#medCopyReport',root);if(copy)copy.onclick=async()=>{await navigator.clipboard.writeText($('#medReportText',root).value);toast('Relatório copiado.')};
 const saveBtn=$('#medSaveReport',root);if(saveBtn)saveBtn.onclick=()=>download('relatorio-mediacao-keise-studio.txt',$('#medReportText',root).value,'text/plain;charset=utf-8');
 const reportType=$('#medReportType',root);if(reportType)reportType.onchange=()=>{$('#medReportText',root).value=reportText(reportType.value)};
 const exp=$('#medExportBtn',root);if(exp)exp.onclick=exportData;
 const imp=$('#medImportBtn',root),file=$('#medImportFile',root);if(imp&&file){imp.onclick=()=>file.click();file.onchange=()=>importData(file.files?.[0])}
 $$('[data-content-copy]',root).forEach(b=>b.onclick=async()=>{const item=contentSupportItems().find(x=>x.id===b.dataset.contentCopy);if(!item)return;const text=[contentKindLabel(item),contentContextText(item),item.message||''].filter(Boolean).join('\n');await navigator.clipboard.writeText(text);toast('Contexto copiado.')});
 $$('[data-content-review]',root).forEach(b=>b.onclick=()=>{const map=contentStatusMap(),id=b.dataset.contentReview;map[id]=!map[id];saveContentStatus(map);render()});
 const expContent=$('#medExportContent',root);if(expContent)expContent.onclick=()=>download('keise-studio-duvidas-contextuais.json',JSON.stringify({schema:'keise-learning/support-queue-v1',exportedAt:new Date().toISOString(),items:contentSupportItems()},null,2),'application/json;charset=utf-8');

 $('#medAddActivity',root)?.addEventListener('click',()=>openActivityForm());
 $$('[data-activity-edit]',root).forEach(b=>b.onclick=()=>openActivityForm(state.activities.find(x=>x.id===b.dataset.activityEdit)));
 $$('[data-activity-toggle]',root).forEach(b=>b.onclick=()=>{state.activities=state.activities.map(x=>x.id===b.dataset.activityToggle?{...x,status:x.status==='concluida'?'pendente':'concluida',updatedAt:new Date().toISOString()}:x);save();render()});
 $$('[data-activity-delete]',root).forEach(b=>b.onclick=()=>{if(!confirm('Excluir este prazo?'))return;state.activities=state.activities.filter(x=>x.id!==b.dataset.activityDelete);save();render()});

 $('#medAddMeeting',root)?.addEventListener('click',()=>openMeetingForm());
 $$('[data-meeting-edit]',root).forEach(b=>b.onclick=()=>openMeetingForm(state.meetings.find(x=>x.id===b.dataset.meetingEdit)));
 $$('[data-meeting-toggle]',root).forEach(b=>b.onclick=()=>{state.meetings=state.meetings.map(x=>x.id===b.dataset.meetingToggle?{...x,status:x.status==='concluido'?'agendado':'concluido',updatedAt:new Date().toISOString()}:x);save();render()});
 $$('[data-meeting-open]',root).forEach(b=>b.onclick=()=>{const m=state.meetings.find(x=>x.id===b.dataset.meetingOpen);if(!m?.url)return;if(/^https?:\/\//i.test(m.url))window.open(m.url,'_blank','noopener')});

 $('#medAddTemplate',root)?.addEventListener('click',()=>openTemplateForm());
 $$('[data-template-edit]',root).forEach(b=>b.onclick=()=>openTemplateForm(state.templates.find(x=>x.id===b.dataset.templateEdit)));
 $$('[data-template-delete]',root).forEach(b=>b.onclick=()=>{state.templates=state.templates.filter(x=>x.id!==b.dataset.templateDelete);save();render()});
 $$('[data-template-use]',root).forEach(b=>b.onclick=()=>{const select=$('#commTemplateSelect',root);if(select){select.value=b.dataset.templateUse;fillCommunicationFromTemplate(b.dataset.templateUse);window.scrollTo({top:0,behavior:'smooth'})}});
 const templateSelect=$('#commTemplateSelect',root);if(templateSelect)templateSelect.onchange=()=>fillCommunicationFromTemplate(templateSelect.value);
 for(const sel of ['#commStudentName','#commActivity','#commObservation']){const n=$(sel,root);if(n)n.oninput=()=>fillCommunicationFromTemplate(templateSelect?.value||'')}
 $('#commCopy',root)?.addEventListener('click',async()=>{const msg=$('#commMessage',root)?.value||'';await navigator.clipboard.writeText(msg);toast('Mensagem copiada.')});
 $('#commSaveHistory',root)?.addEventListener('click',registerCommunication);
}
function openStudentForm(student=null){
 editingId=student?.id||null;
 const dlg=$('#medStudentDialog',root),body=$('#medStudentDialogBody',root);
 body.innerHTML=`
  <div class="dialog-icon">${student?'✏️':'🌱'}</div><h2>${student?'Editar estudante':'Adicionar estudante'}</h2>
  <p>Registre somente informações necessárias ao acompanhamento pedagógico.</p>
  <form id="medStudentForm">
   <label>Nome<input id="medName" required maxlength="100" value="${esc(student?.name||'')}"></label>
   <div class="med-form-grid"><label>Disciplina/contexto<input id="medDiscipline" maxlength="120" value="${esc(student?.discipline||'')}"></label><label>Turma/grupo<input id="medGroup" maxlength="80" value="${esc(student?.group||'')}"></label></div>
   <label>Referência opcional<input id="medReference" maxlength="80" placeholder="Ex.: matrícula abreviada ou identificador interno" value="${esc(student?.reference||'')}"></label>
   <div class="med-form-grid"><label>Situação<select id="medStatus">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${student?.status===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label><label>Última atividade<input id="medLastActivity" type="date" value="${student?.lastActivityAt?String(student.lastActivityAt).slice(0,10):''}"></label></div>
   <label>Próximo acompanhamento<input id="medNextFollow" type="date" value="${student?.nextFollowUpAt||''}"></label>
   <fieldset class="med-signals"><legend>Sinais de atenção</legend>${Object.entries(SIGNALS).map(([k,v])=>`<label><input type="checkbox" name="medSignal" value="${k}" ${activeSignals(student||{}).includes(k)?'checked':''}> <span>${esc(v)}</span></label>`).join('')}</fieldset>
   <label>Observação geral<textarea id="medNotes" maxlength="1500" placeholder="Contexto objetivo do acompanhamento.">${esc(student?.notes||'')}</textarea></label>
   <div class="dialog-actions"><button class="soft" type="button" data-med-close>Cancelar</button><button class="primary" type="submit">${student?'Salvar alterações':'Adicionar'}</button></div>
  </form>`;
 $$('[data-med-close]',dlg).forEach(b=>b.onclick=()=>dlg.close());
 $('#medStudentForm',dlg).onsubmit=e=>{e.preventDefault();const old=editingId?state.students.find(x=>x.id===editingId):null;const obj={id:editingId||uid('student'),name:$('#medName',dlg).value.trim(),discipline:$('#medDiscipline',dlg).value.trim(),group:$('#medGroup',dlg).value.trim(),reference:$('#medReference',dlg).value.trim(),status:$('#medStatus',dlg).value,lastActivityAt:$('#medLastActivity',dlg).value||null,nextFollowUpAt:$('#medNextFollow',dlg).value||null,signals:$$('input[name="medSignal"]:checked',dlg).map(x=>x.value),notes:$('#medNotes',dlg).value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(old)state.students=state.students.map(x=>x.id===obj.id?obj:x);else state.students.push(obj);save();dlg.close();render();toast(old?'Acompanhamento atualizado.':'Estudante adicionado.')};
 dlg.showModal();setTimeout(()=>$('#medName',dlg)?.focus(),40);
}
function openStudent(id){
 const s=state.students.find(x=>x.id===id);if(!s)return;
 const dlg=$('#medStudentDialog',root),body=$('#medStudentDialogBody',root),ints=studentInterventions(id);
 body.innerHTML=`
  <div class="med-profile-head"><div class="med-profile-avatar">${esc((s.name||'?').slice(0,1).toUpperCase())}</div><div><h2>${esc(s.name)}</h2><p>${esc(s.discipline||'Sem disciplina')}${s.group?' · '+esc(s.group):''}</p>${statusPill(s.status)}</div></div>
  <div class="med-profile-grid"><div><small>Última atividade</small><b>${fmtDate(s.lastActivityAt)}</b></div><div><small>Próximo acompanhamento</small><b>${fmtDate(s.nextFollowUpAt)}</b></div><div><small>Intervenções</small><b>${ints.length}</b></div></div>
  <section class="med-profile-section"><h3>Sinais registrados</h3>${signalTags(s)}</section>
  <section class="med-profile-section"><h3>Observação</h3><p>${esc(s.notes||'Nenhuma observação geral registrada.')}</p></section>
  <section class="med-profile-section"><div class="med-panel-head"><h3>Histórico</h3><button class="tiny" id="medAddIntervention">＋ Registrar intervenção</button></div>
   ${ints.length?'<div class="intervention-list">'+ints.slice(0,8).map(x=>`<div class="intervention-row"><span>💬</span><div><b>${esc(x.type)}</b><small>${esc(x.channel)} · ${fmtDate(x.at,true)}</small><p>${esc(x.note||'Sem observação')}</p></div></div>`).join('')+'</div>':empty('💬','Sem histórico ainda','Registre a primeira intervenção quando houver uma ação de acompanhamento.')}
  </section>
  <div class="dialog-actions"><button class="soft" id="medDeleteStudent" type="button">Excluir</button><button class="soft" id="medEditStudent" type="button">Editar</button><button class="primary" type="button" data-med-close>Fechar</button></div>`;
 $$('[data-med-close]',dlg).forEach(b=>b.onclick=()=>dlg.close());
 $('#medEditStudent',dlg).onclick=()=>{dlg.close();openStudentForm(s)};
 $('#medAddIntervention',dlg).onclick=()=>openIntervention(s);
 $('#medDeleteStudent',dlg).onclick=()=>{if(!confirm('Excluir este estudante e o histórico de intervenções deste navegador?'))return;state.students=state.students.filter(x=>x.id!==s.id);state.interventions=state.interventions.filter(x=>x.studentId!==s.id);save();dlg.close();render();toast('Registro local excluído.')};
 dlg.showModal();
}
function openIntervention(student){
 const dlg=$('#medInterventionDialog',root),body=$('#medInterventionDialogBody',root);
 body.innerHTML=`
  <div class="dialog-icon">💬</div><h2>Registrar intervenção</h2><p><b>${esc(student.name)}</b> · registre a ação realizada e, se houver, o resultado observado.</p>
  <form id="medInterventionForm">
   <div class="med-form-grid"><label>Data e hora<input id="medInterventionAt" type="datetime-local" required></label><label>Canal<select id="medChannel">${CHANNELS.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label></div>
   <label>Tipo de ação<select id="medType">${TYPES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
   <label>Registro da intervenção<textarea id="medInterventionNote" maxlength="1500" required placeholder="Ex.: enviado lembrete individual sobre prazo e orientação para localizar a atividade."></textarea></label>
   <label>Resultado/retorno<textarea id="medOutcome" maxlength="1000" placeholder="Ex.: estudante respondeu e informou que fará o envio até amanhã."></textarea></label>
   <label>Atualizar situação do estudante<select id="medNewStatus"><option value="">Manter situação atual</option>${Object.entries(STATUS).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>
   <div class="dialog-actions"><button class="soft" type="button" data-med-close>Cancelar</button><button class="primary" type="submit">Salvar intervenção</button></div>
  </form>`;
 const d=new Date(),local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);$('#medInterventionAt',dlg).value=local;
 $$('[data-med-close]',dlg).forEach(b=>b.onclick=()=>dlg.close());
 $('#medInterventionForm',dlg).onsubmit=e=>{e.preventDefault();state.interventions.push({id:uid('int'),studentId:student.id,at:new Date($('#medInterventionAt',dlg).value).toISOString(),channel:$('#medChannel',dlg).value,type:$('#medType',dlg).value,note:$('#medInterventionNote',dlg).value.trim(),outcome:$('#medOutcome',dlg).value.trim(),createdAt:new Date().toISOString()});const ns=$('#medNewStatus',dlg).value;if(ns)state.students=state.students.map(x=>x.id===student.id?{...x,status:ns,updatedAt:new Date().toISOString()}:x);save();dlg.close();render();toast('Intervenção registrada.');};
 dlg.showModal();
}
function download(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportData(){download('keise-studio-mediacao-backup.json',JSON.stringify({schema:'keise-studio/mediation-v1',exportedAt:new Date().toISOString(),data:state},null,2),'application/json;charset=utf-8');toast('Backup da Mediação salvo.')}
async function importData(file){
 if(!file)return;try{const payload=JSON.parse(await file.text());if(payload?.schema!=='keise-studio/mediation-v1'||payload?.data?.version!==1)throw new Error('Arquivo incompatível.');if(!confirm('Importar este backup substituirá os dados locais atuais da Mediação neste navegador. Continuar?'))return;state=payload.data;save();render();toast('Backup importado.')}catch(e){alert('Não foi possível importar: '+e.message)}
}
function mount(target){root=target;render()}
window.KeiseMediation=Object.freeze({mount,exportState:()=>JSON.parse(JSON.stringify(state)),showTab(name){if(['overview','students','followups','content','reports'].includes(name))tab=name;if(root)render();},showStudent(id){tab='students';if(root){render();setTimeout(()=>openStudent(id),0);}}});
})();