/* Authenticated comment moderation. Never deletes or hides a record without an explicit action. */
export function installModeration({client,activity,getPassword,getComments,refresh,notify}) {
 const root=document.getElementById('list');
 if(!root)return;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const style=make('style');
 style.textContent=`
 .moderation-info{padding:14px 16px;border:1px solid #d5ded9;border-radius:14px;background:#f0f5f2;margin:0 0 14px;color:#30463b;font-size:13px;line-height:1.6}
 .moderation-info strong{display:block;font-size:14px;margin-bottom:4px}.moderation-counts{display:block;color:#596d61;margin-top:6px;font-size:12px}
 .mod-status{display:inline-block;margin:6px 0 0;padding:4px 9px;font-size:11px;font-weight:700;border-radius:20px;background:#e4f0e7;color:#275e39}
 .mod-status.is-hidden{background:#fff0d7;color:#79560c}.thread.mod-hidden{border-style:dashed}
 .mod-actions{display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid #e2e6e3;margin-top:14px;padding-top:12px}
 .mod-button{border:1px solid #c4d5c9;background:#fff;color:#24583c;border-radius:10px;padding:9px 13px;min-height:42px;font-size:12px;font-weight:700;cursor:pointer}
 .mod-button.danger{border-color:#e6c2c6;color:#a22332}.mod-button:disabled{opacity:.55;cursor:default}
 .mod-dialog{width:min(520px,calc(100vw - 30px));max-height:calc(100dvh - 30px);overflow:auto;border:1px solid #d4ded6;border-radius:20px;padding:24px;color:#1d3026;background:#fcfdfb;box-shadow:0 22px 70px #142f3240;font-family:inherit}
 .mod-dialog::backdrop{background:#142624bb}.mod-dialog h2{font-size:22px;margin:0 0 14px}.mod-dialog p{line-height:1.65;font-size:14px;margin:10px 0}
 .mod-preview{padding:12px 14px;border-radius:12px;background:#edf2ee;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}
 .mod-confirm-label{display:block;margin-top:18px;font-size:13px;font-weight:700}.mod-confirm-input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #b5c6bb;border-radius:10px;margin-top:7px;font-size:16px}
 .mod-dialog-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:20px}.mod-error{color:#a51d2d;font-size:13px;line-height:1.5;margin-top:12px}
 .mod-edit-text{box-sizing:border-box;width:100%;min-height:150px;padding:12px;border:1px solid #b5c6bb;border-radius:12px;margin-top:10px;font:inherit;line-height:1.55;resize:vertical}.mod-dialog button:focus-visible,.mod-confirm-input:focus-visible,.mod-edit-text:focus-visible,.mod-button:focus-visible{outline:3px solid #24583c;outline-offset:3px}
 @media(max-width:500px){.mod-dialog{padding:20px}.mod-actions button{flex:1}.mod-dialog-actions button{flex:1}.moderation-info{font-size:12px}}
 `;
 document.head.append(style);
 const info=make('section',undefined,'moderation-info');
 info.setAttribute('aria-label','Gestão de comentários');
 info.append(make('strong','Você decide o que aparece para a turma.'),make('span','Ocultar retira a conversa da visão dos alunos, mas mantém o registro neste painel. Excluir é permanente e exige confirmação.'));
 const counts=make('span','', 'moderation-counts');info.append(counts);root.before(info);
 const dialog=make('dialog',undefined,'mod-dialog');dialog.setAttribute('aria-labelledby','moderationTitle');document.body.append(dialog);
 let busy=false;
 const subtreeSize=id=>{const ids=new Set([id]);let change=true;while(change){change=false;getComments().forEach(c=>{if(c.parent_id&&ids.has(c.parent_id)&&!ids.has(c.id)){ids.add(c.id);change=true;}});}return ids.size;};
 function status(c){return c.is_hidden?'Oculto dos alunos':c.is_visible===false?'Oculto pela conversa de origem':'Visível para os alunos';}
 function decorate(){
  const list=getComments(),map=new Map(list.map(c=>[c.id,c]));
  const hidden=list.filter(c=>c.is_visible===false||c.is_hidden).length;
  counts.textContent=`${list.length} no painel · ${list.length-hidden} visíveis aos alunos · ${hidden} ocultos`;
  root.querySelectorAll('.thread').forEach(thread=>{
   const c=map.get(thread.dataset.id);if(!c)return;
   const hidden=c.is_hidden||c.is_visible===false;thread.classList.toggle('mod-hidden',hidden);
   let badge=thread.querySelector(':scope > summary .mod-status');
   if(!badge){badge=make('span','', 'mod-status');thread.querySelector(':scope > summary > div')?.append(badge);}
   badge.textContent=status(c);badge.classList.toggle('is-hidden',hidden);
   const body=thread.querySelector(':scope > .body');if(!body)return;
   let actions=body.querySelector(':scope > .mod-actions');
   if(!actions){actions=make('div',undefined,'mod-actions');const form=body.querySelector(':scope > .rform');form?body.insertBefore(actions,form):body.append(actions);}
   actions.replaceChildren();
   const toggle=make('button',c.is_hidden?'Mostrar novamente':'Ocultar dos alunos','mod-button');toggle.type='button';
   toggle.dataset.modAction=c.is_hidden?'show':'hide';toggle.dataset.modId=c.id;
   if(!c.is_hidden&&c.is_visible===false){toggle.disabled=true;toggle.textContent='Conversa de origem oculta';}
   if(c.author_role==='mediator'){const edit=make('button','Editar meu comentário','mod-button');edit.type='button';edit.dataset.modAction='edit';edit.dataset.modId=c.id;actions.append(edit);}
   const del=make('button','Excluir comentário','mod-button danger');del.type='button';del.dataset.modAction='delete';del.dataset.modId=c.id;
   actions.append(toggle,del);
  });
 }
 function confirmAction(c,action,opener){
  if(busy)return;
  const count=subtreeSize(c.id),replies=count-1;
  const isDelete=action==='delete',isEdit=action==='edit';dialog.replaceChildren();
  const title=make('h2',isDelete?'Excluir este comentário?':isEdit?'Editar comentário da mediação?':action==='hide'?'Ocultar dos alunos?':'Mostrar novamente?');title.id='moderationTitle';dialog.append(title);
  dialog.append(make('p',`Autor: ${c.author_name}`));
  let editArea=null;
  if(isEdit){editArea=make('textarea',undefined,'mod-edit-text');editArea.value=c.body;editArea.maxLength=1800;editArea.setAttribute('aria-label','Texto do comentário da mediação');dialog.append(editArea);}
  else dialog.append(make('div',c.body.length>220?c.body.slice(0,220)+'…':c.body,'mod-preview'));
  let description;
  if(isDelete)description=(replies?`Serão apagados este comentário e ${replies} resposta${replies===1?'':'s'} vinculada${replies===1?'':'s'}.`:'Este comentário será apagado.')+' A exclusão é permanente, inclusive neste painel. As estrelas de avaliação não serão apagadas.';
  else if(isEdit)description='A alteração será aplicada somente ao comentário da Mediação Pedagógica. O texto do aluno nunca é editado pelo painel.';
  else if(action==='hide')description=(replies?'O comentário e suas respostas deixarão':'O comentário deixará')+' de aparecer para os alunos após a próxima atualização da lista. Você continuará vendo tudo aqui e poderá mostrar novamente depois.';
  else description='A restrição individual será removida. Respostas ocultadas separadamente continuarão ocultas. Se a conversa de origem estiver oculta, este comentário também permanecerá fora da visão dos alunos.';
  dialog.append(make('p',description));
  let input=null;
  if(isDelete){const label=make('label','Digite EXCLUIR para confirmar.','mod-confirm-label');label.htmlFor='moderationConfirmation';input=make('input',undefined,'mod-confirm-input');input.id='moderationConfirmation';input.autocomplete='off';input.spellcheck=false;input.maxLength=7;dialog.append(label,input);}
  const error=make('div','', 'mod-error');error.setAttribute('role','alert');dialog.append(error);
  const actions=make('div',undefined,'mod-dialog-actions');
  const cancel=make('button','Cancelar','mod-button');cancel.type='button';
  const submit=make('button',isDelete?'Excluir definitivamente':isEdit?'Salvar alteração':action==='hide'?'Ocultar dos alunos':'Mostrar novamente','mod-button'+(isDelete?' danger':''));submit.type='button';submit.disabled=isDelete;
  actions.append(cancel,submit);dialog.append(actions);
  input?.addEventListener('input',()=>submit.disabled=busy||input.value!=='EXCLUIR');
  cancel.onclick=()=>dialog.close();
  dialog.oncancel=e=>{if(busy)e.preventDefault();};
  dialog.onclose=()=>{if(opener?.isConnected)opener.focus({preventScroll:true});else document.querySelector('.manual-refresh')?.focus({preventScroll:true});};
  submit.onclick=async()=>{
   if(busy||isDelete&&input.value!=='EXCLUIR')return;
   if(isEdit&&(!editArea||editArea.value.trim().length<2)){error.textContent='Escreva pelo menos 2 caracteres.';editArea?.focus();return;}
   busy=true;submit.disabled=true;cancel.disabled=true;if(input)input.disabled=true;error.textContent='';submit.setAttribute('aria-busy','true');
   try{
    const request=isEdit?client.rpc('edit_mediator_forum_comment',{p_activity_key:activity,p_comment_id:c.id,p_body:editArea.value.trim(),p_password:getPassword()}):client.rpc('moderate_forum_comment',{p_activity_key:activity,p_comment_id:c.id,p_action:action,p_password:getPassword(),p_confirmation:input?.value||null,p_expected_count:count});
    const {data,error:failure}=await request;
    if(failure)throw new Error(failure.message||'Não foi possível concluir a ação.');
    if(data?.ok!==true)throw new Error('O servidor não confirmou a alteração.');
    await refresh();decorate();dialog.close();
    notify(isDelete?'Comentário excluído.':isEdit?'Comentário da mediação atualizado.':action==='hide'?'Comentário oculto para os alunos.':data.is_visible===false?'Restrição individual removida. A conversa de origem permanece oculta.':'Comentário visível para os alunos.');
   }catch(e){error.textContent=e.message||'Não foi possível concluir. Nenhuma confirmação foi recebida.';}
   finally{busy=false;submit.disabled=!!input&&input.value!=='EXCLUIR';cancel.disabled=false;if(input)input.disabled=false;submit.removeAttribute('aria-busy');}
  };
  dialog.showModal();(editArea||input||cancel).focus();
 }
 root.addEventListener('click',event=>{const b=event.target.closest('[data-mod-action]');if(!b||b.disabled)return;event.preventDefault();event.stopPropagation();const c=getComments().find(x=>x.id===b.dataset.modId);if(c)confirmAction(c,b.dataset.modAction,b);});
 new MutationObserver(decorate).observe(root,{childList:true});
 decorate();return {decorate};
}
