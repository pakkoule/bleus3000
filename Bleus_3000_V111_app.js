(() => {
  'use strict';
  const D=window.BLEUS3000_DATA||{};
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=window.BLEUS3000_SEARCH;
  if(!S)throw new Error('Moteur de recherche Bleus 3000 indisponible');
  const norm=S.normalize;
  const fuzzyEntityScore=(query,values)=>S.scoreAny(query,values);
  const icons={
    search:'⌕', history:'↶', star:'★', tools:'⌘', book:'▤', display:'☷',
    user:'👤', list:'📋', ball:'⚽', trophy:'🏆', globe:'🌍', users:'👥', shirt:'👕', chart:'📊', pin:'📍', book2:'📚',
    calendar:'📅', binoculars:'◉', source:'🔗', edit:'✎', add:'＋', close:'×', football:'⚽'
  };
  const localRefKey='bleus3000.reference.custom.v1';
  let refState={key:'selections',query:''};
  let activeSearchIndex=-1, activeSearchItems=[];
  let currentPlayer=null, performanceLimit=5;

  function svgIcon(name){
    const p={
      search:'<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 4.5 4.5"></path>',
      history:'<path d="M4.5 8.5A8 8 0 1 1 4 13"></path><path d="M4.5 4.5v4h4"></path><path d="M12 8v4l2.8 1.8"></path>',
      star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>',
      tools:'<rect x="5" y="3.5" width="14" height="17" rx="2"></rect><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 18h6"></path>',
      book:'<path d="M4 5.5c2.8-.8 5.4-.2 8 1.5v12c-2.6-1.7-5.2-2.3-8-1.5z"></path><path d="M20 5.5c-2.8-.8-5.4-.2-8 1.5v12c2.6-1.7 5.2-2.3 8-1.5z"></path><path d="M12 7v12"></path>',
      display:'<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4"></path><circle cx="16" cy="7" r="2"></circle><circle cx="9" cy="12" r="2"></circle><circle cx="14" cy="17" r="2"></circle>'
    }[name]||'<circle cx="12" cy="12" r="8"></circle>';
    return `<svg aria-hidden="true" viewBox="0 0 24 24">${p}</svg>`;
  }

  function refEmoji(key){return ({selections:'👤',convocations:'📋',matchs:'⚽',competitions:'🏆',adversaires:'🌍',personnel:'👥',equipements:'👕',statistiques:'📊',lieux:'📍',bibliographie:'📚'})[key]||'▦';}

  function renderDashboard(){
    // V1.1.14 : l'accueil est désormais occupé par la base globale des joueurs.
    // Les anciens blocs Ladder / Calendrier / Prochain Bleu / Convocations / Bibliothèque
    // sont conservés dans les données mais ne sont plus rendus ici.
    bindDashboardButtons();
  }

  function bindDashboardButtons(){
    $$('[data-player]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>openPlayer(b.dataset.player));});
    $$('[data-reference]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>openReferences(b.dataset.reference));});
  }

  function openModal(id){const m=$('#'+id);if(!m)return;m.hidden=false;document.body.style.overflow='hidden';}
  function closeModal(id){const m=$('#'+id);if(!m)return;m.hidden=true;if(!$$('.modal-backdrop:not([hidden]),.c3k-v8-panel-backdrop:not([hidden])').length)document.body.style.overflow='';}

  function setupToolbar(){
    $$('.toolbar-group-toggle').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();const key=btn.dataset.toolbarMenu;$$('.toolbar-drop-panel').forEach(p=>{const own=p.dataset.toolbarPanel===key;p.hidden=own?!p.hidden:true;});$$('.toolbar-group-toggle').forEach(x=>x.classList.toggle('is-active',x===btn&&!$(`[data-toolbar-panel="${key}"]`).hidden));
    }));
    document.addEventListener('click',e=>{if(!e.target.closest('.card-ghost-controls')){$$('.toolbar-drop-panel').forEach(p=>p.hidden=true);$$('.toolbar-group-toggle').forEach(x=>x.classList.remove('is-active'));}});
    $('#favoritesOnlyBtn')?.addEventListener('click',()=>alert('Les favoris seront synchronisés au compte Bleus 3000 dès connexion au nouveau Supabase.'));
    $('#quoteHistoryButton')?.addEventListener('click',()=>alert('Historique Bleus 3000 : cette zone reprendra l’historique des compositions, listes et modifications sauvegardées.'));
    $$('[data-tool-open]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.toolOpen;$$('.toolbar-drop-panel').forEach(p=>p.hidden=true);openTool(k);}));
    $$('[data-reference-open]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.referenceOpen;$$('.toolbar-drop-panel').forEach(p=>p.hidden=true);openReferences(k);}));
    $$('[data-setting-open]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.settingOpen;if(k==='settings')openModal('displaySettingsModal');}));
    $('#workspaceWidth')?.addEventListener('change',e=>{const v=e.target.value;document.querySelectorAll('.page,.top-header,.footer-note').forEach(n=>n.style.width=v==='wide'?'min(1420px,100%)':v==='compact'?'min(980px,100%)':'min(1180px,100%)');localStorage.setItem('bleus3000.workspace.width.v1',v);});
    $('#densitySetting')?.addEventListener('change',e=>{document.body.classList.toggle('compact-density',e.target.value==='compact');localStorage.setItem('bleus3000.density.v1',e.target.value);});
  }

  function loadSettings(){
    const w=localStorage.getItem('bleus3000.workspace.width.v1')||'standard',d=localStorage.getItem('bleus3000.density.v1')||'normal';
    if($('#workspaceWidth')){$('#workspaceWidth').value=w;$('#workspaceWidth').dispatchEvent(new Event('change'));}
    if($('#densitySetting')){$('#densitySetting').value=d;$('#densitySetting').dispatchEvent(new Event('change'));}
  }

  function customRefs(){try{return JSON.parse(localStorage.getItem(localRefKey)||'{}')||{};}catch{return {};}}
  function entriesFor(key){const base=(D.referenceEntries?.[key]||[]);const custom=customRefs()[key]||[];return [...custom,...base];}

  function openReferences(key='selections'){
    refState.key=key;refState.query='';$('#referenceSearch').value='';renderReferenceTabs();renderReferenceEntries();openModal('referenceModal');
    window.dispatchEvent(new CustomEvent('bleus:space',{detail:{label:'Bibliothèque · '+(D.references.find(x=>x.key===key)?.title||'Référentiels')}}));
  }
  function renderReferenceTabs(){
    $('#referenceTabs').innerHTML=(D.references||[]).map(r=>`<button type="button" class="reference-tab ${r.key===refState.key?'is-active':''}" data-ref-tab="${esc(r.key)}"><span class="rt-icon">${refEmoji(r.key)}</span><strong>${esc(r.title)}</strong><small>${esc(r.count)} · ${esc(r.tags.slice(0,2).join(' · '))}</small></button>`).join('');
    $$('[data-ref-tab]').forEach(b=>b.addEventListener('click',()=>{refState.key=b.dataset.refTab;renderReferenceTabs();renderReferenceEntries();}));
  }
  function renderReferenceEntries(){
    if(refState.key==='selections'&&window.BLEUS3000_SELECTIONS){window.BLEUS3000_SELECTIONS.render(refState.query);return;}
    if((refState.key==='matchs'||refState.key==='personnel')&&window.BLEUS3000_RELATIONAL_REFS){window.BLEUS3000_RELATIONAL_REFS.render(refState.key,refState.query);return;}
    const cat=$('#selectionCategoryTabs');if(cat)cat.hidden=true;const sf=$('#selectionFilterBar');if(sf)sf.hidden=true;
    const q=refState.query.trim().toLowerCase();const rows=entriesFor(refState.key).filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
    const ref=D.references.find(x=>x.key===refState.key);$('#referenceModalTitle').textContent=ref?.title||'Référentiel';$('#referenceModalSub').textContent=ref?.description||'';$('#referenceCount').textContent=`${rows.length} tuile${rows.length>1?'s':''}`;
    $('#referenceEntries').innerHTML=rows.length?rows.map(row=>`<article class="ref-tile" data-ref-id="${esc(row.id)}"><div class="ref-tile-head"><div><h3>${esc(row.title)}</h3><div class="subtitle">${esc(row.subtitle||'')}</div></div><div class="tile-actions">${row.playerId?`<button class="tile-action" type="button" data-open-player="${esc(row.playerId)}" title="Ouvrir la fiche joueur">↗</button>`:''}${row.custom?`<button class="tile-action" type="button" data-delete-custom="${esc(row.id)}" title="Supprimer">×</button>`:''}</div></div><div class="ref-tags">${(row.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="ref-facts">${(row.facts||[]).map(f=>`<span>• ${esc(f)}</span>`).join('')}</div><div class="ref-tile-foot"><button class="source-btn" type="button" data-sources="${esc(row.id)}">🔗 Sources ${(row.sources||[]).length}</button><div class="contributors">${(row.contributors||[]).map(c=>`<span class="contrib-label">${esc(c)}</span>`).join('')}</div></div></article>`).join(''):'<div class="universal-search-empty">Aucune tuile ne correspond à la recherche.</div>';
    $$('[data-sources]').forEach(b=>b.addEventListener('click',()=>showSources(rows.find(x=>x.id===b.dataset.sources))));
    $$('[data-open-player]').forEach(b=>b.addEventListener('click',()=>{closeModal('referenceModal');openPlayer(b.dataset.openPlayer);}));
    $$('[data-delete-custom]').forEach(b=>b.addEventListener('click',()=>deleteCustomEntry(b.dataset.deleteCustom)));
  }
  function showSources(row){
    if(!row)return;$('#sourcesTitle').textContent=`Sources · ${row.title}`;$('#sourcesList').innerHTML=(row.sources||[]).map((s,i)=>`<div class="source-row"><span class="src-icon">${i%2?'📚':'🔗'}</span><div><strong>${esc(s)}</strong><small>${i%2?'Ouvrage / média / archive':'Site web / organisme / document'}</small></div><span>Source ${i+1}</span></div>`).join('')||'<div class="universal-search-empty">Aucune source renseignée.</div>';openModal('sourcesModal');
  }
  function deleteCustomEntry(id){if(!confirm('Supprimer cette tuile ajoutée localement ?'))return;const all=customRefs(),arr=all[refState.key]||[];all[refState.key]=arr.filter(x=>x.id!==id);localStorage.setItem(localRefKey,JSON.stringify(all));renderReferenceEntries();}
  function openReferenceEditor(){
    if(refState.key==='selections'&&window.BLEUS3000_SELECTIONS){window.BLEUS3000_SELECTIONS.openNewPlayer();return;}
    const ref=D.references.find(x=>x.key===refState.key);$('#editorRefName').textContent=ref?.title||refState.key;$('#refEditorForm').reset();openModal('referenceEditorModal');
  }
  function saveReferenceEditor(e){
    e.preventDefault();const fd=new FormData(e.currentTarget);const title=String(fd.get('title')||'').trim();if(!title)return;const row={id:'local-'+Date.now(),custom:true,title,subtitle:String(fd.get('subtitle')||'').trim(),tags:String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),facts:String(fd.get('facts')||'').split('\n').map(x=>x.trim()).filter(Boolean),sources:String(fd.get('sources')||'').split('\n').map(x=>x.trim()).filter(Boolean),contributors:[window.C3K_ACCOUNT_STATE?.profile?.username||'Contribution locale']};const all=customRefs();all[refState.key]=[row,...(all[refState.key]||[])];localStorage.setItem(localRefKey,JSON.stringify(all));closeModal('referenceEditorModal');renderReferenceEntries();
  }

  function openPlayer(id){
    const p=D.players.find(x=>x.id===id);if(!p)return;currentPlayer=p;performanceLimit=5;$('#playerName').textContent=p.name;$('#playerMeta').textContent=`${p.club} · ${p.position} · ${p.team==='A'?'Équipe de France A':p.team}`;$('#playerIndex').textContent=p.index.toFixed(1);$('#playerInitials').textContent=p.name.split(' ').map(x=>x[0]).join('').slice(0,2);renderPerformances();openModal('playerModal');window.dispatchEvent(new CustomEvent('bleus:space',{detail:{label:'Joueur · '+p.name}}));
  }
  function renderPerformances(){
    const p=currentPlayer;if(!p)return;$$('[data-perf-limit]').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.perfLimit)===performanceLimit));const perf=(p.performances||[]).slice(0,performanceLimit);$('#performanceList').innerHTML=perf.length?perf.map(x=>`<article class="performance-card"><div class="performance-date">${esc(x.date)}<br><span class="tag-badge">${esc(x.competition)}</span></div><div class="performance-main"><strong>${esc(x.home)} ${esc(x.score)} ${esc(x.away)}</strong><small>${x.minutes} minutes · ${x.starter?'Titulaire':'Remplaçant'} · contre ${esc(x.opponent)}</small><div class="performance-stats">${x.goals?`⚽ ${x.goals} but${x.goals>1?'s':''}`:'0 but'} · ${x.assists?`🅰 ${x.assists} passe${x.assists>1?'s':''} décisive${x.assists>1?'s':''}`:'0 passe décisive'}</div></div><div class="performance-score"><strong>${x.minutes}'</strong><small>Temps de jeu</small><span class="rating-pill">★ ${x.rating.toFixed(1)}</span></div></article>`).join(''):'<div class="universal-search-empty">Les performances club seront alimentées par le fournisseur statistique.</div>';
    const all=p.performances||[],sample=all.slice(0,performanceLimit),mins=sample.reduce((s,x)=>s+x.minutes,0),goals=sample.reduce((s,x)=>s+x.goals,0),assists=sample.reduce((s,x)=>s+x.assists,0),rating=sample.length?sample.reduce((s,x)=>s+x.rating,0)/sample.length:0;$('#playerPerfSummary').textContent=sample.length?`${mins} min · ${goals} but${goals>1?'s':''} · ${assists} passe${assists>1?'s':''} · moyenne ${rating.toFixed(2)}`:'Données à connecter';
  }

  function playerOptions(){const reg=window.BLEUS3000_PLAYER_REGISTRY||[];const list=reg.length?reg:(D.players||[]).map(p=>({name:p.name,position:p.position,international_number:null}));return `<option value="">— Choisir —</option>${list.map(p=>`<option value="${esc(p.name||p.display_name)}">${esc(p.name||p.display_name)}${p.international_number?` · n°${p.international_number}`:p.position?` · ${esc(p.position)}`:''}</option>`).join('')}`;}
  function openTool(kind){
    if(kind==='xi'||kind==='five'){const title=kind==='xi'?'Créateur de Onze':'Créateur de Five';$('#teamToolTitle').textContent=title;$('#teamToolSub').textContent=kind==='xi'?'Composition 11 joueurs · terrain plein':'Composition 5 joueurs · terrain réduit';buildPitch(kind);$('#teamToolModal').dataset.kind=kind;openModal('teamToolModal');}
    if(kind==='list'){buildListTool();openModal('listToolModal');}
    window.dispatchEvent(new CustomEvent('bleus:space',{detail:{label:'Outils · '+(kind==='xi'?'Onze':kind==='five'?'Five':'Liste de sélectionneur')}}));
  }
  function buildPitch(kind){
    const n=kind==='xi'?11:5;const coords=kind==='xi'?[[3,5],[2,4],[3,4],[4,4],[5,4],[2,3],[4,3],[3,2],[2,1],[4,1],[3,1]]:[[3,5],[2,3],[4,3],[2,1],[4,1]];
    $('#pitchSlots').innerHTML=coords.slice(0,n).map((c,i)=>`<div class="player-slot" style="grid-column:${c[0]};grid-row:${c[1]}"><label>${kind==='xi'?(i===0?'GB':i<5?'DEF':i<8?'MIL':'ATT'):(i===0?'GB':i<3?'DEF':'ATT')}</label><select data-lineup-slot="${i}">${playerOptions()}</select></div>`).join('');
    $('#toolTitleInput').value=kind==='xi'?'Mon XI France':'Mon Five France';
  }
  function buildListTool(){
    const groups=[['Gardiens',3],['Défenseurs',8],['Milieux',7],['Attaquants',8]];$('#listBuilderGrid').innerHTML=groups.map(([name,n])=>`<section class="list-group"><h4>${name}</h4>${Array.from({length:n},(_,i)=>`<select data-list-slot="${esc(name)}-${i}">${playerOptions()}</select>`).join('')}</section>`).join('');
  }
  function collectNames(sel){return $$(sel).map(s=>s.value).filter(Boolean);}
  function saveToolLocally(kind){const key='bleus3000.compositions.v1',all=JSON.parse(localStorage.getItem(key)||'[]'),title=kind==='list'?$('#listTitleInput').value:$('#toolTitleInput').value,names=kind==='list'?collectNames('[data-list-slot]'):collectNames('[data-lineup-slot]');all.unshift({id:Date.now(),kind,title,names,created_at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(all.slice(0,100)));alert('Sauvegardé localement. La synchronisation Supabase s’activera une fois le nouveau projet configuré.');}
  function exportTool(kind,format){
    const canvas=document.createElement('canvas'),w=1080,h=kind==='list'?1350:1080;canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle='#071426';c.fillRect(0,0,w,h);c.fillStyle='#f7faff';c.roundRect(45,45,w-90,h-90,28);c.fill();c.fillStyle='#15355c';c.font='900 54px Arial';const title=kind==='list'?($('#listTitleInput').value||'Ma liste France'):($('#toolTitleInput').value||'Ma composition France');c.fillText(title,85,125);c.font='700 23px Arial';c.fillStyle='#507098';c.fillText('BLEUS 3000',85,165);
    const names=kind==='list'?collectNames('[data-list-slot]'):collectNames('[data-lineup-slot]');if(kind==='list'){c.fillStyle='#163a68';c.font='800 28px Arial';names.forEach((n,i)=>{const col=i<13?0:1,row=i%13;c.fillText(n,90+col*470,245+row*72);});}else{c.fillStyle='#237d59';c.roundRect(90,220,900,720,24);c.fill();c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=4;c.strokeRect(125,255,830,650);c.beginPath();c.moveTo(540,255);c.lineTo(540,905);c.stroke();const coords=kind==='xi'?[[540,850],[250,710],[440,720],[640,720],[830,710],[320,545],[760,545],[540,470],[300,335],[540,310],[780,335]]:[[540,835],[340,620],[740,620],[370,360],[710,360]];c.textAlign='center';names.forEach((n,i)=>{const [x,y]=coords[i]||[540,550];c.fillStyle='#071426';c.beginPath();c.arc(x,y,38,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.font='800 20px Arial';c.fillText(n.split(' ').slice(-1)[0].toUpperCase(),x,y+62);});c.textAlign='start';}
    const mime=format==='jpg'?'image/jpeg':'image/png',url=canvas.toDataURL(mime,.94),a=document.createElement('a');a.href=url;a.download=`${title.replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')}.${format==='jpg'?'jpg':'png'}`;document.body.appendChild(a);a.click();a.remove();
  }

  function searchDataset(q){
    const out=[],seenPlayers=new Set(),reg=window.BLEUS3000_PLAYER_REGISTRY||[];
    for(const p of reg){
      if(!p?.id||seenPlayers.has(p.id))continue;
      const score=fuzzyEntityScore(q,[p.name,p.display_name,...(p.name_variants||[]),p.position,...(p.positions||[]),...(p.selection_names||[]),...(p.team_tag_labels||[]),String(p.international_number||''),...(p.jersey_numbers||[]).map(String)]);
      if(score<=.48){seenPlayers.add(p.id);out.push({type:'Joueurs',icon:'👤',title:p.name||p.display_name,meta:`${(p.selection_names||[]).slice(0,3).join(' · ')||'Sélections'}${(p.positions||[]).length?' · '+p.positions.join(' / '):p.position?' · '+p.position:''}`,score,action:()=>{const db=window.BLEUS3000_PLAYERS_DB;if(db?.openPlayer)return db.openPlayer(p.id);openReferences('selections');setTimeout(()=>{const inp=$('#referenceSearch');if(inp){inp.value=p.name||p.display_name;inp.dispatchEvent(new Event('input',{bubbles:true}));}},100);}});}
    }
    for(const r of (D.references||[])){const score=fuzzyEntityScore(q,[r.title,r.description,...(r.tags||[])]);if(score<=.48)out.push({type:'Référentiels',icon:refEmoji(r.key),title:r.title,meta:r.description,score:score+.08,action:()=>openReferences(r.key)});}
    for(const [k,rows] of Object.entries(D.referenceEntries||{})){if(['selections','matchs','personnel'].includes(k))continue;for(const r of rows){const score=fuzzyEntityScore(q,[r.title,r.subtitle,...(r.tags||[]),...(r.facts||[])]);if(score<=.48)out.push({type:D.references.find(x=>x.key===k)?.title||'Archives',icon:refEmoji(k),title:r.title,meta:r.subtitle||'',score:score+.12,action:()=>{openReferences(k);setTimeout(()=>{const input=$('#referenceSearch');if(input){input.value=r.title;input.dispatchEvent(new Event('input',{bubbles:true}));}},60);}});}}
    if(window.BLEUS3000_RELATIONAL_REFS?.search)out.push(...window.BLEUS3000_RELATIONAL_REFS.search(q));
    for(const x of (D.calendar||[])){const score=fuzzyEntityScore(q,[x.title,x.subtitle,x.date,x.tag]);if(score<=.48)out.push({type:'Calendrier',icon:'📅',title:x.title,meta:`${x.date} · ${x.subtitle}`,score:score+.15,action:()=>alert(`${x.date}\n${x.title}\n${x.subtitle}`)});}
    return out.sort((a,b)=>(a.score??9)-(b.score??9)||String(a.title).localeCompare(String(b.title),'fr',{sensitivity:'base'})).slice(0,35);
  }
  function renderSearch(q){
    const box=$('#universalSearchResults');if(!q.trim()){box.hidden=true;box.innerHTML='';activeSearchItems=[];activeSearchIndex=-1;return;}const rows=searchDataset(q);activeSearchItems=rows;activeSearchIndex=-1;if(!rows.length){box.innerHTML='<div class="universal-search-empty">Aucun résultat dans Bleus 3000.</div>';box.hidden=false;return;}const grouped=rows.reduce((m,r)=>((m[r.type]??=[]).push(r),m),{});let index=0;box.innerHTML=Object.entries(grouped).map(([type,list])=>`<section class="universal-search-section"><div class="universal-search-section-title">${esc(type)}</div>${list.map(r=>`<button class="universal-search-result" data-search-index="${index++}" type="button"><span class="universal-search-result-icon">${r.icon}</span><span class="universal-search-result-copy"><span class="universal-search-result-title">${esc(r.title)}</span><span class="universal-search-result-meta">${esc(r.meta)}</span></span></button>`).join('')}</section>`).join('');box.hidden=false;$$('[data-search-index]',box).forEach(b=>b.addEventListener('click',()=>{const row=activeSearchItems[Number(b.dataset.searchIndex)];box.hidden=true;row?.action?.();}));
  }
  function setupSearch(){const input=$('#universalSearchInput');input.addEventListener('input',()=>renderSearch(input.value));window.addEventListener('bleus:player-registry',()=>{if(input.value.trim())renderSearch(input.value);});window.addEventListener('bleus:relational-registry',()=>{if(input.value.trim())renderSearch(input.value);});input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!activeSearchItems.length)return;activeSearchIndex=(activeSearchIndex+(e.key==='ArrowDown'?1:-1)+activeSearchItems.length)%activeSearchItems.length;$$('[data-search-index]').forEach((b,i)=>b.classList.toggle('is-active',i===activeSearchIndex));}else if(e.key==='Enter'&&activeSearchIndex>=0){e.preventDefault();$('#universalSearchResults').hidden=true;activeSearchItems[activeSearchIndex]?.action?.();}else if(e.key==='Escape'){$('#universalSearchResults').hidden=true;}});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select();}});document.addEventListener('click',e=>{if(!e.target.closest('#universalSearchShell'))$('#universalSearchResults').hidden=true;});}

  function setupEvents(){
    $$('.modal-backdrop').forEach(m=>m.addEventListener('pointerdown',e=>{if(e.target===m)closeModal(m.id);}));$$('[data-modal-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.modalClose)));
    $('#referenceSearch').addEventListener('input',e=>{refState.query=e.target.value.toLowerCase();renderReferenceEntries();});$('#addReferenceEntry').addEventListener('click',openReferenceEditor);$('#refEditorForm').addEventListener('submit',saveReferenceEditor);
    $$('[data-perf-limit]').forEach(b=>b.addEventListener('click',()=>{performanceLimit=Number(b.dataset.perfLimit);renderPerformances();}));
    $('#saveTeamTool').addEventListener('click',()=>saveToolLocally($('#teamToolModal').dataset.kind||'xi'));$('#exportTeamPng').addEventListener('click',()=>exportTool($('#teamToolModal').dataset.kind||'xi','png'));$('#exportTeamJpg').addEventListener('click',()=>exportTool($('#teamToolModal').dataset.kind||'xi','jpg'));
    $('#saveListTool').addEventListener('click',()=>saveToolLocally('list'));$('#exportListPng').addEventListener('click',()=>exportTool('list','png'));$('#exportListJpg').addEventListener('click',()=>exportTool('list','jpg'));
    $('#openAllReferences')?.addEventListener('click',()=>openReferences('selections'));$('#openCalendar')?.addEventListener('click',()=>alert('Le calendrier complet sera alimenté par les échéances liées aux convocations, matchs et compétitions.'));$('#openLadder')?.addEventListener('click',()=>alert('Le Ladder complet reprendra le même moteur de classement avec filtres par poste, période et sexe.'));$('#openNextBlue')?.addEventListener('click',()=>alert('Prochain Bleu ? est réservé aux joueurs jamais appelés en A et classés sur des critères objectifs de forme et temps de jeu.'));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){const top=$$('.modal-backdrop:not([hidden])').at(-1);if(top)closeModal(top.id);}});
  }

  function initSpaceIndicator(){
    const el=$('#bleusSpaceIndicator');window.addEventListener('bleus:space',e=>{if(el)el.querySelector('span:last-child').textContent=e.detail?.label||'Accueil · Veille France';});
  }

  window.BLEUS3000_APP={openReferences,openTool,openModal,closeModal};
  function init(){renderDashboard();setupToolbar();setupSearch();setupEvents();loadSettings();initSpaceIndicator();document.body.classList.add('js-ready');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
