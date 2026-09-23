/* Bleus 3000 V1.1.17 — Référentiel Sélections · France A M/F + compteurs dynamiques */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(+d)?v:d.toLocaleDateString('fr-FR');};
  const role=()=>window.C3K_ACCOUNT_STATE?.profile?.role||'guest';
  const canEdit=()=>['contributor','admin','superadmin'].includes(role());
  const cfg=window.BLEUS3000_CONFIG||{};
  let client=null,teams=[],teamCounts=new Map(),borders=new Map(),rows=[],selectedCode='FRA-A-M',query='',page=1,pageSize=60,loading=false,tags=[],tagReferenceLinks=[];
  let sortKey='selections',sortDir='desc',jerseyFilter='',tagFilter='';
  let currentEditor=null,pendingPhoto=null,pendingPhotoPreview='',pendingJerseyNumbers=[];

  const waitClient=()=>new Promise(resolve=>{
    let n=0;const tick=()=>{client=window.BLEUS3000_SUPABASE||null;if(client||n++>40)return resolve(client);setTimeout(tick,100);};tick();
  });
  const selectedTeam=()=>teams.find(t=>t.code===selectedCode)||teams[0];
  const photoUrl=path=>{if(!path||!client)return '';try{return client.storage.from('player-photos').getPublicUrl(path).data.publicUrl||'';}catch{return '';}};
  const borderStyle=()=>{
    const b=borders.get(selectedTeam()?.id);if(!b)return 'background:linear-gradient(135deg,#123B8F,#2F6DFF);padding:4px;border-radius:16px';
    const bg=b.appearance==='solid'?b.color_start:`linear-gradient(${b.gradient_angle||135}deg,${b.color_start},${b.color_end})`;
    return `background:${bg};padding:${Number(b.border_width??4)}px;border-radius:${Number(b.border_radius??16)}px`;
  };
  const initials=name=>String(name||'?').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const statVal=v=>v===null||v===undefined?'—':v;
  const JERSEY_BACK_ASSET='assets/jersey-back-france-1998.webp';
  const JERSEY_DIGIT_ASSET=n=>`assets/jersey-number-france-1998-${n}.png`;
  function jerseyDigitsHtml(number){return String(number).split('').map(d=>`<img src="${JERSEY_DIGIT_ASSET(d)}" alt="" aria-hidden="true">`).join('');}
  function jerseyVisualHtml(number,mode='tile',removable=false){const n=Number(number);return `<span class="selection-jersey-visual ${mode==='editor'?'is-editor':'is-tile'}" title="Maillot n° ${n}" data-jersey-number="${n}"><img class="selection-jersey-back" src="${JERSEY_BACK_ASSET}" alt="Dos de maillot France avec le numéro ${n}"><span class="selection-jersey-digits">${jerseyDigitsHtml(n)}</span>${removable?`<button type="button" class="selection-jersey-remove" data-remove-jersey="${n}" aria-label="Retirer le numéro ${n}">×</button>`:''}</span>`;}
  function jerseyListHtml(nums,compact=true){const clean=[...new Set((nums||[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=99))].sort((a,b)=>a-b);if(!clean.length)return '<span class="selection-jersey-empty">—</span>';const shown=compact?clean.slice(0,5):clean;return `<span class="selection-jersey-list ${compact?'is-compact':''}">${shown.map(n=>jerseyVisualHtml(n,compact?'tile':'editor',!compact)).join('')}${compact&&clean.length>shown.length?`<span class="selection-jersey-more">+${clean.length-shown.length}</span>`:''}</span>`;}
  const canAdjust=k=>['selections','goals','wins','draws','losses','starts'].includes(k);
  function statBox(label,key,value,row){
    const controls=canEdit()&&canAdjust(key)?`<span class="sel-stepper"><button type="button" data-stat-step="${key}" data-delta="-1" data-row="${row.id}">−</button><strong>${statVal(value)}</strong><button type="button" data-stat-step="${key}" data-delta="1" data-row="${row.id}">+</button></span>`:`<strong>${statVal(value)}</strong>`;
    return `<div class="sel-stat"><small>${esc(label)}</small>${controls}</div>`;
  }
  function publicPlayer(row){return row?.player||{};}
  function registryFromRows(list){
    const reg=list.map(r=>({id:r.player_id,name:publicPlayer(r).display_name||'Joueur',display_name:publicPlayer(r).display_name||'Joueur',position:publicPlayer(r).primary_position||'',international_number:r.international_number,appearance_status:r.appearance_status||((r.international_number==null&&Number(r.selections||0)===0)?'called_only':'capped'),selection_code:selectedCode,birth_date:publicPlayer(r).birth_date||null,photo_path:publicPlayer(r).photo_path||null}));
    reg.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    window.BLEUS3000_SELECTION_REGISTRY=reg;
    if(!window.BLEUS3000_PLAYER_REGISTRY_ALL)window.BLEUS3000_PLAYER_REGISTRY=reg;
    window.dispatchEvent(new CustomEvent('bleus:player-registry',{detail:{players:reg,selection:selectedCode}}));
  }

  async function loadTeams(){
    if(!client)await waitClient();if(!client)return;
    const [{data:t,error:te},{data:b,error:be},{data:tg,error:tge},{data:trl,error:trle},{data:tc,error:tce}]=await Promise.all([
      client.from('selection_teams').select('*').eq('active',true).order('sort_order'),
      client.from('selection_photo_borders').select('*'),
      client.from('tags').select('*').eq('is_active',true).order('label_text'),
      client.from('tag_reference_links').select('tag_id,reference_type,reference_id,relation_kind').eq('reference_type','selection'),
      client.from('selection_team_counts').select('selection_id,player_count')
    ]);
    if(te)throw new Error('Sélections · '+te.message);if(be)throw be;if(tge)throw tge;if(trle)throw trle;if(tce)throw tce;teams=t||[];teamCounts=new Map((tc||[]).map(x=>[x.selection_id,Number(x.player_count||0)]));borders=new Map((b||[]).map(x=>[x.selection_id,x]));tags=tg||[];tagReferenceLinks=trl||[];
  }
  async function loadRows(code=selectedCode){
    if(!client)await waitClient();if(!client)return [];
    if(!teams.length)await loadTeams();const team=teams.find(t=>t.code===code);if(!team)return [];
    const [{data,error},{data:jerseys,error:jerseyError}]=await Promise.all([
      client.from('player_selection_stats').select(`id,player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,international_number,appearance_status,first_year,last_year,data_status,updated_at,player:players!player_selection_stats_player_id_fkey(id,display_name,last_name,birth_date,photo_path,primary_position,active_source,data_status)`).eq('selection_id',team.id).order('selections',{ascending:false}).order('starts',{ascending:false}).limit(1000),
      client.from('player_jersey_numbers').select('player_id,shirt_number').eq('selection_id',team.id).order('shirt_number',{ascending:true})
    ]);
    if(error)throw error;if(jerseyError)throw jerseyError;
    const jerseyMap=new Map();(jerseys||[]).forEach(x=>{const a=jerseyMap.get(x.player_id)||[];a.push(Number(x.shirt_number));jerseyMap.set(x.player_id,a);});
    rows=(data||[]).map(r=>({...r,_jerseyNumbers:[...new Set(jerseyMap.get(r.player_id)||[])].sort((a,b)=>a-b)}));
    if(code==='FRA-A-M')registryFromRows(rows);return rows;
  }
  async function ensureLoaded(){if(!client)await waitClient();if(!client)return false;if(!teams.length)await loadTeams();if(!rows.length||rows[0]?.selection_id!==selectedTeam()?.id)await loadRows();return true;}

  function renderCategoryTabs(){
    const host=$('#selectionCategoryTabs');if(!host)return;host.hidden=false;
    host.innerHTML=teams.map(t=>{const count=teamCounts.get(t.id)||0;return `<button type="button" class="selection-category-tab ${t.code===selectedCode?'is-active':''}" data-selection-code="${esc(t.code)}"><span>${t.gender==='F'?'♀':'♂'}</span><strong>${esc(t.name.replace(/^France\s*/,''))}</strong>${count?`<small>${count}</small>`:''}</button>`;}).join('');
    $$('[data-selection-code]',host).forEach(b=>b.addEventListener('click',async()=>{selectedCode=b.dataset.selectionCode;page=1;rows=[];jerseyFilter='';tagFilter='';renderLoading();await loadRows();render(query);}));
  }
  function renderLoading(){const host=$('#referenceEntries');if(host)host.innerHTML='<div class="selection-loading">Chargement du référentiel…</div>';}
  function lastNameKey(row){
    const name=String(publicPlayer(row).last_name||publicPlayer(row).display_name||'').trim();
    const parts=name.split(/\s+/).filter(Boolean);if(parts.length<2)return name.toLocaleLowerCase('fr');
    const particles=new Set(['de','du','des','le','la','les','van','von','ben','el','di','da','del','della']);
    let i=parts.length-1;while(i>0&&particles.has(parts[i-1].replace(/[’']/g,'').toLocaleLowerCase('fr')))i--;
    return parts.slice(i).join(' ').toLocaleLowerCase('fr');
  }
  function sortValue(row,key){
    if(key==='last_name')return lastNameKey(row);
    if(key==='jersey_number')return row._jerseyNumbers?.length?Math.min(...row._jerseyNumbers):null;
    return row[key]??null;
  }
  function compareRows(a,b){
    const av=sortValue(a,sortKey),bv=sortValue(b,sortKey);
    if(av==null&&bv==null)return String(publicPlayer(a).display_name||'').localeCompare(String(publicPlayer(b).display_name||''),'fr');
    if(av==null)return 1;if(bv==null)return -1;
    let c=typeof av==='string'||typeof bv==='string'?String(av).localeCompare(String(bv),'fr',{sensitivity:'base'}):Number(av)-Number(bv);
    if(c===0)c=String(publicPlayer(a).display_name||'').localeCompare(String(publicPlayer(b).display_name||''),'fr',{sensitivity:'base'});
    return sortDir==='asc'?c:-c;
  }
  function filterRows(){
    const q=query.trim().toLocaleLowerCase('fr');
    let out=rows.filter(r=>{
      if(jerseyFilter&&!(r._jerseyNumbers||[]).includes(Number(jerseyFilter)))return false;
      if(tagFilter&&!(r._tagIds||[]).includes(tagFilter))return false;
      if(!q)return true;
      const p=publicPlayer(r);const hay=[p.display_name,p.last_name,p.primary_position,r.international_number,r.selections,r.goals,r.appearance_status==='called_only'?'convocation':'international',...(r._jerseyNumbers||[])].join(' ').toLocaleLowerCase('fr');
      return hay.includes(q);
    });
    return out.sort(compareRows);
  }
  function ensureSelectionFilters(){
    const tabs=$('#selectionCategoryTabs');if(!tabs)return;let bar=$('#selectionFilterBar');
    if(!bar){bar=document.createElement('div');bar.id='selectionFilterBar';bar.className='selection-filter-bar';tabs.insertAdjacentElement('afterend',bar);}
    bar.hidden=false;
    const linkedTagIds=new Set(rows.flatMap(r=>r._tagIds||[]));
    const tagOptions=tags.filter(t=>!linkedTagIds.size||linkedTagIds.has(t.id)).map(t=>`<option value="${esc(t.id)}" ${tagFilter===t.id?'selected':''}>${esc(t.label_text)}</option>`).join('');
    bar.innerHTML=`<label>Tri<select id="selectionSortKey"><option value="selections" ${sortKey==='selections'?'selected':''}>Sélections</option><option value="goals" ${sortKey==='goals'?'selected':''}>Buts</option><option value="international_number" ${sortKey==='international_number'?'selected':''}>Ordre d’apparition</option><option value="last_name" ${sortKey==='last_name'?'selected':''}>Nom de famille</option><option value="jersey_number" ${sortKey==='jersey_number'?'selected':''}>Numéro porté</option></select></label><button type="button" class="selection-sort-direction" id="selectionSortDirection" title="Inverser l’ordre">${sortDir==='asc'?'↑ Croissant':'↓ Décroissant'}</button><label>N° porté<select id="selectionJerseyFilter"><option value="">Tous</option>${Array.from({length:99},(_,i)=>i+1).map(n=>`<option value="${n}" ${String(n)===String(jerseyFilter)?'selected':''}>${n}</option>`).join('')}</select></label><label>Tag<select id="selectionTagFilter"><option value="">Tous les tags</option>${tagOptions}</select></label><button type="button" class="selection-filter-reset" id="selectionFilterReset">Réinitialiser</button>`;
    $('#selectionSortKey',bar)?.addEventListener('change',e=>{sortKey=e.target.value;page=1;render(query);});
    $('#selectionSortDirection',bar)?.addEventListener('click',()=>{sortDir=sortDir==='asc'?'desc':'asc';page=1;render(query);});
    $('#selectionJerseyFilter',bar)?.addEventListener('change',e=>{jerseyFilter=e.target.value;page=1;render(query);});
    $('#selectionTagFilter',bar)?.addEventListener('change',e=>{tagFilter=e.target.value;page=1;render(query);});
    $('#selectionFilterReset',bar)?.addEventListener('click',()=>{sortKey='selections';sortDir='desc';jerseyFilter='';tagFilter='';page=1;render(query);});
  }
  function playerPhoto(p){const url=photoUrl(p.photo_path);return url?`<img src="${esc(url)}" alt="Photo de ${esc(p.display_name)}" loading="lazy">`:`<span>${esc(initials(p.display_name))}</span>`;}
  function selectionTagHtml(team,row=null){
    const status=row?.appearance_status==='called_only'?'status':'membership';
    const linked=tagReferenceLinks.find(l=>l.reference_id===team?.id&&l.relation_kind===status);
    const t=linked?tags.find(x=>x.id===linked.tag_id):null;
    if(t&&window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(t,'selection-main-tag-chip');
    if(t)return `<span class="selection-main-tag">${esc(t.icon_text||'🏷️')} ${esc(t.label_text)}</span>`;
    return `<span class="selection-main-tag">${row?.appearance_status==='called_only'?'Convocation':esc(team?.name||'Sélection')}</span>`;
  }
  function contributorHtml(list){return (list||[]).map(c=>`<span class="contrib-label" title="${esc(c.contribution_type||'Contribution')}">${esc(c.label||c.username||'Membre')}</span>`).join('');}
  async function hydrateContributors(visible){
    if(!client||!window.C3K_ACCOUNT_STATE?.profile)return;
    const ids=visible.map(r=>r.player_id);if(!ids.length)return;
    const {data:cs}=await client.from('entity_contributors').select('entity_id,user_id,contribution_type').eq('entity_type','player').in('entity_id',ids);
    const uids=[...new Set((cs||[]).map(x=>x.user_id).filter(Boolean))];if(!uids.length)return;
    const [{data:ps},{data:ls}]=await Promise.all([client.from('profiles').select('id,username,first_name,role').in('id',uids),client.from('member_role_labels').select('user_id,label_text').in('user_id',uids)]);
    const pm=new Map((ps||[]).map(x=>[x.id,x])),lm=new Map((ls||[]).map(x=>[x.user_id,x.label_text]));
    visible.forEach(r=>{r._contributors=(cs||[]).filter(c=>c.entity_id===r.player_id).map(c=>({...(pm.get(c.user_id)||{}),label:lm.get(c.user_id)||pm.get(c.user_id)?.username,contribution_type:c.contribution_type}));});
    drawRows(visible,filterRows().length);
  }
  function appearanceBadge(row){
    const calledOnly=row?.appearance_status==='called_only'||(row?.international_number==null&&Number(row?.selections||0)===0);
    return calledOnly?'<span class="international-number is-called-only">Convocation</span>':`<span class="international-number">N° ${statVal(row?.international_number)}</span>`;
  }
  function drawRows(visible,total){
    const host=$('#referenceEntries'),team=selectedTeam();if(!host)return;
    if(!visible.length){host.innerHTML=`<div class="selection-empty"><strong>Aucune fiche dans ${esc(team?.name||'cette sélection')}.</strong><span>${canEdit()?'Le bouton + Ajouter permet de créer le premier joueur de cette catégorie.':'Cette catégorie est prête à recevoir ses futurs internationaux.'}</span></div>`;return;}
    host.innerHTML=`<div class="selection-grid">${visible.map(r=>{const p=publicPlayer(r);return `<article class="selection-player-tile" data-player-tile="${esc(r.player_id)}">
      <div class="selection-player-head"><div class="selection-photo-frame" style="${borderStyle()}"><div class="selection-photo-inner">${playerPhoto(p)}</div></div><div class="selection-player-title">${appearanceBadge(r)}<h3>${esc(p.display_name||'Joueur')}</h3><div class="selection-dob">Né(e) le ${esc(fmtDate(p.birth_date))}</div><div class="selection-position ${p.primary_position?'':'is-empty'}">Poste · ${esc(p.primary_position||'non renseigné')}</div><div class="selection-tile-actions"><button type="button" data-source-player="${r.player_id}" title="Sources">🔗</button>${canEdit()?`<button type="button" data-edit-player="${r.player_id}" title="Modifier">✎</button>`:''}</div></div></div>
      <div class="selection-stats-grid">${statBox('Sélections','selections',r.selections,r)}${statBox('Buts','goals',r.goals,r)}${statBox('Titularisations','starts',r.starts,r)}${statBox('Victoires','wins',r.wins,r)}${statBox('Nuls','draws',r.draws,r)}${statBox('Défaites','losses',r.losses,r)}</div>
      <div class="selection-linked-fields"><div class="selection-jersey-field"><small>Numéros portés</small><div data-jersey-player="${r.player_id}" class="selection-jersey-slot"><span class="selection-jersey-empty">—</span></div></div><div><small>Accomplissements</small><span data-ach-player="${r.player_id}">🏅 —</span></div></div>
      <div class="selection-tags" data-tags-player="${r.player_id}">${selectionTagHtml(team,r)}</div>
      <footer><div class="selection-source-mini">🔗 Source 1</div><div class="contributors" data-contrib-player="${r.player_id}">${contributorHtml(r._contributors)}</div></footer>
    </article>`}).join('')}</div>${paginationHtml(total)}`;
    bindTiles();hydrateLinkedFields(visible).catch(()=>{});
  }
  function paginationHtml(total){const pages=Math.max(1,Math.ceil(total/pageSize));if(pages<=1)return '';return `<div class="selection-pagination"><button type="button" data-page-prev ${page<=1?'disabled':''}>←</button><span>Page ${page} / ${pages} · ${total} joueurs</span><button type="button" data-page-next ${page>=pages?'disabled':''}>→</button></div>`;}
  function bindTiles(){
    $$('[data-stat-step]').forEach(b=>b.addEventListener('click',()=>adjustStat(b.dataset.row,b.dataset.statStep,Number(b.dataset.delta))));
    $$('[data-edit-player]').forEach(b=>b.addEventListener('click',async()=>{try{await openEditor(b.dataset.editPlayer);}catch(err){console.error('Ouverture éditeur joueur',err);alert('Impossible d’ouvrir l’éditeur : '+(err?.message||err));}}));
    $$('[data-source-player]').forEach(b=>b.addEventListener('click',()=>showSources(b.dataset.sourcePlayer)));
    $('[data-page-prev]')?.addEventListener('click',()=>{page=Math.max(1,page-1);render(query);});$('[data-page-next]')?.addEventListener('click',()=>{page++;render(query);});
  }
  async function hydrateLinkedFields(visible){
    if(!client||!visible.length)return;const ids=visible.map(r=>r.player_id);
    const [{data:pa},{data:et}]=await Promise.all([
      client.from('player_achievements').select('player_id,achievement:achievements(label_text,icon_text)').in('player_id',ids),
      client.from('entity_tags').select('entity_id,tag_id').eq('entity_type','player').in('entity_id',ids)
    ]);
    const tagMap=new Map(tags.map(t=>[t.id,t]));
    ids.forEach(id=>{
      const row=visible.find(r=>r.player_id===id);const nums=row?._jerseyNumbers||[];const je=$(`[data-jersey-player="${id}"]`);if(je)je.innerHTML=jerseyListHtml(nums,true);
      const aa=(pa||[]).filter(x=>x.player_id===id).map(x=>`${x.achievement?.icon_text||'🏅'} ${x.achievement?.label_text||''}`.trim());const ae=$(`[data-ach-player="${id}"]`);if(ae)ae.textContent=aa.length?aa.join(' · '):'🏅 —';
      const linked=(et||[]).filter(x=>x.entity_id===id).map(x=>tagMap.get(x.tag_id)).filter(Boolean).sort((a,b)=>{if(a.slug==='international')return -1;if(b.slug==='international')return 1;return String(a.label_text).localeCompare(String(b.label_text),'fr');});
      const te=$(`[data-tags-player="${id}"]`);if(te){te.innerHTML=linked.length?linked.map(t=>window.BLEUS3000_TAGS?.chipHtml?window.BLEUS3000_TAGS.chipHtml(t,'selection-linked-tag-chip'):`<span class="selection-main-tag">${esc(t.icon_text||'🏷️')} ${esc(t.label_text)}</span>`).join(''):selectionTagHtml(selectedTeam(),row);}
    });
  }

  async function hydrateRowTagIds(){
    if(!client||!rows.length)return;if(rows.every(r=>Array.isArray(r._tagIds)))return;const ids=new Set(rows.map(r=>r.player_id));
    const {data,error}=await client.from('entity_tags').select('entity_id,tag_id').eq('entity_type','player');if(error)return;
    const map=new Map();(data||[]).forEach(x=>{if(!ids.has(x.entity_id))return;const a=map.get(x.entity_id)||[];a.push(x.tag_id);map.set(x.entity_id,a);});
    rows.forEach(r=>r._tagIds=map.get(r.player_id)||[]);
  }
  async function render(q=''){
    query=q||'';if(loading)return;loading=true;renderLoading();try{if(!await ensureLoaded()){throw new Error('Supabase indisponible');}await hydrateRowTagIds();renderCategoryTabs();ensureSelectionFilters();const all=filterRows(),pages=Math.max(1,Math.ceil(all.length/pageSize));page=Math.min(page,pages);const visible=all.slice((page-1)*pageSize,page*pageSize);const ref=$('#referenceCount');if(ref)ref.textContent=`${all.length} joueur${all.length>1?'s':''}`;const title=$('#referenceModalTitle'),sub=$('#referenceModalSub');if(title)title.textContent='Sélections';if(sub)sub.textContent=`${selectedTeam()?.name||''} · joueurs reliés à toute la base Bleus 3000`;drawRows(visible,all.length);hydrateContributors(visible).catch(()=>{});}catch(e){console.error(e);const h=$('#referenceEntries');if(h)h.innerHTML='<div class="selection-empty"><strong>Impossible de charger le référentiel.</strong><span>Vérifie la connexion Supabase.</span></div>';}finally{loading=false;}
  }
  async function selectCategory(code){selectedCode=code||'FRA-A-M';rows=[];page=1;jerseyFilter='';tagFilter='';await render(query);}
  async function adjustStat(rowId,field,delta){
    if(!canEdit()||!client)return;const row=rows.find(x=>x.id===rowId);if(!row)return;
    const {data,error}=await client.rpc('adjust_selection_stat',{p_player_id:row.player_id,p_selection_id:row.selection_id,p_field:field,p_delta:delta});if(error)return alert('Modification refusée : '+error.message);
    if(data){const v=Array.isArray(data)?data[0]:data;if(v)Object.assign(row,v);}render(query);
  }
  async function showSources(playerId){
    if(!client)return;const {data}=await client.from('entity_sources').select('field_scope,source:sources(*)').eq('entity_type','player').eq('entity_id',playerId);
    const row=rows.find(x=>x.player_id===playerId),p=publicPlayer(row),title=$('#sourcesTitle'),list=$('#sourcesList');if(title)title.textContent=`Sources · ${p.display_name||'Joueur'}`;
    if(list)list.innerHTML=(data||[]).map(x=>`<div class="source-row"><span class="src-icon">🔗</span><div><strong>${esc(x.source?.title||'Source')}</strong><small>${esc([x.source?.publisher_author,x.source?.publication_date,x.field_scope].filter(Boolean).join(' · '))}</small></div>${x.source?.url?`<a href="${esc(x.source.url)}" target="_blank" rel="noopener">Ouvrir ↗</a>`:''}</div>`).join('')||'<div class="universal-search-empty">Aucune source renseignée.</div>';
    const m=$('#sourcesModal');if(m)m.hidden=false;
  }

  function ensureEditor(){
    if($('#selectionPlayerEditorModal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="selectionPlayerEditorModal" hidden><section class="modal-dialog selection-editor-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2 id="selectionEditorTitle">Modifier un joueur</h2><p id="selectionEditorSub">Fiche reliée à la sélection</p></div><button class="modal-close" data-selection-editor-close type="button">×</button></header><div class="modal-body"><form id="selectionPlayerEditorForm" class="selection-editor-form">
      <div class="selection-editor-photo"><div class="selection-photo-frame is-large" id="selectionEditorPhotoFrame"><div class="selection-photo-inner" id="selectionEditorPhotoPreview"><span>?</span></div></div><label class="secondary-btn">Importer une photo carrée<input id="selectionEditorPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="secondary-btn" id="selectionEditorPhotoRemove" type="button">Retirer</button><small>Recadrage carré automatique · WebP 512×512</small></div>
      <div class="selection-editor-fields"><label>Nom affiché<input name="display_name" required maxlength="120"></label><label>Date de naissance<input name="birth_date" type="date"></label><label>Poste<input name="primary_position" maxlength="80" placeholder="Ex. Ailier droit, Milieu, Gardien…" list="bleusPositionSuggestions"><datalist id="bleusPositionSuggestions"><option value="Gardien"><option value="Défenseur central"><option value="Latéral droit"><option value="Latéral gauche"><option value="Piston droit"><option value="Piston gauche"><option value="Milieu défensif"><option value="Milieu central"><option value="Milieu offensif"><option value="Ailier droit"><option value="Ailier gauche"><option value="Avant-centre"></datalist></label><label>Statut d’apparition<select name="appearance_status"><option value="capped">International · entré en jeu</option><option value="called_only">Convocation · jamais entré en jeu</option></select></label><label>N° d’apparition<input name="international_number" type="number" min="1"></label><div class="selection-editor-stat-fields"><label>Sélections<input name="selections" type="number" min="0"></label><label>Buts<input name="goals" type="number" min="0"></label><label>Titularisations<input name="starts" type="number" min="0"></label><label>Victoires<input name="wins" type="number" min="0"></label><label>Nuls<input name="draws" type="number" min="0"></label><label>Défaites<input name="losses" type="number" min="0"></label></div><div class="selection-editor-jersey-field"><label>Numéros portés en match</label><div class="selection-jersey-picker"><select id="selectionEditorJerseySelect" aria-label="Choisir un numéro"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option><option value="32">32</option><option value="33">33</option><option value="34">34</option><option value="35">35</option><option value="36">36</option><option value="37">37</option><option value="38">38</option><option value="39">39</option><option value="40">40</option><option value="41">41</option><option value="42">42</option><option value="43">43</option><option value="44">44</option><option value="45">45</option><option value="46">46</option><option value="47">47</option><option value="48">48</option><option value="49">49</option><option value="50">50</option><option value="51">51</option><option value="52">52</option><option value="53">53</option><option value="54">54</option><option value="55">55</option><option value="56">56</option><option value="57">57</option><option value="58">58</option><option value="59">59</option><option value="60">60</option><option value="61">61</option><option value="62">62</option><option value="63">63</option><option value="64">64</option><option value="65">65</option><option value="66">66</option><option value="67">67</option><option value="68">68</option><option value="69">69</option><option value="70">70</option><option value="71">71</option><option value="72">72</option><option value="73">73</option><option value="74">74</option><option value="75">75</option><option value="76">76</option><option value="77">77</option><option value="78">78</option><option value="79">79</option><option value="80">80</option><option value="81">81</option><option value="82">82</option><option value="83">83</option><option value="84">84</option><option value="85">85</option><option value="86">86</option><option value="87">87</option><option value="88">88</option><option value="89">89</option><option value="90">90</option><option value="91">91</option><option value="92">92</option><option value="93">93</option><option value="94">94</option><option value="95">95</option><option value="96">96</option><option value="97">97</option><option value="98">98</option><option value="99">99</option></select><button type="button" class="secondary-btn" id="selectionEditorJerseyAdd">+ Ajouter</button></div><div id="selectionEditorJerseyList" class="selection-editor-jersey-list"><span class="selection-jersey-empty">Aucun numéro renseigné</span></div><small>Sélectionne un numéro puis clique sur + Ajouter. Clique sur × pour le retirer.</small></div><label>Tags<div id="selectionEditorTags" class="selection-tag-checks"></div></label><label>Accomplissements<div id="selectionEditorAchievements" class="selection-achievements-editor">Aucun accomplissement renseigné · le moteur de badges est prêt pour une prochaine version.</div></label></div>
      <div class="c3k-v8-actions selection-editor-actions"><button class="secondary-btn" data-selection-editor-close type="button">Annuler</button><button class="primary-btn" type="submit">Enregistrer</button></div></form></div></section></div>`);
    $$('[data-selection-editor-close]').forEach(b=>b.addEventListener('click',closeEditor));$('#selectionPlayerEditorForm').addEventListener('submit',saveEditor);$('#selectionEditorPhotoInput').addEventListener('change',preparePhoto);$('#selectionEditorPhotoRemove').addEventListener('click',()=>{pendingPhoto=null;pendingPhotoPreview='';$('#selectionPlayerEditorForm').dataset.removePhoto='1';updateEditorPhoto();});$('#selectionEditorJerseyAdd').addEventListener('click',addEditorJerseyNumber);$('#selectionEditorJerseyList').addEventListener('click',e=>{const b=e.target.closest('[data-remove-jersey]');if(!b)return;pendingJerseyNumbers=pendingJerseyNumbers.filter(n=>n!==Number(b.dataset.removeJersey));renderEditorJerseyNumbers();});
  }
  function renderEditorJerseyNumbers(){const host=$('#selectionEditorJerseyList');if(!host)return;host.innerHTML=pendingJerseyNumbers.length?jerseyListHtml(pendingJerseyNumbers,false):'<span class="selection-jersey-empty">Aucun numéro renseigné</span>';}
  function addEditorJerseyNumber(){const select=$('#selectionEditorJerseySelect');if(!select)return;const n=Number(select.value);if(!Number.isInteger(n)||n<0||n>99)return;if(!pendingJerseyNumbers.includes(n))pendingJerseyNumbers.push(n);pendingJerseyNumbers.sort((a,b)=>a-b);renderEditorJerseyNumbers();}
  function closeEditor(){const m=$('#selectionPlayerEditorModal');if(m)m.hidden=true;currentEditor=null;pendingPhoto=null;pendingPhotoPreview='';pendingJerseyNumbers=[];}
  function syncAppearanceEditor(form){
    if(!form)return;
    const status=form.elements?.namedItem('appearance_status')?.value||'capped';
    const calledOnly=status==='called_only';
    const numberInput=form.elements?.namedItem('international_number');
    if(numberInput){
      numberInput.disabled=calledOnly;
      numberInput.placeholder=calledOnly?'Convocation · aucun numéro attribué':'N° d’apparition';
    }
    for(const name of ['selections','goals','starts','wins','draws','losses']){
      const input=form.elements?.namedItem(name);
      if(input){input.disabled=calledOnly;input.title=calledOnly?'Statistique à 0 tant que le joueur n’est jamais entré en jeu':'';}
    }
  }
  async function openEditor(playerId=null){
    if(!canEdit())return alert('Modification réservée aux CONTRIBUTOR, ADMIN et SUPERADMIN.');ensureEditor();if(!teams.length)await loadTeams();const team=selectedTeam();let row=playerId?rows.find(x=>x.player_id===playerId):null,p=publicPlayer(row);currentEditor={playerId,rowId:row?.id||null,newPlayer:!row,selectionId:team.id,photoPath:p.photo_path||null};pendingPhoto=null;pendingPhotoPreview='';const form=$('#selectionPlayerEditorForm');form.reset();delete form.dataset.removePhoto;if(!form.dataset.appearanceBound){form.appearance_status?.addEventListener('change',()=>syncAppearanceEditor(form));form.dataset.appearanceBound='1';}$('#selectionEditorTitle').textContent=row?`Modifier · ${p.display_name}`:'Ajouter un joueur';$('#selectionEditorSub').textContent=team.name;form.display_name.value=p.display_name||'';form.birth_date.value=p.birth_date||'';form.primary_position.value=p.primary_position||'';for(const k of ['international_number','selections','goals','starts','wins','draws','losses'])form[k].value=row?.[k]??'';form.appearance_status.value=row?.appearance_status||((row?.international_number==null&&Number(row?.selections||0)===0)?'called_only':'capped');syncAppearanceEditor(form);
    const [{data:jersey},{data:et},{data:pa}]=row?await Promise.all([client.from('player_jersey_numbers').select('shirt_number').eq('player_id',playerId).eq('selection_id',team.id).order('shirt_number'),client.from('entity_tags').select('tag_id').eq('entity_type','player').eq('entity_id',playerId),client.from('player_achievements').select('achievement:achievements(label_text,icon_text)').eq('player_id',playerId)]):[{data:[]},{data:[]},{data:[]}];pendingJerseyNumbers=[...new Set((jersey||[]).map(x=>Number(x.shirt_number)).filter(Number.isInteger))].sort((a,b)=>a-b);renderEditorJerseyNumbers();const assigned=new Set((et||[]).map(x=>x.tag_id));const membershipDefaults=new Set(tagReferenceLinks.filter(l=>l.reference_id===team.id&&l.relation_kind==='membership').map(l=>l.tag_id));$('#selectionEditorTags').innerHTML=tags.map(t=>`<label class="selection-tag-check"><input type="checkbox" name="tag_ids" value="${t.id}" ${assigned.has(t.id)||(!row&&membershipDefaults.has(t.id))?'checked':''}><span>${esc(t.icon_text||'🏷️')} ${esc(t.label_text)}</span></label>`).join('');$('#selectionEditorAchievements').textContent=(pa||[]).length?(pa||[]).map(x=>`${x.achievement?.icon_text||'🏅'} ${x.achievement?.label_text||''}`).join(' · '):'Aucun accomplissement renseigné · le moteur de badges est prêt pour une prochaine version.';updateEditorPhoto();$('#selectionPlayerEditorModal').hidden=false;
  }
  async function preparePhoto(e){const f=e.target.files?.[0];if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('Format non pris en charge.');pendingPhoto=await squareWebp(f);pendingPhotoPreview=URL.createObjectURL(pendingPhoto);delete $('#selectionPlayerEditorForm').dataset.removePhoto;updateEditorPhoto();}
  function squareWebp(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{try{const s=Math.min(img.width,img.height),sx=(img.width-s)/2,sy=(img.height-s)/2,c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.drawImage(img,sx,sy,s,s,0,0,512,512);c.toBlob(b=>{URL.revokeObjectURL(url);b?resolve(b):reject(new Error('Conversion impossible'));},'image/webp',.88);}catch(err){URL.revokeObjectURL(url);reject(err);}};img.onerror=reject;img.src=url;});}
  function updateEditorPhoto(){const frame=$('#selectionEditorPhotoFrame'),prev=$('#selectionEditorPhotoPreview');if(frame)frame.style.cssText=borderStyle();const existing=currentEditor?.photoPath?photoUrl(currentEditor.photoPath):'';const url=pendingPhotoPreview||($('#selectionPlayerEditorForm')?.dataset.removePhoto?'':existing);if(prev)prev.innerHTML=url?`<img src="${esc(url)}" alt="Aperçu">`:`<span>${esc(initials($('#selectionPlayerEditorForm')?.display_name?.value||'?'))}</span>`;}
  async function saveEditor(e){
    e.preventDefault();if(!canEdit()||!client||!currentEditor)return;const form=e.currentTarget,fd=new FormData(form),team=selectedTeam();let playerId=currentEditor.playerId,photoPath=currentEditor.photoPath;
    try{
      if(currentEditor.newPlayer){const name=String(fd.get('display_name')||'').trim();const {data:p,error}=await client.from('players').insert({display_name:name,last_name:name,gender:team.gender,birth_date:fd.get('birth_date')||null,primary_position:String(fd.get('primary_position')||'').trim()||null,france_eligibility:true,senior_a_called:team.code==='FRA-A-M',active:true,name_normalized:name.toLocaleLowerCase('fr'),profile_slug:name.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now()}).select('id').single();if(error)throw error;playerId=p.id;currentEditor.playerId=playerId;
        const appearanceStatus=fd.get('appearance_status')==='called_only'?'called_only':'capped';const statPayload={player_id:playerId,selection_id:team.id,appearance_status:appearanceStatus};for(const k of ['international_number','selections','goals','starts','wins','draws','losses'])statPayload[k]=fd.get(k)===''?null:Number(fd.get(k));if(appearanceStatus==='called_only'){statPayload.international_number=null;for(const k of ['selections','goals','starts','wins','draws','losses'])statPayload[k]=0;}const {error:se}=await client.from('player_selection_stats').insert(statPayload);if(se)throw se;
      }else{
        const {error:pe}=await client.from('players').update({display_name:String(fd.get('display_name')||'').trim(),last_name:String(fd.get('display_name')||'').trim(),birth_date:fd.get('birth_date')||null,primary_position:String(fd.get('primary_position')||'').trim()||null}).eq('id',playerId);if(pe)throw pe;const appearanceStatus=fd.get('appearance_status')==='called_only'?'called_only':'capped';const statPayload={appearance_status:appearanceStatus};for(const k of ['international_number','selections','goals','starts','wins','draws','losses'])statPayload[k]=fd.get(k)===''?null:Number(fd.get(k));if(appearanceStatus==='called_only'){statPayload.international_number=null;for(const k of ['selections','goals','starts','wins','draws','losses'])statPayload[k]=0;}const {error:se}=await client.from('player_selection_stats').update(statPayload).eq('player_id',playerId).eq('selection_id',team.id);if(se)throw se;
      }
      if(pendingPhoto){const path=`${playerId}/${Date.now()}.webp`;const {error:ue}=await client.storage.from('player-photos').upload(path,pendingPhoto,{contentType:'image/webp',upsert:false});if(ue)throw new Error('Photo · upload : '+ue.message);photoPath=path;{const {error:ppe}=await client.from('players').update({photo_path:path}).eq('id',playerId);if(ppe)throw new Error('Photo · fiche joueur : '+ppe.message);}}else if(form.dataset.removePhoto){photoPath=null;{const {error:pre}=await client.from('players').update({photo_path:null}).eq('id',playerId);if(pre)throw new Error('Photo · retrait : '+pre.message);}}
      const nums=[...new Set(pendingJerseyNumbers.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=99))].sort((a,b)=>a-b);{const {error:jde}=await client.from('player_jersey_numbers').delete().eq('player_id',playerId).eq('selection_id',team.id);if(jde)throw new Error('Numéros · suppression : '+jde.message);}if(nums.length){const {error:je}=await client.from('player_jersey_numbers').insert(nums.map(n=>({player_id:playerId,selection_id:team.id,shirt_number:n})));if(je)throw new Error('Numéros · ajout : '+je.message);}
      let tagIds=fd.getAll('tag_ids').map(String);const appearanceStatus=fd.get('appearance_status')==='called_only'?'called_only':'capped';const membershipIds=new Set(tagReferenceLinks.filter(l=>l.reference_id===team.id&&l.relation_kind==='membership').map(l=>l.tag_id)),statusIds=new Set(tagReferenceLinks.filter(l=>l.reference_id===team.id&&l.relation_kind==='status').map(l=>l.tag_id));if(appearanceStatus==='called_only'){tagIds=tagIds.filter(id=>!membershipIds.has(id));statusIds.forEach(id=>tagIds.push(id));}else{tagIds=tagIds.filter(id=>!statusIds.has(id));membershipIds.forEach(id=>tagIds.push(id));}tagIds=[...new Set(tagIds)];{const {error:tde}=await client.from('entity_tags').delete().eq('entity_type','player').eq('entity_id',playerId);if(tde)throw new Error('Tags · suppression : '+tde.message);}if(tagIds.length){const {error:te}=await client.from('entity_tags').insert(tagIds.map(tag_id=>({entity_type:'player',entity_id:playerId,tag_id})));if(te)throw new Error('Tags · ajout : '+te.message);}
      await client.rpc('record_selection_contribution',{p_player_id:playerId,p_type:currentEditor.newPlayer?'create':'edit'});closeEditor();rows=[];await loadRows();render(query);window.BLEUS3000_PLAYERS_DB?.reload?.();
    }catch(err){console.error(err);alert('Enregistrement impossible : '+(err.message||err));}
  }

  function ensureBorderModal(){if($('#selectionBorderModal'))return;document.body.insertAdjacentHTML('beforeend',`<div class="c3k-v8-panel-backdrop" id="selectionBorderModal" hidden><section class="c3k-v8-panel selection-border-panel" role="dialog" aria-modal="true"><header class="c3k-v8-panel-head"><strong>Sélections · bordures photo</strong><button class="c3k-v8-close" data-border-close type="button">×</button></header><div class="c3k-v8-panel-body"><p class="c3k-v8-muted">Définis uniquement le rendu de la bordure photo de chaque sélection. Les tags sont désormais associés aux référentiels depuis l’éditeur de tags.</p><div id="selectionBorderList"></div></div></section></div>`);$('[data-border-close]')?.addEventListener('click',()=>$('#selectionBorderModal').hidden=true);$('#selectionBorderModal')?.addEventListener('pointerdown',e=>{if(e.target.id==='selectionBorderModal')e.currentTarget.hidden=true;});}
  async function openBorderEditor(){if(!canEdit())return alert('Gestion des sélections réservée aux CONTRIBUTOR, ADMIN et SUPERADMIN.');if(!teams.length)await loadTeams();ensureBorderModal();const host=$('#selectionBorderList');host.innerHTML=teams.map(t=>{const b=borders.get(t.id)||{};return `<form class="selection-border-row" data-border-team="${t.id}"><div class="selection-border-sample" style="${borderCss(b)}"><span>${t.gender==='F'?'♀':'♂'}</span></div><div><strong>${esc(t.name)}</strong><div class="selection-border-controls"><select name="appearance"><option value="gradient" ${b.appearance!=='solid'?'selected':''}>Dégradé</option><option value="solid" ${b.appearance==='solid'?'selected':''}>Uni</option></select><input name="color_start" type="color" value="${esc(b.color_start||'#123B8F')}"><input name="color_end" type="color" value="${esc(b.color_end||'#2F6DFF')}"><label>Ép. <input name="border_width" type="number" min="0" max="12" value="${Number(b.border_width??4)}"></label><label>Arrondi <input name="border_radius" type="number" min="0" max="48" value="${Number(b.border_radius??16)}"></label><label>Angle <input name="gradient_angle" type="number" min="0" max="360" value="${Number(b.gradient_angle??135)}"></label><button class="primary-btn" type="submit">Sauver</button></div></div></form>`}).join('');$$('[data-border-team]',host).forEach(f=>f.addEventListener('submit',saveBorder));$('#selectionBorderModal').hidden=false;}

  function borderCss(b){const bg=b.appearance==='solid'?b.color_start:`linear-gradient(${b.gradient_angle||135}deg,${b.color_start||'#123B8F'},${b.color_end||'#2F6DFF'})`;return `background:${bg};border-radius:${Number(b.border_radius??16)}px;border:${Math.max(1,Number(b.border_width??4))}px solid transparent`;}
  async function saveBorder(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),teamId=f.dataset.borderTeam,payload={selection_id:teamId,appearance:fd.get('appearance'),color_start:fd.get('color_start'),color_end:fd.get('color_end'),border_width:Number(fd.get('border_width')),border_radius:Number(fd.get('border_radius')),gradient_angle:Number(fd.get('gradient_angle')),updated_by:window.C3K_ACCOUNT_STATE?.profile?.id||null};const {data,error}=await client.from('selection_photo_borders').upsert(payload).select().single();if(error)return alert(error.message);borders.set(data.selection_id,data);await openBorderEditor();if(selectedTeam()?.id===data.selection_id)render(query);}

  async function openNewPlayer(){return openEditor(null);}
  async function init(){await waitClient();if(!client)return;try{await loadTeams();selectedCode=teams.some(t=>t.code==='FRA-A-M')?'FRA-A-M':teams[0]?.code;await loadRows(selectedCode);}catch(e){console.error('Selections init',e);}}
  window.addEventListener('c3k:account-state',()=>{if(!client)waitClient().then(c=>{if(c)init();});});
  window.BLEUS3000_SELECTIONS={render,selectCategory,openNewPlayer,openEditor,openBorderEditor,get teams(){return teams;},get rows(){return rows;},get selectedCode(){return selectedCode;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
