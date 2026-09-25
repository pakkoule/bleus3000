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
      client.from('competition_editions').select('*').order('edition_year',{ascending:false}).limit(2000),
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
    const tags=links.map(x=>window.BLEUS3000_RELATIONAL_REFS?.getTag?.(x.tag_id)).filter(Boolean);
    const matches=(window.BLEUS3000_RELATIONAL_REFS?.matches||[]).filter(m=>String(m.competition_edition_id||'')===String(ed.id));
    return `<div class="competition-edition" data-v161-edition="${esc(ed.id)}" data-v161-edition-tags="${esc(links.map(x=>x.tag_id).join(','))}">
      <div class="competition-edition-row"><strong class="competition-edition-year">${esc(ed.edition_label||ed.edition_year)}</strong>
      <div class="competition-edition-tags">${tags.length?tags.map(t=>`<button type="button" class="competition-tag-filter" data-v161-edition-filter="${esc(t.id)}">${tagChip(t,'competition-edition-chip')}</button>`).join(''):`<span class="jersey-empty-relation">Tag édition à consolider</span>`}</div>
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
    const tags=uniqueTags(tagRows);
    const eds=familyEditionRows(family),editionIds=new Set(eds.map(x=>String(x.id)));
    const matchCount=(window.BLEUS3000_RELATIONAL_REFS?.matches||[]).filter(m=>editionIds.has(String(m.competition_edition_id||''))).length;
    const multi=members.length>1;
    return `<article class="competition-catalog-tile${multi?' is-family':''}" data-v161-family="${esc(family.id)}">
      <div class="competition-catalog-head"><div><h3>${esc(family.name)}</h3><small>${esc(family.competition_type||'Compétition')} · ${members.length} entité${members.length>1?'s':''} · ${matchCount} match${matchCount>1?'s':''} relié${matchCount>1?'s':''}</small>
      <div class="competition-catalog-tags"><span class="competition-family-chip">🏆 ${esc(family.name)}</span>${tags.map(t=>`<button type="button" class="competition-tag-filter" data-v161-family-filter="${esc(t.id)}">${tagChip(t,'competition-section-chip')}</button>`).join('')}</div></div>
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
  function installCompetitionOverride(){
    const api=window.BLEUS3000_RELATIONAL_REFS;if(!api||api.__v161)return false;const original=api.render.bind(api);
    api.render=async(kind,q='')=>kind==='competitions'?renderCompetitions(q):original(kind,q);
    api.__v161=true;return true;
  }
  async function hydrateMatchJerseys(root=document){
    const api=window.BLEUS3000_JERSEYS;if(!api)return;
    for(const card of $$('.rel-match-tile[data-match-id]',root)){
      if(card.dataset.v161Jersey==='loading'||card.dataset.v161Jersey==='done')continue;
      card.dataset.v161Jersey='loading';
      try{
        const j=await api.getMatchJersey(card.dataset.matchId);
        card.dataset.v161Jersey='done';
        if(!j)return;
        const target=$('.rel-match-bottom',card);if(!target)return;
        target.insertAdjacentHTML('beforebegin',`<div class="rel-match-jersey-preview">${j.photo?`<img src="${esc(j.photo)}" alt="${esc(j.title||'Maillot')}">`:''}<div><strong>👕 ${esc(j.title||'Maillot')}</strong><small>${esc([j.year,j.manufacturer,j.usage].filter(Boolean).join(' · '))}</small></div></div>`);
      }catch{card.dataset.v161Jersey='';}
    }
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
  async function boot(){
    for(let i=0;i<80&&!installCompetitionOverride();i++)await new Promise(r=>setTimeout(r,50));
    await loadCatalog();observe();hydrateMatchJerseys(document);
  }
  boot();
  window.BLEUS3000_V161={loadCatalog,renderCompetitions,get positions(){return positions;}};
})();
