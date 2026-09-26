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

function blank(){return{version:1,students:[],interventions:[],updatedAt:null}}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&x.version===1?x:blank()}catch{return blank()}}
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
 return `
 <div class="med-tabs" role="tablist">
  <button class="${tab==='overview'?'active':''}" data-tab="overview">Hoje</button>
  <button class="${tab==='students'?'active':''}" data-tab="students">Estudantes</button>
  <button class="${tab==='followups'?'active':''}" data-tab="followups">Intervenções</button>
  <button class="${tab==='reports'?'active':''}" data-tab="reports">Relatórios</button>
 </div>
 <div id="mediationBody">${tab==='overview'?overview():tab==='students'?studentsView():tab==='followups'?followupsView():reportsView()}</div>
 <dialog class="dialog med-dialog" id="medStudentDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medStudentDialogBody"></div></dialog>
 <dialog class="dialog med-dialog" id="medInterventionDialog"><button class="dialog-close" type="button" data-med-close>×</button><div id="medInterventionDialogBody"></div></dialog>`;
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
 const exp=$('#medExportBtn',root);if(exp)exp.onclick=exportData;
 const imp=$('#medImportBtn',root),file=$('#medImportFile',root);if(imp&&file){imp.onclick=()=>file.click();file.onchange=()=>importData(file.files?.[0])}
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
window.KeiseMediation=Object.freeze({mount,exportState:()=>JSON.parse(JSON.stringify(state)),showTab(name){if(['overview','students','followups','reports'].includes(name))tab=name;if(root)render();},showStudent(id){tab='students';if(root){render();setTimeout(()=>openStudent(id),0);}}});
})();