/* 3615 Bleus V1.1.61.11 — familles de compétitions · filtres sections/types */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>window.BLEUS3000_SEARCH?.normalize?.(v)||String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let client=null,catalogLoaded=false,entities=[],editions=[],entityTags=[],editionTags=[],positions=[],families=[],familyEntities=[];
  const competitionFilters={type:'all',tag:'all'};
  const waitClient=async()=>{client=window.BLEUS3000_SUPABASE||client;if(client)return client;await new Promise(r=>{const t=setTimeout(r,4000);window.addEventListener('bleus:supabase-ready',()=>{clearTimeout(t);r();},{once:true});});client=window.BLEUS3000_SUPABASE||null;return client;};
  async function loadCatalog(){
    if(catalogLoaded)return;
    if(!await waitClient())return;
    const [a,b,c,d,p,f,fe]=await Promise.all([
      client.from('competition_entities').select('*').order('name'),
      client.from('competition_editions').select('id,competition_entity_id,edition_year,edition_label,edition_tag_id,notes').order('edition_year',{ascending:false}).limit(2000),
      client.from('competition_entity_tags').select('*').limit(5000),
      client.from('competition_edition_tags').select('*').limit(10000),
      client.from('football_positions').select('*').order('sort_order'),
      client.from('competition_families').select('*').order('sort_order').order('name'),
      client.from('competition_family_entities').select('*').order('sort_order').limit(5000)
    ]);
    entities=a.data||[];editions=b.data||[];entityTags=c.data||[];editionTags=d.data||[];positions=p.data||[];families=f.data||[];familyEntities=fe.data||[];catalogLoaded=true;
  }
  function tagChip(tag,cls=''){
    if(!tag)return '';
    return window.BLEUS3000_TAGS?.chipHtml?window.BLEUS3000_TAGS.chipHtml(tag,cls):`<span class="${cls}">${esc(tag.label_text||tag.slug||'Tag')}</span>`;
  }
  function matchMini(m){
    const eff=window.BLEUS3000_RELATIONAL_REFS?.effective||((x,k)=>x?.[k]);
    const opp=eff(m,'opponent_name')||m.opponent?.name||'Adversaire';
    const a=eff(m,'france_score'),b=eff(m,'opponent_score'),score=(a!==null&&a!==undefined&&b!==null&&b!==undefined)?`${a} – ${b}`:'VS';
    const date=eff(m,'match_date')?new Date(eff(m,'match_date')).toLocaleDateString('fr-FR'):'—';
    const flag=window.BLEUS3000_FLAGS?.img?.(opp,'b3k-svg-flag')||'';
    return `<button type="button" class="rel-linked-match-tile" data-v161-open-match="${esc(m.id)}"><span class="rel-linked-match-date">${esc(date)}</span><span class="rel-linked-match-main"><strong>France <b class="rel-linked-score">${esc(score)}</b> ${flag}${esc(opp)}</strong><small>${esc(eff(m,'competition_name')||m.competition?.name||'Match international')}</small></span><span class="rel-linked-match-open">↗</span></button>`;
  }
  function editionHtml(ed,entity){
    const links=editionTags.filter(x=>String(x.competition_edition_id)===String(ed.id));
    const sectionTags=links.map(x=>window.BLEUS3000_RELATIONAL_REFS?.getTag?.(x.tag_id)).filter(Boolean);
    const editionTag=ed.edition_tag_id?window.BLEUS3000_RELATIONAL_REFS?.getTag?.(ed.edition_tag_id):null;
    const matches=(window.BLEUS3000_RELATIONAL_REFS?.matches||[]).filter(m=>String(m.competition_edition_id||'')===String(ed.id));
    return `<div class="competition-edition" data-v161-edition="${esc(ed.id)}" data-v161-edition-tags="${esc(links.map(x=>x.tag_id).join(','))}">
      <div class="competition-edition-row"><strong class="competition-edition-year">${esc(ed.edition_label||ed.edition_year)}</strong>
      <div class="competition-edition-tags">${editionTag?tagChip(editionTag,'competition-edition-chip is-canonical-edition'):`<span class="jersey-empty-relation">Tag édition à consolider</span>`}${sectionTags.length?`<span class="competition-edition-sections">${sectionTags.map(t=>`<button type="button" class="competition-tag-filter" data-v161-edition-filter="${esc(t.id)}" title="Filtrer les matchs de cette section">${tagChip(t,'competition-section-chip')}</button>`).join('')}</span>`:''}</div>
      <button type="button" class="competition-edition-expand" data-v161-edition-expand="${esc(ed.id)}" aria-expanded="false">+</button></div>
      <div class="competition-edition-matches" hidden>${matches.length?matches.map(matchMini).join(''):'<div class="universal-search-empty">Aucun match relié à cette édition.</div>'}</div>
    </div>`;
  }
  function uniqueTags(rows){
    const seen=new Set(),out=[];
    for(const row of rows){
      const tag=window.BLEUS3000_RELATIONAL_REFS?.getTag?.(row.tag_id);
      if(tag&&!seen.has(String(tag.id))){seen.add(String(tag.id));out.push(tag);}
    }
    return out;
  }
  function familyMembers(family){
    const links=familyEntities.filter(x=>String(x.family_id)===String(family.id));
    const byId=new Map(entities.map(e=>[String(e.id),e]));
    return links.map(x=>byId.get(String(x.competition_entity_id))).filter(Boolean);
  }
  function familyEditionRows(family){
    const members=familyMembers(family),ids=new Set(members.map(e=>String(e.id)));
    return editions.filter(ed=>ids.has(String(ed.competition_entity_id))).sort((a,b)=>Number(b.edition_year||0)-Number(a.edition_year||0));
  }
  function familyHtml(family){
    const members=familyMembers(family),memberIds=new Set(members.map(e=>String(e.id)));
    const tagRows=entityTags.filter(x=>memberIds.has(String(x.competition_entity_id)));
    const sectionTags=uniqueTags(tagRows);
    const entityCompetitionTags=[...new Map(members.map(e=>{const t=window.BLEUS3000_RELATIONAL_REFS?.getTag?.(e.competition_tag_id);return t?[String(t.id),t]:null;}).filter(Boolean)).values()];
    const eds=familyEditionRows(family),editionIds=new Set(eds.map(x=>String(x.id)));
    const matchCount=(window.BLEUS3000_RELATIONAL_REFS?.matches||[]).filter(m=>editionIds.has(String(m.competition_edition_id||''))).length;
    const multi=members.length>1;
    return `<article class="competition-catalog-tile${multi?' is-family':''}" data-v161-family="${esc(family.id)}">
      <div class="competition-catalog-head"><div><h3>${esc(family.name)}</h3><small>${esc(family.competition_type||'Compétition')} · ${members.length} entité${members.length>1?'s':''} · ${matchCount} match${matchCount>1?'s':''} relié${matchCount>1?'s':''}</small>
      <div class="competition-catalog-tags">${entityCompetitionTags.length?entityCompetitionTags.map(t=>tagChip(t,'competition-entity-chip')).join(''):`<span class="competition-family-chip">🏆 ${esc(family.name)}</span>`}${sectionTags.map(t=>`<button type="button" class="competition-tag-filter" data-v161-family-filter="${esc(t.id)}" title="Filtrer les éditions de cette section">${tagChip(t,'competition-section-chip')}</button>`).join('')}</div></div>
      <button type="button" class="competition-expand-btn" data-v161-family-expand="${esc(family.id)}" aria-expanded="false">+</button></div>
      <div class="competition-editions" hidden>${eds.map(ed=>editionHtml(ed,members.find(e=>String(e.id)===String(ed.competition_entity_id)))).join('')}</div>
    </article>`;
  }
  function bindCompetitionHost(host){
    $$('[data-v161-family-expand]',host).forEach(b=>b.addEventListener('click',()=>{const tile=b.closest('[data-v161-family]'),panel=$('.competition-editions',tile),open=panel.hidden;panel.hidden=!open;b.textContent=open?'−':'+';b.setAttribute('aria-expanded',String(open));}));
    $$('[data-v161-edition-expand]',host).forEach(b=>b.addEventListener('click',()=>{const row=b.closest('[data-v161-edition]'),panel=$('.competition-edition-matches',row),open=panel.hidden;panel.hidden=!open;b.textContent=open?'−':'+';b.setAttribute('aria-expanded',String(open));}));
    $$('[data-v161-open-match]',host).forEach(b=>b.addEventListener('click',()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.v161OpenMatch)));
    $$('[data-v161-family-filter]',host).forEach(b=>b.addEventListener('click',()=>{const tile=b.closest('[data-v161-family]'),panel=$('.competition-editions',tile),active=!b.classList.contains('is-active');$$('[data-v161-family-filter]',tile).forEach(x=>x.classList.remove('is-active'));b.classList.toggle('is-active',active);panel.hidden=false;const tag=b.dataset.v161FamilyFilter;$$('[data-v161-edition]',tile).forEach(ed=>{const tags=(ed.dataset.v161EditionTags||'').split(',').filter(Boolean);ed.hidden=active&&!tags.includes(tag);});}));
    $$('[data-v161-edition-filter]',host).forEach(b=>b.addEventListener('click',()=>{const row=b.closest('[data-v161-edition]'),panel=$('.competition-edition-matches',row);panel.hidden=false;const tagId=b.dataset.v161EditionFilter;const matches=window.BLEUS3000_RELATIONAL_REFS?.matches||[];const teamById=new Map((window.BLEUS3000_RELATIONAL_REFS?.getSelections?.()||[]).map(t=>[String(t.id),t]));const filtered=matches.filter(m=>String(m.competition_edition_id||'')===String(row.dataset.v161Edition)&&String(teamById.get(String(m.selection_team_id))?.team_tag_id||'')===String(tagId));panel.innerHTML=filtered.length?filtered.map(matchMini).join(''):'<div class="universal-search-empty">Aucun match de cette sélection n’est encore relié à l’édition.</div>';$$('[data-v161-open-match]',panel).forEach(x=>x.addEventListener('click',()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(x.dataset.v161OpenMatch)));}));
  }
  async function renderCompetitions(q=''){
    await window.BLEUS3000_RELATIONAL_REFS?.load?.();await loadCatalog();
    const host=$('#referenceEntries'),title=$('#referenceModalTitle'),sub=$('#referenceModalSub'),count=$('#referenceCount'),bar=$('#referenceFacetFilters'),old=$('#matchReferenceFilters');
    if(old)old.hidden=true;
    const types=[...new Set(families.map(f=>f.competition_type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    const familyTagIds=new Set(entityTags.map(x=>String(x.tag_id)));
    const availableTags=[...familyTagIds].map(id=>window.BLEUS3000_RELATIONAL_REFS?.getTag?.(id)).filter(Boolean).sort((a,b)=>String(a.label_text||'').localeCompare(String(b.label_text||''),'fr'));
    if(bar){bar.hidden=false;bar.className='reference-filter-bar competition-family-filter-bar';bar.innerHTML=`<label>Type<select data-v161-catalog-filter="type"><option value="all">Tous les types</option>${types.map(v=>`<option value="${esc(v)}" ${competitionFilters.type===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>Section<select data-v161-catalog-filter="tag"><option value="all">Toutes les sections</option>${availableTags.map(tag=>`<option value="${esc(tag.id)}" ${competitionFilters.tag===String(tag.id)?'selected':''}>${esc(tag.label_text||tag.slug)}</option>`).join('')}</select></label><button type="button" class="reference-filter-reset" data-v161-catalog-reset>Réinitialiser</button>`;bar.onchange=e=>{const k=e.target.dataset.v161CatalogFilter;if(!k)return;competitionFilters[k]=e.target.value;renderCompetitions($('#referenceSearch')?.value||'');};bar.querySelector('[data-v161-catalog-reset]')?.addEventListener('click',()=>{competitionFilters.type='all';competitionFilters.tag='all';renderCompetitions($('#referenceSearch')?.value||'');});}
    const nq=norm(q),list=families.filter(f=>{const members=familyMembers(f),memberIds=new Set(members.map(e=>String(e.id))),tagIds=new Set(entityTags.filter(x=>memberIds.has(String(x.competition_entity_id))).map(x=>String(x.tag_id)));if(competitionFilters.type!=='all'&&String(f.competition_type||'')!==competitionFilters.type)return false;if(competitionFilters.tag!=='all'&&!tagIds.has(String(competitionFilters.tag)))return false;if(!nq)return true;return [f.name,...(f.aliases||[]),...members.flatMap(e=>[e.name,...(e.aliases||[])])].some(v=>norm(v).includes(nq));});
    if(title)title.textContent='Compétitions';if(sub)sub.textContent='Familles principales · sections par tags · éditions · matchs associés';if(count)count.textContent=`${list.length} famille${list.length>1?'s':''}`;
    if(host){host.innerHTML=list.length?`<div class="competition-catalog-grid">${list.map(familyHtml).join('')}</div>`:'<div class="universal-search-empty">Aucune compétition ne correspond à la recherche.</div>';bindCompetitionHost(host);}
  }
  function canEdit(){return ['admin','superadmin'].includes(String(window.C3K_ACCOUNT_STATE?.profile?.role||'').toLowerCase());}
  function slugify(v){return String(v||'competition').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'competition';}
  function ensureCompetitionEditor(){
    let modal=$('#competitionCanonicalEditorModal');if(modal)return modal;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="competitionCanonicalEditorModal" hidden><section class="modal-dialog" style="width:min(720px,100%)" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Ajouter une compétition</h2><p>Création canonique · entité + édition + tags</p></div><button class="modal-close" type="button" data-comp-editor-close>×</button></header><div class="modal-body"><form id="competitionCanonicalEditorForm" class="c3k-v8-form"></form></div></section></div>`);
    modal=$('#competitionCanonicalEditorModal');modal.querySelector('[data-comp-editor-close]')?.addEventListener('click',()=>modal.hidden=true);modal.addEventListener('pointerdown',e=>{if(e.target===modal)modal.hidden=true;});modal.querySelector('form')?.addEventListener('submit',saveNewCompetition);return modal;
  }
  async function openNewCompetition(){
    if(!canEdit())return alert('Ajout réservé aux ADMIN et SUPERADMIN.');await loadCatalog();
    const modal=ensureCompetitionEditor(),form=$('#competitionCanonicalEditorForm'),year=new Date().getFullYear();
    form.innerHTML=`<label>Famille existante<select name="family_id"><option value="">— créer une nouvelle famille —</option>${families.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label><label>Nouvelle famille<input name="family_name" maxlength="160" placeholder="ex. Coupe du Monde de la FIFA"></label><label>Nom de l’entité<input name="entity_name" maxlength="180" required placeholder="ex. Coupe du Monde de la FIFA"></label><label>Type<input name="competition_type" maxlength="80" placeholder="Mondial, Euro, Amical…"></label><div class="rel-editor-grid"><label>Année de l’édition<input name="edition_year" type="number" min="1900" max="2200" value="${year}" required></label><label>Libellé édition<input name="edition_label" maxlength="80" value="${year}"></label></div><label>Alias de l’entité<input name="aliases" maxlength="300" placeholder="Coupe du Monde, Mondial"></label><div class="c3k-v8-actions"><button type="button" class="secondary-btn" data-comp-editor-cancel>Annuler</button><button type="submit" class="primary-btn">Créer</button></div><div class="c3k-v8-status" data-comp-editor-status hidden></div>`;
    form.querySelector('[data-comp-editor-cancel]')?.addEventListener('click',()=>modal.hidden=true);
    const familySelect=form.elements.family_id,familyName=form.elements.family_name,entityName=form.elements.entity_name,type=form.elements.competition_type;
    familySelect.addEventListener('change',()=>{const f=families.find(x=>String(x.id)===String(familySelect.value));if(f){familyName.value='';entityName.value=f.name;type.value=f.competition_type||'';}});
    form.elements.edition_year.addEventListener('input',()=>{if(!form.elements.edition_label.dataset.touched)form.elements.edition_label.value=form.elements.edition_year.value;});form.elements.edition_label.addEventListener('input',()=>form.elements.edition_label.dataset.touched='1');
    modal.hidden=false;
  }
  async function saveNewCompetition(e){
    e.preventDefault();if(!client)return;const form=e.currentTarget,fd=new FormData(form),st=form.querySelector('[data-comp-editor-status]');st.hidden=false;st.className='c3k-v8-status';st.textContent='Création…';
    try{
      let familyId=String(fd.get('family_id')||'').trim()||null;const familyName=String(fd.get('family_name')||'').trim(),entityName=String(fd.get('entity_name')||'').trim(),competitionType=String(fd.get('competition_type')||'').trim()||null,year=Number(fd.get('edition_year')),editionLabel=String(fd.get('edition_label')||year).trim()||String(year),aliases=String(fd.get('aliases')||'').split(',').map(x=>x.trim()).filter(Boolean);
      if(!entityName||!Number.isInteger(year))throw new Error('Nom et année obligatoires.');
      if(!familyId){if(!familyName)throw new Error('Choisis une famille existante ou saisis une nouvelle famille.');const {data,error}=await client.from('competition_families').insert({slug:`${slugify(familyName)}-${Date.now()}`,name:familyName,competition_type:competitionType,aliases:[]}).select('id').single();if(error)throw error;familyId=data.id;}
      const baseSlug=`${slugify(entityName)}-${Date.now()}`;
      const createdBy=window.C3K_ACCOUNT_STATE?.profile?.id;if(!createdBy)throw new Error('Session administrateur introuvable.');
      const {data:entityTag,error:tagError}=await client.from('tags').insert({slug:`competition-${baseSlug}`,kind:'tag',label_text:entityName.slice(0,80),icon_text:'🏆',aliases,appearance:'gradient',color_start:'#081f4d',color_end:'#315fc9',gradient_colors:['#081f4d','#315fc9'],text_color:'#ffffff',border_color:'#081f4d',gradient_angle:135,border_radius:16,border_width:1,is_active:true,reference_scope:'competition',competition_tag_level:'entity',created_by:createdBy}).select('id').single();if(tagError)throw tagError;
      const {data:entity,error:entityError}=await client.from('competition_entities').insert({slug:baseSlug,name:entityName,aliases,gender:'M',competition_type:competitionType,competition_tag_id:entityTag.id}).select('id').single();if(entityError)throw entityError;
      let r=await client.from('competition_family_entities').insert({family_id:familyId,competition_entity_id:entity.id,sort_order:1000});if(r.error)throw r.error;
      const team=window.BLEUS3000_RELATIONAL_REFS?.getSelections?.()?.find(x=>x.code==='FRA-A-M')||window.BLEUS3000_RELATIONAL_REFS?.getSelections?.()?.[0];if(team?.team_tag_id){r=await client.from('competition_entity_tags').upsert({competition_entity_id:entity.id,tag_id:team.team_tag_id},{onConflict:'competition_entity_id,tag_id'});if(r.error)throw r.error;}
      const {data:editionTag,error:editionTagError}=await client.from('tags').insert({slug:`competition-edition-${baseSlug}-${year}`,kind:'tag',label_text:`${entityName} ${editionLabel}`.slice(0,100),icon_text:'🏆',aliases:[],appearance:'gradient',color_start:'#123b8f',color_end:'#2f6dff',gradient_colors:['#123b8f','#2f6dff'],text_color:'#ffffff',border_color:'#123b8f',gradient_angle:135,border_radius:16,border_width:1,is_active:true,reference_scope:'competition',competition_tag_level:'edition',parent_tag_id:entityTag.id,created_by:createdBy}).select('id').single();if(editionTagError)throw editionTagError;
      const {data:edition,error:editionError}=await client.from('competition_editions').insert({competition_entity_id:entity.id,edition_year:year,edition_label:editionLabel,edition_tag_id:editionTag.id}).select('id').single();if(editionError)throw editionError;
      if(team?.team_tag_id){r=await client.from('competition_edition_tags').upsert({competition_edition_id:edition.id,tag_id:team.team_tag_id},{onConflict:'competition_edition_id,tag_id'});if(r.error)throw r.error;}
      r=await client.from('competitions').insert({name:entityName,edition:editionLabel,competition_type:competitionType,gender:'M',selection_category:team?.category||'A',status:'active',tag_id:entityTag.id,canonical_entity_id:entity.id,canonical_edition_id:edition.id});if(r.error)throw r.error;
      catalogLoaded=false;window.BLEUS3000_RELATIONAL_REFS?.invalidate?.();await window.BLEUS3000_RELATIONAL_REFS?.load?.();await loadCatalog();ensureCompetitionEditor().hidden=true;await renderCompetitions($('#referenceSearch')?.value||'');
    }catch(err){console.error('Création compétition',err);st.className='c3k-v8-status is-error';st.textContent=String(err?.message||err);}
  }
  async function hydrateMatchJerseys(root=document){
    // V1.1.61.46: le maillot porté n'est affiché que dans la feuille de match dépliée.
    $$('.rel-match-jersey-preview',root).forEach(x=>x.remove());
  }
  function canonicalPosition(value){
    const n=norm(value);if(!n)return '';
    for(const p of positions){if(norm(p.label_text)===n||(p.aliases||[]).some(a=>norm(a)===n))return p.label_text;}return value;
  }
  async function enhancePositionEditors(root=document){
    await loadCatalog();if(!positions.length)return;
    for(const input of $$('input[data-appearance-position]',root)){
      if(input.dataset.v161Done)return;
      const value=input.value,sel=document.createElement('select');sel.dataset.appearancePosition='';sel.dataset.v161Done='1';
      sel.innerHTML=`<option value="">Poste</option>`+positions.map(p=>`<option value="${esc(p.label_text)}" ${canonicalPosition(value)===p.label_text?'selected':''}>${esc(p.label_text)}</option>`).join('')+(value&&canonicalPosition(value)===value&&!positions.some(p=>p.label_text===value)?`<option value="${esc(value)}" selected>${esc(value)} · ancien libellé</option>`:'');
      input.replaceWith(sel);
    }
  }
  function observe(){
    const host=$('#referenceEntries');if(host)new MutationObserver(()=>hydrateMatchJerseys(host)).observe(host,{childList:true,subtree:true});
    new MutationObserver(muts=>{for(const m of muts){for(const n of m.addedNodes){if(n.nodeType===1&&(n.matches?.('#matchSheetEditorModal')||n.querySelector?.('[data-appearance-position]')))enhancePositionEditors(n).catch(()=>{});}}}).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest('[data-add-editor-row]'))setTimeout(()=>enhancePositionEditors(document),0);});
  }
  async function boot(){await loadCatalog();observe();hydrateMatchJerseys(document);}
  boot();
  window.BLEUS3000_V161={loadCatalog,renderCompetitions,openNewCompetition,get positions(){return positions;}};
})();
