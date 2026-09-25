/* 3615 Bleus V1.1.61.15 — équipementiers + logos + tags reliés aux maillots */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72)||'equipementier';
  const state=()=>window.C3K_ACCOUNT_STATE||{};
  const client=()=>window.BLEUS3000_SUPABASE;
  const canEdit=()=>['editor','admin','superadmin'].includes(String(state().role||'').toLowerCase());
  let rows=[],tags=new Map(),editingId=null,pendingFile=null,pendingPreview='';

  const publicIconUrl=t=>{const c=client();if(!t?.icon_image_path||!c)return '';try{return c.storage.from('tag-icons').getPublicUrl(t.icon_image_path).data?.publicUrl||'';}catch{return '';}};
  function logoHtml(row,cls='broadcast-logo-preview'){
    const t=tags.get(row?.tag_id),u=publicIconUrl(t);
    return u?`<img class="${cls}" src="${esc(u)}" alt="${esc(row?.name||'Équipementier')}">`:`<span class="broadcast-tag-preview">${esc(t?.icon_text||'👕')} ${esc(row?.name||'Équipementier')}</span>`;
  }
  async function load({renderPanel=false}={}){
    const c=client();if(!c){if(renderPanel)render();return rows;}
    const [{data:r,error:re},{data:t,error:te}]=await Promise.all([
      c.from('equipment_manufacturers').select('*').eq('active',true).order('name'),
      c.from('tags').select('*').eq('is_active',true).eq('reference_scope','equipment')
    ]);
    if(re)console.warn('Équipementiers',re);if(te)console.warn('Tags équipementiers',te);
    rows=r||[];tags=new Map((t||[]).map(x=>[x.id,x]));
    window.dispatchEvent(new CustomEvent('bleus:equipment-ready',{detail:{manufacturers:rows,tags:[...tags.values()]}}));
    if(renderPanel)render();
    return rows;
  }
  function open(){editingId=null;pendingFile=null;pendingPreview='';const body=$('#c3kV8PanelBody');if(body)body.innerHTML='<div class="c3k-v8-muted">Chargement des équipementiers…</div>';load({renderPanel:true});}
  function rowHtml(r){return `<article class="broadcast-manager-row"><div class="broadcast-manager-logo">${logoHtml(r)}</div><div><strong>${esc(r.name)}</strong><small>${esc((r.aliases||[]).join(' · ')||r.slug)}</small></div>${canEdit()?`<button type="button" data-equipment-edit="${esc(r.id)}">Modifier</button>`:''}</article>`;}
  function render(){
    const body=$('#c3kV8PanelBody');if(!body)return;const r=rows.find(x=>x.id===editingId)||null,t=r?tags.get(r.tag_id):null;
    body.innerHTML=`<section class="broadcast-manager"><div class="broadcast-manager-head"><div><strong>👕 Équipementiers</strong><span>Personnalise les tags d’équipementier et importe leur logo. Ces entrées alimentent directement les tuiles Maillots.</span></div><span>${rows.length}</span></div>${canEdit()?editorHtml(r,t):''}<div class="broadcast-manager-list">${rows.map(rowHtml).join('')||'<div class="c3k-v8-muted">Aucun équipementier connu.</div>'}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="equipmentBack" type="button">Retour</button></div></section>`;
    $('#equipmentBack')?.addEventListener('click',()=>$('#c3kV8AccountBtn')?.click());
    $$('[data-equipment-edit]').forEach(x=>x.addEventListener('click',()=>{editingId=x.dataset.equipmentEdit;pendingFile=null;pendingPreview='';render();}));
    $('#equipmentForm')?.addEventListener('submit',save);
    $('#equipmentCancel')?.addEventListener('click',()=>{editingId=null;pendingFile=null;pendingPreview='';render();});
    $('#equipmentLogo')?.addEventListener('change',prepareLogo);
    $('#equipmentRemoveLogo')?.addEventListener('click',()=>{const f=$('#equipmentForm');if(f)f.dataset.removeLogo='1';pendingFile=null;pendingPreview='';renderPreview();});
    renderPreview();
  }
  function editorHtml(r,t){return `<form class="broadcast-manager-editor" id="equipmentForm"><div class="broadcast-manager-editor-title"><strong>${r?'Modifier':'Ajouter'} un équipementier</strong><small>Le logo est stocké dans le même espace que les icônes de tags.</small></div><div class="broadcast-manager-preview" id="equipmentPreview">${r?logoHtml(r):'<span class="broadcast-tag-preview">👕 Nouvel équipementier</span>'}</div><label>Nom<input name="name" required maxlength="80" value="${esc(r?.name||'')}"></label><label>Alias / variantes<input name="aliases" maxlength="240" value="${esc((r?.aliases||[]).join(', '))}" placeholder="ex. adidas, Adidas Football"></label><label>Site web<input name="website_url" type="url" maxlength="500" value="${esc(r?.website_url||'')}" placeholder="https://…"></label><div class="broadcast-logo-actions"><label class="c3k-v8-secondary">Importer un logo<input id="equipmentLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>${r&&t?.icon_image_path?'<button class="c3k-v8-secondary" id="equipmentRemoveLogo" type="button">Retirer le logo</button>':''}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="equipmentCancel" type="button">${r?'Annuler':'Vider'}</button><button class="c3k-v8-primary" type="submit">Enregistrer</button></div><div class="c3k-v8-status" id="equipmentStatus" hidden></div></form>`;}
  function renderPreview(){const p=$('#equipmentPreview');if(p&&pendingPreview)p.innerHTML=`<img class="broadcast-logo-preview" src="${pendingPreview}" alt="Aperçu">`;}
  async function prepareLogo(e){const f=e.target.files?.[0];if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('PNG, JPG ou WebP uniquement.');if(f.size>8*1024*1024)return alert('8 Mo maximum.');const img=await createImageBitmap(f),canvas=document.createElement('canvas');canvas.width=320;canvas.height=160;const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,320,160);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const scale=Math.min(300/img.width,140/img.height,1),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(320-w)/2,(160-h)/2,w,h);img.close?.();pendingFile=await new Promise((res,rej)=>canvas.toBlob(x=>x?res(x):rej(new Error('Conversion impossible')),'image/webp',.92));pendingPreview=canvas.toDataURL('image/webp',.92);renderPreview();}
  async function uploadLogo(blob,name,id){const c=client(),uid=state().profile?.id;if(!c||!uid)throw new Error('Connexion requise.');const key=`${uid}/equipment-${id||crypto.randomUUID()}-${slugify(name)}-${Date.now()}.webp`;const {error}=await c.storage.from('tag-icons').upload(key,blob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});if(error)throw error;return key;}
  async function save(e){e.preventDefault();const c=client(),form=e.currentTarget,st=$('#equipmentStatus');if(!c||!state().session?.user)return;const fd=new FormData(form),name=String(fd.get('name')||'').trim();if(!name)return;st.hidden=false;st.className='c3k-v8-status';st.textContent='Enregistrement…';try{
    let row=rows.find(x=>x.id===editingId)||null,tag=row?tags.get(row.tag_id):null;const aliases=String(fd.get('aliases')||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!tag){const {data,error}=await c.from('tags').insert({slug:`equipment-${slugify(name)}`,kind:'tag',label_text:name.slice(0,40),icon_text:'👕',aliases:[name,...aliases],appearance:'solid',color_start:'#ffffff',color_end:'#ffffff',gradient_colors:['#ffffff'],text_color:'#123b8f',border_color:'#c8d8eb',gradient_angle:0,border_radius:10,border_width:1,created_by:state().profile?.id||null,is_active:true,reference_scope:'equipment'}).select('*').single();if(error)throw error;tag=data;}
    let iconPath=tag.icon_image_path||null;if(form.dataset.removeLogo==='1')iconPath=null;if(pendingFile)iconPath=await uploadLogo(pendingFile,name,tag.id);
    const {error:te}=await c.from('tags').update({label_text:name.slice(0,40),aliases:[name,...aliases],icon_image_path:iconPath,reference_scope:'equipment',updated_at:new Date().toISOString()}).eq('id',tag.id);if(te)throw te;
    if(row){const {error}=await c.from('equipment_manufacturers').update({name,slug:slugify(name),aliases,website_url:String(fd.get('website_url')||'').trim()||null,tag_id:tag.id,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)throw error;}
    else{const {data,error}=await c.from('equipment_manufacturers').insert({name,slug:slugify(name),aliases,website_url:String(fd.get('website_url')||'').trim()||null,tag_id:tag.id}).select('*').single();if(error)throw error;row=data;const {error:le}=await c.from('tag_reference_links').insert({tag_id:tag.id,reference_type:'equipment',reference_id:row.id,relation_kind:'membership',created_by:state().profile?.id||null});if(le&&le.code!=='23505')throw le;}
    editingId=null;pendingFile=null;pendingPreview='';await load({renderPanel:true});window.BLEUS3000_JERSEYS?.invalidate?.();window.dispatchEvent(new CustomEvent('bleus:equipment-changed'));
  }catch(err){console.error(err);st.hidden=false;st.className='c3k-v8-status is-error';st.textContent=err.message||String(err);}}
  function getById(id){return rows.find(x=>String(x.id)===String(id))||null;}
  function tagFor(row){return row?tags.get(row.tag_id)||null:null;}
  function renderCompact(id){const row=getById(id);if(!row)return '';const t=tagFor(row),u=publicIconUrl(t);return u?`<span class="equipment-compact equipment-compact--logo-only" title="${esc(row.name)}"><img src="${esc(u)}" alt="${esc(row.name)}"></span>`:`<span class="equipment-compact equipment-compact--logo-only" title="${esc(row.name)}"><span class="equipment-compact-fallback">${esc(t?.icon_text||'👕')}</span></span>`;}
  window.BLEUS3000_EQUIPMENT={open,load,get rows(){return rows;},getById,tagFor,publicIconUrl,renderCompact};
  window.addEventListener('bleus:supabase-ready',()=>load());
})();
