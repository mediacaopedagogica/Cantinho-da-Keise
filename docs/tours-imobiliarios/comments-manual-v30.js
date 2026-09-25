/* Manual comment controls. No polling, automatic closing or remote draft storage. */
const sheet=document.createElement('style');
sheet.textContent=`.thread[open]>summary .thread-preview,.thread[open]>summary .preview{display:none!important}.thread>summary>div:first-child{min-width:0}.thread .comment-text,.thread .text{overflow-wrap:anywhere}.comment-actions-top{display:flex!important;flex-wrap:wrap}.manual-refresh:disabled{opacity:.6;cursor:wait}`;
document.head.append(sheet);

export function preserveCommentView(root,draw){
 const forms=()=>[...root.querySelectorAll('.reply-form,.rform')];
 const fields=form=>[...form.querySelectorAll('input,textarea,select')];
 const id=form=>form.closest('.thread')?.dataset.id;
 const open=new Set([...root.querySelectorAll('.thread[open]')].map(node=>node.dataset.id));
 const drafts=new Map(forms().map(form=>[id(form),{
  open:form.classList.contains('open'),
  values:fields(form).map(field=>({value:field.value,checked:field.checked})),
  stars:[...form.querySelectorAll('.reply-star')].map(star=>star.classList.contains('active')),
  starsDisplay:form.querySelector('.reply-stars')?.style.display||''
 }]));
 const active=document.activeElement,form=active?.closest('.reply-form,.rform');
 const focused=form&&root.contains(form)?{id:id(form),index:fields(form).indexOf(active),start:active.selectionStart,end:active.selectionEnd,direction:active.selectionDirection}:null;
 const scroller=root.closest('.comments-scroll'),scroll=scroller?.scrollTop??window.scrollY;
 const anchor=[...root.children].find(node=>node.matches('.thread')&&node.getBoundingClientRect().bottom>(scroller?.getBoundingClientRect().top||0));
 const anchorId=anchor?.dataset.id,anchorTop=anchor?.getBoundingClientRect().top;
 draw(open);
 forms().forEach(form=>{
  const saved=drafts.get(id(form));if(!saved)return;
  form.classList.toggle('open',saved.open);
  fields(form).forEach((field,index)=>{const old=saved.values[index];if(!old)return;field.value=old.value;if('checked'in field)field.checked=old.checked;});
  form.querySelectorAll('.reply-star').forEach((star,index)=>star.classList.toggle('active',!!saved.stars[index]));
  const stars=form.querySelector('.reply-stars');if(stars)stars.style.display=saved.starsDisplay;
  if(focused?.id===id(form)){
   const field=fields(form)[focused.index];if(field){field.focus({preventScroll:true});if(typeof field.setSelectionRange==='function'&&focused.start!==null)try{field.setSelectionRange(focused.start,focused.end,focused.direction);}catch{}}
  }
 });
 if(scroller)scroller.scrollTop=scroll;else window.scrollTo({top:scroll,behavior:'instant'});
 const next=[...root.children].find(node=>node.dataset.id===anchorId);
 if(next&&Number.isFinite(anchorTop)){const delta=next.getBoundingClientRect().top-anchorTop;if(scroller)scroller.scrollTop+=delta;else window.scrollBy({top:delta,behavior:'instant'});}
}

export function createRefreshQueue(load,onError){
 let running=null,again=false;
 return function refresh(){
  again=true;if(running)return running;
  running=(async()=>{do{again=false;try{await load();}catch(error){onError(error);}}while(again);})().finally(()=>{running=null;});
  return running;
 };
}

export function addManualRefresh(controls,refresh,className){
 const button=document.createElement('button');button.type='button';button.className=className+' manual-refresh';button.textContent='Atualizar comentários';button.title='Buscar novas mensagens sem fechar comentários nem apagar o que está sendo escrito';
 button.onclick=async()=>{if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');try{await refresh();}finally{button.disabled=false;button.removeAttribute('aria-busy');}};
 controls.prepend(button);return button;
}
