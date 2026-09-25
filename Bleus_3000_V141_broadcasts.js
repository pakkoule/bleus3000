/* 3615 Bleus V1.1.48 — chaînes de diffusion + logos + menus calendrier */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72)||'chaine';
  const state=()=>window.C3K_ACCOUNT_STATE||{};
  const client=()=>window.BLEUS3000_SUPABASE;
  const canEdit=()=>['editor','admin','superadmin'].includes(String(state().role||'').toLowerCase());
  let channels=[],tags=new Map(),editingId=null,pendingFile=null,pendingPreview='';

  const publicIconUrl=t=>{const c=client();if(!t?.icon_image_path||!c)return '';return c.storage.from('tag-icons').getPublicUrl(t.icon_image_path).data?.publicUrl||'';};
  const logoHtml=(b,t)=>{const u=publicIconUrl(t);return u?`<img class="broadcast-logo-preview" src="${esc(u)}" alt="${esc(b.name)}">`:`<span class="broadcast-tag-preview">${esc(t?.icon_text||'📺')} ${esc(b.name)}</span>`;};

  async function load(){
    const c=client();if(!c)return render();
    const [{data:b,error:be},{data:t,error:te}]=await Promise.all([
      c.from('broadcast_channels').select('*').eq('active',true).order('name'),
      c.from('tags').select('*').eq('is_active',true)
    ]);
    if(be)console.warn('Chaînes',be);if(te)console.warn('Tags chaînes',te);
    channels=b||[];tags=new Map((t||[]).map(x=>[x.id,x]));render();
    window.dispatchEvent(new CustomEvent('bleus:broadcasts-ready',{detail:{channels,tags:[...tags.values()]}}));
    return channels;
  }
  function open(){editingId=null;pendingFile=null;pendingPreview='';const body=$('#c3kV8PanelBody');if(body)body.innerHTML='<div class="c3k-v8-muted">Chargement des chaînes…</div>';load();}
  function rowHtml(b){const t=tags.get(b.tag_id);return `<article class="broadcast-manager-row"><div class="broadcast-manager-logo">${logoHtml(b,t)}</div><div><strong>${esc(b.name)}</strong><small>${esc((b.aliases||[]).join(' · ')||b.slug)}</small></div>${canEdit()?`<button type="button" data-broadcast-edit="${esc(b.id)}">Modifier</button>`:''}</article>`;}
  function render(){const body=$('#c3kV8PanelBody');if(!body)return;const b=channels.find(x=>x.id===editingId)||null,t=b?tags.get(b.tag_id):null;body.innerHTML=`<section class="broadcast-manager"><div class="broadcast-manager-head"><div><strong>📺 Chaînes de diffusion</strong><span>Chaque chaîne est une entité liée à un tag. Dès qu’un logo est importé, le calendrier affiche le logo à la place du tag texte.</span></div><span>${channels.length}</span></div>${canEdit()?editorHtml(b,t):''}<div class="broadcast-manager-list">${channels.map(rowHtml).join('')||'<div class="c3k-v8-muted">Aucune chaîne connue.</div>'}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="broadcastBack" type="button">Retour</button></div></section>`;
    $('#broadcastBack')?.addEventListener('click',()=>$('#c3kV8AccountBtn')?.click());
    $$('[data-broadcast-edit]').forEach(x=>x.addEventListener('click',()=>{editingId=x.dataset.broadcastEdit;pendingFile=null;pendingPreview='';render();}));
    $('#broadcastForm')?.addEventListener('submit',save);
    $('#broadcastCancel')?.addEventListener('click',()=>{editingId=null;pendingFile=null;pendingPreview='';render();});
    $('#broadcastLogo')?.addEventListener('change',prepareLogo);
    $('#broadcastRemoveLogo')?.addEventListener('click',()=>{const f=$('#broadcastForm');if(f)f.dataset.removeLogo='1';pendingFile=null;pendingPreview='';renderPreview();});
    renderPreview();
  }
  function editorHtml(b,t){return `<form class="broadcast-manager-editor" id="broadcastForm"><div class="broadcast-manager-editor-title"><strong>${b?'Modifier':'Ajouter'} une chaîne</strong><small>Le logo est conservé dans le stockage des icônes de tags.</small></div><div class="broadcast-manager-preview" id="broadcastPreview">${b?logoHtml(b,t):'<span class="broadcast-tag-preview">📺 Nouvelle chaîne</span>'}</div><label>Nom<input name="name" required maxlength="80" value="${esc(b?.name||'')}"></label><label>Alias / variantes<input name="aliases" maxlength="240" value="${esc((b?.aliases||[]).join(', '))}" placeholder="ex. TF1+, TF1 HD"></label><label>Site web<input name="website_url" type="url" maxlength="500" value="${esc(b?.website_url||'')}" placeholder="https://…"></label><div class="broadcast-logo-actions"><label class="c3k-v8-secondary">Importer un logo<input id="broadcastLogo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>${b&&t?.icon_image_path?'<button class="c3k-v8-secondary" id="broadcastRemoveLogo" type="button">Retirer le logo</button>':''}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="broadcastCancel" type="button">${b?'Annuler':'Vider'}</button><button class="c3k-v8-primary" type="submit">Enregistrer</button></div><div class="c3k-v8-status" id="broadcastStatus" hidden></div></form>`;}
  function renderPreview(){const p=$('#broadcastPreview');if(!p)return;if(pendingPreview)p.innerHTML=`<img class="broadcast-logo-preview" src="${pendingPreview}" alt="Aperçu">`;}
  async function prepareLogo(e){const f=e.target.files?.[0];if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('PNG, JPG ou WebP uniquement.');if(f.size>8*1024*1024)return alert('8 Mo maximum.');const img=await createImageBitmap(f),canvas=document.createElement('canvas');canvas.width=320;canvas.height=160;const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,320,160);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const scale=Math.min(300/img.width,140/img.height,1),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(320-w)/2,(160-h)/2,w,h);img.close?.();pendingFile=await new Promise((res,rej)=>canvas.toBlob(x=>x?res(x):rej(new Error('Conversion impossible')),'image/webp',.92));pendingPreview=canvas.toDataURL('image/webp',.92);renderPreview();}
  async function uploadLogo(blob,name,id){const c=client(),uid=state().profile?.id;if(!c||!uid)throw new Error('Connexion requise.');const key=`${uid}/broadcast-${id||crypto.randomUUID()}-${slugify(name)}-${Date.now()}.webp`;const {error}=await c.storage.from('tag-icons').upload(key,blob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});if(error)throw error;return key;}
  async function save(e){e.preventDefault();const c=client(),form=e.currentTarget,st=$('#broadcastStatus');if(!c||!state().session?.user)return;const fd=new FormData(form),name=String(fd.get('name')||'').trim();if(!name)return;st.hidden=false;st.textContent='Enregistrement…';try{let channel=channels.find(x=>x.id===editingId)||null,tag=channel?tags.get(channel.tag_id):null;const aliases=String(fd.get('aliases')||'').split(',').map(x=>x.trim()).filter(Boolean);if(!tag){const {data,error}=await c.from('tags').insert({slug:`diffusion-${slugify(name)}`,kind:'tag',label_text:name.slice(0,40),icon_text:'📺',aliases:[name,...aliases],appearance:'gradient',color_start:'#082654',color_end:'#2563eb',gradient_colors:['#082654','#2563eb'],text_color:'#ffffff',border_color:'#082654',gradient_angle:135,border_radius:10,border_width:1,created_by:state().profile?.id||null,is_active:true,reference_scope:'broadcast'}).select('*').single();if(error)throw error;tag=data;}
      let iconPath=tag.icon_image_path||null;if(form.dataset.removeLogo==='1')iconPath=null;if(pendingFile)iconPath=await uploadLogo(pendingFile,name,tag.id);
      const {error:te}=await c.from('tags').update({label_text:name.slice(0,40),aliases:[name,...aliases],icon_image_path:iconPath,reference_scope:'broadcast',updated_at:new Date().toISOString()}).eq('id',tag.id);if(te)throw te;
      if(channel){const {error}=await c.from('broadcast_channels').update({name,slug:slugify(name),aliases,website_url:String(fd.get('website_url')||'').trim()||null,tag_id:tag.id,updated_at:new Date().toISOString()}).eq('id',channel.id);if(error)throw error;}else{const {data,error}=await c.from('broadcast_channels').insert({name,slug:slugify(name),aliases,website_url:String(fd.get('website_url')||'').trim()||null,tag_id:tag.id}).select('*').single();if(error)throw error;channel=data;await c.from('tag_reference_links').insert({tag_id:tag.id,reference_type:'broadcast',reference_id:channel.id,relation_kind:'membership',created_by:state().profile?.id||null});}
      editingId=null;pendingFile=null;pendingPreview='';await load();window.BLEUS3000_CALENDAR?.refreshBroadcasts?.();
    }catch(err){console.error(err);st.hidden=false;st.className='c3k-v8-status is-error';st.textContent=err.message||String(err);}}
  function findByText(text){const n=String(text||'').toLowerCase();return channels.filter(b=>n.includes(String(b.name||'').toLowerCase())||(b.aliases||[]).some(a=>n.includes(String(a).toLowerCase())));}
  function renderText(text){const found=findByText(text);if(!found.length)return `<span class="calendar-tv">📺 ${esc(text||'Diffusion à confirmer')}</span>`;return found.map(b=>{const t=tags.get(b.tag_id),u=publicIconUrl(t);return u?`<span class="broadcast-calendar-logo" title="${esc(b.name)}"><img src="${esc(u)}" alt="${esc(b.name)}"></span>`:`<span class="calendar-tv broadcast-text-tag">${esc(t?.icon_text||'📺')} ${esc(b.name)}</span>`;}).join('');}
  window.BLEUS3000_BROADCASTS={open,refresh:load,refreshBroadcasts:load,renderText,findByText,get channels(){return channels;}};
  window.addEventListener('bleus:supabase-ready',()=>load());
})();
