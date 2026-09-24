/* 3615 Bleus V1.1.39 — gestionnaire d'accomplissements sans limite par joueur */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'accomplissement';
  const client=()=>window.BLEUS3000_SUPABASE||null;
  const state=()=>window.C3K_ACCOUNT_STATE||{};
  const userId=()=>state().session?.user?.id||state().profile?.id||null;
  const role=()=>state().profile?.role||'guest';
  const canEdit=()=>['contributor','admin','superadmin'].includes(role());
  const refs=[
    ['selection','Sélections'],['callup','Convocations'],['match','Matchs'],['competition','Compétitions'],['opponent','Adversaires'],
    ['personnel','Personnel & Officiels'],['equipment','Équipements'],['statistics','Statistiques'],['place','Lieux'],['bibliography','Bibliographie & Médias']
  ];
  let items=[],scopes=[],editingId=null,pendingIconBlob=null,pendingPreview='';

  function iconUrl(a){
    if(a?.icon_storage_path&&client())try{return client().storage.from('achievement-icons').getPublicUrl(a.icon_storage_path).data.publicUrl||'';}catch{}
    return String(a?.icon_image_path||'');
  }
  function previewHtml(a){const src=iconUrl(a);return `<span class="b3k-ach-preview-icon">${src?`<img src="${esc(src)}" alt="">`:`<span>${esc(a?.icon_text||'🏅')}</span>`}</span><strong>${esc(a?.label_text||'Accomplissement')}</strong>`;}
  function status(n,m,t=''){if(!n)return;n.hidden=false;n.className='c3k-v8-status'+(t?` is-${t}`:'');n.textContent=m;}
  async function load(){
    const c=client();if(!c)return;
    const [{data:a,error:ae},{data:s,error:se}]=await Promise.all([
      c.from('achievements').select('*').eq('is_active',true).order('label_text'),
      c.from('achievement_reference_scopes').select('achievement_id,reference_type')
    ]);
    if(ae)throw ae;if(se)throw se;items=a||[];scopes=s||[];render();window.dispatchEvent(new CustomEvent('bleus:achievements-changed'));
  }
  function current(){return items.find(x=>x.id===editingId)||{label_text:'',icon_text:'🏅',description_short:'',appearance:{},icon_image_path:null,icon_storage_path:null};}
  function selectedScopes(id){return new Set(scopes.filter(x=>x.achievement_id===id).map(x=>x.reference_type));}
  function render(){
    const body=$('#c3kV8PanelBody');if(!body)return;const cur=current(),selected=selectedScopes(editingId);
    const list=items.map(a=>{const names=refs.filter(([k])=>selectedScopes(a.id).has(k)).map(([,l])=>l);return `<article class="b3k-ach-row"><div class="b3k-ach-row-icon">${previewHtml(a)}</div><div class="b3k-ach-row-meta"><small>${esc(a.description_short||'')}</small><span>${esc(names.join(' · ')||'Aucun référentiel')}</span></div>${canEdit()?`<button type="button" class="c3k-v8-secondary" data-ach-edit="${esc(a.id)}">Modifier</button>`:''}</article>`;}).join('')||'<div class="c3k-v8-muted">Aucun accomplissement.</div>';
    body.innerHTML=`<section class="b3k-ach-manager"><div class="b3k-ach-head"><div><strong>Accomplissements</strong><span>Catalogue commun et affiliations aux référentiels · aucune limite d’accomplissements par joueur.</span></div><span>${items.length}</span></div>${canEdit()?`<form id="b3kAchForm" class="b3k-ach-editor"><div class="b3k-ach-preview" id="b3kAchPreview">${previewHtml(cur)}</div><label>Nom<input name="label_text" maxlength="60" required value="${esc(cur.label_text||'')}"></label><label>Description<input name="description_short" maxlength="180" value="${esc(cur.description_short||'')}"></label><div class="b3k-ach-upload"><label class="b3k-tag-file-btn">Importer une icône<input id="b3kAchIconFile" type="file" accept="image/png,image/jpeg,image/webp"></label><small>PNG/JPG/WebP · ajustement automatique dans un carré transparent 128×128.</small></div><fieldset><legend>Référentiels affiliés</legend><div class="b3k-ach-ref-grid">${refs.map(([k,l])=>`<label><input type="checkbox" name="reference_types" value="${k}" ${selected.has(k)?'checked':''}> ${esc(l)}</label>`).join('')}</div></fieldset><div class="b3k-tag-editor-actions"><button type="button" class="c3k-v8-secondary" id="b3kAchCancel">${editingId?'Annuler':'Vider'}</button><button class="c3k-v8-primary" type="submit">${editingId?'Enregistrer':'Ajouter'}</button></div><div id="b3kAchStatus" class="c3k-v8-status" hidden></div></form>`:`<div class="c3k-v8-muted">Ton rôle peut consulter le catalogue mais pas le modifier.</div>`}<div class="b3k-ach-list">${list}</div><div class="c3k-v8-actions"><button type="button" class="c3k-v8-secondary" id="b3kAchBack">Retour</button></div></section>`;
    $('#b3kAchBack',body)?.addEventListener('click',()=>$('#c3kV8AccountBtn')?.click());
    $$('[data-ach-edit]',body).forEach(b=>b.addEventListener('click',()=>{editingId=b.dataset.achEdit;pendingIconBlob=null;pendingPreview='';render();}));
    $('#b3kAchCancel',body)?.addEventListener('click',()=>{editingId=null;pendingIconBlob=null;pendingPreview='';render();});
    $('#b3kAchIconFile',body)?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const x=await prepareIcon(f);pendingIconBlob=x.blob;pendingPreview=x.preview;updatePreview();}catch(err){status($('#b3kAchStatus'),err.message,'error');}});
    $('#b3kAchForm',body)?.addEventListener('input',updatePreview);
    $('#b3kAchForm',body)?.addEventListener('submit',save);
  }
  function updatePreview(){const form=$('#b3kAchForm'),out=$('#b3kAchPreview');if(!form||!out)return;const fd=new FormData(form),a={...current(),label_text:String(fd.get('label_text')||'').trim()||'Accomplissement'};if(pendingPreview)out.innerHTML=`<span class="b3k-ach-preview-icon"><img src="${pendingPreview}" alt=""></span><strong>${esc(a.label_text)}</strong>`;else out.innerHTML=previewHtml(a);}
  async function prepareIcon(file){
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('Format accepté : PNG, JPG ou WebP.');
    if(file.size>8*1024*1024)throw new Error('Image trop lourde : 8 Mo maximum.');
    const src=await createImageBitmap(file),side=Math.max(src.width,src.height),c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d',{alpha:true});x.clearRect(0,0,128,128);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';const scale=112/side,w=src.width*scale,h=src.height*scale;x.drawImage(src,(128-w)/2,(128-h)/2,w,h);src.close?.();const blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Conversion impossible.')),'image/webp',.9));return {blob,preview:c.toDataURL('image/webp',.9)};
  }
  async function uploadIcon(blob,label,id){const c=client(),uid=userId();if(!c||!uid)throw new Error('Connexion requise.');const key=`${uid}/${id||crypto.randomUUID()}-${slugify(label)}-${Date.now()}.webp`;const {error}=await c.storage.from('achievement-icons').upload(key,blob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});if(error)throw error;return key;}
  async function save(e){
    e.preventDefault();if(!canEdit())return;const c=client(),form=e.currentTarget,fd=new FormData(form),st=$('#b3kAchStatus'),label=String(fd.get('label_text')||'').trim();if(!label)return status(st,'Ajoute un nom.','error');status(st,'Enregistrement…');
    try{
      let id=editingId,storage=current().icon_storage_path||null;if(pendingIconBlob)storage=await uploadIcon(pendingIconBlob,label,id);
      const payload={label_text:label,description_short:String(fd.get('description_short')||'').trim()||null,icon_storage_path:storage,updated_at:new Date().toISOString()};
      if(id){const {error}=await c.from('achievements').update(payload).eq('id',id);if(error)throw error;}else{const {data,error}=await c.from('achievements').insert({...payload,slug:slugify(label),icon_text:'🏅',appearance:{counter_prefix:'×',counter_position:'top'},created_by:userId()}).select('id').single();if(error)throw error;id=data.id;}
      const {error:de}=await c.from('achievement_reference_scopes').delete().eq('achievement_id',id);if(de)throw de;const rt=fd.getAll('reference_types').map(String);if(rt.length){const {error:ie}=await c.from('achievement_reference_scopes').insert(rt.map(reference_type=>({achievement_id:id,reference_type,created_by:userId()})));if(ie)throw ie;}
      editingId=null;pendingIconBlob=null;pendingPreview='';await load();
    }catch(err){status(st,err.message||String(err),'error');}
  }
  function open(){const b=$('#c3kV8AccountBackdrop');if(b)b.hidden=false;document.body.style.overflow='hidden';load().catch(err=>{const body=$('#c3kV8PanelBody');if(body)body.innerHTML=`<div class="c3k-v8-status is-error">${esc(err.message||err)}</div>`;});}
  window.BLEUS3000_ACHIEVEMENTS={open,refresh:load,getAll:()=>[...items]};
})();
