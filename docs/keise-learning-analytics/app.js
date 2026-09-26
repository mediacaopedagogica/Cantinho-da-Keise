'use strict';
(()=>{
const STORAGE_KEY='keise-learning-analytics-v1';
const PROJECTS=[
 {id:'missao-circular',name:'Missão Circular',discipline:'Design e Sustentabilidade',type:'Dinâmica interativa',accent:'#ef77a8',icon:'♻️'},
 {id:'tours-virtuais',name:'Tours Virtuais',discipline:'Mercado e Operações Imobiliárias',type:'Atividade e fórum',accent:'#9277df',icon:'🥽'},
 {id:'escritorio-360',name:'Escritório em Ação 360º',discipline:'Prática Profissional em Design de Interiores',type:'Simulador 360º',accent:'#58bea5',icon:'🏠'}
];
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let state=loadState(),currentView='overview';

function blankState(){return{version:1,events:[],imports:[],lastUpdate:null};}
function loadState(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return x&&x.version===1?x:blankState()}catch{return blankState()}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600)}
function fmt(n,d=0){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(n)||0)}
function dateFmt(v){if(!v)return'—';try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(prefix='evt'){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function participantKey(e){return String(e.participantId||e.participantName||'').trim().toLowerCase()}
function isMediator(e){return e.actorRole==='mediator'||/mediação pedagógica|mediadora pedagógica/i.test(e.participantName||'')}
function periodStart(){
 const p=$('#periodFilter').value,now=new Date();
 if(p==='all')return null;if(p==='7'||p==='30')return new Date(now.getTime()-Number(p)*864e5);
 if(p==='semester'){const month=now.getMonth(),startMonth=month<6?0:6;return new Date(now.getFullYear(),startMonth,1);}
 return null;
}
function filteredEvents(){
 const project=$('#projectFilter').value,start=periodStart();
 return state.events.filter(e=>(project==='all'||e.projectId===project)&&(!start||new Date(e.at)>=start));
}
function metrics(events){
 const learners=events.filter(e=>!isMediator(e)&&participantKey(e));
 const people=new Set(learners.map(participantKey));
 const sessions=new Set(learners.map(e=>e.sessionId).filter(Boolean));
 const completions=events.filter(e=>e.type==='completion'&&!isMediator(e));
 const starts=events.filter(e=>e.type==='start'&&!isMediator(e));
 const interactions=events.filter(e=>['interaction','stage','comment','reply','hint','attempt'].includes(e.type));
 const feedback=events.filter(e=>e.type==='feedback'&&Number.isFinite(Number(e.rating)));
 const scores=events.filter(e=>e.type==='score'&&Number(e.maxScore)>0);
 const byPerson=new Map();learners.forEach(e=>{const k=participantKey(e);if(!k)return;const set=byPerson.get(k)||new Set();if(e.sessionId)set.add(e.sessionId);byPerson.set(k,set)});
 const returns=[...byPerson.values()].filter(s=>s.size>1).length;
 return{
  participants:people.size,sessions:sessions.size||events.filter(e=>e.type==='session').length,
  starts:starts.length,completions:completions.length,interactions:interactions.length,
  completionRate:starts.length?completions.length/starts.length*100:null,
  satisfaction:feedback.length?feedback.reduce((a,b)=>a+Number(b.rating),0)/feedback.length:null,
  feedbacks:feedback.length,comments:events.filter(e=>e.type==='comment'||e.type==='reply').length,
  avgScore:scores.length?scores.reduce((a,b)=>a+(Number(b.score)/Number(b.maxScore)*100),0)/scores.length:null,
  returns
 };
}
function projectEvents(id,events=filteredEvents()){return events.filter(e=>e.projectId===id)}
function projectMetric(id){return metrics(projectEvents(id))}
function hasData(id){return state.events.some(e=>e.projectId===id)}
function pct(v){return v==null?'—':fmt(v,1)+'%'}
function satisfaction(v){return v==null?'—':fmt(v,1)+' / 5'}

function setupFilters(){
 const sel=$('#projectFilter');PROJECTS.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.append(o)});
 sel.onchange=render;$('#periodFilter').onchange=render;$('#resetFilters').onclick=()=>{sel.value='all';$('#periodFilter').value='all';render()};
}
function metricCards(m){
 const cards=[
  ['pink','Projetos monitorados',PROJECTS.filter(p=>hasData(p.id)).length,'com dados importados','📁'],
  ['lav','Participantes únicos',m.participants,'pessoas diferentes','👥'],
  ['mint','Sessões',m.sessions,'utilizações identificadas','💻'],
  ['blue','Conclusões',m.completions,m.completionRate==null?'sem taxa calculável':pct(m.completionRate)+' de conclusão','🎓'],
  ['yellow','Interações',m.interactions,'ações pedagógicas registradas','💬'],
  ['peach','Satisfação média',m.satisfaction==null?'—':fmt(m.satisfaction,1)+' / 5',m.feedbacks+' avaliações','⭐']
 ];
 return '<div class="cards">'+cards.map(c=>`<article class="metric-card ${c[0]}"><div class="metric-label">${c[1]}</div><div class="metric-value">${c[2]}</div><div class="metric-sub">${c[3]}</div><div class="metric-icon">${c[4]}</div></article>`).join('')+'</div>';
}
function projectBars(events){
 const rows=PROJECTS.map((p,i)=>({p,m:metrics(projectEvents(p.id,events)),cls:['pink','lav','mint','blue'][i]}));
 const max=Math.max(1,...rows.map(x=>x.m.participants));
 return rows.every(x=>x.m.participants===0)?empty('📊','Ainda não há participantes importados','Quando você importar os primeiros dados, este gráfico aparecerá automaticamente.'):
 '<div class="project-bars">'+rows.map(x=>`<div class="bar-row"><b>${esc(x.p.name)}</b><div class="bar-track"><div class="bar-fill ${x.cls}" style="width:${x.m.participants/max*100}%"></div></div><span class="bar-value">${x.m.participants}</span></div>`).join('')+'</div>';
}
function completionPanel(m){
 if(m.starts===0&&m.completions===0)return empty('🎓','Taxa ainda indisponível','Precisamos de eventos de início e conclusão para calcular essa métrica.');
 const rate=m.completionRate??0,not=Math.max(0,m.starts-m.completions);
 return `<div class="donut-wrap"><div class="donut" style="--pct:${Math.min(100,rate)}%"><strong>${fmt(rate,0)}%</strong></div><div class="legend"><span><i class="dot" style="background:#66cbb1"></i>Concluídos: <b>${m.completions}</b></span><span><i class="dot" style="background:#79acef"></i>Em andamento/não concluídos: <b>${not}</b></span><span><i class="dot" style="background:#f5b3c8"></i>Inícios registrados: <b>${m.starts}</b></span></div></div>`;
}
function feedbackPanel(events){
 const fs=events.filter(e=>e.type==='feedback'&&Number.isFinite(Number(e.rating)));
 if(!fs.length)return empty('💜','Ainda não há feedbacks importados','As avaliações dos projetos aparecerão aqui quando forem exportadas.');
 const buckets=[5,4,3,2,1].map(n=>fs.filter(x=>Math.round(Number(x.rating))===n).length);
 const labels=['Excelente','Muito bom','Bom','Cansativo','Ruim'];
 return '<div class="feedback-grid">'+labels.map((l,i)=>`<div class="mood"><span>${['😍','😊','🙂','😮‍💨','😕'][i]}</span><b>${fs.length?Math.round(buckets[i]/fs.length*100):0}%</b><span>${l}</span></div>`).join('')+'</div>';
}
function empty(icon,title,text){return `<div class="empty"><div><span>${icon}</span><strong>${title}</strong><p>${text}</p></div></div>`}

