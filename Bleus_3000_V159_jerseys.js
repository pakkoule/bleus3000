/* 3615 Bleus V1.1.61.15 — Maillots · équipementiers relationnels + logos */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>window.BLEUS3000_SEARCH?.normalize?.(v)||String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const role=()=>String(window.C3K_ACCOUNT_STATE?.profile?.role||'guest').toLowerCase();
  const canEdit=()=>['editor','admin','superadmin'].includes(role());
  const usageLabels={domicile:'Domicile',exterieur:'Extérieur',third:'Third',gardien:'Gardien',entrainement:'Entraînement',special:'Édition spéciale',autre:'Autre'};
  const photoTypes={face:'Face',dos:'Dos',detail:'Détail',match:'En match',catalogue:'Catalogue',autre:'Autre'};
  let client=null,loaded=false,loading=null,dbReady=false,rows=[],teamLinks=[],competitionLinks=[],photos=[],matchLinks=[],matches=[],selections=[],competitions=[],tags=[],manufacturers=[];
  let filterState={usage:'all',manufacturer:'all',year:'all',team:'all',competition:'all'};
  let editing=null;

  const seedRows=()=>((window.BLEUS3000_DATA?.referenceEntries?.maillots)||[]).map(r=>({...r,_seed:true}));

  function waitClient(timeout=9000){
    client=window.BLEUS3000_SUPABASE||null;if(client)return Promise.resolve(client);
    return new Promise(resolve=>{let done=false,timer;const finish=c=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('bleus:supabase-ready',ready);client=c||window.BLEUS3000_SUPABASE||null;resolve(client);};const ready=e=>finish(e.detail?.client);window.addEventListener('bleus:supabase-ready',ready);timer=setTimeout(()=>finish(null),timeout);});
  }
  function photoUrl(photo){
    if(photo?.photo_url)return photo.photo_url;
    if(photo?.photo_path&&client){try{return client.storage.from('jersey-photos').getPublicUrl(photo.photo_path).data?.publicUrl||'';}catch{return '';}}
    return '';
  }
  function mainPhoto(row){
    if(row._seed)return row.main_photo_url||'';
    const list=photos.filter(p=>String(p.jersey_id)===String(row.id)).sort((a,b)=>(Number(b.is_primary)-Number(a.is_primary))||(Number(a.sort_order||0)-Number(b.sort_order||0)));
    const preferred=list.find(p=>p.is_primary)||list[0];
    if(row.main_photo_url)return row.main_photo_url;
    if(preferred)return photoUrl(preferred)||'';
    if(row.main_photo_path&&client){try{return client.storage.from('jersey-photos').getPublicUrl(row.main_photo_path).data?.publicUrl||'';}catch{}}
    return '';
  }
  function photoCount(row){return photoList(row).length;}
  function photoList(row){
    const list=[];
    if(row.main_photo_url)list.push({url:row.main_photo_url,caption:'Photo principale',credit:'',is_primary:true});
    if(!row._seed){for(const p of photos.filter(x=>String(x.jersey_id)===String(row.id)).sort((a,b)=>(Number(b.is_primary)-Number(a.is_primary))||(Number(a.sort_order||0)-Number(b.sort_order||0)))){const url=photoUrl(p);if(url&&!list.some(x=>x.url===url))list.push({url,caption:p.caption||photoTypes[p.photo_type]||'Photo',credit:p.credit||'',is_primary:!!p.is_primary});}}
    return list;
  }
  function equipmentFor(row){
    if(!row)return null;
    if(row.manufacturer_id){const found=manufacturers.find(x=>String(x.id)===String(row.manufacturer_id));if(found)return found;}
    const n=norm(row.manufacturer||'');return manufacturers.find(x=>norm(x.name)===n||(x.aliases||[]).some(a=>norm(a)===n))||null;
  }
  function equipmentHtml(row){
    const e=equipmentFor(row);
    if(e&&window.BLEUS3000_EQUIPMENT?.renderCompact)return window.BLEUS3000_EQUIPMENT.renderCompact(e.id);
    return `<span class="equipment-compact equipment-compact--logo-only" title="${esc(row?.manufacturer||'Équipementier')}"><span class="equipment-compact-fallback">👕</span></span>`;
  }
  function teamRelations(row){
    if(row._seed)return row.team_relations||[];
    const ids=teamLinks.filter(x=>String(x.jersey_id)===String(row.id)).map(x=>String(x.selection_team_id));
    return selections.filter(x=>ids.includes(String(x.id)));
  }
  function competitionRelations(row){
    if(row._seed)return row.competition_relations||[];
    const ids=competitionLinks.filter(x=>String(x.jersey_id)===String(row.id)).map(x=>String(x.competition_id));
    return competitions.filter(x=>ids.includes(String(x.id)));
  }
  function tagById(id){return tags.find(t=>String(t.id)===String(id))||null;}
  function chipForTeam(t,rowId){
    const tag=t?.team_tag_id?tagById(t.team_tag_id):null;
    const inside=tag&&window.BLEUS3000_TAGS?.chipHtml?window.BLEUS3000_TAGS.chipHtml(tag,'jersey-team-chip'):`<span class="jersey-fallback-chip">${esc(t?.name||t?.label||'Équipe de France')}</span>`;
    return `<button type="button" class="jersey-team-filter-btn" data-jersey-team-filter="${esc(t?.id||'')}" data-jersey-team-row="${esc(rowId)}" title="Afficher les matchs de cette sélection">${inside}</button>`;
  }
  function chipForCompetition(c){
    const tag=c?.tag_id?tagById(c.tag_id):null;
    if(tag&&window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(tag,'jersey-competition-chip');
    return `<span class="jersey-fallback-chip jersey-competition-chip">${esc(c?.name||c?.label||'Compétition')}</span>`;
  }
  function yearLabel(r){
    if(r.season_label)return r.season_label;
    if(r.year_start&&r.year_end&&r.year_start!==r.year_end)return `${r.year_start}–${r.year_end}`;
    return String(r.year_start||r.year_end||'—');
  }
  function fields(r){
    return [
      ['Usage',usageLabels[r.usage_type]||r.usage_type||'—'],['Équipementier',r.manufacturer||'—'],['Saison',yearLabel(r)],['Référence',r.manufacturer_reference||r.template_name||'—'],
      ['Col',r.collar_type||'—'],['Manches',r.sleeve_type||'—'],['Écusson',r.crest_description||'—'],['Flocage n°',r.number_font||'—'],['Version',r.version_type||'—']
    ];
  }
  function sourcesFor(r){return Array.isArray(r.source_urls)?r.source_urls:(r.sources||[]);}
  function contributorFor(r){return r.contributors?.[0]||'3615 Bleus';}
  function showSources(r){
    const list=sourcesFor(r);const title=$('#sourcesTitle'),host=$('#sourcesList');if(!title||!host)return;
    title.textContent=`Sources · ${r.title}`;
    host.innerHTML=list.length?list.map((s,i)=>`<div class="source-row"><span class="src-icon">🔗</span><div><strong>${esc(s)}</strong><small>Source du référentiel Maillots</small></div><span>Source ${i+1}</span></div>`).join(''):'<div class="universal-search-empty">Aucune source renseignée.</div>';
    window.BLEUS3000_APP?.openModal?.('sourcesModal');
  }

  async function load(){
    if(loaded)return rows;if(loading)return loading;
    loading=(async()=>{
      try{
        await window.BLEUS3000_RELATIONAL_REFS?.load?.();
        selections=window.BLEUS3000_RELATIONAL_REFS?.getSelections?.()||[];
        competitions=window.BLEUS3000_RELATIONAL_REFS?.getCompetitions?.()||[];
        tags=window.BLEUS3000_RELATIONAL_REFS?.getTags?.()||[];
      }catch{}
      if(!await waitClient()){rows=seedRows();dbReady=false;loaded=true;return rows;}
      try{
        await window.BLEUS3000_EQUIPMENT?.load?.();
        const [jr,tl,cl,ph,eq]=await Promise.all([
          client.from('jerseys').select('*').order('year_start',{ascending:false}).order('title'),
          client.from('jersey_selection_teams').select('*').limit(10000),
          client.from('jersey_competitions').select('*').limit(10000),
          client.from('jersey_photos').select('*').order('sort_order').limit(10000),
          client.from('equipment_manufacturers').select('*').eq('active',true).order('name')
        ]);
        if(jr.error)throw jr.error;if(tl.error)throw tl.error;if(cl.error)throw cl.error;if(ph.error)throw ph.error;if(eq.error)throw eq.error;
        rows=jr.data||[];teamLinks=tl.data||[];competitionLinks=cl.data||[];photos=ph.data||[];manufacturers=eq.data||[];
        matches=window.BLEUS3000_RELATIONAL_REFS?.matches||[];
        const ml=await client.from('match_jerseys').select('*').limit(10000);
        if(!ml.error)matchLinks=ml.data||[];else if(String(ml.error.code||'')!=='42P01')console.warn('Maillots · liens matchs',ml.error);
        dbReady=true;
        if(!rows.length)rows=seedRows();
      }catch(err){console.warn('Maillots · migration Supabase non disponible',err);dbReady=false;rows=seedRows();}
      loaded=true;return rows;
    })().finally(()=>loading=null);
    return loading;
  }

  function renderFilters(list){
    const bar=$('#referenceFacetFilters');if(!bar)return;
    const usages=[...new Set(list.map(r=>r.usage_type).filter(Boolean))].sort();
    const makers=[...new Set(list.map(r=>r.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    const years=[...new Set(list.flatMap(r=>[r.year_start,r.year_end]).filter(Boolean))].sort((a,b)=>b-a);
    const opts=(vals,current,labelFn=x=>x)=>`<option value="all">Tous</option>${vals.map(v=>`<option value="${esc(v)}" ${String(current)===String(v)?'selected':''}>${esc(labelFn(v))}</option>`).join('')}`;
    bar.hidden=false;bar.className='reference-filter-bar jersey-filter-bar';
    const linkedTeams=[...new Map(list.flatMap(r=>teamRelations(r)).filter(Boolean).map(x=>[String(x.id),x])).values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));
    const linkedComps=[...new Map(list.flatMap(r=>competitionRelations(r)).filter(Boolean).map(x=>[String(x.id),x])).values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));
    bar.innerHTML=`<label>Type de maillot<select data-jersey-filter="usage">${opts(usages,filterState.usage,v=>usageLabels[v]||v)}</select></label><label>Équipementier<select data-jersey-filter="manufacturer">${opts(makers,filterState.manufacturer)}</select></label><label>Année<select data-jersey-filter="year">${opts(years,filterState.year)}</select></label><label>Sélection liée<select data-jersey-filter="team"><option value="all">Toutes</option>${linkedTeams.map(x=>`<option value="${esc(x.id)}" ${filterState.team===String(x.id)?'selected':''}>${esc(x.name||x.category||'Sélection')}</option>`).join('')}</select></label><label>Compétition liée<select data-jersey-filter="competition"><option value="all">Toutes</option>${linkedComps.map(x=>`<option value="${esc(x.id)}" ${filterState.competition===String(x.id)?'selected':''}>${esc(x.name||'Compétition')}</option>`).join('')}</select></label><button class="jersey-filter-reset" id="jerseyFilterReset" type="button">Réinitialiser</button>`;
    bar.onchange=e=>{const key=e.target.dataset.jerseyFilter;if(!key)return;filterState[key]=e.target.value;render($('#referenceSearch')?.value||'');};
    $('#jerseyFilterReset')?.addEventListener('click',()=>{filterState={usage:'all',manufacturer:'all',year:'all',team:'all',competition:'all'};render($('#referenceSearch')?.value||'');});
  }
  function filtered(list,q){
    const nq=norm(q);
    return list.filter(r=>{
      if(filterState.usage!=='all'&&String(r.usage_type)!==filterState.usage)return false;
      if(filterState.manufacturer!=='all'&&String(r.manufacturer)!==filterState.manufacturer)return false;
      if(filterState.year!=='all'&&![String(r.year_start||''),String(r.year_end||'')].includes(filterState.year))return false;
      if(filterState.team!=='all'&&!teamRelations(r).some(x=>String(x.id)===String(filterState.team)))return false;
      if(filterState.competition!=='all'&&!competitionRelations(r).some(x=>String(x.id)===String(filterState.competition)))return false;
      if(!nq)return true;
      const rel=[...teamRelations(r).map(x=>x.name||x.label),...competitionRelations(r).map(x=>x.name||x.label)];
      return norm([r.title,r.season_label,r.usage_type,r.manufacturer,r.manufacturer_reference,r.template_name,r.primary_color,r.secondary_color,r.collar_type,r.sleeve_type,r.pattern_description,r.number_font,r.version_type,r.notes_short,...rel].join(' ')).includes(nq);
    });
  }
  function linkedMatchesFor(r,teamId='all'){
    if(r?._seed)return [];
    const links=matchLinks.filter(x=>String(x.jersey_id)===String(r.id));
    const ids=new Set(links.map(x=>String(x.match_id)));
    return matches.filter(m=>ids.has(String(m.id))&&(teamId==='all'||String(m.selection_team_id)===String(teamId))).sort((a,b)=>String(b.match_date||'').localeCompare(String(a.match_date||'')));
  }
  function selectionName(m){return m?.selection?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||m?.selection_category||'France';}
  function matchMiniCard(m){
    const date=m?.match_date?new Date(m.match_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
    const opponent=m?.opponent?.name||m?.manual_overrides?.opponent_name||'Adversaire';
    const competition=m?.competition?.name||m?.manual_overrides?.competition_name||'Match international';
    const fs=m?.manual_overrides&&Object.prototype.hasOwnProperty.call(m.manual_overrides,'france_score')?m.manual_overrides.france_score:m?.france_score;
    const os=m?.manual_overrides&&Object.prototype.hasOwnProperty.call(m.manual_overrides,'opponent_score')?m.manual_overrides.opponent_score:m?.opponent_score;
    const score=(fs!==null&&fs!==undefined&&fs!==''&&os!==null&&os!==undefined&&os!=='')?`${fs}–${os}`:'VS';
    return `<button type="button" class="jersey-match-row" data-jersey-open-match="${esc(m.id)}"><span class="jersey-match-date">${esc(date)}</span><span class="jersey-match-main"><strong>${esc(selectionName(m))} <b>${esc(score)}</b> ${esc(opponent)}</strong><small>${esc(competition)}</small></span><span class="jersey-match-arrow">↗</span></button>`;
  }
  function expandedMatchesHtml(r,teamId='all'){
    const list=linkedMatchesFor(r,teamId);
    const team=teamId==='all'?null:selections.find(x=>String(x.id)===String(teamId));
    const label=team?selectionName({selection:team}):'Toutes les sélections affiliées';
    return `<div class="jersey-expanded-head"><strong>Matchs liés</strong><span>${esc(label)} · ${list.length}</span></div><div class="jersey-match-list">${list.length?list.map(matchMiniCard).join(''):'<div class="jersey-match-empty">Aucun match n’est encore associé à ce maillot pour cette sélection.</div>'}</div>`;
  }
  function renderCard(r){
    const teams=teamRelations(r),comps=competitionRelations(r),photo=mainPhoto(r),count=photoCount(r);
    const linkRef=`jersey:${r.id}`;
    return `<article class="jersey-tile jersey-tile-compact" data-jersey-id="${esc(r.id)}" data-jersey-link="${esc(linkRef)}">
      <div class="jersey-photo-wrap"><button class="jersey-photo-stage" type="button" data-jersey-gallery="${esc(r.id)}">${photo?`<img src="${esc(photo)}" alt="Maillot ${esc(yearLabel(r))}" loading="lazy">`:`<div class="jersey-photo-placeholder"><svg viewBox="0 0 64 64"><path d="M22 12 14 17 7 29l10 6 4-6v23h22V29l4 6 10-6-7-12-8-5-5 7H27z"></path><path d="M27 19h10"></path></svg><strong>Photo à ajouter</strong></div>`}${count>1?`<span class="jersey-photo-count">▧ ${count}</span>`:''}</button>${canEdit()?`<button class="jersey-compact-edit" type="button" data-jersey-edit="${esc(r.id)}" title="Modifier le maillot">✎</button>`:''}</div>
      <div class="jersey-tile-body jersey-compact-body">
        <div class="jersey-compact-meta"><div><span>Année</span><strong>${esc(yearLabel(r))}</strong></div><div class="jersey-equipment-cell"><span>Équipementier</span><strong class="jersey-equipment-display">${equipmentHtml(r)}</strong></div></div>
        <div class="jersey-relation-block jersey-compact-relations"><span class="jersey-relation-label">Équipes</span><div class="jersey-tag-row">${teams.length?teams.map(t=>chipForTeam(t,r.id)).join(''):'<span class="jersey-empty-relation">Aucune équipe reliée</span>'}</div><div class="jersey-tag-separator"></div><span class="jersey-relation-label">Compétitions</span><div class="jersey-tag-row">${comps.length?comps.map(chipForCompetition).join(''):'<span class="jersey-empty-relation">Aucune compétition reliée</span>'}</div></div>
        <button class="jersey-expand-btn" type="button" data-jersey-expand="${esc(r.id)}" aria-expanded="false" title="Afficher les matchs liés"><span>+</span></button>
        <div class="jersey-expanded-panel" data-jersey-expanded-panel="${esc(r.id)}">${expandedMatchesHtml(r,'all')}</div>
      </div>
    </article>`;
  }
  function setExpandedCard(card,row,teamId='all',forceOpen=true){
    if(!card||!row)return;
    const panel=$('[data-jersey-expanded-panel]',card),btn=$('[data-jersey-expand]',card);
    if(panel)panel.innerHTML=expandedMatchesHtml(row,teamId);
    if(forceOpen){card.classList.add('is-expanded');if(btn){btn.setAttribute('aria-expanded','true');btn.querySelector('span').textContent='−';}}
    $$('[data-jersey-team-filter]',card).forEach(x=>x.classList.toggle('is-active',teamId!=='all'&&String(x.dataset.jerseyTeamFilter)===String(teamId)));
    $$('[data-jersey-open-match]',card).forEach(x=>x.addEventListener('click',()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(x.dataset.jerseyOpenMatch)));
  }


  async function render(q=''){
    const host=$('#referenceEntries'),title=$('#referenceModalTitle'),sub=$('#referenceModalSub'),count=$('#referenceCount');if(!host)return;
    host.innerHTML='<div class="selection-loading">Chargement des maillots…</div>';
    await load();renderFilters(rows);
    const list=filtered(rows,q);
    if(title)title.textContent='Maillots';if(sub)sub.textContent='Maillots des sélections françaises · photos · équipes et compétitions affiliées';if(count)count.textContent=`${list.length} maillot${list.length>1?'s':''}`;
    host.innerHTML=list.length?`<div class="jersey-reference-grid">${list.map(renderCard).join('')}</div>`:'<div class="universal-search-empty">Aucun maillot ne correspond aux filtres.</div>';
    $$('[data-jersey-edit]',host).forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.jerseyEdit)));
    $$('[data-jersey-gallery]',host).forEach(b=>b.addEventListener('click',()=>openGallery(b.dataset.jerseyGallery)));
    $$('[data-jersey-expand]',host).forEach(b=>b.addEventListener('click',()=>{const card=b.closest('.jersey-tile'),row=rows.find(x=>String(x.id)===String(b.dataset.jerseyExpand));if(!card||!row)return;const opening=!card.classList.contains('is-expanded');card.classList.toggle('is-expanded',opening);b.setAttribute('aria-expanded',opening?'true':'false');const mark=b.querySelector('span');if(mark)mark.textContent=opening?'−':'+';if(opening)setExpandedCard(card,row,'all',true);}));
    $$('[data-jersey-team-filter]',host).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const card=b.closest('.jersey-tile'),row=rows.find(x=>String(x.id)===String(b.dataset.jerseyTeamRow));if(card&&row)setExpandedCard(card,row,b.dataset.jerseyTeamFilter,true);}));
  }


  function ensureGallery(){
    let modal=$('#jerseyGalleryModal');if(modal)return modal;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="jerseyGalleryModal" hidden><section class="modal-dialog jersey-gallery-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2 id="jerseyGalleryTitle">Photos du maillot</h2><p>Photo principale · face · dos · détails · photos portées</p></div><button class="modal-close" id="jerseyGalleryClose" type="button">×</button></header><div class="modal-body"><div class="jersey-gallery-main" id="jerseyGalleryMain"></div><div class="jersey-gallery-thumbs" id="jerseyGalleryThumbs"></div></div></section></div>`);
    modal=$('#jerseyGalleryModal');$('#jerseyGalleryClose').addEventListener('click',()=>{modal.hidden=true;document.body.style.overflow='';});modal.addEventListener('pointerdown',e=>{if(e.target===modal){modal.hidden=true;document.body.style.overflow='';}});return modal;
  }
  function openGallery(id){
    const row=rows.find(x=>String(x.id)===String(id));if(!row)return;const list=photoList(row);if(!list.length)return;
    const modal=ensureGallery(),main=$('#jerseyGalleryMain'),thumbs=$('#jerseyGalleryThumbs');$('#jerseyGalleryTitle').textContent=`Photos · ${row.title}`;
    const show=i=>{const p=list[i]||list[0];main.innerHTML=`<img src="${esc(p.url)}" alt="${esc(row.title)}"><div><strong>${esc(p.caption||'Photo')}</strong>${p.credit?`<span>Crédit : ${esc(p.credit)}</span>`:''}</div>`;$$('[data-gallery-index]',thumbs).forEach((b,n)=>b.classList.toggle('is-active',n===i));};
    thumbs.innerHTML=list.map((p,i)=>`<button type="button" data-gallery-index="${i}"><img src="${esc(p.url)}" alt="${esc(p.caption||'Photo')}"><span>${esc(p.caption||'Photo')}</span></button>`).join('');$$('[data-gallery-index]',thumbs).forEach(b=>b.addEventListener('click',()=>show(Number(b.dataset.galleryIndex))));show(0);modal.hidden=false;document.body.style.overflow='hidden';
  }

  function ensureEditor(){
    let modal=$('#jerseyEditorModal');if(modal)return modal;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="jerseyEditorModal" hidden><section class="modal-dialog jersey-editor-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2 id="jerseyEditorTitle">Ajouter un maillot</h2><p>Photo principale · galerie · équipes et compétitions affiliées</p></div><button class="modal-close" id="jerseyEditorClose" type="button">×</button></header><div class="modal-body"><form id="jerseyEditorForm" class="jersey-editor-form"></form></div></section></div>`);
    modal=$('#jerseyEditorModal');$('#jerseyEditorClose').addEventListener('click',()=>{modal.hidden=true;document.body.style.overflow='';});modal.addEventListener('pointerdown',e=>{if(e.target===modal){modal.hidden=true;document.body.style.overflow='';}});$('#jerseyEditorForm').addEventListener('submit',saveEditor);return modal;
  }
  function pickerHtml(kind,items,selectedIds){
    return `<div><span class="jersey-relation-label">${kind==='team'?'Équipes affiliées':'Compétitions affiliées'}</span><div class="jersey-picker-list">${items.map(item=>`<label class="jersey-picker-item"><input type="checkbox" name="${kind}_ids" value="${esc(item.id)}" ${selectedIds.includes(String(item.id))?'checked':''}><span>${esc(item.name||item.label||item.code||'Entrée')}</span></label>`).join('')||'<span class="jersey-empty-relation">Aucune donnée relationnelle chargée.</span>'}</div></div>`;
  }
  function editorHtml(row={}){
    const teamIds=teamRelations(row).map(x=>String(x.id)),compIds=competitionRelations(row).map(x=>String(x.id)),sources=sourcesFor(row).join('\n'),primary=mainPhoto(row),currentEquipment=equipmentFor(row);
    const equipmentOptions=`<option value="">— Aucun équipementier —</option>${manufacturers.map(e=>`<option value="${esc(e.id)}" ${String(currentEquipment?.id||'')===String(e.id)?'selected':''}>${esc(e.name)}</option>`).join('')}`;
    return `<section class="jersey-editor-section"><h3>Maillot</h3><div class="jersey-editor-grid"><label>Nom de la tuile<input name="title" required maxlength="160" value="${esc(row.title||'')}"><small>Ce nom est aussi celui affiché dans l’édition des feuilles de match.</small></label><label>Type<select name="usage_type">${Object.entries(usageLabels).map(([v,l])=>`<option value="${v}" ${String(row.usage_type||'domicile')===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Portée / genre<select name="gender_scope"><option value="">Toutes</option><option value="M" ${row.gender_scope==='M'?'selected':''}>Masculin</option><option value="F" ${row.gender_scope==='F'?'selected':''}>Féminin</option><option value="Mixte" ${row.gender_scope==='Mixte'?'selected':''}>Mixte</option></select></label><label>Saison / millésime<input name="season_label" maxlength="60" value="${esc(row.season_label||'')}"></label><label>Année début<input name="year_start" type="number" min="1900" max="2100" value="${esc(row.year_start||'')}"></label><label>Année fin<input name="year_end" type="number" min="1900" max="2100" value="${esc(row.year_end||'')}"></label><label>Équipementier<select name="manufacturer_id">${equipmentOptions}</select><small>Géré depuis Profil → Équipementiers.</small></label></div></section>
    <section class="jersey-editor-section"><h3>Relations 3615 Bleus</h3><div class="jersey-relations-picker">${pickerHtml('team',selections,teamIds)}${pickerHtml('competition',competitions,compIds)}</div><div class="jersey-editor-separator"></div><small style="font-size:6.3px;color:#70869f">Ces associations pilotent automatiquement les maillots proposés dans une feuille de match : sélection + compétition.</small></section>
    <section class="jersey-editor-section"><h3>Photos</h3><div class="jersey-photo-editor"><div class="jersey-photo-preview" id="jerseyPhotoPreview">${primary?`<img src="${esc(primary)}" alt="Aperçu">`:'<span class="jersey-empty-relation">Aucune photo principale</span>'}</div><div class="jersey-photo-fields"><label>URL de photo principale<input name="main_photo_url" type="url" value="${esc(row.main_photo_url||'')}" placeholder="https://…"></label><label>Ajouter des photos<input name="photos" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><label>Type des nouvelles photos<select name="photo_type">${Object.entries(photoTypes).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Crédit photo<input name="photo_credit" maxlength="160"></label></div></div><div class="jersey-photo-gallery-preview" id="jerseyPhotoGalleryPreview"></div></section>
    <section class="jersey-editor-section"><h3>Notes & sources</h3><label>Notes courtes<input name="notes_short" maxlength="500" value="${esc(row.notes_short||'')}"></label><label style="margin-top:8px">URLs / références · une par ligne<textarea name="source_urls" placeholder="https://…">${esc(sources)}</textarea></label></section>
    <div class="jersey-editor-status" id="jerseyEditorStatus" hidden></div><div class="c3k-v8-actions"><button class="secondary-btn" type="button" id="jerseyEditorCancel">Annuler</button><button class="primary-btn" type="submit">${row.id&&!row._seed?'Enregistrer':'Créer le maillot'}</button></div>`;
  }
  async function openEditor(id=null){
    if(!canEdit())return alert('Modification réservée aux éditeurs et administrateurs.');await load();editing=id?rows.find(x=>String(x.id)===String(id))||null:null;
    if(editing?._seed)editing=null;
    const modal=ensureEditor();$('#jerseyEditorTitle').textContent=editing?'Modifier le maillot':'Ajouter un maillot';const form=$('#jerseyEditorForm');form.innerHTML=editorHtml(editing||{});
    $('#jerseyEditorCancel').addEventListener('click',()=>{modal.hidden=true;document.body.style.overflow='';});
    const files=form.elements.photos,preview=$('#jerseyPhotoGalleryPreview');files?.addEventListener('change',()=>{preview.innerHTML='';[...(files.files||[])].slice(0,12).forEach(file=>{const url=URL.createObjectURL(file);preview.insertAdjacentHTML('beforeend',`<div class="jersey-photo-thumb"><img src="${url}" alt="Aperçu"></div>`);});});
    form.elements.main_photo_url?.addEventListener('input',e=>{const p=$('#jerseyPhotoPreview');p.innerHTML=e.target.value?`<img src="${esc(e.target.value)}" alt="Aperçu">`:'<span class="jersey-empty-relation">Aucune photo principale</span>';});
    modal.hidden=false;document.body.style.overflow='hidden';
  }

  async function uploadPhotos(jerseyId,files,fd,currentMain){
    if(!files.length)return currentMain||null;
    let main=currentMain||null;let order=photos.filter(p=>String(p.jersey_id)===String(jerseyId)).length;
    for(const file of files){
      if(file.size>10*1024*1024)throw new Error(`${file.name} dépasse 10 Mo.`);
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const safe=['jpg','jpeg','png','webp'].includes(ext)?ext:'jpg';
      const path=`${jerseyId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${safe}`;
      const {error:upErr}=await client.storage.from('jersey-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});if(upErr)throw upErr;
      const isPrimary=!main;const {error:phErr}=await client.from('jersey_photos').insert({jersey_id:jerseyId,photo_path:path,photo_type:String(fd.get('photo_type')||'autre'),credit:String(fd.get('photo_credit')||'').trim()||null,is_primary:isPrimary,sort_order:order++});if(phErr)throw phErr;
      if(isPrimary)main=path;
    }
    return main;
  }
  async function saveEditor(e){
    e.preventDefault();const form=e.currentTarget,status=$('#jerseyEditorStatus'),fd=new FormData(form);status.hidden=false;status.className='jersey-editor-status';status.textContent='Enregistrement…';
    if(!dbReady){status.classList.add('is-error');status.textContent='Le référentiel Maillots est prêt dans le code, mais le schéma Maillots doit être installé via SUPABASE_BASELINE.sql avant le premier enregistrement.';return;}
    try{
      const n=v=>v===''?null:Number(v);
      const payload={title:String(fd.get('title')||'').trim(),usage_type:String(fd.get('usage_type')||'domicile'),gender_scope:String(fd.get('gender_scope')||'').trim()||null,season_label:String(fd.get('season_label')||'').trim()||null,year_start:n(fd.get('year_start')),year_end:n(fd.get('year_end')),manufacturer_id:String(fd.get('manufacturer_id')||'').trim()||null,notes_short:String(fd.get('notes_short')||'').trim()||null,source_urls:String(fd.get('source_urls')||'').split('\n').map(x=>x.trim()).filter(Boolean),main_photo_url:String(fd.get('main_photo_url')||'').trim()||null,updated_at:new Date().toISOString()};
      let jerseyId=editing?.id;
      if(jerseyId){const {error}=await client.from('jerseys').update(payload).eq('id',jerseyId);if(error)throw error;}
      else{const {data,error}=await client.from('jerseys').insert(payload).select('id').single();if(error)throw error;jerseyId=data.id;}
      const teamIds=fd.getAll('team_ids').map(String),compIds=fd.getAll('competition_ids').map(String);
      await Promise.all([client.from('jersey_selection_teams').delete().eq('jersey_id',jerseyId),client.from('jersey_competitions').delete().eq('jersey_id',jerseyId)]);
      if(teamIds.length){const {error}=await client.from('jersey_selection_teams').insert(teamIds.map(selection_team_id=>({jersey_id:jerseyId,selection_team_id})));if(error)throw error;}
      if(compIds.length){const {error}=await client.from('jersey_competitions').insert(compIds.map(competition_id=>({jersey_id:jerseyId,competition_id})));if(error)throw error;}
      const fileList=[...(form.elements.photos?.files||[])];const mainPath=await uploadPhotos(jerseyId,fileList,fd,editing?.main_photo_path||null);
      if(mainPath&&!payload.main_photo_url){const {error}=await client.from('jerseys').update({main_photo_path:mainPath,updated_at:new Date().toISOString()}).eq('id',jerseyId);if(error)throw error;}
      status.classList.add('is-ok');status.textContent='Maillot enregistré.';loaded=false;editing=null;await render($('#referenceSearch')?.value||'');setTimeout(()=>{const modal=$('#jerseyEditorModal');if(modal){modal.hidden=true;document.body.style.overflow='';}},350);
    }catch(err){console.error('Maillot · enregistrement',err);status.classList.add('is-error');status.textContent=String(err?.message||err);}
  }

  async function getMatchPickerData(matchId,m={}){
    await load();
    matches=window.BLEUS3000_RELATIONAL_REFS?.matches||matches;
    const teamId=String(m?.selection_team_id||m?.selection?.id||'');
    const competitionId=String(m?.competition_id||m?.competition?.id||'');
    const scoreCandidate=r=>{
      const teamIds=teamRelations(r).map(x=>String(x.id)),compIds=competitionRelations(r).map(x=>String(x.id));
      const teamOk=!teamId||!teamIds.length||teamIds.includes(teamId);
      const compOk=!competitionId||!compIds.length||compIds.includes(competitionId);
      if(!teamOk||!compOk)return -999;
      return (teamIds.includes(teamId)?8:0)+(compIds.includes(competitionId)?8:0)+(teamIds.length?2:0)+(compIds.length?2:0);
    };
    const exact=rows.filter(r=>!r._seed&&(!teamId||teamRelations(r).some(x=>String(x.id)===teamId))&&(!competitionId||competitionRelations(r).some(x=>String(x.id)===competitionId)));
    let candidates=exact.length?exact:rows.filter(r=>!r._seed&&scoreCandidate(r)>-999);
    candidates.sort((a,b)=>scoreCandidate(b)-scoreCandidate(a)||Number(b.year_start||0)-Number(a.year_start||0)||String(a.title||'').localeCompare(String(b.title||''),'fr'));
    const selected=matchLinks.find(x=>String(x.match_id)===String(matchId)&&String(x.role||'outfield')==='outfield');
    return {selectedId:selected?.jersey_id||'',options:candidates.map(r=>({id:r.id,label:[r.title,yearLabel(r),r.manufacturer,usageLabels[r.usage_type]||r.usage_type].filter(Boolean).join(' · '),title:r.title||'',photo:mainPhoto(r),year:yearLabel(r),manufacturer:r.manufacturer||'',link:`jersey:${r.id}`}))};
  }
  async function setMatchJersey(matchId,jerseyId,selectionTeamId=null){
    await load();if(!client)throw new Error('Supabase indisponible.');
    const del=await client.from('match_jerseys').delete().eq('match_id',matchId).eq('role','outfield');
    if(del.error)throw del.error;
    matchLinks=matchLinks.filter(x=>!(String(x.match_id)===String(matchId)&&String(x.role||'outfield')==='outfield'));
    if(jerseyId){const payload={match_id:matchId,jersey_id:jerseyId,selection_team_id:selectionTeamId||null,role:'outfield'};const ins=await client.from('match_jerseys').insert(payload).select().single();if(ins.error)throw ins.error;matchLinks.push(ins.data||payload);}
    return true;
  }
  async function getMatchJersey(matchId){
    await load();const link=matchLinks.find(x=>String(x.match_id)===String(matchId)&&String(x.role||'outfield')==='outfield');if(!link)return null;const row=rows.find(x=>String(x.id)===String(link.jersey_id));if(!row)return null;return {id:row.id,title:row.title||'',year:yearLabel(row),manufacturer:row.manufacturer||'',usage:usageLabels[row.usage_type]||row.usage_type||'',photo:mainPhoto(row),link:`jersey:${row.id}`};
  }
  function openNew(){openEditor(null);}
  function invalidate(){loaded=false;loading=null;rows=[];teamLinks=[];competitionLinks=[];photos=[];matchLinks=[];matches=[];manufacturers=[];}
  window.BLEUS3000_JERSEYS={render,load,openNew,openEditor,invalidate,getMatchPickerData,setMatchJersey,getMatchJersey,linkFor:id=>`jersey:${id}`};
  window.addEventListener('bleus:supabase-ready',()=>invalidate());window.addEventListener('bleus:equipment-changed',()=>invalidate());
})();
