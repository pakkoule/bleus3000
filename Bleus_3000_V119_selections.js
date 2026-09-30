/* 3615 Bleus V1.1.79 — Internationaux A · numéros portés retirés de l’interface */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(+d)?v:d.toLocaleDateString('fr-FR');};
  const S=window.BLEUS3000_SEARCH;
  if(!S)throw new Error('Moteur de recherche 3615 Bleus indisponible');
  const norm=S.normalize;
  const fuzzyMatch=(query,values)=>S.matches(query,values,.48);
  const role=()=>window.C3K_ACCOUNT_STATE?.profile?.role||'guest';
  const canEdit=()=>['admin','superadmin'].includes(role());
  let client=null,teams=[],teamCounts=new Map(),borders=new Map(),rows=[],selectedCode='FRA-A-M',query='',page=1,pageSize=60,loading=false,tags=[],tagReferenceLinks=[],achievements=[],achievementScopes=[];
  let sortKey='selections',sortDir='desc',tagFilter='',positionFilter='';
  let currentEditor=null,pendingPhoto=null,pendingPhotoPreview='',pendingActionPhoto=null,pendingActionPhotoPreview='',pendingAchievements=[],photoCropState=null;
  let expandedPlayerId='';
  const playerContextCache=new Map(),playerMatchesCache=new Map();

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
  function achievementIconSrc(a){const storage=String(a?.icon_storage_path||'').trim();if(storage&&client){try{return client.storage.from('achievement-icons').getPublicUrl(storage).data.publicUrl||'';}catch{}}const path=String(a?.icon_image_path||'').trim();if(!path)return '';return path;}
  function achievementBadgeHtml(item){const a=item?.achievement||item||{},v=item?.achievement_value;const src=achievementIconSrc(a),label=String(a.label_text||'Accomplissement');return `<span class="selection-achievement-badge" tabindex="0" role="img" aria-label="${esc(label)}${v!==null&&v!==undefined?' · ×'+esc(v):''}">${src?`<img src="${esc(src)}" alt="">`:`<span class="selection-achievement-fallback">${esc(a.icon_text||'🏅')}</span>`}${v!==null&&v!==undefined&&v!==''?`<span class="selection-achievement-count">×${esc(v)}</span>`:''}<span class="selection-achievement-tooltip" role="tooltip">${esc(label)}</span></span>`;}
  function renderEditorAchievements(){
    const host=$('#selectionEditorAchievements'),select=$('#selectionEditorAchievementSelect'),add=$('#selectionEditorAchievementAdd');
    if(!host)return;
    const byId=new Map(achievements.map(a=>[a.id,a]));
    pendingAchievements=pendingAchievements.filter(x=>byId.has(x.achievement_id));
    if(!pendingAchievements.length)host.innerHTML='<span class="selection-achievement-empty">Aucun accomplissement ajouté</span>';
    else host.innerHTML=pendingAchievements.map(item=>{const a=byId.get(item.achievement_id);return `<div class="selection-achievement-editor-row is-assigned" data-achievement-id="${esc(a.id)}"><span class="selection-achievement-editor-icon">${achievementBadgeHtml({achievement:a,achievement_value:item.achievement_value})}</span><span class="selection-achievement-editor-name"><strong>${esc(a.label_text)}</strong></span><label class="selection-achievement-value-label">Nombre<input type="number" min="0" step="1" data-achievement-value value="${esc(item.achievement_value??'')}" placeholder="ex. 36"></label><button type="button" class="selection-achievement-remove" data-remove-achievement="${esc(a.id)}" aria-label="Retirer ${esc(a.label_text)}">×</button></div>`;}).join('');
    if(select){
      const assigned=new Set(pendingAchievements.map(x=>x.achievement_id));
      const available=achievements.filter(a=>!assigned.has(a.id));
      select.innerHTML=available.length?`<option value="">Choisir un accomplissement…</option>${available.map(a=>`<option value="${esc(a.id)}">${esc(a.label_text)}</option>`).join('')}`:'<option value="">Tous les accomplissements sont déjà ajoutés</option>';
      select.disabled=!available.length;
      if(add)add.disabled=!available.length;
    }
  }
  function addEditorAchievement(){const select=$('#selectionEditorAchievementSelect');if(!select)return;const id=String(select.value||'');if(!id||pendingAchievements.some(x=>x.achievement_id===id))return;pendingAchievements.push({achievement_id:id,achievement_value:null});renderEditorAchievements();}
  const canAdjust=k=>['selections','goals','wins','draws','losses'].includes(k);
  function statBox(label,key,value,row){
    const controls=canEdit()&&canAdjust(key)?`<span class="sel-stepper"><button type="button" data-stat-step="${key}" data-delta="-1" data-row="${row.id}">−</button><strong>${statVal(value)}</strong><button type="button" data-stat-step="${key}" data-delta="1" data-row="${row.id}">+</button></span>`:`<strong>${statVal(value)}</strong>`;
    return `<div class="sel-stat"><small>${esc(label)}</small>${controls}</div>`;
  }
  function publicPlayer(row){return row?.player||{};}
  function registryFromRows(list){
    const reg=list.map(r=>({id:r.player_id,name:publicPlayer(r).display_name||'Joueur',display_name:publicPlayer(r).display_name||'Joueur',position:publicPlayer(r).primary_position||'',positions:[publicPlayer(r).primary_position,...(publicPlayer(r).secondary_positions||[])].filter(Boolean),international_number:r.international_number,appearance_status:r.appearance_status||((r.international_number==null&&Number(r.selections||0)===0)?'called_only':'capped'),selection_code:selectedCode,birth_date:publicPlayer(r).birth_date||null,death_date:publicPlayer(r).death_date||null,photo_path:publicPlayer(r).photo_path||null,action_photo_path:publicPlayer(r).action_photo_path||null}));
    reg.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    window.BLEUS3000_SELECTION_REGISTRY=reg;
    if(!window.BLEUS3000_PLAYER_REGISTRY_ALL)window.BLEUS3000_PLAYER_REGISTRY=reg;
    window.dispatchEvent(new CustomEvent('bleus:player-registry',{detail:{players:reg,selection:selectedCode}}));
  }

  async function loadTeams(){
    if(!client)await waitClient();if(!client)return;
    const [{data:t,error:te},{data:b,error:be},{data:tg,error:tge},{data:trl,error:trle},{data:tc,error:tce},{data:ach,error:ache},{data:asc,error:asce}]=await Promise.all([
      client.from('selection_teams').select('*').eq('active',true).eq('code','FRA-A-M').order('sort_order'),
      client.from('selection_photo_borders').select('*'),
      client.from('tags').select('*').eq('is_active',true).order('label_text'),
      client.from('tag_reference_links').select('tag_id,reference_type,reference_id,relation_kind').eq('reference_type','selection'),
      client.from('selection_team_counts').select('selection_id,player_count'),
      client.from('achievements').select('*').eq('is_active',true).order('label_text'),
      client.from('achievement_reference_scopes').select('achievement_id,reference_type')
    ]);
    if(te)throw new Error('Sélections · '+te.message);if(be)throw be;if(tge)throw tge;if(trle)throw trle;if(tce)throw tce;if(ache)throw ache;if(asce)throw asce;teams=t||[];teamCounts=new Map((tc||[]).map(x=>[x.selection_id,Number(x.player_count||0)]));borders=new Map((b||[]).map(x=>[x.selection_id,x]));tags=tg||[];tagReferenceLinks=trl||[];achievementScopes=asc||[];const allowed=new Set(achievementScopes.filter(x=>x.reference_type==='selection').map(x=>x.achievement_id));achievements=(ach||[]).filter(a=>allowed.has(a.id)&&a.slug!=='capitanat');
  }
  async function loadRows(code=selectedCode){
    if(!client)await waitClient();if(!client)return [];
    if(!teams.length)await loadTeams();const team=teams.find(t=>t.code===code);if(!team)return [];
    const {data,error}=await client.from('player_selection_stats').select(`id,player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,international_number,appearance_status,first_year,last_year,data_status,updated_at,player:players!player_selection_stats_player_id_fkey(id,display_name,last_name,birth_date,death_date,photo_path,action_photo_path,photo_copyright_source,action_photo_copyright_source,primary_position,secondary_positions,active_source,data_status)`).eq('selection_id',team.id).order('selections',{ascending:false}).order('starts',{ascending:false}).limit(1000);
    if(error)throw error;
    rows=(data||[]);
    if(code==='FRA-A-M')registryFromRows(rows);return rows;
  }
  async function ensureLoaded(){if(!client)await waitClient();if(!client)return false;if(!teams.length)await loadTeams();if(!rows.length||rows[0]?.selection_id!==selectedTeam()?.id)await loadRows();return true;}

  function renderCategoryTabs(){
    const host=$('#selectionCategoryTabs');if(!host)return;host.hidden=true;host.innerHTML='';selectedCode='FRA-A-M';
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
      if(tagFilter&&!(r._tagIds||[]).includes(tagFilter))return false;
      if(positionFilter&&!(r._tagIds||[]).includes(positionFilter))return false;
      if(!q)return true;
      const p=publicPlayer(r);return fuzzyMatch(q,[p.display_name,p.last_name,p.primary_position,...(p.secondary_positions||[]),r.international_number,r.selections,r.goals,r.appearance_status==='called_only'?'convocation':'international',...(r._jerseyNumbers||[])]);
    });
    return out.sort(compareRows);
  }
  function ensureSelectionFilters(){
    const tabs=$('#selectionCategoryTabs');if(!tabs)return;let bar=$('#selectionFilterBar');
    if(!bar){bar=document.createElement('div');bar.id='selectionFilterBar';bar.className='selection-filter-bar';tabs.insertAdjacentElement('afterend',bar);}
    bar.hidden=false;
    const linkedTagIds=new Set(rows.flatMap(r=>r._tagIds||[]));
    const linkedTags=tags.filter(t=>!linkedTagIds.size||linkedTagIds.has(t.id));
    const tagOptions=linkedTags.filter(t=>t.reference_scope!=='position').map(t=>`<option value="${esc(t.id)}" ${tagFilter===t.id?'selected':''}>${esc(t.label_text)}</option>`).join('');
    const positionOptions=linkedTags.filter(t=>t.reference_scope==='position').sort((a,b)=>String(a.label_text||'').localeCompare(String(b.label_text||''),'fr')).map(t=>`<option value="${esc(t.id)}" ${positionFilter===t.id?'selected':''}>${esc(t.label_text)}</option>`).join('');
    bar.innerHTML=`<label>Tri<select id="selectionSortKey"><option value="selections" ${sortKey==='selections'?'selected':''}>Sélections</option><option value="goals" ${sortKey==='goals'?'selected':''}>Buts</option><option value="international_number" ${sortKey==='international_number'?'selected':''}>Ordre d’apparition</option><option value="last_name" ${sortKey==='last_name'?'selected':''}>Nom de famille</option></select></label><button type="button" class="selection-sort-direction" id="selectionSortDirection" title="Inverser l’ordre">${sortDir==='asc'?'↑ Croissant':'↓ Décroissant'}</button><label>Poste<select id="selectionPositionFilter"><option value="">Tous les postes</option>${positionOptions}</select></label><label>Autre tag<select id="selectionTagFilter"><option value="">Tous les tags</option>${tagOptions}</select></label><button type="button" class="selection-filter-reset" id="selectionFilterReset">Réinitialiser</button>`;
    $('#selectionSortKey',bar)?.addEventListener('change',e=>{sortKey=e.target.value;page=1;render(query);});
    $('#selectionSortDirection',bar)?.addEventListener('click',()=>{sortDir=sortDir==='asc'?'desc':'asc';page=1;render(query);});
    $('#selectionPositionFilter',bar)?.addEventListener('change',e=>{positionFilter=e.target.value;page=1;render(query);});
    $('#selectionTagFilter',bar)?.addEventListener('change',e=>{tagFilter=e.target.value;page=1;render(query);});
    $('#selectionFilterReset',bar)?.addEventListener('click',()=>{sortKey='selections';sortDir='desc';tagFilter='';positionFilter='';page=1;render(query);});
  }
  function playerPhoto(p){const url=photoUrl(p.photo_path);return url?`<img src="${esc(url)}" alt="Photo de ${esc(p.display_name)}" loading="lazy">`:`<span>${esc(initials(p.display_name))}</span>`;}
  function photoCopyright(source){const x=String(source||'').trim();return x?`<span class="photo-copyright-capsule">© ${esc(x)}</span>`:'';}
  const sourceListOnly=row=>row?.data_status==='source_list'&&row?.selections==null&&row?.international_number==null;
  function selectionMembershipTag(team){const linked=tagReferenceLinks.find(l=>l.reference_id===team?.id&&l.relation_kind==='membership');return linked?tags.find(x=>x.id===linked.tag_id):null;}
  function selectionTagHtml(team,row=null){
    const status=sourceListOnly(row)?'membership':(row?.appearance_status==='called_only'?'status':'membership');
    const linked=tagReferenceLinks.find(l=>l.reference_id===team?.id&&l.relation_kind===status);
    const t=linked?tags.find(x=>x.id===linked.tag_id):null;
    if(t&&window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(t,'selection-main-tag-chip');
    if(t)return `<span class="selection-main-tag">${esc(t.icon_text||'🏷️')} ${esc(t.label_text)}</span>`;
    return `<span class="selection-main-tag">${sourceListOnly(row)?esc(team?.name||'Sélection'):(row?.appearance_status==='called_only'?'Convocation':esc(team?.name||'Sélection'))}</span>`;
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
  const POSITION_FALLBACK_CHOICES=['Gardien','Défenseur central','Stoppeur','Libéro','Latéral droit','Latéral gauche','Piston droit','Piston gauche','Milieu défensif /6','Milieu central /8','Milieu offensif axial /10','Demi droit','Demi centre','Demi gauche','Inter droit','Inter gauche','Avant-centre 9','Deuxième attaquant','Faux neuf','Neuf et demi','Ailier droit','Ailier gauche'];
  const positionKey=v=>norm(String(v||'')).replace(/\s+/g,'');
  function positionTags(){return tags.filter(t=>t.reference_scope==='position').sort((a,b)=>String(a.label_text||'').localeCompare(String(b.label_text||''),'fr'));}
  function positionTagForLabel(label){const key=positionKey(label);if(!key)return null;return positionTags().find(t=>positionKey(t.label_text)===key||(t.aliases||[]).some(a=>positionKey(a)===key))||null;}
  function canonicalPositionLabel(label){return positionTagForLabel(label)?.label_text||String(label||'').trim();}
  function playerPositions(p){return [...new Set([p?.primary_position,...(p?.secondary_positions||[])].map(x=>String(x||'').trim()).filter(Boolean))];}
  function positionsLabel(p){const a=playerPositions(p);return a.length?a.map(canonicalPositionLabel).join(' · '):'non renseigné';}
  function positionsEditorHtml(p={}){
    const current=playerPositions(p),currentKeys=new Set(current.map(positionKey));
    const canonical=positionTags().map(t=>t.label_text).filter(Boolean);
    const choices=[...new Set([...current,...(canonical.length?canonical:POSITION_FALLBACK_CHOICES)])];
    return `<div class="selection-position-checks">${choices.map(pos=>{const tag=positionTagForLabel(pos),checked=currentKeys.has(positionKey(pos))||(tag&&(tag.aliases||[]).some(a=>currentKeys.has(positionKey(a))));return `<label class="selection-position-check" ${tag?`data-position-tag-id="${esc(tag.id)}"`:''}><input type="checkbox" name="positions" value="${esc(tag?.label_text||pos)}" ${checked?'checked':''}><span>${esc(tag?.label_text||pos)}</span></label>`;}).join('')}</div><small>Chaque case est reliée au tag de poste correspondant. Le premier poste sélectionné devient le poste principal ; les suivants restent secondaires.</small>`;
  }

  function appearanceBadge(row){
    if(sourceListOnly(row)){const tg=selectionMembershipTag(selectedTeam());return `<span class="international-number">${esc(tg?.label_text||selectedTeam()?.name?.replace(/^France\s*/,'')||'Sélection')}</span>`;}
    const calledOnly=row?.appearance_status==='called_only'||(row?.international_number==null&&Number(row?.selections||0)===0);
    return calledOnly?'<span class="international-number is-called-only">Convocation</span>':`<span class="international-number">N° ${statVal(row?.international_number)}</span>`;
  }
  function sumKnown(list,key){const vals=list.map(x=>x?.[key]).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0):null;}
  function generalStats(contexts){return {selection_code:'GENERAL',selection_name:'GENERAL',selections:sumKnown(contexts,'selections'),goals:sumKnown(contexts,'goals'),wins:sumKnown(contexts,'wins'),draws:sumKnown(contexts,'draws'),losses:sumKnown(contexts,'losses'),international_number:null,appearance_status:'aggregate'};}
  function staticStatBox(label,value){return `<div class="sel-stat"><small>${esc(label)}</small><strong>${statVal(value)}</strong></div>`;}
  function contextStatsGrid(stats){return `${staticStatBox('Sélections',stats.selections)}${staticStatBox('Buts',stats.goals)}${staticStatBox('Victoires',stats.wins)}${staticStatBox('Nuls',stats.draws)}${staticStatBox('Défaites',stats.losses)}`;}
  function contextButtonHtml(ctx,active=false){const tag=ctx.tag;const label=ctx.selection_code==='GENERAL'?'GENERAL':(tag?.label_text||ctx.selection_name||ctx.selection_code);let inner;if(tag&&window.BLEUS3000_TAGS?.chipHtml)inner=window.BLEUS3000_TAGS.chipHtml(tag,'selection-context-chip');else inner=`<span class="selection-main-tag">${esc(ctx.selection_code==='GENERAL'?'∑':tag?.icon_text||'🇫🇷')} ${esc(label)}</span>`;return `<button type="button" class="selection-context-tag ${active?'is-active':''}" data-player-context="${esc(ctx.player_id||'')}" data-context-code="${esc(ctx.selection_code)}" title="Afficher les statistiques ${esc(label)}">${inner}</button>`;}
  function applyTileContext(playerId,code){const tile=$(`[data-player-tile="${playerId}"]`);if(!tile)return;const contexts=playerContextCache.get(playerId)||[];const current=code==='GENERAL'?generalStats(contexts):contexts.find(x=>x.selection_code===code);if(!current)return;tile.dataset.activeContext=code;const grid=$('.selection-stats-grid',tile);if(grid){const live=code===selectedCode;const row=rows.find(x=>x.player_id===playerId);grid.innerHTML=contextStatsGrid(current,live,row);$$('[data-stat-step]',grid).forEach(b=>b.addEventListener('click',()=>adjustStat(b.dataset.row,b.dataset.statStep,Number(b.dataset.delta))));}$$('[data-context-code]',tile).forEach(b=>b.classList.toggle('is-active',b.dataset.contextCode===code));const badge=$('.international-number',tile);if(badge){if(code==='GENERAL')badge.textContent='GENERAL';else if(sourceListOnly(current)){const tm=teams.find(t=>t.code===code),tg=selectionMembershipTag(tm);badge.textContent=tg?.label_text||current.selection_name||code;}else if(current.appearance_status==='called_only')badge.textContent='Convocation';else{const tm=teams.find(t=>t.code===code),lk=tm?tagReferenceLinks.find(l=>l.reference_id===tm.id&&l.relation_kind==='membership'):null,tg=lk?tags.find(t=>t.id===lk.tag_id):null;badge.textContent=current.international_number!=null?`N° ${current.international_number}`:(tg?.label_text||current.selection_name||code);}}}
  function actionPhotoStyle(p){const url=photoUrl(p?.action_photo_path);return url?`--player-action-photo:url('${esc(url)}')`:'';}
  function playerRowSummary(r){const p=publicPlayer(r),open=String(expandedPlayerId)===String(r.player_id);return `<article class="selection-player-row ${open?'is-open':''}" data-player-tile="${esc(r.player_id)}" style="${actionPhotoStyle(p)}">
      <button type="button" class="selection-player-row-summary" data-player-row-toggle="${esc(r.player_id)}" aria-expanded="${open?'true':'false'}">
        <span class="selection-row-photo" style="${borderStyle()}"><span class="selection-photo-inner">${playerPhoto(p)}${photoCopyright(p.photo_copyright_source)}</span></span>
        <span class="selection-row-name"><strong>${esc(p.display_name||'Joueur')}</strong><small>${esc(positionsLabel(p)||'Poste non renseigné')}</small></span>
        <span class="selection-row-stat is-order"><small>Ordre</small><strong>${r.international_number!=null?`N° ${esc(r.international_number)}`:'—'}</strong></span>
        <span class="selection-row-stat"><small>Sélections</small><strong>${statVal(r.selections)}</strong></span>
        <span class="selection-row-stat"><small>Buts</small><strong>${statVal(r.goals)}</strong></span>
        <span class="selection-row-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="selection-player-row-detail" ${open?'':'hidden'}>
        <div class="selection-row-action-photo" aria-hidden="true">${photoCopyright(p.action_photo_copyright_source)}</div>
        <div class="selection-row-detail-content">
          <div class="selection-row-detail-top">
            <div class="selection-row-identity"><span class="international-number">${r.international_number!=null?`N° ${esc(r.international_number)}`:'International A'}</span><h3>${esc(p.display_name||'Joueur')}</h3><div class="selection-dob">${p.birth_date?`Né le ${esc(fmtDate(p.birth_date))}`:'Date de naissance non renseignée'}${p.death_date?` · Décédé le ${esc(fmtDate(p.death_date))}`:''}</div><div class="selection-position ${playerPositions(p).length?'':'is-empty'}"><span class="selection-position-label">Poste${playerPositions(p).length>1?'s':''} ·</span><span class="selection-position-inline" data-position-player="${esc(r.player_id)}">${esc(positionsLabel(p)||'Non renseigné')}</span></div></div>
            <div class="selection-tile-actions">${canEdit()?`<button type="button" data-edit-player="${esc(r.player_id)}" title="Modifier la fiche">✎</button>`:''}</div>
          </div>
          <div class="selection-stats-grid">${contextStatsGrid(r,true,r)}</div>
          <div class="selection-linked-fields is-achievements-only"><div class="selection-achievements-field"><small>Accomplissements</small><div data-ach-player="${esc(r.player_id)}" class="selection-achievements-slot"><span class="selection-achievement-empty">—</span></div></div></div>
          <div class="selection-tags" data-tags-player="${esc(r.player_id)}">${selectionTagHtml(selectedTeam(),r)}</div>
          <section class="selection-player-matches"><div class="selection-player-matches-head"><strong>Matchs</strong><small>Historique lié aux feuilles de match</small></div><div class="selection-player-match-list" data-player-match-list="${esc(r.player_id)}">${open?'<div class="selection-player-match-loading">Chargement…</div>':''}</div></section>
          <footer><div class="contributors">${contributorHtml(r._contributors)}</div></footer>
        </div>
      </div>
    </article>`;}
  function drawRows(visible,total){
    const host=$('#referenceEntries'),team=selectedTeam();if(!host)return;
    if(!visible.length){host.innerHTML=`<div class="selection-empty"><strong>Aucune fiche dans ${esc(team?.name||'cette sélection')}.</strong><span>${canEdit()?'Le bouton + Ajouter permet de créer le premier joueur de cette catégorie.':'Cette catégorie est prête à recevoir ses futurs internationaux.'}</span></div>`;return;}
    host.innerHTML=`<div class="selection-player-list">${visible.map(playerRowSummary).join('')}</div>${paginationHtml(total)}`;
    bindTiles();hydrateLinkedFields(visible).catch(()=>{});if(expandedPlayerId)hydratePlayerMatches(expandedPlayerId).catch(()=>{});
  }
  function paginationHtml(total){const pages=Math.max(1,Math.ceil(total/pageSize));if(pages<=1)return '';return `<div class="selection-pagination"><button type="button" data-page-prev ${page<=1?'disabled':''}>←</button><span>Page ${page} / ${pages} · ${total} joueurs</span><button type="button" data-page-next ${page>=pages?'disabled':''}>→</button></div>`;}
  function matchResultLabel(m){
    const fs=m?.france_score,os=m?.opponent_score;if(fs==null||os==null)return '';return fs>os?'Victoire':fs<os?'Défaite':'Nul';
  }
  async function hydratePlayerMatches(playerId){
    playerId=String(playerId||'');if(!playerId||!client)return;const host=$(`[data-player-match-list="${CSS.escape(playerId)}"]`);if(!host)return;
    let list=playerMatchesCache.get(playerId);
    if(!list){
      host.innerHTML='<div class="selection-player-match-loading">Chargement des matchs…</div>';
      const {data,error}=await client.from('match_appearances').select(`match_id,starter,minutes,shirt_number,position,goals,captain,match:matches!match_appearances_match_id_fkey(id,match_date,france_score,opponent_score,status,home_away,opponent:opponents(name),competition:competitions(name))`).eq('player_id',playerId).limit(500);
      if(error){host.innerHTML=`<div class="selection-player-match-empty">${esc(error.message||'Historique indisponible.')}</div>`;return;}
      list=(data||[]).filter(x=>x.match).sort((a,b)=>new Date(b.match.match_date)-new Date(a.match.match_date));playerMatchesCache.set(playerId,list);
    }
    host.innerHTML=list.length?list.slice(0,20).map(x=>{const m=x.match,opp=m.opponent?.name||'Adversaire',date=m.match_date?new Date(m.match_date).toLocaleDateString('fr-FR'):'—',score=(m.france_score!=null&&m.opponent_score!=null)?`${m.france_score} – ${m.opponent_score}`:'VS',meta=[m.competition?.name,x.position,x.shirt_number!=null?`N° ${x.shirt_number}`:'',x.starter?'Titulaire':'Entré en jeu',x.goals?`${x.goals} but${x.goals>1?'s':''}`:''].filter(Boolean).join(' · ');return `<button type="button" class="selection-player-match-row" data-player-open-match="${esc(m.id)}"><span><strong>France ${esc(score)} ${esc(opp)}</strong><small>${esc(date)}${meta?' · '+esc(meta):''}</small></span><em>${esc(matchResultLabel(m))}</em></button>`;}).join(''):'<div class="selection-player-match-empty">Aucun match lié à une feuille de match pour le moment.</div>';
    $$('[data-player-open-match]',host).forEach(b=>b.addEventListener('click',()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.playerOpenMatch)));
  }
  function togglePlayerRow(playerId){
    const id=String(playerId||'');expandedPlayerId=String(expandedPlayerId)===id?'':id;drawRows(filterRows().slice((page-1)*pageSize,page*pageSize),filterRows().length);
  }
  function bindAchievementTooltips(root=document){
    $$('.selection-achievement-badge',root).forEach(b=>{
      b.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();const on=!b.classList.contains('is-tooltip-open');$$('.selection-achievement-badge.is-tooltip-open').forEach(x=>x.classList.remove('is-tooltip-open'));b.classList.toggle('is-tooltip-open',on);}});
    });
  }
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.target.closest('.selection-achievement-badge'))$$('.selection-achievement-badge.is-tooltip-open').forEach(x=>x.classList.remove('is-tooltip-open'));});
  function bindTiles(){
    $$('[data-stat-step]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();adjustStat(b.dataset.row,b.dataset.statStep,Number(b.dataset.delta));}));
    $$('[data-edit-player]').forEach(b=>b.addEventListener('click',async e=>{e.stopPropagation();try{await openEditor(b.dataset.editPlayer);}catch(err){console.error('Ouverture éditeur joueur',err);alert('Impossible d’ouvrir l’éditeur : '+(err?.message||err));}}));
    $$('[data-player-row-toggle]').forEach(b=>b.addEventListener('click',()=>togglePlayerRow(b.dataset.playerRowToggle)));
    $('[data-page-prev]')?.addEventListener('click',()=>{page=Math.max(1,page-1);expandedPlayerId='';render(query);});$('[data-page-next]')?.addEventListener('click',()=>{page++;expandedPlayerId='';render(query);});
  }

  function linkedTagHtml(t,playerId){
    const chip=window.BLEUS3000_TAGS?.chipHtml?window.BLEUS3000_TAGS.chipHtml(t,'selection-linked-tag-chip'):`<span class="selection-main-tag">${esc(t.label_text)}</span>`;
    if(t?.reference_scope!=='position')return chip;
    return `<button type="button" class="player-position-tag" data-player-position-tag="${esc(t.id)}" data-player-position-player="${esc(playerId)}" title="Voir les matchs joués à ce poste">${chip}</button>`;
  }
  function ensurePositionMatchesModal(){
    let modal=$('#playerPositionMatchesModal');if(modal)return modal;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop player-position-matches" id="playerPositionMatchesModal" hidden><section class="modal-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2 id="playerPositionMatchesTitle">Matchs par poste</h2><p>Feuilles de match liées au poste sélectionné</p></div><button class="modal-close" type="button" data-position-matches-close>×</button></header><div class="modal-body"><div class="player-position-match-list" id="playerPositionMatchesList"></div></div></section></div>`);
    modal=$('#playerPositionMatchesModal');
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-position-matches-close]')){modal.hidden=true;document.body.style.overflow='';}});
    return modal;
  }
  async function openPositionMatches(playerId,tagId){
    if(!client)return;
    const modal=ensurePositionMatchesModal(),title=$('#playerPositionMatchesTitle'),host=$('#playerPositionMatchesList');
    modal.hidden=false;document.body.style.overflow='hidden';host.innerHTML='<div class="selection-loading">Chargement des matchs…</div>';
    const {data:pos,error:pe}=await client.from('football_positions').select('id,label_text').eq('tag_id',tagId).maybeSingle();
    if(pe||!pos){host.innerHTML='<div class="universal-search-empty">Poste introuvable.</div>';return;}
    const {data:apps,error:ae}=await client.from('match_appearances').select('match_id').eq('player_id',playerId).eq('position_id',pos.id).limit(500);
    if(ae){host.innerHTML=`<div class="universal-search-empty">${esc(ae.message||'Chargement impossible.')}</div>`;return;}
    await window.BLEUS3000_RELATIONAL_REFS?.load?.();
    const matchMap=new Map((window.BLEUS3000_RELATIONAL_REFS?.matches||[]).map(m=>[String(m.id),m]));
    const list=[...new Map((apps||[]).map(a=>[String(a.match_id),matchMap.get(String(a.match_id))]).filter(x=>x[1])).values()].sort((a,b)=>new Date(b.match_date)-new Date(a.match_date));
    const playerName=publicPlayer(rows.find(r=>String(r.player_id)===String(playerId))||{})?.display_name||'Joueur';
    if(title)title.textContent=`${playerName} · ${pos.label_text}`;
    host.innerHTML=list.length?list.map(m=>{const opp=m.opponent?.name||'Adversaire',date=m.match_date?new Date(m.match_date).toLocaleDateString('fr-FR'):'—',score=(m.france_score!=null&&m.opponent_score!=null)?`${m.france_score} – ${m.opponent_score}`:'VS';return `<button type="button" data-position-open-match="${esc(m.id)}"><strong>France ${esc(score)} ${esc(opp)}</strong><small>${esc(date)} · ${esc(m.competition?.name||m.selection?.name||'Match international')}</small></button>`;}).join(''):'<div class="universal-search-empty">Aucun match lié à ce poste.</div>';
    $$('[data-position-open-match]',host).forEach(b=>b.addEventListener('click',()=>{modal.hidden=true;document.body.style.overflow='';window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.positionOpenMatch);}));
  }

  async function hydrateLinkedFields(visible){
    if(!client||!visible.length)return;const ids=visible.map(r=>r.player_id);
    const [{data:pa},{data:et},{data:allStats}]=await Promise.all([
      client.from('player_achievements').select('player_id,selection_id,achievement_id,achievement_value,achievement:achievements(slug,label_text,icon_text,icon_image_path,icon_storage_path)').eq('selection_id',selectedTeam().id).in('player_id',ids),
      client.from('entity_tags').select('entity_id,tag_id').eq('entity_type','player').in('entity_id',ids),
      client.from('player_selection_stats').select('player_id,selection_id,selections,goals,starts,wins,draws,losses,international_number,appearance_status,data_status,selection:selection_teams(id,code,name)').in('player_id',ids)
    ]);
    const tagMap=new Map(tags.map(t=>[t.id,t]));const generalTag=tags.find(t=>t.slug==='general');
    ids.forEach(id=>{
      const row=visible.find(r=>r.player_id===id);
      const aa=(pa||[]).filter(x=>x.player_id===id);const ae=$(`[data-ach-player="${id}"]`);if(ae){ae.innerHTML=aa.length?aa.map(achievementBadgeHtml).join(''):'<span class="selection-achievement-empty">—</span>';bindAchievementTooltips(ae);}
      const contexts=(allStats||[]).filter(x=>x.player_id===id).map(x=>{const tm=x.selection||teams.find(t=>t.id===x.selection_id)||{};const link=tagReferenceLinks.find(l=>l.reference_id===x.selection_id&&l.relation_kind===(sourceListOnly(x)?'membership':(x.appearance_status==='called_only'?'status':'membership')));return {...x,selection_code:tm.code||'',selection_name:tm.name||'',tag:link?tagMap.get(link.tag_id):null,player_id:id};}).sort((a,b)=>(teams.findIndex(t=>t.id===a.selection_id))-(teams.findIndex(t=>t.id===b.selection_id)));
      playerContextCache.set(id,contexts);
      const selectionTagIds=new Set(contexts.map(c=>c.tag?.id).filter(Boolean));
      const linked=(et||[]).filter(x=>x.entity_id===id&&!selectionTagIds.has(x.tag_id)).map(x=>tagMap.get(x.tag_id)).filter(Boolean).filter(t=>t.slug!=='general');
      const positionPool=linked.filter(t=>t.reference_scope==='position');
      const preferredPositionIds=playerPositions(publicPlayer(row)).map(positionTagForLabel).filter(Boolean).map(t=>String(t.id));
      const positionById=new Map(positionPool.map(t=>[String(t.id),t]));const usedPositionIds=new Set();const positionLinked=[];
      preferredPositionIds.forEach(pid=>{const t=positionById.get(pid);if(t&&!usedPositionIds.has(pid)){positionLinked.push(t);usedPositionIds.add(pid);}});
      positionPool.filter(t=>!usedPositionIds.has(String(t.id))).sort((a,b)=>String(a.label_text||'').localeCompare(String(b.label_text||''),'fr')).forEach(t=>positionLinked.push(t));
      const generic=linked.filter(t=>t.reference_scope!=='position');
      const pe=$(`[data-position-player="${id}"]`),tile=$(`[data-player-tile="${id}"]`);if(pe){if(positionLinked.length){pe.classList.add('has-position-tags');pe.innerHTML=positionLinked.map(t=>linkedTagHtml(t,id)).join('');if(tile){const label=$('.selection-position-label',tile);if(label)label.textContent=`Poste${positionLinked.length>1?'s':''} ·`;$('.selection-position',tile)?.classList.remove('is-empty');}}else{const fallback=positionsLabel(publicPlayer(row));pe.classList.remove('has-position-tags');pe.textContent=fallback||'Non renseigné';}}
      const te=$(`[data-tags-player="${id}"]`);if(te){const buttons=contexts.map(c=>contextButtonHtml(c,c.selection_code===selectedCode)).join('');const genericHtml=generic.map(t=>linkedTagHtml(t,id)).join('');te.innerHTML=buttons+genericHtml;$$('[data-context-code]',te).forEach(b=>b.addEventListener('click',()=>applyTileContext(id,b.dataset.contextCode)));}
      if(tile)$$('[data-player-position-tag]',tile).forEach(b=>b.addEventListener('click',()=>openPositionMatches(b.dataset.playerPositionPlayer,b.dataset.playerPositionTag)));
    });
  }


  async function hydrateRowTagIds(){
    if(!client||!rows.length)return;if(rows.every(r=>Array.isArray(r._tagIds)))return;const ids=new Set(rows.map(r=>r.player_id));
    const {data,error}=await client.from('entity_tags').select('entity_id,tag_id').eq('entity_type','player');if(error)return;
    const map=new Map();(data||[]).forEach(x=>{if(!ids.has(x.entity_id))return;const a=map.get(x.entity_id)||[];a.push(x.tag_id);map.set(x.entity_id,a);});
    rows.forEach(r=>r._tagIds=map.get(r.player_id)||[]);
  }
  async function render(q=''){
    query=q||'';if(loading)return;loading=true;renderLoading();try{if(!await ensureLoaded()){throw new Error('Supabase indisponible');}await hydrateRowTagIds();renderCategoryTabs();ensureSelectionFilters();const all=filterRows(),pages=Math.max(1,Math.ceil(all.length/pageSize));page=Math.min(page,pages);const visible=all.slice((page-1)*pageSize,page*pageSize);const ref=$('#referenceCount');if(ref)ref.textContent=`${all.length} joueur${all.length>1?'s':''}`;const title=$('#referenceModalTitle'),sub=$('#referenceModalSub');if(title)title.textContent='Internationaux A';if(sub)sub.textContent=`${selectedTeam()?.name||'France A Masculin'} · liste compacte · cliquer sur une ligne pour déplier la fiche`;drawRows(visible,all.length);hydrateContributors(visible).catch(()=>{});}catch(e){console.error(e);const h=$('#referenceEntries');if(h)h.innerHTML='<div class="selection-empty"><strong>Impossible de charger le référentiel.</strong><span>Vérifie la connexion Supabase.</span></div>';}finally{loading=false;}
  }
  async function selectCategory(code){selectedCode=code||'FRA-A-M';rows=[];page=1;tagFilter='';positionFilter='';await render(query);}
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
      <div class="selection-editor-photo"><div class="selection-photo-frame is-large" id="selectionEditorPhotoFrame"><div class="selection-photo-inner" id="selectionEditorPhotoPreview"><span>?</span></div></div><label class="secondary-btn">Importer un portrait<input id="selectionEditorPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="secondary-btn" id="selectionEditorPhotoCropExisting" type="button">Recadrer</button><button class="secondary-btn" id="selectionEditorPhotoRemove" type="button">Retirer</button><small>Portrait · recadrage manuel carré · WebP 512×512</small><label class="photo-copyright-toggle"><input id="selectionEditorPhotoCopyrightEnabled" type="checkbox"> Copyright</label><label class="photo-copyright-field" id="selectionEditorPhotoCopyrightField" hidden><span>©</span><input name="photo_copyright_source" maxlength="180" placeholder="Source / photographe / agence"></label><div class="selection-action-photo-editor"><div class="selection-action-photo-editor-preview" id="selectionEditorActionPhotoPreview"><span>Photo en match</span></div><label class="secondary-btn">Importer une photo en match<input id="selectionEditorActionPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="secondary-btn" id="selectionEditorActionPhotoRemove" type="button">Retirer le fond</button><small>Utilisée uniquement en arrière-plan de la fiche déployée · format paysage conseillé.</small><label class="photo-copyright-toggle"><input id="selectionEditorActionCopyrightEnabled" type="checkbox"> Copyright</label><label class="photo-copyright-field" id="selectionEditorActionCopyrightField" hidden><span>©</span><input name="action_photo_copyright_source" maxlength="180" placeholder="Source / photographe / agence"></label></div></div>
      <div class="selection-editor-fields"><label>Nom affiché<input name="display_name" required maxlength="120"></label><label>Date de naissance<input name="birth_date" type="date"></label><label>Date de décès<input name="death_date" type="date"><small>Laisser vide si le joueur est vivant ou si la date est inconnue.</small></label><div class="selection-derived-note"><strong>Postes</strong><span>Calculés automatiquement depuis les feuilles de match validées.</span><div id="selectionEditorPositions" hidden></div></div><label id="selectionEditorContextLabel">Statistiques de la sélection<select id="selectionEditorContext" aria-label="Choisir la sélection à modifier"></select><small>GENERAL est calculé automatiquement et ne se modifie pas directement.</small></label><label>Statut d’apparition<select name="appearance_status"><option value="capped">International · entré en jeu</option><option value="called_only">Convocation · jamais entré en jeu</option></select></label><label>N° d’apparition<input name="international_number" type="number" min="1"></label><div class="selection-derived-note"><strong>Statistiques sportives</strong><span>Sélections, buts et V/N/D sont calculés uniquement après validation des feuilles de match.</span><input name="selections" type="hidden"><input name="goals" type="hidden"><input name="wins" type="hidden"><input name="draws" type="hidden"><input name="losses" type="hidden"></div><label>Tags<div id="selectionEditorTags" class="selection-tag-checks"></div></label><div class="selection-editor-achievement-field"><label>Accomplissements</label><div class="selection-achievement-picker"><select id="selectionEditorAchievementSelect" aria-label="Choisir un accomplissement"><option value="">Choisir un accomplissement…</option></select><button type="button" class="secondary-btn" id="selectionEditorAchievementAdd">+ Ajouter</button></div><div id="selectionEditorAchievements" class="selection-achievements-editor"><span class="selection-achievement-empty">Aucun accomplissement ajouté</span></div><small>Choisis autant d’accomplissements que nécessaire : aucune limite n’est imposée. Le nombre est facultatif.</small></div></div>
      <div class="c3k-v8-actions selection-editor-actions"><span class="selection-editor-save-status" id="selectionEditorSaveStatus"></span><button class="secondary-btn" data-selection-editor-close type="button">Fermer</button><button class="primary-btn" type="submit">Enregistrer</button></div></form></div></section></div>`);
    $$('[data-selection-editor-close]').forEach(b=>b.addEventListener('click',closeEditor));$('#selectionPlayerEditorForm').addEventListener('submit',saveEditor);$('#selectionEditorPhotoInput').addEventListener('change',preparePhoto);$('#selectionEditorPhotoCropExisting').addEventListener('click',recropExistingPhoto);$('#selectionEditorPhotoRemove').addEventListener('click',()=>{pendingPhoto=null;pendingPhotoPreview='';$('#selectionPlayerEditorForm').dataset.removePhoto='1';updateEditorPhoto();});$('#selectionEditorActionPhotoInput').addEventListener('change',prepareActionPhoto);$('#selectionEditorActionPhotoRemove').addEventListener('click',()=>{pendingActionPhoto=null;pendingActionPhotoPreview='';$('#selectionPlayerEditorForm').dataset.removeActionPhoto='1';updateEditorActionPhoto();});$('#selectionEditorPhotoCopyrightEnabled').addEventListener('change',e=>{$('#selectionEditorPhotoCopyrightField').hidden=!e.target.checked;});$('#selectionEditorActionCopyrightEnabled').addEventListener('change',e=>{$('#selectionEditorActionCopyrightField').hidden=!e.target.checked;});$('#selectionEditorContext').addEventListener('change',e=>{if(currentEditor?.playerId&&e.target.value)openEditor(currentEditor.playerId,e.target.value);});$('#selectionEditorAchievementAdd').addEventListener('click',addEditorAchievement);$('#selectionEditorAchievements').addEventListener('click',e=>{const b=e.target.closest('[data-remove-achievement]');if(!b)return;pendingAchievements=pendingAchievements.filter(x=>x.achievement_id!==String(b.dataset.removeAchievement));renderEditorAchievements();});$('#selectionEditorAchievements').addEventListener('input',e=>{const input=e.target.closest('[data-achievement-value]');if(!input)return;const row=input.closest('[data-achievement-id]');const item=pendingAchievements.find(x=>x.achievement_id===row?.dataset.achievementId);if(!item)return;item.achievement_value=input.value===''?null:Math.max(0,Number(input.value)||0);});
  }
  function closeEditor(){const m=$('#selectionPlayerEditorModal');if(m)m.hidden=true;currentEditor=null;pendingPhoto=null;pendingPhotoPreview='';pendingActionPhoto=null;pendingActionPhotoPreview='';pendingAchievements=[];}
  function syncAppearanceEditor(form){
    if(!form)return;
    const status=form.elements?.namedItem('appearance_status')?.value||'capped';
    const calledOnly=status==='called_only';
    const numberInput=form.elements?.namedItem('international_number');
    if(numberInput){
      numberInput.disabled=calledOnly;
      numberInput.placeholder=calledOnly?'Convocation · aucun numéro attribué':'N° d’apparition';
    }
    for(const name of ['selections','goals','wins','draws','losses']){
      const input=form.elements?.namedItem(name);
      if(input){input.disabled=calledOnly;input.title=calledOnly?'Statistique à 0 tant que le joueur n’est jamais entré en jeu':'';}
    }
  }
  async function openEditor(playerId=null,contextCode=null){
    if(!canEdit())return alert('Modification réservée aux ADMIN et SUPERADMIN.');ensureEditor();if(!teams.length)await loadTeams();
    let contextRows=[];if(playerId){const {data,error}=await client.from('player_selection_stats').select(`id,player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,international_number,appearance_status,first_year,last_year,data_status,updated_at,selection:selection_teams(id,code,name,gender),player:players!player_selection_stats_player_id_fkey(id,display_name,last_name,birth_date,death_date,photo_path,action_photo_path,photo_copyright_source,action_photo_copyright_source,primary_position,secondary_positions,active_source,data_status)`).eq('player_id',playerId);if(error)throw error;contextRows=data||[];}
    const wantedCode=contextCode||(contextRows.some(x=>x.selection?.code===selectedCode)?selectedCode:contextRows[0]?.selection?.code)||selectedCode;const team=teams.find(t=>t.code===wantedCode)||selectedTeam();let row=playerId?contextRows.find(x=>x.selection_id===team.id)||rows.find(x=>x.player_id===playerId):null;let p=publicPlayer(row);if(playerId&&!p?.id){const {data:pp}=await client.from('players').select('id,display_name,last_name,birth_date,death_date,photo_path,action_photo_path,photo_copyright_source,action_photo_copyright_source,primary_position,secondary_positions,active_source,data_status').eq('id',playerId).single();p=pp||{};}
    currentEditor={playerId,rowId:row?.id||null,newPlayer:!playerId,selectionId:team.id,selectionCode:team.code,photoPath:p.photo_path||null,actionPhotoPath:p.action_photo_path||null,photoCopyright:p.photo_copyright_source||'',actionPhotoCopyright:p.action_photo_copyright_source||''};pendingPhoto=null;pendingPhotoPreview='';pendingActionPhoto=null;pendingActionPhotoPreview='';const form=$('#selectionPlayerEditorForm');form.reset();delete form.dataset.removePhoto;delete form.dataset.removeActionPhoto;if(!form.dataset.appearanceBound){form.appearance_status?.addEventListener('change',()=>syncAppearanceEditor(form));form.dataset.appearanceBound='1';}
    const ctx=$('#selectionEditorContext');if(ctx){ctx.innerHTML=playerId?contextRows.map(x=>{const lk=tagReferenceLinks.find(l=>l.reference_id===x.selection_id&&l.relation_kind===(sourceListOnly(x)?'membership':(x.appearance_status==='called_only'?'status':'membership')));const tg=lk?tags.find(t=>t.id===lk.tag_id):null;return `<option value="${esc(x.selection?.code||'')}" ${(x.selection?.code||'')===team.code?'selected':''}>${esc(tg?.label_text||x.selection?.name||x.selection?.code||'Sélection')}</option>`;}).join(''):`<option value="${esc(team.code)}" selected>${esc(team.name)}</option>`;ctx.disabled=!playerId||contextRows.length<2;}
    $('#selectionEditorTitle').textContent=playerId?`Modifier · ${p.display_name}`:'Ajouter un joueur';$('#selectionEditorSub').textContent=team.name;form.display_name.value=p.display_name||'';form.birth_date.value=p.birth_date||'';form.death_date.value=p.death_date||'';const pc=$('#selectionEditorPhotoCopyrightEnabled'),pcf=$('#selectionEditorPhotoCopyrightField'),ac=$('#selectionEditorActionCopyrightEnabled'),acf=$('#selectionEditorActionCopyrightField');if(pc){pc.checked=!!String(p.photo_copyright_source||'').trim();pcf.hidden=!pc.checked;}if(ac){ac.checked=!!String(p.action_photo_copyright_source||'').trim();acf.hidden=!ac.checked;}if(form.photo_copyright_source)form.photo_copyright_source.value=p.photo_copyright_source||'';if(form.action_photo_copyright_source)form.action_photo_copyright_source.value=p.action_photo_copyright_source||'';if($('#selectionEditorPositions'))$('#selectionEditorPositions').innerHTML='';for(const k of ['international_number','selections','goals','wins','draws','losses'])if(form[k])form[k].value=row?.[k]??'';form.appearance_status.value=row?.appearance_status||((row?.international_number==null&&Number(row?.selections||0)===0)?'called_only':'capped');syncAppearanceEditor(form);
    const [{data:et},{data:pa}]=playerId?await Promise.all([client.from('entity_tags').select('tag_id').eq('entity_type','player').eq('entity_id',playerId),client.from('player_achievements').select('achievement_id,achievement_value,selection_id,achievement:achievements(slug,label_text,icon_text,icon_image_path,icon_storage_path,description_short)').eq('player_id',playerId).eq('selection_id',team.id)]):[{data:[]},{data:[]}];const assigned=new Set((et||[]).map(x=>x.tag_id));const membershipDefaults=new Set(tagReferenceLinks.filter(l=>l.reference_id===team.id&&l.relation_kind==='membership').map(l=>l.tag_id));$('#selectionEditorTags').innerHTML=tags.filter(t=>t.slug!=='general'&&t.reference_scope!=='position').map(t=>`<label class="selection-tag-check"><input type="checkbox" name="tag_ids" value="${t.id}" ${assigned.has(t.id)||(!playerId&&membershipDefaults.has(t.id))?'checked':''}><span>${esc(t.icon_text||'🏷️')} ${esc(t.label_text)}</span></label>`).join('');pendingAchievements=(pa||[]).filter(x=>x.achievement?.slug!=='capitanat').map(x=>({achievement_id:x.achievement_id,achievement_value:x.achievement_value??null}));renderEditorAchievements();updateEditorPhoto();updateEditorActionPhoto();$('#selectionPlayerEditorModal').hidden=false;
  }
  function ensurePhotoCropModal(){let m=$('#selectionPhotoCropModal');if(m)return m;document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop selection-photo-crop-modal" id="selectionPhotoCropModal" hidden><section class="modal-dialog selection-photo-crop-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Recadrer le portrait</h2><p>Déplace le cadrage horizontalement / verticalement et ajuste le zoom.</p></div><button class="modal-close" type="button" data-crop-close>×</button></header><div class="modal-body"><div class="selection-photo-crop-workspace"><canvas id="selectionPhotoCropCanvas" width="420" height="420"></canvas><div class="selection-photo-crop-controls"><label>Zoom<input id="selectionPhotoCropZoom" type="range" min="100" max="300" step="1" value="100"><span id="selectionPhotoCropZoomValue">100 %</span></label><label>Horizontal<input id="selectionPhotoCropX" type="range" min="-100" max="100" step="1" value="0"></label><label>Vertical<input id="selectionPhotoCropY" type="range" min="-100" max="100" step="1" value="0"></label><button class="secondary-btn" id="selectionPhotoCropCenter" type="button">Centrer</button></div></div><div class="c3k-v8-actions selection-photo-crop-actions"><button class="secondary-btn" type="button" data-crop-close>Annuler</button><button class="primary-btn" id="selectionPhotoCropApply" type="button">Appliquer le recadrage</button></div></div></section></div>`);m=$('#selectionPhotoCropModal');$$('[data-crop-close]',m).forEach(b=>b.addEventListener('click',closePhotoCrop));for(const id of ['selectionPhotoCropZoom','selectionPhotoCropX','selectionPhotoCropY'])$('#'+id,m)?.addEventListener('input',renderPhotoCrop);$('#selectionPhotoCropCenter',m)?.addEventListener('click',()=>{const z=$('#selectionPhotoCropZoom',m),x=$('#selectionPhotoCropX',m),y=$('#selectionPhotoCropY',m);z.value='100';x.value='0';y.value='0';renderPhotoCrop();});$('#selectionPhotoCropApply',m)?.addEventListener('click',applyPhotoCrop);m.addEventListener('pointerdown',e=>{if(e.target===m)closePhotoCrop();});return m;}
  function closePhotoCrop(){const m=$('#selectionPhotoCropModal');if(m)m.hidden=true;if(photoCropState?.url)URL.revokeObjectURL(photoCropState.url);photoCropState=null;}
  function cropGeometry(size){const st=photoCropState;if(!st?.img)return null;const zoom=Number($('#selectionPhotoCropZoom')?.value||100)/100,xp=Number($('#selectionPhotoCropX')?.value||0)/100,yp=Number($('#selectionPhotoCropY')?.value||0)/100,base=Math.max(size/st.img.naturalWidth,size/st.img.naturalHeight),scale=base*zoom,dw=st.img.naturalWidth*scale,dh=st.img.naturalHeight*scale,maxX=Math.max(0,(dw-size)/2),maxY=Math.max(0,(dh-size)/2),dx=(size-dw)/2+xp*maxX,dy=(size-dh)/2+yp*maxY;return {dx,dy,dw,dh};}
  function renderPhotoCrop(){const c=$('#selectionPhotoCropCanvas'),st=photoCropState;if(!c||!st?.img)return;const g=cropGeometry(c.width),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#dbe8f7';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(st.img,g.dx,g.dy,g.dw,g.dh);ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,c.width-3,c.height-3);const zv=$('#selectionPhotoCropZoomValue');if(zv)zv.textContent=`${$('#selectionPhotoCropZoom').value} %`;}
  async function openPhotoCropper(file){if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))return alert('Format non pris en charge.');const m=ensurePhotoCropModal(),url=URL.createObjectURL(file),img=new Image();img.onload=()=>{photoCropState={file,url,img};$('#selectionPhotoCropZoom',m).value='100';$('#selectionPhotoCropX',m).value='0';$('#selectionPhotoCropY',m).value='0';m.hidden=false;renderPhotoCrop();};img.onerror=()=>{URL.revokeObjectURL(url);alert('Impossible de lire cette image.');};img.src=url;}
  async function preparePhoto(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;await openPhotoCropper(f);}
  async function recropExistingPhoto(){try{if(pendingPhoto){await openPhotoCropper(new File([pendingPhoto],'portrait.webp',{type:'image/webp'}));return;}const url=currentEditor?.photoPath?photoUrl(currentEditor.photoPath):'';if(!url)return alert('Aucune photo à recadrer. Importe d’abord un portrait.');const res=await fetch(url);if(!res.ok)throw new Error('Téléchargement de la photo impossible');const blob=await res.blob();await openPhotoCropper(new File([blob],'portrait.webp',{type:blob.type||'image/webp'}));}catch(err){console.error(err);alert('Recadrage impossible : '+(err.message||err));}}
  async function applyPhotoCrop(){const st=photoCropState,c=document.createElement('canvas');if(!st?.img)return;c.width=c.height=512;const g=cropGeometry(512),ctx=c.getContext('2d');ctx.fillStyle='#dbe8f7';ctx.fillRect(0,0,512,512);ctx.drawImage(st.img,g.dx,g.dy,g.dw,g.dh);const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Conversion impossible')),'image/webp',.9));pendingPhoto=blob;if(pendingPhotoPreview)URL.revokeObjectURL(pendingPhotoPreview);pendingPhotoPreview=URL.createObjectURL(blob);delete $('#selectionPlayerEditorForm').dataset.removePhoto;updateEditorPhoto();closePhotoCrop();}
  async function prepareActionPhoto(e){const f=e.target.files?.[0];if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return alert('Format non pris en charge.');pendingActionPhoto=await landscapeWebp(f);pendingActionPhotoPreview=URL.createObjectURL(pendingActionPhoto);delete $('#selectionPlayerEditorForm').dataset.removeActionPhoto;updateEditorActionPhoto();}
  function landscapeWebp(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{try{const tw=1600,th=900,target=tw/th,source=img.width/img.height;let sx=0,sy=0,sw=img.width,sh=img.height;if(source>target){sw=img.height*target;sx=(img.width-sw)/2;}else{sh=img.width/target;sy=(img.height-sh)/2;}const c=document.createElement('canvas');c.width=tw;c.height=th;const x=c.getContext('2d');x.drawImage(img,sx,sy,sw,sh,0,0,tw,th);c.toBlob(b=>{URL.revokeObjectURL(url);b?resolve(b):reject(new Error('Conversion impossible'));},'image/webp',.86);}catch(err){URL.revokeObjectURL(url);reject(err);}};img.onerror=reject;img.src=url;});}
  function updateEditorPhoto(){const frame=$('#selectionEditorPhotoFrame'),prev=$('#selectionEditorPhotoPreview');if(frame)frame.style.cssText=borderStyle();const existing=currentEditor?.photoPath?photoUrl(currentEditor.photoPath):'';const url=pendingPhotoPreview||($('#selectionPlayerEditorForm')?.dataset.removePhoto?'':existing);if(prev)prev.innerHTML=url?`<img src="${esc(url)}" alt="Aperçu">`:`<span>${esc(initials($('#selectionPlayerEditorForm')?.display_name?.value||'?'))}</span>`;const crop=$('#selectionEditorPhotoCropExisting');if(crop)crop.disabled=!url;}
  function updateEditorActionPhoto(){const prev=$('#selectionEditorActionPhotoPreview');if(!prev)return;const existing=currentEditor?.actionPhotoPath?photoUrl(currentEditor.actionPhotoPath):'';const url=pendingActionPhotoPreview||($('#selectionPlayerEditorForm')?.dataset.removeActionPhoto?'':existing);prev.innerHTML=url?`<img src="${esc(url)}" alt="Aperçu photo en match">`:'<span>Photo en match</span>';prev.classList.toggle('has-image',!!url);}
  async function saveEditor(e){
    e.preventDefault();if(!canEdit()||!client||!currentEditor)return;const form=e.currentTarget,fd=new FormData(form),team=teams.find(t=>t.id===currentEditor.selectionId)||selectedTeam();let playerId=currentEditor.playerId,photoPath=currentEditor.photoPath,actionPhotoPath=currentEditor.actionPhotoPath;
    try{
      const birthDate=String(fd.get('birth_date')||'').trim(),deathDate=String(fd.get('death_date')||'').trim();if(birthDate&&deathDate&&deathDate<birthDate)throw new Error('La date de décès ne peut pas être antérieure à la date de naissance.');
      if(currentEditor.newPlayer){const name=String(fd.get('display_name')||'').trim();const {data:p,error}=await client.from('players').insert({display_name:name,last_name:name,gender:team.gender,birth_date:fd.get('birth_date')||null,death_date:fd.get('death_date')||null,primary_position:null,secondary_positions:[],france_eligibility:true,senior_a_called:team.code==='FRA-A-M',active:true,photo_copyright_source:$('#selectionEditorPhotoCopyrightEnabled')?.checked?String(fd.get('photo_copyright_source')||'').trim()||null:null,action_photo_copyright_source:$('#selectionEditorActionCopyrightEnabled')?.checked?String(fd.get('action_photo_copyright_source')||'').trim()||null:null,name_normalized:name.toLocaleLowerCase('fr'),profile_slug:name.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now()}).select('id').single();if(error)throw error;playerId=p.id;currentEditor.playerId=playerId;
        const newAppearanceStatus=fd.get('appearance_status')==='capped'?'capped':'called_only';const newIntl=fd.get('international_number')===''?null:Number(fd.get('international_number'));const {error:se}=await client.from('player_selection_stats').insert({player_id:playerId,selection_id:team.id,appearance_status:newAppearanceStatus,international_number:newIntl,selections:0,goals:0,wins:0,draws:0,losses:0,starts:0,minutes:0,data_status:'sheet_rebuild_pending'});if(se)throw se;
      }else{
        const {error:pe}=await client.from('players').update({display_name:String(fd.get('display_name')||'').trim(),last_name:String(fd.get('display_name')||'').trim(),birth_date:fd.get('birth_date')||null,death_date:fd.get('death_date')||null,photo_copyright_source:$('#selectionEditorPhotoCopyrightEnabled')?.checked?String(fd.get('photo_copyright_source')||'').trim()||null:null,action_photo_copyright_source:$('#selectionEditorActionCopyrightEnabled')?.checked?String(fd.get('action_photo_copyright_source')||'').trim()||null:null}).eq('id',playerId);if(pe)throw pe;const appearanceStatus=fd.get('appearance_status')==='called_only'?'called_only':'capped';const internationalNumber=fd.get('international_number')===''?null:Number(fd.get('international_number'));const {error:statusError}=await client.from('player_selection_stats').update({appearance_status:appearanceStatus,international_number:internationalNumber,updated_at:new Date().toISOString()}).eq('player_id',playerId).eq('selection_id',team.id);if(statusError)throw statusError;
      }
      if(pendingPhoto){const path=`${playerId}/${Date.now()}.webp`;const {error:ue}=await client.storage.from('player-photos').upload(path,pendingPhoto,{contentType:'image/webp',upsert:false});if(ue)throw new Error('Photo · upload : '+ue.message);photoPath=path;{const {error:ppe}=await client.from('players').update({photo_path:path}).eq('id',playerId);if(ppe)throw new Error('Photo · fiche joueur : '+ppe.message);}}else if(form.dataset.removePhoto){photoPath=null;{const {error:pre}=await client.from('players').update({photo_path:null,photo_copyright_source:null}).eq('id',playerId);if(pre)throw new Error('Photo · retrait : '+pre.message);}}
      if(pendingActionPhoto){const actionPath=`${playerId}/action-${Date.now()}.webp`;const {error:aue}=await client.storage.from('player-photos').upload(actionPath,pendingActionPhoto,{contentType:'image/webp',upsert:false});if(aue)throw new Error('Photo en match · upload : '+aue.message);actionPhotoPath=actionPath;const {error:ape}=await client.from('players').update({action_photo_path:actionPath}).eq('id',playerId);if(ape)throw new Error('Photo en match · fiche joueur : '+ape.message);}else if(form.dataset.removeActionPhoto){actionPhotoPath=null;const {error:are}=await client.from('players').update({action_photo_path:null,action_photo_copyright_source:null}).eq('id',playerId);if(are)throw new Error('Photo en match · retrait : '+are.message);}
      {const editableIds=achievements.map(a=>String(a.id));const selectedAchievements=pendingAchievements.filter(a=>editableIds.includes(String(a.achievement_id))).map(a=>({achievement_id:a.achievement_id,achievement_value:a.achievement_value===null||a.achievement_value===undefined||a.achievement_value===''?null:Math.max(0,Number(a.achievement_value)||0)}));if(editableIds.length){const {error:ade}=await client.from('player_achievements').delete().eq('player_id',playerId).eq('selection_id',team.id).in('achievement_id',editableIds);if(ade)throw new Error('Accomplissements · suppression : '+ade.message);}if(selectedAchievements.length){const payload=selectedAchievements.map(a=>({player_id:playerId,selection_id:team.id,achievement_id:a.achievement_id,achievement_value:a.achievement_value,added_by:window.C3K_ACCOUNT_STATE?.profile?.id||null}));const {error:ae}=await client.from('player_achievements').insert(payload);if(ae)throw new Error('Accomplissements · ajout : '+ae.message);}}
      let tagIds=fd.getAll('tag_ids').map(String).filter(id=>tags.find(t=>String(t.id)===String(id))?.reference_scope!=='position');const appearanceStatus=fd.get('appearance_status')==='called_only'?'called_only':'capped';const membershipIds=new Set(tagReferenceLinks.filter(l=>l.reference_id===team.id&&l.relation_kind==='membership').map(l=>l.tag_id)),statusIds=new Set(tagReferenceLinks.filter(l=>l.reference_id===team.id&&l.relation_kind==='status').map(l=>l.tag_id));if(appearanceStatus==='called_only'){tagIds=tagIds.filter(id=>!membershipIds.has(id));statusIds.forEach(id=>tagIds.push(id));}else{tagIds=tagIds.filter(id=>!statusIds.has(id));membershipIds.forEach(id=>tagIds.push(id));}tagIds=[...new Set(tagIds)];{const {error:tde}=await client.from('entity_tags').delete().eq('entity_type','player').eq('entity_id',playerId);if(tde)throw new Error('Tags · suppression : '+tde.message);}if(tagIds.length){const {error:te}=await client.from('entity_tags').insert(tagIds.map(tag_id=>({entity_type:'player',entity_id:playerId,tag_id})));if(te)throw new Error('Tags · ajout : '+te.message);}const {error:positionSyncError}=await client.rpc('sync_player_position_tags',{p_player_id:playerId});if(positionSyncError)throw new Error('Postes · synchronisation des tags : '+positionSyncError.message);
      const savedContext=currentEditor.selectionCode;const contributionType=currentEditor.newPlayer?'create':'edit';playerContextCache.delete(playerId);await client.rpc('record_selection_contribution',{p_player_id:playerId,p_type:contributionType});rows=[];await loadRows();render(query);window.BLEUS3000_PLAYERS_DB?.reload?.();window.BLEUS3000_STATISTICS?.invalidate?.();window.BLEUS3000_EPHEMERIDE?.refresh?.().catch?.(()=>{});await openEditor(playerId,savedContext);const saved=$('#selectionEditorSaveStatus');if(saved){saved.textContent='Enregistré ✓ · la fenêtre reste ouverte';setTimeout(()=>{if(saved.isConnected)saved.textContent='';},1800);}
    }catch(err){console.error(err);alert('Enregistrement impossible : '+(err.message||err));}
  }

  function ensureBorderModal(){if($('#selectionBorderModal'))return;document.body.insertAdjacentHTML('beforeend',`<div class="c3k-v8-panel-backdrop" id="selectionBorderModal" hidden><section class="c3k-v8-panel selection-border-panel" role="dialog" aria-modal="true"><header class="c3k-v8-panel-head"><strong>Sélections · bordures photo</strong><button class="c3k-v8-close" data-border-close type="button">×</button></header><div class="c3k-v8-panel-body"><p class="c3k-v8-muted">Définis uniquement le rendu de la bordure photo de chaque sélection. Les tags sont désormais associés aux référentiels depuis l’éditeur de tags.</p><div id="selectionBorderList"></div></div></section></div>`);$('[data-border-close]')?.addEventListener('click',()=>$('#selectionBorderModal').hidden=true);$('#selectionBorderModal')?.addEventListener('pointerdown',e=>{if(e.target.id==='selectionBorderModal')e.currentTarget.hidden=true;});}
  async function openBorderEditor(){if(!canEdit())return alert('Gestion des sélections réservée aux ADMIN et SUPERADMIN.');if(!teams.length)await loadTeams();ensureBorderModal();const host=$('#selectionBorderList');host.innerHTML=teams.map(t=>{const b=borders.get(t.id)||{};return `<form class="selection-border-row" data-border-team="${t.id}"><div class="selection-border-sample" style="${borderCss(b)}"><span>${t.gender==='F'?'♀':'♂'}</span></div><div><strong>${esc(t.name)}</strong><div class="selection-border-controls"><select name="appearance"><option value="gradient" ${b.appearance!=='solid'?'selected':''}>Dégradé</option><option value="solid" ${b.appearance==='solid'?'selected':''}>Uni</option></select><input name="color_start" type="color" value="${esc(b.color_start||'#123B8F')}"><input name="color_end" type="color" value="${esc(b.color_end||'#2F6DFF')}"><label>Ép. <input name="border_width" type="number" min="0" max="12" value="${Number(b.border_width??4)}"></label><label>Arrondi <input name="border_radius" type="number" min="0" max="48" value="${Number(b.border_radius??16)}"></label><label>Angle <input name="gradient_angle" type="number" min="0" max="360" value="${Number(b.gradient_angle??135)}"></label><button class="primary-btn" type="submit">Sauver</button></div></div></form>`}).join('');$$('[data-border-team]',host).forEach(f=>f.addEventListener('submit',saveBorder));$('#selectionBorderModal').hidden=false;}

  function borderCss(b){const bg=b.appearance==='solid'?b.color_start:`linear-gradient(${b.gradient_angle||135}deg,${b.color_start||'#123B8F'},${b.color_end||'#2F6DFF'})`;return `background:${bg};border-radius:${Number(b.border_radius??16)}px;border:${Math.max(1,Number(b.border_width??4))}px solid transparent`;}
  async function saveBorder(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),teamId=f.dataset.borderTeam,payload={selection_id:teamId,appearance:fd.get('appearance'),color_start:fd.get('color_start'),color_end:fd.get('color_end'),border_width:Number(fd.get('border_width')),border_radius:Number(fd.get('border_radius')),gradient_angle:Number(fd.get('gradient_angle')),updated_by:window.C3K_ACCOUNT_STATE?.profile?.id||null};const {data,error}=await client.from('selection_photo_borders').upsert(payload).select().single();if(error)return alert(error.message);borders.set(data.selection_id,data);await openBorderEditor();if(selectedTeam()?.id===data.selection_id)render(query);}

  async function openNewPlayer(){return openEditor(null);}
  const isJwtFuture=e=>/jwt\s+issued\s+at\s+future|issued\s+at\s+future/i.test(String(e?.message||e||''));
  async function init(retry=true){
    await waitClient();if(!client)return;
    try{
      await loadTeams();selectedCode=teams.some(t=>t.code==='FRA-A-M')?'FRA-A-M':teams[0]?.code;await loadRows(selectedCode);
    }catch(e){
      if(retry&&isJwtFuture(e)){
        console.warn('Sélections · JWT temporel invalide, refresh + nouvelle tentative.');
        const rr=await client.auth.refreshSession().catch(err=>({error:err}));
        if(!rr?.error){await new Promise(r=>setTimeout(r,1400));teams=[];rows=[];return init(false);}
      }
      console.error('Selections init',e);
    }
  }
  window.addEventListener('c3k:account-state',()=>{if(!client)waitClient().then(c=>{if(c)init();});});
  window.BLEUS3000_SELECTIONS={render,selectCategory,openNewPlayer,openEditor,openBorderEditor,reload:async()=>{rows=[];playerContextCache.clear();await ensureLoaded();await render(query);return rows;},get teams(){return teams;},get rows(){return rows;},get selectedCode(){return selectedCode;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