function overview(){
 const events=filteredEvents(),m=metrics(events);
 return metricCards(m)+`
 <div class="grid-3">
  <section class="panel"><div class="panel-header"><h2>📊 Projetos por participantes</h2><button data-view-jump="projects">Ver todos →</button></div>${projectBars(events)}</section>
  <section class="panel"><div class="panel-header"><h2>🌱 Engajamento</h2><button data-view-jump="engagement">Ver detalhes →</button></div>
   ${m.interactions?'<div class="big-number">'+fmt(m.interactions)+'</div><p class="metric-sub">interações pedagógicas registradas no período</p><div class="project-bars" style="margin-top:18px">'+PROJECTS.map((p,i)=>{const x=projectMetric(p.id);const max=Math.max(1,...PROJECTS.map(q=>projectMetric(q.id).interactions));return `<div class="bar-row"><b>${esc(p.name)}</b><div class="bar-track"><div class="bar-fill ${['pink','lav','mint'][i]}" style="width:${x.interactions/max*100}%"></div></div><span class="bar-value">${x.interactions}</span></div>`}).join('')+'</div>':empty('✨','Sem interações ainda','Comentários, etapas, dicas e outras ações relevantes aparecerão aqui.')}
  </section>
  <section class="panel"><div class="panel-header"><h2>🎓 Taxa de conclusão</h2></div>${completionPanel(m)}</section>
 </div>
 <div class="grid-2">
  <section class="panel"><div class="panel-header"><h2>📁 Projetos iniciais</h2><button data-view-jump="projects">Detalhes →</button></div>${projectTable(events)}</section>
  <section class="panel"><div class="panel-header"><h2>💜 Feedbacks dos participantes</h2><button data-view-jump="feedback">Ver todos →</button></div>${feedbackPanel(events)}</section>
 </div>`;
}
function projectTable(events){
 return `<div class="table-wrap"><table><thead><tr><th>Projeto</th><th>Participantes</th><th>Sessões</th><th>Conclusões</th><th>Satisfação</th><th>Status</th></tr></thead><tbody>${PROJECTS.map(p=>{const m=metrics(projectEvents(p.id,events)),has=hasData(p.id);return `<tr><td><b>${p.icon} ${esc(p.name)}</b><br><small>${esc(p.discipline)}</small></td><td>${m.participants}</td><td>${m.sessions}</td><td>${m.completions}</td><td>${satisfaction(m.satisfaction)}</td><td><span class="pill ${has?'green':'yellow'}">${has?'Com dados':'Aguardando dados'}</span></td></tr>`}).join('')}</tbody></table></div>`;
}
function projectsView(){
 const events=filteredEvents();
 return `<div class="section-title"><div><h2>Projetos monitorados</h2><p>Os projetos continuam independentes; somente os dados exportados chegam aqui.</p></div><span class="spark-note">Cada projeto conta uma história ♡</span></div>
 <div class="project-grid">${PROJECTS.map(p=>{const m=metrics(projectEvents(p.id,events)),has=hasData(p.id);return `<article class="project-card" style="--accent:${p.accent}"><span style="font-size:31px">${p.icon}</span><h3>${esc(p.name)}</h3><p>${esc(p.discipline)} · ${esc(p.type)}</p><span class="project-status ${has?'':'empty-status'}">${has?'Dados disponíveis':'Aguardando primeira importação'}</span><div class="project-mini"><div><b>${m.participants}</b><small>participantes</small></div><div><b>${m.sessions}</b><small>sessões</small></div><div><b>${m.completions}</b><small>conclusões</small></div></div></article>`}).join('')}</div>
 <section class="panel"><div class="panel-header"><h2>Resumo comparativo</h2></div>${projectTable(events)}</section>`;
}
function participantsView(){
 const events=filteredEvents().filter(e=>!isMediator(e)&&participantKey(e));
 const map=new Map();
 events.forEach(e=>{const k=participantKey(e);if(!k)return;const x=map.get(k)||{name:e.participantName||e.participantId,projects:new Set(),sessions:new Set(),events:0,last:null};x.projects.add(e.projectId);if(e.sessionId)x.sessions.add(e.sessionId);x.events++;if(!x.last||new Date(e.at)>new Date(x.last))x.last=e.at;map.set(k,x)});
 const rows=[...map.values()].sort((a,b)=>new Date(b.last)-new Date(a.last));
 return `<div class="section-title"><div><h2>Participantes</h2><p>Somente participantes presentes nos arquivos importados.</p></div><div class="big-number">${rows.length}</div></div>
 <section class="panel">${rows.length?`<div class="table-wrap"><table><thead><tr><th>Participante</th><th>Projetos</th><th>Sessões</th><th>Registros</th><th>Última atividade</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.projects.size}</td><td>${x.sessions.size||'—'}</td><td>${x.events}</td><td>${dateFmt(x.last)}</td></tr>`).join('')}</tbody></table></div>`:empty('👥','Nenhum participante ainda','Importe dados dos projetos para formar a lista de participantes.')}</section>`;
}
function engagementView(){
 const events=filteredEvents(),m=metrics(events);
 return metricCards({...m,satisfaction:m.satisfaction})+`<div class="grid-2"><section class="panel"><div class="panel-header"><h2>Interações por projeto</h2></div>${projectBars(events.map(e=>e))}</section><section class="panel"><div class="panel-header"><h2>Retorno de participantes</h2></div>${m.participants?'<div class="big-number">'+m.returns+'</div><p class="metric-sub">participantes identificados em mais de uma sessão</p>':empty('↩️','Sem dados de retorno','Precisamos de IDs de sessão para identificar quem voltou.')}</section></div>`;
}
function learningView(){
 const events=filteredEvents(),m=metrics(events);
 return `<div class="section-title"><div><h2>Aprendizagem</h2><p>Indicadores derivados apenas de atividades que realmente registram desempenho.</p></div><span class="spark-note">Nada de inventar resultado ✨</span></div>
 <div class="cards" style="grid-template-columns:repeat(4,minmax(0,1fr))"><article class="metric-card blue"><div class="metric-label">Pontuação média</div><div class="metric-value">${m.avgScore==null?'—':fmt(m.avgScore,1)+'%'}</div><div class="metric-sub">somente eventos com pontuação e máximo</div><div class="metric-icon">🧠</div></article><article class="metric-card mint"><div class="metric-label">Conclusões</div><div class="metric-value">${m.completions}</div><div class="metric-sub">${m.completionRate==null?'taxa ainda indisponível':pct(m.completionRate)}</div><div class="metric-icon">✅</div></article><article class="metric-card yellow"><div class="metric-label">Tentativas</div><div class="metric-value">${events.filter(e=>e.type==='attempt').length}</div><div class="metric-sub">eventos de tentativa registrados</div><div class="metric-icon">🎯</div></article><article class="metric-card pink"><div class="metric-label">Dicas utilizadas</div><div class="metric-value">${events.filter(e=>e.type==='hint').length}</div><div class="metric-sub">quando o projeto registra dicas</div><div class="metric-icon">💡</div></article></div>
 <section class="panel"><div class="panel-header"><h2>Desempenho por projeto</h2></div>${PROJECTS.map(p=>{const pm=metrics(projectEvents(p.id,events));return `<div class="bar-row" style="margin-bottom:12px"><b>${esc(p.name)}</b><div class="bar-track"><div class="bar-fill mint" style="width:${pm.avgScore||0}%"></div></div><span class="bar-value">${pm.avgScore==null?'—':fmt(pm.avgScore,1)+'%'}</span></div>`}).join('')}</section>`;
}
function feedbackView(){
 const events=filteredEvents(),fs=events.filter(e=>e.type==='feedback');
 return `<div class="section-title"><div><h2>Feedbacks</h2><p>Avaliações e comentários voluntários presentes nos projetos.</p></div><div class="big-number">${fs.length}</div></div>
 <section class="panel">${feedbackPanel(events)}${fs.some(x=>x.comment)?'<div style="margin-top:15px">'+fs.filter(x=>x.comment).slice(-8).reverse().map(x=>`<div class="quote">“${esc(x.comment)}”<br><small>${esc(x.participantName||'Participante')} · ${esc(PROJECTS.find(p=>p.id===x.projectId)?.name||x.projectId)} · ${dateFmt(x.at)}</small></div>`).join('')+'</div>':''}</section>`;
}
function reportText(){
 const events=filteredEvents(),m=metrics(events),project=$('#projectFilter').value==='all'?'os recursos educacionais monitorados':PROJECTS.find(p=>p.id===$('#projectFilter').value)?.name;
 const pCount=PROJECTS.filter(p=>projectEvents(p.id,events).length).length;
 const bits=[`No período analisado, ${project} registraram ${fmt(m.participants)} participante(s) único(s) e ${fmt(m.sessions)} sessão(ões) identificada(s).`];
 if(m.interactions)bits.push(`Foram registradas ${fmt(m.interactions)} interações pedagogicamente relevantes.`);
 if(m.completions)bits.push(`Houve ${fmt(m.completions)} conclusão(ões)${m.completionRate!=null?', com taxa de conclusão de '+fmt(m.completionRate,1)+'%':''}.`);
 if(m.satisfaction!=null)bits.push(`A satisfação média registrada foi de ${fmt(m.satisfaction,1)} em 5, com ${m.feedbacks} avaliação(ões).`);
 if(m.avgScore!=null)bits.push(`Nas atividades com pontuação estruturada, o desempenho médio foi de ${fmt(m.avgScore,1)}%.`);
 if(!events.length)bits.length=0,bits.push('Ainda não há dados importados para gerar um relatório.');
 return bits.join(' ');
}
function reportsView(){
 return `<div class="section-title"><div><h2>Relatórios</h2><p>Texto gerado somente a partir dos dados disponíveis neste navegador.</p></div><span class="spark-note">Dados → evidências profissionais ♡</span></div>
 <section class="report-box"><textarea id="reportText" readonly>${esc(reportText())}</textarea><div class="report-actions"><button class="secondary" id="copyReport" type="button">Copiar texto</button><button class="primary" id="downloadReport" type="button">Salvar relatório .txt</button></div></section>
 <section class="panel"><div class="panel-header"><h2>Onde você pode usar</h2></div><div class="project-mini" style="grid-template-columns:repeat(4,1fr)"><div><b>📄</b><small>Currículo</small></div><div><b>💼</b><small>LinkedIn</small></div><div><b>🗂️</b><small>Portfólio</small></div><div><b>📊</b><small>Coordenação</small></div></div></section>`;
}
function render(){
 const root=$('#viewRoot');
 const views={overview,projects:projectsView,participants:participantsView,engagement:engagementView,learning:learningView,feedback:feedbackView,reports:reportsView};
 root.innerHTML=(views[currentView]||overview)();
 $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
 $$('[data-view-jump]').forEach(b=>b.onclick=()=>switchView(b.dataset.viewJump));
 if(currentView==='reports'){
  $('#copyReport').onclick=async()=>{await navigator.clipboard.writeText($('#reportText').value);toast('Relatório copiado.')};
  $('#downloadReport').onclick=()=>downloadText('keise-learning-analytics-relatorio.txt',$('#reportText').value);
 }
 $('#lastUpdate').textContent=state.lastUpdate?'Última atualização: '+dateFmt(state.lastUpdate):'Nenhuma atualização realizada';
}
function switchView(v){currentView=v;render();window.scrollTo({top:0,behavior:'smooth'})}
function bindNav(){$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-route]').forEach(a=>a.onclick=e=>{e.preventDefault();switchView(a.dataset.route)})}

function normalizeEvent(e,defaultProject){
 if(!e||typeof e!=='object')return null;
 const projectId=String(e.projectId||defaultProject||'').trim();
 if(!PROJECTS.some(p=>p.id===projectId))return null;
 const type=String(e.type||'').trim();
 const allowed=['access','session','start','interaction','stage','comment','reply','completion','score','feedback','hint','attempt'];
 if(!allowed.includes(type))return null;
 const at=new Date(e.at||e.createdAt||Date.now());if(Number.isNaN(at.getTime()))return null;
 return{
  id:String(e.id||uid(projectId)),projectId,type,at:at.toISOString(),
  participantId:e.participantId==null?null:String(e.participantId),
  participantName:e.participantName==null?null:String(e.participantName),
  actorRole:e.actorRole||'student',
  sessionId:e.sessionId==null?null:String(e.sessionId),
  stage:e.stage==null?null:String(e.stage),
  score:e.score==null?null:Number(e.score),maxScore:e.maxScore==null?null:Number(e.maxScore),
  rating:e.rating==null?null:Number(e.rating),comment:e.comment==null?null:String(e.comment),
  value:e.value??null,metadata:e.metadata&&typeof e.metadata==='object'?e.metadata:{}
 };
}
function normalizePayload(payload,fileName=''){
 const out=[];
 if(Array.isArray(payload))payload={events:payload};
 if(payload?.schema==='keise-learning-analytics/v1'||Array.isArray(payload?.events)){
  const def=payload.project?.id||payload.projectId;for(const e of payload.events||[]){const n=normalizeEvent(e,def);if(n)out.push(n)}return out;
 }
 if(Array.isArray(payload?.comments)&&Array.isArray(payload?.ratings)){
  for(const c of payload.comments){
   const med=c.author_role==='mediator',n=normalizeEvent({id:'tours-comment-'+c.id,projectId:'tours-virtuais',type:c.parent_id?'reply':'comment',at:c.created_at,participantId:c.normalized_name||c.author_name,participantName:c.author_name,actorRole:med?'mediator':'student',metadata:{commentId:c.id,parentId:c.parent_id}},'tours-virtuais');if(n)out.push(n);
  }
  for(const r of payload.ratings){const n=normalizeEvent({id:'tours-rating-'+r.id,projectId:'tours-virtuais',type:'feedback',at:r.created_at,participantId:r.normalized_name||r.author_name,participantName:r.author_name,rating:r.stars},'tours-virtuais');if(n)out.push(n)}
  return out;
 }
 throw new Error('Formato não reconhecido em '+fileName+'.');
}
function parseCSV(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];
 const headers=splitCSV(lines[0]);return lines.slice(1).map(line=>{const vals=splitCSV(line),o={};headers.forEach((h,i)=>o[h.trim()]=vals[i]??'');return normalizeEvent(o,o.projectId)}).filter(Boolean);
}
function splitCSV(line){let a=[],cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){a.push(cur);cur=''}else cur+=c}a.push(cur);return a}

async function importFiles(files){
 let incoming=[],accepted=0,failed=[];
 for(const file of files){
  try{
   const text=await file.text();let events;
   if(file.name.toLowerCase().endsWith('.csv'))events=parseCSV(text);else events=normalizePayload(JSON.parse(text),file.name);
   if(!events.length)throw new Error('Nenhum evento válido encontrado.');
   incoming.push(...events);accepted++;
  }catch(e){failed.push(file.name+': '+e.message)}
 }
 const map=new Map(state.events.map(e=>[e.id,e]));let added=0,updated=0;
 incoming.forEach(e=>{if(map.has(e.id))updated++;else added++;map.set(e.id,e)});
 state.events=[...map.values()].sort((a,b)=>new Date(a.at)-new Date(b.at));
 state.lastUpdate=new Date().toISOString();
 state.imports.push({at:state.lastUpdate,files:[...files].map(f=>f.name),added,updated,failed});
 saveState();render();
 const msg=`${accepted} arquivo(s) processado(s) · ${added} registro(s) novo(s) · ${updated} já existente(s)`;
 $('#importStatus').textContent=failed.length?msg+' · '+failed.join(' | '):msg;
 toast(msg);
}
function downloadText(name,text,type='text/plain;charset=utf-8'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function backup(){downloadText('keise-learning-analytics-backup.json',JSON.stringify({schema:'keise-learning-analytics/backup-v1',...state},null,2),'application/json;charset=utf-8');toast('Backup salvo.')}

function setupImport(){
 const dialog=$('#importDialog'),input=$('#fileInput'),drop=$('#dropZone');
 $('#refreshButton').onclick=()=>{dialog.showModal();$('#importStatus').textContent=''};
 $('#chooseFiles').onclick=()=>input.click();input.onchange=async()=>{if(input.files?.length)await importFiles(input.files);input.value=''};
 $$('[data-close-dialog]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=async e=>{e.preventDefault();drop.classList.remove('drag');if(e.dataTransfer.files.length)await importFiles(e.dataTransfer.files)};
 $('#backupButton').onclick=backup;
}
setupFilters();bindNav();setupImport();render();
})();