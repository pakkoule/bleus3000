(() => {
  'use strict';
  const D=window.BLEUS3000_DATA||{};
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=window.BLEUS3000_SEARCH;
  if(!S)throw new Error('Moteur de recherche 3615 Bleus indisponible');
  const fuzzyEntityScore=(query,values)=>S.scoreAny(query,values);
  const canAdminEdit=()=>['admin','superadmin'].includes(String(window.C3K_ACCOUNT_STATE?.profile?.role||'').toLowerCase());
  let refState={key:'selections',query:''};
  const staticFacetState={};
  let activeSearchIndex=-1, activeSearchItems=[];


  function refEmoji(key){return ({selections:'👤',staff:'👔',matchs:'⚽',competitions:'🏆',adversaires:'🌍',arbitres:'🟨',maillots:'👕',statistiques:'📊',lieux:'🏟️',rassemblements:'📋',livres:'📚',buts:'🥅',panini:'🟨'})[key]||'▦';}

  function renderDashboard(){
    // V1.1.14 : l'accueil est désormais occupé par la base globale des joueurs.
    // Les anciens blocs Ladder / Calendrier / Prochain Bleu / Bibliothèque
    // sont conservés dans les données mais ne sont plus rendus ici.
    bindDashboardButtons();
  }

  function bindDashboardButtons(){
    $$('[data-player]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>window.BLEUS3000_PLAYERS_DB?.openPlayer?.(b.dataset.player));});
    $$('[data-reference]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>openReferences(b.dataset.reference));});
  }

  function openModal(id){const m=$('#'+id);if(!m)return;m.hidden=false;document.body.style.overflow='hidden';}
  function closeModal(id){const m=$('#'+id);if(!m)return;m.hidden=true;if(!$$('.modal-backdrop:not([hidden]),.c3k-v8-panel-backdrop:not([hidden])').length)document.body.style.overflow='';}

  let navigationOverlay=null;
  function navigationItemsHtml(){
    const refs=[
      ['selections','👤','Joueurs'],['staff','👔','Sélectionneurs'],['matchs','⚽','Matchs'],
      ['rassemblements','📋','Rassemblements'],['livres','📚','Livres'],['buts','🥅','Buts'],['panini','🟨','Panini'],['competitions','🏆','Compétitions'],
      ['adversaires','🌍','Adversaires'],['arbitres','🟨','Arbitres'],['maillots','👕','Maillots'],
      ['statistiques','📊','Statistiques'],['lieux','🏟️','Stades']
    ];
    return `<section class="c3k-navigation-section"><h3>OUTILS</h3><div class="c3k-navigation-grid is-tools"><button type="button" data-navigation-tool="xi"><span class="c3k-navigation-icon" aria-hidden="true">•</span><strong>MON ONZE</strong><small>Créer une composition</small></button><button type="button" data-navigation-tool="list"><span class="c3k-navigation-icon" aria-hidden="true">•</span><strong>LISTE SÉLECTIONNEUR</strong><small>Composer une liste</small></button>${canAdminEdit()?'<button type="button" data-navigation-tool="completion"><span class="c3k-navigation-icon" aria-hidden="true">•</span><strong>COMPLÉTION</strong><small>Contrôler toutes les tuiles</small></button>':''}</div></section><section class="c3k-navigation-section"><h3>RÉFÉRENTIELS</h3><div class="c3k-navigation-grid">${refs.map(([key,icon,label])=>`<button type="button" data-navigation-reference="${key}"><span class="c3k-navigation-icon" aria-hidden="true">•</span><strong>${String(label).toLocaleUpperCase('fr-FR')}</strong></button>`).join('')}</div></section>`;
  }
  function ensureNavigationOverlay(){
    if(navigationOverlay&&document.body.contains(navigationOverlay))return navigationOverlay;
    navigationOverlay=document.createElement('div');
    navigationOverlay.id='c3kNavigationOverlay';
    navigationOverlay.className='c3k-navigation-overlay';
    navigationOverlay.hidden=true;
    navigationOverlay.setAttribute('role','navigation');
    navigationOverlay.setAttribute('aria-label','Navigation 3615 Bleus');
    navigationOverlay.innerHTML=`<div class="c3k-navigation-body">${navigationItemsHtml()}</div>`;
    document.body.appendChild(navigationOverlay);
    navigationOverlay.addEventListener('click',e=>{
      const tool=e.target.closest('[data-navigation-tool]');if(tool){const kind=tool.dataset.navigationTool;closeNavigation();openTool(kind);return;}
      const ref=e.target.closest('[data-navigation-reference]');if(ref){const key=ref.dataset.navigationReference;closeNavigation();openReferences(key);}
    });
    return navigationOverlay;
  }
  let navigationPositionFrame=0;
  function positionNavigationNow(){
    navigationPositionFrame=0;
    const launcher=$('#c3kNavigationLauncher'),toggle=launcher?.querySelector('[data-navigation-open]'),overlay=ensureNavigationOverlay();
    if(!toggle||overlay.hidden)return;
    const vv=window.visualViewport;
    const viewportLeft=Number(vv?.offsetLeft||0),viewportTop=Number(vv?.offsetTop||0);
    const viewportWidth=Math.max(280,Number(vv?.width||window.innerWidth||0));
    const viewportHeight=Math.max(260,Number(vv?.height||window.innerHeight||0));
    const r=toggle.getBoundingClientRect(),margin=10,maxW=340;
    const available=Math.max(280,viewportWidth-margin*2);
    const width=Math.min(maxW,available);
    let left=Math.min(Math.max(viewportLeft+margin,r.left),viewportLeft+viewportWidth-width-margin);
    if(viewportWidth<=720)left=viewportLeft+margin;
    const viewportBottom=viewportTop+viewportHeight;
    let top=Math.max(viewportTop+margin,r.bottom+7);
    let maxHeight=Math.max(160,viewportBottom-top-margin);
    if(maxHeight<180){
      const above=Math.max(0,r.top-viewportTop-margin-7);
      if(above>maxHeight){
        maxHeight=Math.max(160,Math.min(520,above));
        top=Math.max(viewportTop+margin,r.top-maxHeight-7);
      }
    }
    overlay.style.width=`${Math.round(width)}px`;
    overlay.style.left=`${Math.round(left)}px`;
    overlay.style.top=`${Math.round(top)}px`;
    overlay.style.maxHeight=`${Math.round(maxHeight)}px`;
  }
  function positionNavigation(){
    if(navigationPositionFrame)return;
    navigationPositionFrame=requestAnimationFrame(positionNavigationNow);
  }
  function openNavigation(){
    const overlay=ensureNavigationOverlay(),launcher=$('#c3kNavigationLauncher'),toggle=launcher?.querySelector('[data-navigation-open]');
    if(!toggle)return;
    overlay.hidden=false;
    launcher.classList.add('is-open');
    toggle.setAttribute('aria-expanded','true');
    positionNavigation();
    requestAnimationFrame(()=>overlay.classList.add('is-visible'));
  }
  function closeNavigation(){
    const overlay=ensureNavigationOverlay(),launcher=$('#c3kNavigationLauncher'),toggle=launcher?.querySelector('[data-navigation-open]');
    overlay.classList.remove('is-visible');
    launcher?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded','false');
    window.setTimeout(()=>{if(!overlay.classList.contains('is-visible'))overlay.hidden=true;},120);
  }
  function toggleNavigation(){const overlay=ensureNavigationOverlay();overlay.hidden||!overlay.classList.contains('is-visible')?openNavigation():closeNavigation();}
  function mountNavigationLauncher(afterNode){
    const rail=afterNode?.parentElement||$('#c3kTopLeftRail');if(!rail)return null;
    let launcher=$('#c3kNavigationLauncher');
    if(!launcher){launcher=document.createElement('section');launcher.id='c3kNavigationLauncher';launcher.className='c3k-navigation-launcher';launcher.innerHTML='<button type="button" class="c3k-navigation-toggle" data-navigation-open aria-expanded="false"><span>☰ Navigation</span><b>▾</b></button>';}
    if(afterNode?.parentElement===rail){afterNode.insertAdjacentElement('afterend',launcher);}else rail.appendChild(launcher);
    return launcher;
  }
  function setupNavigation(){
    ensureNavigationOverlay();
    document.addEventListener('click',e=>{
      const open=e.target.closest('[data-navigation-open]');if(open){e.preventDefault();e.stopPropagation();toggleNavigation();return;}
      if(navigationOverlay&&!navigationOverlay.hidden&&!e.target.closest('#c3kNavigationOverlay')&&!e.target.closest('#c3kNavigationLauncher'))closeNavigation();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&navigationOverlay&&!navigationOverlay.hidden)closeNavigation();});
    window.addEventListener('resize',positionNavigation,{passive:true});
    window.addEventListener('orientationchange',positionNavigation,{passive:true});
    window.addEventListener('scroll',positionNavigation,{passive:true});
    window.visualViewport?.addEventListener('resize',positionNavigation,{passive:true});
    window.visualViewport?.addEventListener('scroll',positionNavigation,{passive:true});
  }
  window.BLEUS3000_NAVIGATION={mount:mountNavigationLauncher,open:openNavigation,close:closeNavigation};

  function entriesFor(key){return D.referenceEntries?.[key]||[];}
  const facetConfigs={};
  function facetValues(row,facet){const raw=facet.values(row);return (Array.isArray(raw)?raw:[raw]).map(x=>String(x||'').trim()).filter(Boolean);}
  function hideReferenceFacetBar(){const bar=$('#referenceFacetFilters');if(bar){bar.hidden=true;bar.innerHTML='';bar.onchange=null;}}
  function renderStaticFacetBar(key,rows){
    const bar=$('#referenceFacetFilters'),cfg=facetConfigs[key];if(!bar||!cfg?.length){hideReferenceFacetBar();return rows;}
    const st=staticFacetState[key]||(staticFacetState[key]={});
    const opt=(v,l,sel)=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;
    bar.hidden=false;bar.innerHTML=cfg.map(f=>{const vals=[...new Set(rows.flatMap(r=>facetValues(r,f)))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));const current=st[f.key]||'all';if(current!=='all'&&!vals.includes(current))st[f.key]='all';return `<label>${esc(f.label)}<select data-static-filter="${esc(f.key)}">${opt('all','Tous',st[f.key]||'all')}${vals.map(v=>opt(v,v,st[f.key]||'all')).join('')}</select></label>`;}).join('')+`<button type="button" class="reference-filter-reset" id="referenceFilterReset">Réinitialiser</button>`;
    bar.onchange=e=>{const k=e.target.dataset.staticFilter;if(!k)return;st[k]=e.target.value;renderReferenceEntries();};
    $('#referenceFilterReset')?.addEventListener('click',()=>{staticFacetState[key]={};renderReferenceEntries();});
    return rows.filter(row=>cfg.every(f=>{const val=st[f.key]||'all';return val==='all'||facetValues(row,f).includes(val);}));
  }

  function canAddReference(key){return canAdminEdit()&&['selections','matchs','rassemblements','maillots','competitions','adversaires','staff','arbitres','lieux','livres','panini','buts'].includes(key);}
  function openReferences(key='selections'){
    refState.key=key;refState.query='';if(key==='buts')window.BLEUS3000_COLLECTIONS?.invalidateGoals?.();const refModal=$('#referenceModal');if(refModal)refModal.dataset.referenceKind=key;const rs=$('#referenceSearch');if(rs){rs.value='';rs.placeholder=`Rechercher dans ${D.references.find(x=>x.key===key)?.title||'ce référentiel'}…`;rs.hidden=false;}hideReferenceFacetBar();renderReferenceEntries();openModal('referenceModal');
  }
  function renderReferenceEntries(){
    const addBtn=$('#addReferenceEntry');if(addBtn)addBtn.hidden=!canAddReference(refState.key);hideReferenceFacetBar();const matchBar=$('#matchReferenceFilters');if(matchBar)matchBar.hidden=true;
    if(refState.key==='selections'&&window.BLEUS3000_SELECTIONS){window.BLEUS3000_SELECTIONS.render(refState.query);return;}
    if(refState.key==='rassemblements'&&window.BLEUS3000_GATHERINGS){window.BLEUS3000_GATHERINGS.render(refState.query);return;}
    if(refState.key==='competitions'&&window.BLEUS3000_V161?.renderCompetitions){window.BLEUS3000_V161.renderCompetitions(refState.query);return;}
    if((refState.key==='matchs'||refState.key==='adversaires'||refState.key==='staff'||refState.key==='arbitres'||refState.key==='lieux')&&window.BLEUS3000_RELATIONAL_REFS){window.BLEUS3000_RELATIONAL_REFS.render(refState.key,refState.query);return;}
    if(refState.key==='statistiques'&&window.BLEUS3000_STATISTICS){window.BLEUS3000_STATISTICS.render(refState.query);return;}
    if(refState.key==='maillots'&&window.BLEUS3000_JERSEYS){window.BLEUS3000_JERSEYS.render(refState.query);return;}
    if(['livres','buts','panini'].includes(refState.key)&&window.BLEUS3000_COLLECTIONS){window.BLEUS3000_COLLECTIONS.render(refState.key,refState.query);return;}
    const cat=$('#selectionCategoryTabs');if(cat)cat.hidden=true;const sf=$('#selectionFilterBar');if(sf)sf.hidden=true;const add=$('#addReferenceEntry');if(add)add.hidden=!canAddReference(refState.key);
    const q=refState.query.trim().toLowerCase();const allRows=entriesFor(refState.key);let rows=allRows.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));rows=renderStaticFacetBar(refState.key,rows);
    const ref=D.references.find(x=>x.key===refState.key);$('#referenceModalTitle').textContent=ref?.title||'Référentiel';$('#referenceModalSub').textContent=ref?.description||'';$('#referenceCount').textContent=`${rows.length} tuile${rows.length>1?'s':''}`;
    $('#referenceEntries').innerHTML=rows.length?rows.map(row=>`<article class="ref-tile" data-ref-id="${esc(row.id)}"><div class="ref-tile-head"><div><h3>${esc(row.title)}</h3><div class="subtitle">${esc(row.subtitle||'')}</div></div><div class="tile-actions">${row.playerId?`<button class="tile-action" type="button" data-open-player="${esc(row.playerId)}" title="Ouvrir la fiche joueur">↗</button>`:''}</div></div><div class="ref-tags">${(row.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="ref-facts">${(row.facts||[]).map(f=>`<span>• ${esc(f)}</span>`).join('')}</div><div class="ref-tile-foot"><button class="source-btn" type="button" data-sources="${esc(row.id)}">🔗 Sources ${(row.sources||[]).length}</button><div class="contributors">${(row.contributors||[]).map(c=>`<span class="contrib-label">${esc(c)}</span>`).join('')}</div></div></article>`).join(''):'<div class="universal-search-empty">Aucune tuile ne correspond à la recherche.</div>';
    $$('[data-sources]').forEach(b=>b.addEventListener('click',()=>showSources(rows.find(x=>x.id===b.dataset.sources))));
    $$('[data-open-player]').forEach(b=>b.addEventListener('click',()=>{closeModal('referenceModal');window.BLEUS3000_PLAYERS_DB?.openPlayer?.(b.dataset.openPlayer);}));
  }
  function showSources(row){
    if(!row)return;$('#sourcesTitle').textContent=`Sources · ${row.title}`;$('#sourcesList').innerHTML=(row.sources||[]).map((s,i)=>`<div class="source-row"><span class="src-icon">${i%2?'📚':'🔗'}</span><div><strong>${esc(s)}</strong><small>${i%2?'Ouvrage / média / archive':'Site web / organisme / document'}</small></div><span>Source ${i+1}</span></div>`).join('')||'<div class="universal-search-empty">Aucune source renseignée.</div>';openModal('sourcesModal');
  }
  function openReferenceEditor(){
    if(!canAdminEdit())return alert('Ajout réservé aux ADMIN et SUPERADMIN.');
    if(refState.key==='selections'&&window.BLEUS3000_SELECTIONS){window.BLEUS3000_SELECTIONS.openNewPlayer();return;}
    if(refState.key==='matchs'&&window.BLEUS3000_CALENDAR?.openCreate){window.BLEUS3000_CALENDAR.openCreate();return;}
    if(refState.key==='rassemblements'&&window.BLEUS3000_GATHERINGS?.openNew){window.BLEUS3000_GATHERINGS.openNew();return;}
    if(refState.key==='maillots'&&window.BLEUS3000_JERSEYS?.openNew){window.BLEUS3000_JERSEYS.openNew();return;}
    if(refState.key==='competitions'&&window.BLEUS3000_V161?.openNewCompetition){window.BLEUS3000_V161.openNewCompetition();return;}
    if(['livres','panini','buts'].includes(refState.key)&&window.BLEUS3000_COLLECTIONS?.openNew){window.BLEUS3000_COLLECTIONS.openNew(refState.key);return;}
    if(['adversaires','staff','arbitres','lieux'].includes(refState.key)&&window.BLEUS3000_RELATIONAL_REFS?.openNew){window.BLEUS3000_RELATIONAL_REFS.openNew(refState.key);return;}
    alert('Aucun formulaire Supabase n’est disponible pour ce référentiel.');
  }

  function playerOptions(){const list=window.BLEUS3000_PLAYER_REGISTRY||[];return `<option value="">— Choisir —</option>${list.map(p=>`<option value="${esc(p.name||p.display_name)}">${esc(p.name||p.display_name)}${p.international_number?` · n°${p.international_number}`:p.position?` · ${esc(p.position)}`:''}</option>`).join('')}`;}
  function openTool(kind){
    if(kind==='xi'&&window.BLEUS3000_TEAM_TOOLS?.open){window.BLEUS3000_TEAM_TOOLS.open('xi');}
    else if(kind==='xi'){$('#teamToolTitle').textContent='Créateur de Onze';$('#teamToolSub').textContent='Composition 11 joueurs · terrain plein';buildPitch('xi');$('#teamToolModal').dataset.kind='xi';openModal('teamToolModal');}
    if(kind==='list'&&window.BLEUS3000_SELECTION_LIST?.open){window.BLEUS3000_SELECTION_LIST.open();}
    else if(kind==='list'){buildListTool();openModal('listToolModal');}
    if(kind==='completion')window.BLEUS3000_COMPLETION_AUDIT?.open?.();
  }
  function buildPitch(kind){
    const n=11,coords=[[3,5],[2,4],[3,4],[4,4],[5,4],[2,3],[4,3],[3,2],[2,1],[4,1],[3,1]];
    $('#pitchSlots').innerHTML=coords.slice(0,n).map((c,i)=>`<div class="player-slot" style="grid-column:${c[0]};grid-row:${c[1]}"><label>${i===0?'GB':i<5?'DEF':i<8?'MIL':'ATT'}</label><select data-lineup-slot="${i}">${playerOptions()}</select></div>`).join('');
    $('#toolTitleInput').value='Mon XI France';
  }
  function buildListTool(){
    const groups=[['Gardiens',3],['Défenseurs',8],['Milieux',7],['Attaquants',8]];$('#listBuilderGrid').innerHTML=groups.map(([name,n])=>`<section class="list-group"><h4>${name}</h4>${Array.from({length:n},(_,i)=>`<select data-list-slot="${esc(name)}-${i}">${playerOptions()}</select>`).join('')}</section>`).join('');
  }
  function collectNames(sel){return $$(sel).map(s=>s.value).filter(Boolean);}
  function saveToolLocally(kind){const key='bleus3000.compositions.v1',all=JSON.parse(localStorage.getItem(key)||'[]'),title=kind==='list'?$('#listTitleInput').value:$('#toolTitleInput').value,names=kind==='list'?collectNames('[data-list-slot]'):collectNames('[data-lineup-slot]');all.unshift({id:Date.now(),kind,title,names,created_at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(all.slice(0,100)));alert('Sauvegardé localement. La synchronisation Supabase s’activera une fois le nouveau projet configuré.');}
  function exportTool(kind,format){
    const canvas=document.createElement('canvas'),w=1080,h=kind==='list'?1350:1080;canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle='#071426';c.fillRect(0,0,w,h);c.fillStyle='#f7faff';c.roundRect(45,45,w-90,h-90,28);c.fill();c.fillStyle='#15355c';c.font='900 54px Arial';const title=kind==='list'?($('#listTitleInput').value||'Ma liste France'):($('#toolTitleInput').value||'Ma composition France');c.fillText(title,85,125);c.font='700 23px Arial';c.fillStyle='#507098';c.fillText('3615 BLEUS',85,165);
    const names=kind==='list'?collectNames('[data-list-slot]'):collectNames('[data-lineup-slot]');if(kind==='list'){c.fillStyle='#163a68';c.font='800 28px Arial';names.forEach((n,i)=>{const col=i<13?0:1,row=i%13;c.fillText(n,90+col*470,245+row*72);});}else{c.fillStyle='#237d59';c.roundRect(90,220,900,720,24);c.fill();c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=4;c.strokeRect(125,255,830,650);c.beginPath();c.moveTo(540,255);c.lineTo(540,905);c.stroke();const coords=kind==='xi'?[[540,850],[250,710],[440,720],[640,720],[830,710],[320,545],[760,545],[540,470],[300,335],[540,310],[780,335]]:[[540,835],[340,620],[740,620],[370,360],[710,360]];c.textAlign='center';names.forEach((n,i)=>{const [x,y]=coords[i]||[540,550];c.fillStyle='#071426';c.beginPath();c.arc(x,y,38,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.font='800 20px Arial';c.fillText(n.split(' ').slice(-1)[0].toUpperCase(),x,y+62);});c.textAlign='start';}
    const mime=format==='jpg'?'image/jpeg':'image/png',url=canvas.toDataURL(mime,.94),a=document.createElement('a');a.href=url;a.download=`${title.replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')}.${format==='jpg'?'jpg':'png'}`;document.body.appendChild(a);a.click();a.remove();
  }

  function searchPlayerPhoto(p){
    const path=String(p?.photo_path||'').trim();
    if(!path)return '';
    const c=window.BLEUS3000_SUPABASE;
    if(!c)return '';
    try{return c.storage.from('player-photos').getPublicUrl(path).data.publicUrl||'';}catch{return '';}
  }
  function searchResultVisual(r){
    const image=String(r?.image||'').trim();
    if(image)return `<span class="universal-search-result-icon has-image"><img src="${esc(image)}" alt="" loading="lazy"></span>`;
    return `<span class="universal-search-result-icon">${r?.icon||'▦'}</span>`;
  }

  function searchCopyText(type,list,interpretation=''){
    const header=[interpretation||'',`${type} · ${list.length} résultat${list.length>1?'s':''}`].filter(Boolean).join('\n');
    const lines=list.map((r,i)=>`${i+1}. ${String(r.title||'').trim()}${r.meta?` — ${String(r.meta).trim()}`:''}`);
    return [header,...lines].filter(Boolean).join('\n');
  }
  async function copySearchGroup(type,list,interpretation,button){
    const text=searchCopyText(type,list,interpretation);if(!text)return;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
      if(button){const before=button.textContent;button.textContent='Copié ✓';button.classList.add('is-copied');setTimeout(()=>{button.textContent=before;button.classList.remove('is-copied');},1400);}
    }catch(err){console.warn('Copie résultats 3615',err);if(button)button.textContent='Copie impossible';}
  }

  function searchDataset(q){
    const out=[],seenPlayers=new Set(),reg=window.BLEUS3000_PLAYER_REGISTRY||[];
    for(const p of reg){
      if(!p?.id||seenPlayers.has(p.id))continue;
      const score=fuzzyEntityScore(q,[p.name,p.display_name,...(p.name_variants||[]),p.position,...(p.positions||[]),...(p.selection_names||[]),...(p.team_tag_labels||[]),String(p.international_number||''),...(p.jersey_numbers||[]).map(String)]);
      if(score<=.48){seenPlayers.add(p.id);out.push({type:'Joueurs',icon:'👤',image:searchPlayerPhoto(p),title:p.name||p.display_name,meta:`${(p.selection_names||[]).slice(0,3).join(' · ')||'Sélections'}${(p.positions||[]).length?' · '+p.positions.join(' / '):p.position?' · '+p.position:''}`,score,action:()=>{const db=window.BLEUS3000_PLAYERS_DB;if(db?.openPlayer)return db.openPlayer(p.id);openReferences('selections');setTimeout(()=>{const inp=$('#referenceSearch');if(inp){inp.value=p.name||p.display_name;inp.dispatchEvent(new Event('input',{bubbles:true}));}},100);}});}
    }
    for(const r of (D.references||[])){const score=fuzzyEntityScore(q,[r.title,r.description,...(r.tags||[])]);if(score<=.48)out.push({type:'Référentiels',icon:refEmoji(r.key),title:r.title,meta:r.description,score:score+.08,action:()=>openReferences(r.key)});}
    const modules=[window.BLEUS3000_RELATIONAL_REFS?.search?.(q)||[],window.BLEUS3000_GATHERINGS?.search?.(q)||[],window.BLEUS3000_JERSEYS?.search?.(q)||[],window.BLEUS3000_COLLECTIONS?.search?.(q)||[]];
    modules.flat().forEach(r=>out.push(r));
    const seen=new Set(),unique=[];
    for(const r of out.sort((a,b)=>(a.score??9)-(b.score??9)||String(a.title).localeCompare(String(b.title),'fr',{sensitivity:'base'}))){const key=`${r.type||''}|${r.title||''}|${r.meta||''}`;if(seen.has(key))continue;seen.add(key);unique.push(r);if(unique.length>=70)break;}
    return unique;
  }
  let searchRenderSeq=0,searchTimer=null;
  function renderSearchRows(box,rows,interpretation=''){
    activeSearchIndex=-1;
    if(!rows.length){
      activeSearchItems=[];
      box.innerHTML=`${interpretation?`<div class="smart-search-interpretation"><span>3615 comprend</span><strong>${esc(interpretation)}</strong></div>`:''}<div class="universal-search-empty"><strong>Aucune donnée correspondante</strong><span>${interpretation?'La requête est comprise, mais aucune feuille de match renseignée ne correspond encore.':'Essaie un autre nom, stade, adversaire ou compétition.'}</span></div>`;
      box.hidden=false;return;
    }
    const grouped=rows.reduce((m,r)=>((m[r.type]??=[]).push(r),m),{}),displayRows=[];
    const groupedEntries=Object.entries(grouped);
    box.innerHTML=`${interpretation?`<div class="smart-search-interpretation"><span>3615 comprend</span><strong>${esc(interpretation)}</strong></div>`:''}`+groupedEntries.map(([type,list],groupIndex)=>`<section class="universal-search-section"><div class="universal-search-section-title"><span>${esc(type)}</span><div class="universal-search-section-actions"><b>${list.length}</b><button class="universal-search-copy-btn" data-search-copy-group="${groupIndex}" type="button" title="Copier toute cette liste">⧉ Copier</button></div></div>${list.map(r=>{const index=displayRows.push(r)-1;return `<button class="universal-search-result${r.smart?' is-smart':''}" data-search-index="${index}" type="button" role="option">${searchResultVisual(r)}<span class="universal-search-result-copy"><span class="universal-search-result-title">${esc(r.title)}</span><span class="universal-search-result-meta">${esc(r.meta||type)}</span></span><span class="universal-search-result-arrow">›</span></button>`;}).join('')}</section>`).join('');
    activeSearchItems=displayRows;box.hidden=false;
    $$('[data-search-index]',box).forEach(b=>b.addEventListener('click',()=>{const row=activeSearchItems[Number(b.dataset.searchIndex)];box.hidden=true;row?.action?.();}));
    $$('[data-search-copy-group]',box).forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const entry=groupedEntries[Number(b.dataset.searchCopyGroup)];if(entry)copySearchGroup(entry[0],entry[1],interpretation,b);}));
  }
  async function ensureSearchEverywhereLoaded(){
    const local=window.BLEUS3000_SEARCH_INDEX;
    if(local?.ensure){await local.ensure();return;}
    await Promise.allSettled([window.BLEUS3000_RELATIONAL_REFS?.load?.(),window.BLEUS3000_GATHERINGS?.load?.(),window.BLEUS3000_JERSEYS?.load?.()]);
  }
  async function renderSearch(q){
    const box=$('#universalSearchResults');if(!box)return;
    const query=String(q||'').trim(),seq=++searchRenderSeq;
    if(!query){box.hidden=true;box.innerHTML='';activeSearchItems=[];activeSearchIndex=-1;return;}
    box.hidden=false;box.innerHTML='<div class="smart-search-loading"><span class="smart-search-pulse">3615</span><span>Recherche locale dans tout 3615 Bleus…</span></div>';
    const local=window.BLEUS3000_SEARCH_INDEX;
    if(local?.search){
      try{
        const localResult=await local.search(query);if(seq!==searchRenderSeq)return;
        const smart=window.BLEUS3000_SMART_SEARCH;
        if(localResult?.preferLegacySmart&&smart?.shouldHandle?.(query)&&(localResult.rows||[]).length<=2){
          box.innerHTML='<div class="smart-search-loading"><span class="smart-search-pulse">3615</span><span>Analyse statistique complémentaire…</span></div>';
          try{
            const smartResult=await smart.search(query);if(seq!==searchRenderSeq)return;
            const rows=[...(smartResult?.rows||[]),...(localResult.rows||[])];
            renderSearchRows(box,rows,smartResult?.handled?smartResult.interpretation||localResult.interpretation||'':'');
            return;
          }catch(err){console.warn('Recherche statistique 3615',err);}
        }
        if((localResult?.rows||[]).length){renderSearchRows(box,localResult.rows,localResult.interpretation||'');return;}
      }catch(err){console.warn('Index local 3615',err);}
    }
    await ensureSearchEverywhereLoaded();if(seq!==searchRenderSeq)return;
    const smart=window.BLEUS3000_SMART_SEARCH;
    if(smart?.shouldHandle?.(query)){
      box.hidden=false;box.innerHTML='<div class="smart-search-loading"><span class="smart-search-pulse">3615</span><span>Analyse de la requête statistique…</span></div>';
      try{
        const smartResult=await smart.search(query);if(seq!==searchRenderSeq)return;
        const classic=searchDataset(query);
        const rows=smartResult?.handled?[...(smartResult.rows||[]),...classic.slice(0,8)]:classic;
        renderSearchRows(box,rows,smartResult?.handled?smartResult.interpretation||'Requête statistique':'');
      }catch(err){
        console.warn('Recherche statistique 3615',err);if(seq!==searchRenderSeq)return;
        renderSearchRows(box,searchDataset(query),'');
      }
      return;
    }
    renderSearchRows(box,searchDataset(query),'');
  }
  function setupSearch(){
    const input=$('#universalSearchInput'),box=$('#universalSearchResults');if(!input||!box)return;
    const schedule=(delay=150)=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>renderSearch(input.value),delay);};
    input.addEventListener('input',()=>schedule());
    $$('[data-smart-search-example]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.smartSearchExample||'';input.focus();renderSearch(input.value);}));
    window.addEventListener('bleus:player-registry',()=>{if(input.value.trim())schedule(20);});
    window.addEventListener('bleus:relational-registry',()=>{if(input.value.trim())schedule(20);});
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!activeSearchItems.length)return;activeSearchIndex=(activeSearchIndex+(e.key==='ArrowDown'?1:-1)+activeSearchItems.length)%activeSearchItems.length;$$('[data-search-index]',box).forEach((b,i)=>b.classList.toggle('is-active',i===activeSearchIndex));}else if(e.key==='Enter'){if(activeSearchIndex<0&&activeSearchItems.length===1)activeSearchIndex=0;if(activeSearchIndex>=0){e.preventDefault();box.hidden=true;activeSearchItems[activeSearchIndex]?.action?.();}}else if(e.key==='Escape'){box.hidden=true;}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select();}});
    document.addEventListener('click',e=>{if(!e.target.closest('#universalSearchShell'))box.hidden=true;});
  }

  function setupEvents(){
    $$('.modal-backdrop').forEach(m=>m.addEventListener('pointerdown',e=>{if(e.target===m)closeModal(m.id);}));$$('[data-modal-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.modalClose)));
    let referenceSearchTimer=0;
    $('#referenceSearch').addEventListener('input',e=>{refState.query=e.target.value.toLowerCase();clearTimeout(referenceSearchTimer);referenceSearchTimer=setTimeout(renderReferenceEntries,window.matchMedia('(pointer:coarse)').matches?110:55);});$('#addReferenceEntry').addEventListener('click',openReferenceEditor);
    if(!window.BLEUS3000_SELECTION_LIST){$('#saveListTool')?.addEventListener('click',()=>saveToolLocally('list'));$('#exportListPng')?.addEventListener('click',()=>exportTool('list','png'));$('#exportListJpg')?.addEventListener('click',()=>exportTool('list','jpg'));}

    document.addEventListener('keydown',e=>{if(e.key==='Escape'){const top=$$('.modal-backdrop:not([hidden])').at(-1);if(top)closeModal(top.id);}});
  }


  const mobileFilterMedia=window.matchMedia('(max-width:760px)');
  function countActiveMobileFilters(bar){
    let count=0;
    bar.querySelectorAll('select').forEach(sel=>{
      const val=String(sel.value||'').trim();
      if(val&&val!=='all')count++;
    });
    bar.querySelectorAll('input[type="checkbox"]').forEach(input=>{if(input.checked)count++;});
    return count;
  }
  function syncMobileFilterToggle(bar){
    const toggle=bar?._mobileFilterToggle;
    if(!toggle)return;
    const mobile=mobileFilterMedia.matches;
    const hidden=!!(bar.hidden||bar.closest('[hidden]'));
    const expanded=bar.dataset.mobileExpanded==='1';
    const activeCount=countActiveMobileFilters(bar);
    const nextHidden=!mobile||hidden;if(toggle.hidden!==nextHidden)toggle.hidden=nextHidden;
    bar.classList.toggle('is-mobile-collapsed',mobile&&!expanded);
    toggle.setAttribute('aria-expanded',String(!mobile||expanded));
    toggle.classList.toggle('is-open',!mobile||expanded);
    toggle.innerHTML=`<span class="filter-collapse-toggle-copy"><span>Filtres</span>${activeCount?`<span class="filter-collapse-toggle-badge">${activeCount}</span>`:''}</span><span class="filter-collapse-toggle-caret">${mobile&&expanded?'▴':'▾'}</span>`;
  }
  function ensureMobileFilterToggle(bar){
    if(!bar||bar._mobileFilterBound)return;
    bar._mobileFilterBound=true;
    if(bar.dataset.mobileExpanded==null)bar.dataset.mobileExpanded=mobileFilterMedia.matches?'0':'1';
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='filter-collapse-toggle';
    toggle.addEventListener('click',()=>{
      if(!mobileFilterMedia.matches)return;
      bar.dataset.mobileExpanded=bar.dataset.mobileExpanded==='1'?'0':'1';
      syncMobileFilterToggle(bar);
    });
    bar._mobileFilterToggle=toggle;
    bar.parentNode?.insertBefore(toggle,bar);
    bar.addEventListener('change',()=>syncMobileFilterToggle(bar));
    bar.addEventListener('input',()=>syncMobileFilterToggle(bar));
    syncMobileFilterToggle(bar);
  }
  function setupMobileFilterToggles(root=document){
    root.querySelectorAll('.reference-filter-bar,.selection-filter-bar').forEach(ensureMobileFilterToggle);
    root.querySelectorAll('.reference-filter-bar,.selection-filter-bar').forEach(syncMobileFilterToggle);
  }
  function setupMobileFilterObserver(){
    setupMobileFilterToggles(document);
    let frame=0;
    const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;setupMobileFilterToggles(document);});};
    const obs=new MutationObserver(muts=>{
      for(const m of muts){
        if(m.type==='attributes'){
          const target=m.target;
          if(target?.matches?.('.reference-filter-bar,.selection-filter-bar')){schedule();return;}
          continue;
        }
        if(m.type==='childList'){
          const nodes=[...m.addedNodes].filter(n=>n?.nodeType===1);
          if(nodes.some(n=>n.matches?.('.reference-filter-bar,.selection-filter-bar')||n.querySelector?.('.reference-filter-bar,.selection-filter-bar'))){schedule();return;}
        }
      }
    });
    obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    if(mobileFilterMedia.addEventListener)mobileFilterMedia.addEventListener('change',schedule);
    window.addEventListener('resize',schedule,{passive:true});
  }

  window.BLEUS3000_APP={openReferences,openTool,openModal,closeModal};
  function init(){renderDashboard();setupNavigation();setupSearch();setupEvents();setupMobileFilterObserver();document.body.classList.add("js-ready");}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
