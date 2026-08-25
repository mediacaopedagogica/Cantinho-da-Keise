const __bg64=(window.__BG_V19_A||'')+(window.__BG_V19_B||'');
if(__bg64){document.documentElement.style.setProperty('--office-bg',`url("data:image/webp;base64,${__bg64}")`);}

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";
const supabase=createClient("https://stsetmvuacvogbcolouo.supabase.co","sb_publishable_wrULbAYnACY62_ziencB5w_nfRqPoox");
const ACTIVITY_KEY="mercado-imobiliario-tours-utd-2025";

const PAPER_DATA = {
  study: {
    kicker:"RECORTE 01 · AMOSTRA",
    headline:"Estudo analisou quase 43 mil imóveis anunciados",
    deck:"A pesquisa usou dados de uma plataforma imobiliária para comparar propriedades com e sem tour em realidade virtual.",
    metric:"≈ 43 mil",
    metricLabel:"imóveis analisados",
    brief1:"A base reuniu imóveis anunciados entre 2018 e 2019 em uma grande plataforma do mercado imobiliário.",
    brief2:"Os pesquisadores observaram principalmente o tempo de permanência no mercado e o preço final de venda."
  },
  time: {
    kicker:"RECORTE 02 · TEMPO NO MERCADO",
    headline:"Imóveis com tour virtual ficaram, em média, 19 dias anunciados",
    deck:"Nos imóveis sem o recurso, o tempo médio registrado pela pesquisa foi de 34 dias.",
    metric:"19 x 34 dias",
    metricLabel:"com tour x sem tour",
    brief1:"A comparação mostrou uma diferença no tempo médio de permanência dos anúncios no mercado.",
    brief2:"Esse resultado foi divulgado pela University of Texas at Dallas como um dos principais achados do estudo."
  },
  price: {
    kicker:"RECORTE 03 · PREÇO DE VENDA",
    headline:"Pesquisa não identificou efeito do tour virtual sobre o preço final",
    deck:"A diferença observada no tempo de permanência não foi acompanhada por aumento no valor da venda.",
    metric:"Sem efeito",
    metricLabel:"sobre o preço final",
    brief1:"Os pesquisadores não encontraram evidência de que os imóveis com tour virtual fossem vendidos por preços maiores.",
    brief2:"Na divulgação do estudo, a realidade virtual é descrita como um recurso de informação sobre a propriedade."
  },
  info: {
    kicker:"RECORTE 04 · INFORMAÇÃO SOBRE O IMÓVEL",
    headline:"Estudo destaca o caráter informativo dos tours em realidade virtual",
    deck:"A tecnologia permite examinar os ambientes por diferentes ângulos e conhecer mais características da propriedade.",
    metric:"Mais detalhes",
    metricLabel:"sobre os ambientes",
    brief1:"A matéria institucional explica que o tour permite ao usuário olhar os cômodos em diferentes direções.",
    brief2:"Os pesquisadores também observaram resultados mais evidentes em imóveis maiores e mais novos."
  },
  agent: {
    kicker:"RECORTE 05 · AGENTE IMOBILIÁRIO",
    headline:"Pesquisa examinou a relação entre o tour virtual e as informações fornecidas pelo agente",
    deck:"A equipe investigou situações em que havia diferenças na quantidade de informação disponível sobre a propriedade.",
    metric:"Informação",
    metricLabel:"tour e atendimento",
    brief1:"A divulgação relata que a realidade virtual pode suprir informações quando o agente é menos responsivo ou oferece poucos detalhes.",
    brief2:"O estudo apresenta esse resultado como uma relação de complementaridade entre as fontes de informação."
  }
};

const VISITED_KEY="fmu_tours_shared_v19_visited";
let visited=new Set(JSON.parse(localStorage.getItem(VISITED_KEY)||"[]"));
let comments=[],ratings=[],selectedStars=0,currentKey=null;
const replyRatings={};

const tabs=[...document.querySelectorAll(".tab")];
const newsCard=document.getElementById("newsCard");
const newsClose=document.getElementById("newsClose");
const newsKicker=document.getElementById("newsKicker");
const newsHeadline=document.getElementById("newsHeadline");
const newsDeck=document.getElementById("newsDeck");
const newsMetric=document.getElementById("newsMetric");
const newsMetricLabel=document.getElementById("newsMetricLabel");
const newsBrief1=document.getElementById("newsBrief1");
const newsBrief2=document.getElementById("newsBrief2");
const exploredTop=document.getElementById("exploredTop");
const reflectCount=document.getElementById("reflectCount");
const mainForm=document.getElementById("mainForm");
const studentName=document.getElementById("studentName");
const studentBody=document.getElementById("studentBody");
const mainStars=[...document.querySelectorAll("#mainStars .star")];
const ratingOnly=document.getElementById("ratingOnly");
const ratingNote=document.getElementById("ratingNote");
const commentList=document.getElementById("commentList");
const commentCount=document.getElementById("commentCount");

