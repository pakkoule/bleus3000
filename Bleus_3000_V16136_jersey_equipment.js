/* 3615 Bleus V1.1.61.36 — système équipement maillots */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>String(window.C3K_ACCOUNT_STATE?.profile?.role||'guest').toLowerCase();
  const canEdit=()=>['admin','superadmin'].includes(role());
  const client=()=>window.BLEUS3000_SUPABASE;
  let loaded=false,loading=null,components=[],kitLinks=[],variants=[],opponentLinks=[],opponents=[],patches=[],patchTagLinks=[],jerseyPatchLinks=[],matchPatchLinks=[],tags=[],jerseyRows=[];
  let viewMode='gallery';

  async function load(force=false){
    if(loaded&&!force)return;
    if(loading)return loading;
    const c=client(); if(!c)return;
    loading=(async()=>{
      const rel=window.BLEUS3000_RELATIONAL_REFS;
      try{await rel?.load?.();}catch{}
      tags=rel?.getTags?.()||[]; opponents=rel?.getOpponents?.()||rel?.opponents||[];
      const qs=await Promise.all([
        c.from('jerseys').select('id,title,year_start,year_end,season_label,usage_type').limit(10000),
        c.from('kit_components').select('*').eq('active',true).order('year_start',{ascending:false}).order('title'),
        c.from('jersey_kit_components').select('*').limit(10000),
        c.from('jersey_variants').select('*').eq('active',true).order('created_at'),
        c.from('jersey_opponents').select('*').limit(10000),
        c.from('competition_patches').select('*').eq('active',true).order('name'),
        c.from('competition_patch_tags').select('*').limit(10000),
        c.from('jersey_patches').select('*').limit(10000),
        c.from('match_jersey_patches').select('*').limit(10000)
      ]);
      const [j,a,b,d,e,f,g,h,i]=qs;
      jerseyRows=j.error?[]:(j.data||[]); components=a.error?[]:(a.data||[]); kitLinks=b.error?[]:(b.data||[]); variants=d.error?[]:(d.data||[]); opponentLinks=e.error?[]:(e.data||[]);
      patches=f.error?[]:(f.data||[]); patchTagLinks=g.error?[]:(g.data||[]); jerseyPatchLinks=h.error?[]:(h.data||[]); matchPatchLinks=i.error?[]:(i.data||[]);
      loaded=true;
    })().finally(()=>loading=null);
    return loading;
  }
  const storageUrl=path=>{if(!path||!client())return '';try{return client().storage.from('jersey-photos').getPublicUrl(path).data.publicUrl||'';}catch{return '';}};
  const componentUrl=x=>x?.image_url||storageUrl(x?.image_path)||'';
  const byJersey=(arr,id,key='jersey_id')=>arr.filter(x=>String(x[key])===String(id));
  function componentsFor(id,type){const ids=new Set(byJersey(kitLinks,id).map(x=>String(x.component_id)));return components.filter(x=>ids.has(String(x.id))&&(!type||x.component_type===type));}
  function variantsFor(id){return byJersey(variants,id);}
  function patchesFor(id){const ids=new Set(byJersey(jerseyPatchLinks,id).map(x=>String(x.patch_id)));return patches.filter(x=>ids.has(String(x.id)));}
  function opponentsFor(id){const ids=new Set(byJersey(opponentLinks,id).map(x=>String(x.opponent_id)));return opponents.filter(x=>ids.has(String(x.id)));}
  const kitPill=(label,x)=>`<span class="jersey-kit-pill" title="${esc(x.title||label)}">${componentUrl(x)?`<img src="${esc(componentUrl(x))}" alt="">`:''}<b>${esc(label)}</b><span>${esc(x.title||'')}</span></span>`;
  function cardExtrasHtml(row){
    const vs=variantsFor(row.id);
    if(!vs.length)return '';
    return `<div class="jersey-kit-summary"><div class="jersey-kit-summary-row"><span class="jersey-relation-label">Variantes</span><div class="jersey-kit-pills">${vs.slice(0,4).map(x=>`<span class="jersey-kit-pill is-text">${(x.image_url||storageUrl(x.image_path))?`<img src="${esc(x.image_url||storageUrl(x.image_path))}" alt="">`:''}<b>${esc(x.sleeve_type||x.usage_type||x.label)}</b><span>${esc(x.label)}</span></span>`).join('')}</div></div></div>`;
  }

  function options(items,selected,labelFn){return items.map(x=>`<label class="jersey-equipment-check"><input type="checkbox" value="${esc(x.id)}" ${selected.has(String(x.id))?'checked':''}><span>${esc(labelFn(x))}</span></label>`).join('')||'<span class="jersey-empty-relation">Aucune entrée dans la bibliothèque.</span>';}
  function editorSections(row={}){
    const oppSel=new Set(byJersey(opponentLinks,row.id).map(x=>String(x.opponent_id)));
    const kitSel=new Set(byJersey(kitLinks,row.id).map(x=>String(x.component_id)));
    const patchSel=new Set(byJersey(jerseyPatchLinks,row.id).map(x=>String(x.patch_id)));
    const sh=components.filter(x=>x.component_type==='short'),so=components.filter(x=>x.component_type==='socks'),vs=variantsFor(row.id);
    return `<section class="jersey-editor-section jersey-equipment-editor"><div class="jersey-editor-section-head"><h3>Tenue complète & variantes</h3><button type="button" class="secondary-btn" data-kit-library-open>Bibliothèque shorts / chaussettes / patchs</button></div>
      <div class="jersey-editor-grid"><label>Famille / génération<input name="family_key" maxlength="80" value="${esc(row.family_key||'')}" placeholder="Ex. france-2026-nike"></label></div>
      <div class="jersey-equipment-columns"><div><span class="jersey-relation-label">Shorts compatibles · plusieurs possibles</span><div class="jersey-equipment-choice-list" data-kit-choice="short">${options(sh,kitSel,x=>`${x.title}${x.season_label?` · ${x.season_label}`:''}`)}</div></div><div><span class="jersey-relation-label">Chaussettes compatibles · plusieurs possibles</span><div class="jersey-equipment-choice-list" data-kit-choice="socks">${options(so,kitSel,x=>`${x.title}${x.season_label?` · ${x.season_label}`:''}`)}</div></div></div>
      <div class="jersey-editor-separator"></div><div class="jersey-editor-section-head"><h3>Variantes directement liées au maillot</h3><button type="button" class="secondary-btn" data-add-jersey-variant>＋ Variante</button></div><div class="jersey-variant-editor-list" data-jersey-variant-list>${vs.map(variantRow).join('')}</div>
    </section>
    <section class="jersey-editor-section jersey-equipment-editor"><h3>Automatisation par adversaire & patchs</h3><div class="jersey-equipment-columns"><div><span class="jersey-relation-label">Adversaires documentés / prioritaires</span><div class="jersey-equipment-choice-list is-tall" data-opponent-choice>${options(opponents,oppSel,x=>x.name||x.label||'Adversaire')}</div></div><div><span class="jersey-relation-label">Patchs compatibles</span><div class="jersey-equipment-choice-list is-tall" data-patch-choice>${options(patches,patchSel,x=>x.name)}</div></div></div><small class="jersey-editor-note">La sélection automatique combine période, édition de compétition, sélection et adversaire. Tu peux toujours remplacer le choix sur la feuille de match.</small></section>`;
  }
  function variantRow(v={}){return `<div class="jersey-variant-row" data-variant-id="${esc(v.id||'')}" data-image-path="${esc(v.image_path||'')}"><input data-v-label placeholder="Nom variante" value="${esc(v.label||'')}"><select data-v-kind><option value="sleeve" ${v.variant_kind==='sleeve'?'selected':''}>Manches</option><option value="usage" ${v.variant_kind==='usage'?'selected':''}>Domicile / extérieur</option><option value="goalkeeper" ${v.variant_kind==='goalkeeper'?'selected':''}>Gardien</option><option value="special" ${v.variant_kind==='special'?'selected':''}>Spéciale</option></select><select data-v-sleeve><option value="">Manches…</option><option value="courtes" ${v.sleeve_type==='courtes'?'selected':''}>Courtes</option><option value="longues" ${v.sleeve_type==='longues'?'selected':''}>Longues</option></select><select data-v-usage><option value="">Usage…</option><option value="domicile" ${v.usage_type==='domicile'?'selected':''}>Domicile</option><option value="exterieur" ${v.usage_type==='exterieur'?'selected':''}>Extérieur</option><option value="gardien" ${v.usage_type==='gardien'?'selected':''}>Gardien</option></select><input data-v-image type="url" placeholder="Image variante (URL)" value="${esc(v.image_url||'')}"><label class="jersey-variant-file">Photo<input data-v-file type="file" accept="image/png,image/jpeg,image/webp"></label><label class="jersey-variant-default"><input data-v-default type="checkbox" ${v.is_default?'checked':''}>Défaut</label><button type="button" data-remove-variant>×</button></div>`;}

  async function bindEditor(form,row){
    await load();
    // Sections were generated before async load on first opening: refresh only the extension blocks if needed.
    const sections=$$('.jersey-equipment-editor',form); if(!sections.length)return;
    $('[data-add-jersey-variant]',form)?.addEventListener('click',()=>{$('[data-jersey-variant-list]',form)?.insertAdjacentHTML('beforeend',variantRow({}));});
    form.addEventListener('click',e=>{const b=e.target.closest('[data-remove-variant]');if(b)b.closest('.jersey-variant-row')?.remove();});
    $('[data-kit-library-open]',form)?.addEventListener('click',()=>openLibrary(row?.id||null));
  }
  async function saveEditorExtras(jerseyId,form,fd){
    const c=client(); if(!c||!jerseyId)return;
    const {error:je}=await c.from('jerseys').update({family_key:String(fd.get('family_key')||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',jerseyId);if(je)throw je;
    const compEls=$$('[data-kit-choice] input:checked',form),compIds=compEls.map(x=>x.value);
    const oppIds=$$('[data-opponent-choice] input:checked',form).map(x=>x.value);
    const patchIds=$$('[data-patch-choice] input:checked',form).map(x=>x.value);
    await Promise.all([c.from('jersey_kit_components').delete().eq('jersey_id',jerseyId),c.from('jersey_opponents').delete().eq('jersey_id',jerseyId),c.from('jersey_patches').delete().eq('jersey_id',jerseyId),c.from('jersey_variants').delete().eq('jersey_id',jerseyId)]);
    if(compIds.length){const counts={};for(const id of compIds){const t=components.find(x=>String(x.id)===String(id))?.component_type||'other';counts[t]=(counts[t]||0)+1;}const {error}=await c.from('jersey_kit_components').insert(compIds.map((component_id,i)=>{const t=components.find(x=>String(x.id)===String(component_id))?.component_type||'other';return {jersey_id:jerseyId,component_id,sort_order:i,is_default:counts[t]===1};}));if(error)throw error;}
    if(oppIds.length){const {error}=await c.from('jersey_opponents').insert(oppIds.map((opponent_id,i)=>({jersey_id:jerseyId,opponent_id,priority:100-i})));if(error)throw error;}
    if(patchIds.length){const {error}=await c.from('jersey_patches').insert(patchIds.map(patch_id=>({jersey_id:jerseyId,patch_id})));if(error)throw error;}
    const variantRows=$$('[data-jersey-variant-list] .jersey-variant-row',form);const vr=[];
    for(const x of variantRows){const label=String($('[data-v-label]',x)?.value||'').trim();if(!label)continue;let imagePath=x.dataset.imagePath||null;const file=$('[data-v-file]',x)?.files?.[0]||null;if(file){if(file.size>10*1024*1024)throw new Error('La photo de variante dépasse 10 Mo.');const ext=(String(file.name||'').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const safe=['png','jpg','jpeg','webp'].includes(ext)?ext:'jpg';imagePath=`variants/${jerseyId}/${Date.now()}-${crypto.randomUUID()}.${safe}`;const {error:ue}=await c.storage.from('jersey-photos').upload(imagePath,file,{contentType:file.type||undefined,upsert:false});if(ue)throw ue;}vr.push({jersey_id:jerseyId,label,variant_kind:$('[data-v-kind]',x)?.value||'sleeve',sleeve_type:$('[data-v-sleeve]',x)?.value||null,usage_type:$('[data-v-usage]',x)?.value||null,image_url:String($('[data-v-image]',x)?.value||'').trim()||null,image_path:imagePath,is_default:!!$('[data-v-default]',x)?.checked});}
    if(vr.length){const {error}=await c.from('jersey_variants').insert(vr);if(error)throw error;}
    loaded=false; await load(true);
  }

  function decorateReference(host,list){
    load().then(()=>{});
    const bar=$('#referenceFacetFilters');if(bar&&!$('[data-jersey-view-switch]',bar))bar.insertAdjacentHTML('beforeend',`<div class="jersey-view-switch" data-jersey-view-switch><button type="button" data-jersey-view="gallery" class="${viewMode==='gallery'?'is-active':''}">▦ Galerie</button><button type="button" data-jersey-view="timeline" class="${viewMode==='timeline'?'is-active':''}">↔ Chronologie</button></div>`);
    $$('[data-jersey-view]',bar||document).forEach(b=>b.addEventListener('click',()=>{viewMode=b.dataset.jerseyView;applyView(host,list);$$('[data-jersey-view]',bar).forEach(x=>x.classList.toggle('is-active',x.dataset.jerseyView===viewMode));}));
    applyView(host,list);
  }
  function applyView(host,list){const grid=$('.jersey-reference-grid',host);if(!grid)return;grid.classList.toggle('is-timeline',viewMode==='timeline');$$('.jersey-tile',grid).forEach((card,i)=>{const r=list[i];card.dataset.timelineYear=String(r?.year_start||r?.season_label||'—');});}

  async function openLibrary(returnJerseyId){await load();let m=$('#jerseyEquipmentLibrary');if(!m){m=document.createElement('div');m.id='jerseyEquipmentLibrary';m.className='modal-backdrop';m.hidden=true;document.body.appendChild(m);}m.innerHTML=`<section class="modal-dialog jersey-library-dialog"><header class="modal-head"><div><h2>Bibliothèque équipement</h2><p>Shorts · chaussettes · patchs compétition réutilisables</p></div><button class="modal-close" data-library-close>×</button></header><div class="modal-body jersey-library-body"><section><h3>Short / chaussettes</h3><form data-component-form class="jersey-library-form"><select name="component_type"><option value="short">Short</option><option value="socks">Chaussettes</option></select><input name="title" required placeholder="Nom"><input name="season_label" placeholder="Saison"><input name="primary_color" type="color" value="#123B8F"><input name="image_url" type="url" placeholder="Image URL (facultatif)"><label class="jersey-library-file">Importer une photo<input name="image_file" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="primary-btn">Ajouter</button></form><div class="jersey-library-list">${components.map(x=>`<div>${componentUrl(x)?`<img src="${esc(componentUrl(x))}" alt="">`:`<span class="jersey-component-dot" style="background:${esc(x.primary_color||'#dce8f6')}"></span>`}<strong>${esc(x.title)}</strong><small>${esc(x.component_type==='short'?'Short':'Chaussettes')} ${esc(x.season_label||'')}</small>${canEdit()?`<button data-delete-component="${esc(x.id)}">×</button>`:''}</div>`).join('')}</div></section><section><h3>Patch compétition</h3><form data-patch-form class="jersey-library-form"><input name="name" required placeholder="Nom du patch"><input name="image_url" type="url" placeholder="Image URL"><select name="tag_id"><option value="">Tag compétition…</option>${tags.filter(t=>t.reference_scope==='competition').map(t=>`<option value="${esc(t.id)}">${esc(t.label_text)}</option>`).join('')}</select><button class="primary-btn">Ajouter</button></form><div class="jersey-library-list">${patches.map(x=>`<div>${x.image_url?`<img src="${esc(x.image_url)}" alt="">`:'<span>🏆</span>'}<strong>${esc(x.name)}</strong>${canEdit()?`<button data-delete-patch="${esc(x.id)}">×</button>`:''}</div>`).join('')}</div></section></div></section>`;
    $('[data-library-close]',m).onclick=()=>{m.hidden=true;if(returnJerseyId)window.BLEUS3000_JERSEYS?.openEditor?.(returnJerseyId);};
    $('[data-component-form]',m)?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),c=client();let imagePath=null;const file=e.currentTarget.elements.image_file?.files?.[0]||null;if(file){if(file.size>10*1024*1024)return alert('La photo dépasse 10 Mo.');const ext=(String(file.name||'').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const safe=['png','jpg','jpeg','webp'].includes(ext)?ext:'jpg';imagePath=`components/${Date.now()}-${crypto.randomUUID()}.${safe}`;const {error:ue}=await c.storage.from('jersey-photos').upload(imagePath,file,{contentType:file.type||undefined,upsert:false});if(ue)return alert(ue.message);}const {error}=await c.from('kit_components').insert({component_type:f.get('component_type'),title:String(f.get('title')||'').trim(),season_label:String(f.get('season_label')||'').trim()||null,primary_color:String(f.get('primary_color')||'').trim()||null,image_url:String(f.get('image_url')||'').trim()||null,image_path:imagePath,created_by:window.C3K_ACCOUNT_STATE?.profile?.id||null});if(error)return alert(error.message);await load(true);openLibrary(returnJerseyId);});
    $('[data-patch-form]',m)?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),c=client();const {data,error}=await c.from('competition_patches').insert({name:String(f.get('name')||'').trim(),image_url:String(f.get('image_url')||'').trim()||null,created_by:window.C3K_ACCOUNT_STATE?.profile?.id||null}).select('id').single();if(error)return alert(error.message);const tag=String(f.get('tag_id')||'');if(tag)await c.from('competition_patch_tags').insert({patch_id:data.id,tag_id:tag});await load(true);openLibrary(returnJerseyId);});
    $$('[data-delete-component]',m).forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer cet élément de tenue ?'))return;await client().from('kit_components').delete().eq('id',b.dataset.deleteComponent);await load(true);openLibrary(returnJerseyId);});
    $$('[data-delete-patch]',m).forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer ce patch ?'))return;await client().from('competition_patches').delete().eq('id',b.dataset.deletePatch);await load(true);openLibrary(returnJerseyId);});
    m.hidden=false;
  }

  function scoreJersey(id,m){const api=window.BLEUS3000_JERSEYS,rowId=String(id),opp=String(m?.opponent_id||m?.opponent?.id||''),date=m?.match_date?new Date(m.match_date):null,yr=date&&!isNaN(date)?date.getFullYear():null;let score=0;const os=byJersey(opponentLinks,rowId);if(opp&&os.some(x=>String(x.opponent_id)===opp))score+=40;const row=jerseyRows.find(x=>String(x.id)===rowId);if(row&&yr){if(row.year_start&&yr>=Number(row.year_start))score+=8;if(row.year_end&&yr<=Number(row.year_end))score+=8;}return score;}

  function kitPickerHtml(jerseyId,link){
    const vs=variantsFor(jerseyId),defaultVariant=vs.find(x=>x.is_default)?.id||'',variantSelected=link?.jersey_variant_id||defaultVariant;
    if(!vs.length)return '';
    return `<div class="match-sheet-kit-options"><label>Variante<select data-match-kit-variant><option value="">Standard</option>${vs.map(x=>`<option value="${esc(x.id)}" ${String(variantSelected||'')===String(x.id)?'selected':''}>${esc(x.label)}${x.sleeve_type?` · ${esc(x.sleeve_type)}`:''}</option>`).join('')}</select></label></div>`;
  }
  async function refreshMatchKitUI(){await load();const modal=$('#matchSheetEditorModal');if(!modal||modal.hidden)return;const sel=$('#matchSheetEditorJersey',modal);if(!sel)return;let host=$('#matchSheetKitDetails',modal);if(!host){host=document.createElement('div');host.id='matchSheetKitDetails';$('.match-sheet-jersey-picker',modal)?.after(host);}const jerseyId=sel.value;const matchId=window.__BLEUS_MATCH_SHEET_CURRENT_ID||null;let baseLink=null;if(jerseyId&&matchId&&client()){const {data:link}=await client().from('match_jerseys').select('*').eq('match_id',matchId).eq('jersey_id',jerseyId).eq('role','outfield').maybeSingle();baseLink=link||null;}host.innerHTML=jerseyId?kitPickerHtml(jerseyId,baseLink):'';}

  function wrapBaseApi(){const api=window.BLEUS3000_JERSEYS;if(!api||api.__equipmentWrapped)return;api.__equipmentWrapped=true;
    const oldGet=api.getMatchPickerData.bind(api);api.getMatchPickerData=async(matchId,m)=>{await load();const data=await oldGet(matchId,m);data.options.sort((a,b)=>scoreJersey(b.id,m)-scoreJersey(a.id,m));if(!data.selectedId&&data.options.length)data.selectedId=data.options[0].id;setTimeout(refreshMatchKitUI,50);return data;};
    const oldMatchJersey=api.getMatchJersey?.bind(api);if(oldMatchJersey)api.getMatchJersey=async matchId=>{await load();const base=await oldMatchJersey(matchId);if(!base)return null;const c=client();let link=null;try{const {data}=await c.from('match_jerseys').select('*').eq('match_id',matchId).eq('role','outfield').maybeSingle();link=data||null;}catch{}const variant=variants.find(x=>String(x.id)===String(link?.jersey_variant_id||base.jersey_variant_id||''))||null;return {...base,jersey_variant_id:link?.jersey_variant_id||base.jersey_variant_id||null,variant};};
    const oldSet=api.setMatchJersey.bind(api);api.setMatchJersey=async(matchId,jerseyId,teamId)=>{const modal=$('#matchSheetEditorModal'),variantId=$('[data-match-kit-variant]',modal)?.value||null;const ok=await oldSet(matchId,jerseyId,teamId);if(!jerseyId){loaded=false;return ok;}const c=client();const {error}=await c.from('match_jerseys').update({jersey_variant_id:variantId,updated_at:new Date().toISOString()}).eq('match_id',matchId).eq('role','outfield');if(error)throw error;loaded=false;await load(true);return ok;};
    const oldLoad=api.load?.bind(api);if(oldLoad)api.load=async(...a)=>{const v=await oldLoad(...a);api._rows=v;return v;};
  }

  document.addEventListener('change',e=>{if(e.target?.id==='matchSheetEditorJersey')setTimeout(refreshMatchKitUI,20);});
  const obs=new MutationObserver(()=>{wrapBaseApi();const modal=$('#matchSheetEditorModal');if(modal&&!modal.hidden)setTimeout(refreshMatchKitUI,60);});obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('bleus:supabase-ready',()=>{loaded=false;load(true);wrapBaseApi();});
  setTimeout(()=>{load();wrapBaseApi();},0);
  window.BLEUS3000_JERSEY_EQUIPMENT={load,cardExtrasHtml,editorSections,bindEditor,saveEditorExtras,decorateReference,openLibrary,componentsFor,variantsFor,patchesFor,opponentsFor};
})();