function norm(name){return (name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function fullName(name){return (name||"").trim().split(/\s+/).filter(Boolean).length>=2}
function reservedName(name){return ["mediadora pedagogica","mediadora","fmu","fiam faam","fiam-faam"].includes(norm(name))}
function fmt(iso){return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
function escapeHtml(text){return (text||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function showToast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove("show"),2300)}
function saveVisited(){localStorage.setItem(VISITED_KEY,JSON.stringify([...visited]))}
function ratingFor(name){return ratings.find(r=>r.normalized_name===norm(name))}
function hasRated(name){return !!ratingFor(name)}

function updateProgress(){
  exploredTop.textContent=visited.size+" / 5";
  reflectCount.textContent=visited.size+" de 5";
  tabs.forEach(t=>t.classList.toggle("done",visited.has(t.dataset.key)));
}
function openStory(key){
  const d=PAPER_DATA[key]; if(!d)return;
  currentKey=key;visited.add(key);saveVisited();updateProgress();
  tabs.forEach(t=>t.classList.toggle("active",t.dataset.key===key));
  newsKicker.textContent=d.kicker;newsHeadline.textContent=d.headline;newsDeck.textContent=d.deck;
  newsMetric.textContent=d.metric;newsMetricLabel.textContent=d.metricLabel;
  newsBrief1.textContent=d.brief1;newsBrief2.textContent=d.brief2;
  newsCard.classList.add("open");
}
tabs.forEach(t=>t.addEventListener("click",()=>openStory(t.dataset.key)));
newsClose.addEventListener("click",()=>{newsCard.classList.remove("open");currentKey=null;tabs.forEach(t=>t.classList.remove("active"))});

function paintMainStars(){mainStars.forEach(x=>x.classList.toggle("active",Number(x.dataset.v)<=selectedStars))}
mainStars.forEach(s=>s.addEventListener("click",()=>{selectedStars=Number(s.dataset.v);paintMainStars()}));
function updateRatingUI(){
  const done=fullName(studentName.value.trim())&&hasRated(studentName.value.trim());
  ratingOnly.classList.toggle("hidden",done);ratingNote.classList.toggle("show",done);
  if(done){selectedStars=0;paintMainStars()}
}
studentName.addEventListener("input",updateRatingUI);

async function refreshComments(openIds=null){
  const open=openIds||new Set([...document.querySelectorAll(".thread[open]")].map(d=>d.dataset.id));
  const [c,r]=await Promise.all([
    supabase.from("forum_comments").select("*").eq("activity_key",ACTIVITY_KEY).order("created_at",{ascending:true}),
    supabase.from("forum_ratings").select("*").eq("activity_key",ACTIVITY_KEY)
  ]);
  if(c.error||r.error){showToast("Não foi possível atualizar os comentários agora.");return}
  comments=c.data||[];ratings=r.data||[];renderComments(open);updateRatingUI();
}
function buildTree(){
  const map=new Map(comments.map(c=>[c.id,{...c,children:[]}])),roots=[];
  map.forEach(c=>{if(c.parent_id&&map.has(c.parent_id))map.get(c.parent_id).children.push(c);else roots.push(c)});
  return roots.reverse();
}
function desc(c){return c.children.reduce((n,x)=>n+1+desc(x),0)}
function firstStudentComment(c){
  if(c.author_role==="mediator")return false;
  return comments.filter(x=>x.author_role==="student"&&x.normalized_name===c.normalized_name).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))[0]?.id===c.id;
}
function starsMarkup(n){if(!n)return "";let h='<div class="comment-stars">';for(let i=1;i<=5;i++)h+=`<span class="${i<=n?"":"off"}">★</span>`;return h+"</div>";}
function replyFormMarkup(id){return `<div class="reply-form" id="rf_${id}"><div class="reply-grid"><input id="rn_${id}" placeholder="Nome e sobrenome"><textarea id="rb_${id}" placeholder="Escreva sua resposta..."></textarea></div><div class="reply-foot"><div class="reply-stars" id="rs_${id}">${[1,2,3,4,5].map(v=>`<button type="button" class="reply-star" data-parent="${id}" data-v="${v}">★</button>`).join("")}</div><div><button class="small-btn" type="button" data-cancel="${id}">Cancelar</button><button class="small-btn send" type="button" data-send="${id}">Responder</button></div></div></div>`;}
function renderThread(x,openIds){
  const med=x.author_role==="mediator",preview=escapeHtml(x.body).replace(/\n/g," ").slice(0,80),n=desc(x);
  const nameHtml=med?'<span class="thread-name">Mediadora Pedagógica</span><span class="mediator-word">comentou</span>':`<span class="thread-name">${escapeHtml(x.author_name)}</span>`;
  const r=(!med&&firstStudentComment(x))?ratingFor(x.author_name):null;
  return `<details class="thread${med?" mediator-thread":""}" data-id="${x.id}" ${openIds.has(x.id)?"open":""}><summary><div><div>${nameHtml}</div><div class="thread-time">${fmt(x.created_at)}</div><div class="thread-preview">${preview}${x.body.length>80?"…":""}</div></div><div class="thread-chev">⌄</div></summary><div class="thread-body"><div class="comment-text">${escapeHtml(x.body)}</div>${r?starsMarkup(r.stars):""}<div class="reply-row"><button class="reply-btn" type="button" data-reply="${x.id}">Responder</button><span class="reply-count">${n} resposta${n===1?"":"s"}</span></div>${replyFormMarkup(x.id)}<div class="children">${(x.children||[]).map(c=>renderThread(c,openIds)).join("")}</div></div></details>`;
}
function bindReplies(){
  document.querySelectorAll("[data-reply]").forEach(b=>b.onclick=()=>document.getElementById("rf_"+b.dataset.reply)?.classList.toggle("open"));
  document.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>document.getElementById("rf_"+b.dataset.cancel)?.classList.remove("open"));
  document.querySelectorAll(".reply-star").forEach(b=>b.onclick=()=>{const id=b.dataset.parent,v=Number(b.dataset.v);replyRatings[id]=v;document.querySelectorAll("#rs_"+id+" .reply-star").forEach(x=>x.classList.toggle("active",Number(x.dataset.v)<=v));});
  document.querySelectorAll(".reply-form input").forEach(input=>input.addEventListener("input",()=>{const id=input.id.replace("rn_",""),wrap=document.getElementById("rs_"+id);if(wrap)wrap.style.display=(fullName(input.value)&&hasRated(input.value))?"none":"flex";}));
  document.querySelectorAll("[data-send]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.send,name=document.getElementById("rn_"+id).value.trim(),body=document.getElementById("rb_"+id).value.trim();
    if(!fullName(name)){showToast("Informe nome e sobrenome.");return}
    if(reservedName(name)){showToast("Este nome é reservado à mediação pedagógica.");return}
    if(body.length<2){showToast("Escreva uma resposta.");return}
    const rated=hasRated(name);if(!rated&&!replyRatings[id]){showToast("Na primeira participação, marque de 1 a 5 estrelas.");return}
    const q=await supabase.rpc("submit_student_comment",{p_activity_key:ACTIVITY_KEY,p_parent_id:id,p_author_name:name,p_body:body,p_stars:rated?null:replyRatings[id]});
    if(q.error){showToast(q.error.message||"Não foi possível publicar.");return}
    await refreshComments();showToast("Resposta publicada.");
  });
}
function renderComments(openIds=new Set()){
  const n=comments.length;commentCount.textContent=n;document.querySelector(".comments-panel").classList.toggle("has-comments",n>0);
  if(!n){commentList.innerHTML="";return}
  commentList.innerHTML=buildTree().map(c=>renderThread(c,openIds)).join("");bindReplies();
}
mainForm.addEventListener("submit",async e=>{
  e.preventDefault();const name=studentName.value.trim(),body=studentBody.value.trim();
  if(!fullName(name)){showToast("Informe nome e sobrenome.");studentName.focus();return}
  if(reservedName(name)){showToast("Este nome é reservado à mediação pedagógica.");return}
  if(body.length<4){showToast("Escreva sua contribuição.");studentBody.focus();return}
  const rated=hasRated(name);if(!rated&&!selectedStars){showToast("Na primeira participação, marque de 1 a 5 estrelas.");return}
  const q=await supabase.rpc("submit_student_comment",{p_activity_key:ACTIVITY_KEY,p_parent_id:null,p_author_name:name,p_body:body,p_stars:rated?null:selectedStars});
  if(q.error){showToast(q.error.message||"Não foi possível publicar.");return}
  studentBody.value="";selectedStars=0;paintMainStars();await refreshComments();showToast("Contribuição publicada.");
});
document.getElementById("expandAll").onclick=()=>document.querySelectorAll(".thread").forEach(d=>d.open=true);
document.getElementById("collapseAll").onclick=()=>document.querySelectorAll(".thread").forEach(d=>d.open=false);
updateProgress();
await refreshComments();
setInterval(()=>refreshComments(),4000);