/* 3615 Bleus V1.1.61.14 — Base joueurs · lignes compactes + favoris profil */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client=null, teams=[], tags=new Map(), tagLinks=[], players=[], filtered=[], page=1, pageSize=10, sortKey='name', sortDir='asc';
  let search='', positionFilter='', teamFilter='', jerseyFilter='',selectedPlayerId='',favoriteOnly=false;
  let favoriteIds=new Set();
  const localFavoritesKey='bleus3000.player-favorites.local.v1';

  const waitClient=(timeout=15000)=>new Promise(resolve=>{
    client=window.BLEUS3000_SUPABASE||null;if(client)return resolve(client);
    let done=false,timer=null;
    const finish=c=>{if(done)return;done=true;if(timer)clearTimeout(timer);window.removeEventListener('bleus:supabase-ready',onReady);client=c||window.BLEUS3000_SUPABASE||null;resolve(client);};
    const onReady=e=>finish(e.detail?.client||window.BLEUS3000_SUPABASE||null);
    window.addEventListener('bleus:supabase-ready',onReady);
    timer=setTimeout(()=>finish(window.BLEUS3000_SUPABASE||null),timeout);
  });
  const S=window.BLEUS3000_SEARCH;
  if(!S)throw new Error('Moteur de recherche 3615 Bleus indisponible');
  const norm=S.normalize;
  const nameVariants=(name,lastName='')=>[...new Set([...S.buildNameKeys(name),...S.buildNameKeys(lastName)].filter(Boolean))];
  const account=()=>window.C3K_ACCOUNT_STATE||{};
  function localFavorites(){try{return new Set((JSON.parse(localStorage.getItem(localFavoritesKey)||'[]')||[]).slice(0,10).map(String));}catch{return new Set();}}
  function saveLocalFavorites(){localStorage.setItem(localFavoritesKey,JSON.stringify([...favoriteIds].slice(0,10)));}
  async function loadFavorites(){
    const st=account();
    if(client&&st.session?.user?.id){
      const {data,error}=await client.from('user_player_favorites').select('player_id,created_at').eq('user_id',st.session.user.id).order('created_at',{ascending:true});
      if(error){console.warn('Favoris joueurs',error);favoriteIds=localFavorites();}
      else favoriteIds=new Set((data||[]).map(x=>String(x.player_id)));
    }else favoriteIds=localFavorites();
    const badge=$('#favoritesOnlyBtn .favorites-count-badge');if(badge){badge.hidden=!favoriteIds.size;badge.textContent=String(favoriteIds.size);}
    apply();
  }
  async function toggleFavorite(id){
    id=String(id||'');if(!id)return;const st=account(),exists=favoriteIds.has(id);
    if(!exists&&favoriteIds.size>=10){alert('Tu peux enregistrer au maximum 10 joueurs favoris.');return;}
    if(client&&st.session?.user?.id){
      const q=exists?client.from('user_player_favorites').delete().eq('user_id',st.session.user.id).eq('player_id',id):client.from('user_player_favorites').insert({user_id:st.session.user.id,player_id:id});
      const {error}=await q;if(error){alert(error.message||'Impossible de modifier les favoris.');return;}
    }
    if(exists)favoriteIds.delete(id);else favoriteIds.add(id);saveLocalFavorites();const badge=$('#favoritesOnlyBtn .favorites-count-badge');if(badge){badge.hidden=!favoriteIds.size;badge.textContent=String(favoriteIds.size);}page=1;apply();
    window.dispatchEvent(new CustomEvent('bleus:player-favorites-changed',{detail:{ids:[...favoriteIds]}}));
  }
  function highlightName(name,query){
    const q=norm(query);if(!q)return esc(name);
    const source=String(name||''),chars=[...source],flat=[],map=[];
    chars.forEach((ch,i)=>{const n=norm(ch).replace(/ /g,'');for(const c of n){flat.push(c);map.push(i);}});
    const needle=S.compact(q),hay=flat.join(''),idx=needle?hay.indexOf(needle):-1;
    if(idx>=0){const a=map[idx],b=map[idx+needle.length-1]+1;return `${esc(source.slice(0,a))}<mark class="players-db-name-hit">${esc(source.slice(a,b))}</mark>${esc(source.slice(b))}`;}
    return S.matches(q,nameVariants(source),.48)?`<mark class="players-db-name-hit is-fuzzy">${esc(source)}</mark>`:esc(source);
  }

  async function fetchAllStats(){
    const out=[];let from=0;const chunk=1000;
    while(true){
      const {data,error}=await client.from('player_selection_stats').select(`player_id,selection_id,appearance_status,selections,international_number,player:players!player_selection_stats_player_id_fkey(id,display_name,last_name,primary_position,secondary_positions,birth_date,photo_path,gender)`).range(from,from+chunk-1);
      if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<chunk)break;from+=chunk;
    }
    return out;
  }

  const isJwtFuture=e=>/jwt\s+issued\s+at\s+future|issued\s+at\s+future/i.test(String(e?.message||e||''));
  async function loadOnce(){
    if(!client)await waitClient();if(!client)throw new Error('Supabase indisponible');
    const [{data:teamRows,error:teamError},{data:tagRows,error:tagError},{data:linkRows,error:linkError},stats,{data:jerseyRows,error:jerseyError}]=await Promise.all([
      client.from('selection_teams').select('id,code,name,gender,category,sort_order,team_tag_id').eq('active',true).order('sort_order'),
      client.from('tags').select('*').eq('is_active',true),
      client.from('tag_reference_links').select('tag_id,reference_type,reference_id,relation_kind').eq('reference_type','selection'),
      fetchAllStats(),
      client.from('player_jersey_numbers').select('player_id,shirt_number').order('shirt_number',{ascending:true})
    ]);
    if(teamError)throw teamError;if(tagError)throw tagError;if(linkError)throw linkError;if(jerseyError)throw jerseyError;
    teams=teamRows||[];tags=new Map((tagRows||[]).map(t=>[t.id,t]));tagLinks=linkRows||[];
    const teamMap=new Map(teams.map(t=>[t.id,t]));
    const map=new Map();
    for(const row of stats){
      const p=row.player||{};if(!p.id)continue;
      let item=map.get(p.id);
      if(!item){const cleanName=String(p.display_name||'Joueur').replace(/\s+/g,' ').trim();item={id:p.id,name:cleanName,last_name:String(p.last_name||'').replace(/\s+/g,' ').trim(),nameVariants:nameVariants(cleanName,p.last_name||''),position:p.primary_position||'',positions:[...new Set([p.primary_position,...(p.secondary_positions||[])].filter(Boolean))],birth_date:p.birth_date||null,gender:p.gender||'',photo_path:p.photo_path||null,teams:[]};map.set(p.id,item);}
      const team=teamMap.get(row.selection_id);if(team&&!item.teams.some(x=>x.id===team.id))item.teams.push({...team,appearance_status:row.appearance_status,international_number:row.international_number,selections:row.selections});
    }
    players=[...map.values()];
    const jerseyMap=new Map();
    for(const row of (jerseyRows||[])){const n=Number(row.shirt_number);if(!Number.isInteger(n))continue;const arr=jerseyMap.get(row.player_id)||[];arr.push(n);jerseyMap.set(row.player_id,arr);}
    players.forEach(p=>{p.teams.sort((a,b)=>(a.sort_order||999)-(b.sort_order||999));p.jerseyNumbers=[...new Set(jerseyMap.get(p.id)||[])].sort((a,b)=>a-b);});
    await hydratePlayerTeamTags(players);
    buildFilters();publishRegistry();apply();
  }

  async function load(retry=true){
    try{return await loadOnce();}
    catch(e){
      if(retry&&isJwtFuture(e)){
        console.warn('Base joueurs · JWT temporel invalide, refresh + nouvelle tentative.');
        const rr=await client.auth.refreshSession().catch(err=>({error:err}));
        if(!rr?.error){await new Promise(r=>setTimeout(r,1400));return load(false);}
      }
      throw e;
    }
  }

  async function hydratePlayerTeamTags(list){
    const ids=list.map(p=>p.id);if(!ids.length)return;
    const all=[];let from=0,chunk=1000;
    while(true){
      const {data,error}=await client.from('entity_tags').select('entity_id,tag_id').eq('entity_type','player').range(from,from+chunk-1);
      if(error)throw error;const rows=data||[];all.push(...rows);if(rows.length<chunk)break;from+=chunk;
    }
    const teamMap=new Map(teams.map(t=>[t.id,t]));
    const refsByTag=new Map();
    for(const l of tagLinks){const arr=refsByTag.get(l.tag_id)||[];arr.push({...l,team:teamMap.get(l.reference_id)||null});refsByTag.set(l.tag_id,arr);}
    const playerTags=new Map();
    const idSet=new Set(ids);for(const x of all){if(!idSet.has(x.entity_id))continue;const arr=playerTags.get(x.entity_id)||[];arr.push(x.tag_id);playerTags.set(x.entity_id,arr);}
    for(const p of list){
      const idsForPlayer=[...new Set(playerTags.get(p.id)||[])];
      p.teamTags=idsForPlayer.map(id=>{const tag=tags.get(id);if(!tag)return null;const refs=(refsByTag.get(id)||[]).filter(r=>r.reference_type==='selection');if(!refs.length)return null;return {tag,refs};}).filter(Boolean);
      // Fallback only when no explicit team/status tag exists yet.
      if(!p.teamTags.length){
        p.teamTags=p.teams.map(team=>{const tag=team.team_tag_id?tags.get(team.team_tag_id):null;return tag?{tag,refs:[{reference_type:'selection',reference_id:team.id,relation_kind:'membership',team}]}:null;}).filter(Boolean);
      }
    }
  }

  function buildFilters(){
    const team=$('#playersDbTeamFilter');if(!team)return;
    const linked=[...new Map(tagLinks.map(l=>{const tag=tags.get(l.tag_id),tm=teams.find(t=>t.id===l.reference_id);return [l.tag_id,{...l,tag,team:tm}]})).values()].filter(x=>x.tag&&x.team).sort((a,b)=>(a.team.sort_order||999)-(b.team.sort_order||999)||String(a.tag.label_text).localeCompare(String(b.tag.label_text),'fr'));
    team.innerHTML='<option value="">Toutes les sélections</option>'+linked.map(x=>`<option value="${esc(x.tag.id)}">${esc(x.tag.label_text)} · ${esc(x.team.name)}${x.relation_kind==='status'?' · statut':''}</option>`).join('');
    team.value=teamFilter;
  }

  function publishRegistry(){
    const reg=players.map(p=>({id:p.id,name:p.name,display_name:p.name,name_variants:p.nameVariants||nameVariants(p.name,p.last_name),position:p.position||'',positions:p.positions||[],international_number:p.teams.find(t=>t.code==='FRA-A-M')?.international_number||null,selection_code:p.teams[0]?.code||'',selection_names:p.teams.map(t=>t.name),team_codes:p.teams.map(t=>t.code),team_tag_ids:(p.teamTags||[]).map(x=>x.tag.id),team_tag_labels:(p.teamTags||[]).map(x=>x.tag.label_text),jersey_numbers:p.jerseyNumbers||[],birth_date:p.birth_date,photo_path:p.photo_path})).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    window.BLEUS3000_PLAYER_REGISTRY_ALL=reg;
    window.BLEUS3000_PLAYER_REGISTRY=reg;
    window.dispatchEvent(new CustomEvent('bleus:player-registry',{detail:{players:reg,scope:'all-selections'}}));
  }

  function tagChipHtml(t){
    if(!t)return '';
    const colors=Array.isArray(t.gradient_colors)&&t.gradient_colors.length?t.gradient_colors.filter(Boolean).slice(0,5):[t.color_start||'#2563EB',t.color_end||'#0EA5C6'];const bg=t.appearance==='solid'?colors[0]:`linear-gradient(${Number(t.gradient_angle||135)}deg,${colors.join(',')})`;
    let icon='';
    if(t.icon_image_path&&client){try{const u=client.storage.from('tag-icons').getPublicUrl(t.icon_image_path).data.publicUrl;icon=u?`<img src="${esc(u)}" alt="">`:'';}catch{}}
    if(!icon&&t.icon_text)icon=`<span>${esc(t.icon_text)}</span>`;
    return `<span class="players-db-team-tag" style="background:${bg};color:${esc(t.text_color||'#fff')};border-color:${esc(t.border_color||'#1e4fa7')};border-width:${Number(t.border_width||1)}px;border-radius:${Number(t.border_radius||8)}px">${icon}<span>${esc(t.label_text)}</span></span>`;
  }

  function teamTagHtml(team){
    const t=team.team_tag_id?tags.get(team.team_tag_id):null;
    if(!t)return `<span class="players-db-team-tag is-fallback">${team.gender==='F'?'♀':'♂'} ${esc(team.name.replace(/^France\s*/,''))}</span>`;
    return tagChipHtml(t);
  }


  function compare(a,b){
    const af=favoriteIds.has(String(a.id)),bf=favoriteIds.has(String(b.id));if(af!==bf)return af?-1:1;
    let av,bv;
    if(sortKey==='position'){av=a.position||'~~~~';bv=b.position||'~~~~';}
    else if(sortKey==='teams'){av=(a.teamTags||[]).length;bv=(b.teamTags||[]).length;}
    else {av=a.last_name||a.name;bv=b.last_name||b.name;}
    let c=typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'fr',{sensitivity:'base',numeric:true});
    if(c===0)c=a.name.localeCompare(b.name,'fr',{sensitivity:'base'});
    return sortDir==='asc'?c:-c;
  }

  function apply(){
    const q=norm(search);
    filtered=players.filter(p=>{
      if(favoriteOnly&&!favoriteIds.has(String(p.id)))return false;
      if(teamFilter&&!(p.teamTags||[]).some(x=>x.tag.id===teamFilter))return false;
      // La recherche d’accueil reste volontairement compacte : identité + sélection.
      if(q&&!S.matches(q,p.nameVariants||nameVariants(p.name,p.last_name),.48))return false;
      return true;
    }).sort(compare);
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));if(page>pages)page=pages;if(page<1)page=1;render();
  }

  function render(){
    const body=$('#playersDbRows'),count=$('#playersDbCount');if(!body)return;
    if(count)count.textContent=`${filtered.length.toLocaleString('fr-FR')} joueur${filtered.length>1?'s':''}${favoriteIds.size?` · ★ ${favoriteIds.size}`:''}`;
    const start=(page-1)*pageSize, rows=filtered.slice(start,start+pageSize);
    body.innerHTML=rows.length?rows.map(p=>{const fav=favoriteIds.has(String(p.id)),selected=String(selectedPlayerId)===String(p.id);return `<tr data-global-player="${esc(p.id)}" class="${fav?'is-favorite ':''}${selected?'is-selected':''}" tabindex="0" aria-selected="${selected?'true':'false'}">
      <td><div class="players-db-player"><button type="button" class="players-db-open-card" data-open-global-player="${esc(p.id)}" title="Ouvrir la tuile de ${esc(p.name)}" aria-label="Ouvrir la tuile de ${esc(p.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="10" r="2"></circle><path d="M6.5 16c.7-2 4.3-2 5 0M14 9h3M14 13h3"></path></svg></button><span class="players-db-player-name">${highlightName(p.name,search)}</span><span class="players-db-player-meta">${p.gender==='F'?'F':'M'}</span></div></td>
      <td><div class="players-db-team-tags">${(p.teamTags||[]).length?(p.teamTags||[]).map(x=>tagChipHtml(x.tag)).join(''):p.teams.map(teamTagHtml).join('')}</div></td>
      <td><div class="players-db-row-actions"><button type="button" class="players-db-favorite ${fav?'is-active':''}" data-player-favorite="${esc(p.id)}" title="${fav?'Retirer des favoris':'Ajouter aux favoris'}" aria-label="${fav?'Retirer des favoris':'Ajouter aux favoris'}" aria-pressed="${fav?'true':'false'}">★</button><button type="button" class="players-db-action" data-open-global-player="${esc(p.id)}" title="Ouvrir dans Sélections">⚙</button></div></td>
    </tr>`}).join(''):'<tr><td colspan="3" class="players-db-empty">Aucun joueur ne correspond aux filtres.</td></tr>';
    renderPagination($('#playersDbPaginationTop'));
    $$('[data-open-global-player]',body).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openInSelections(b.dataset.openGlobalPlayer)}));
    $$('[data-player-favorite]',body).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFavorite(b.dataset.playerFavorite)}));
    $$('tr[data-global-player]',body).forEach(row=>{const select=()=>{selectedPlayerId=row.dataset.globalPlayer||'';render();};row.addEventListener('click',e=>{if(e.target.closest('button,a,input,select'))return;select();});row.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();select();}});});
  }

  function renderPagination(host){
    if(!host)return;const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    const nums=[];for(let n of [1,2,3,page-1,page,page+1,pages])if(n>=1&&n<=pages&&!nums.includes(n))nums.push(n);nums.sort((a,b)=>a-b);
    let prev=0;const parts=[];for(const n of nums){if(prev&&n-prev>1)parts.push('<span class="players-db-page-gap">…</span>');parts.push(`<button type="button" class="players-db-page-btn ${n===page?'is-active':''}" data-player-db-page="${n}">${n}</button>`);prev=n;}
    host.innerHTML=`<button type="button" class="players-db-page-btn" data-player-db-page="1" ${page===1?'disabled':''}>«</button><button type="button" class="players-db-page-btn" data-player-db-page="${Math.max(1,page-1)}" ${page===1?'disabled':''}>‹</button>${parts.join('')}<button type="button" class="players-db-page-btn" data-player-db-page="${Math.min(pages,page+1)}" ${page===pages?'disabled':''}>›</button><button type="button" class="players-db-page-btn" data-player-db-page="${pages}" ${page===pages?'disabled':''}>»</button>`;
    $$('[data-player-db-page]',host).forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;page=Number(b.dataset.playerDbPage)||1;render();document.querySelector('.players-database-shell')?.scrollIntoView({block:'start',behavior:'smooth'});}));
  }

  async function openInSelections(id){
    const p=players.find(x=>x.id===id);if(!p||!p.teams.length)return;
    const app=window.BLEUS3000_APP,sel=window.BLEUS3000_SELECTIONS;if(!app||!sel)return;
    app.openReferences('selections');await sel.selectCategory(p.teams[0].code);const input=$('#referenceSearch');if(input){input.value=p.name;input.dispatchEvent(new Event('input',{bubbles:true}));}
    requestAnimationFrame(()=>setTimeout(()=>{const tile=document.querySelector(`[data-player-tile="${CSS.escape(id)}"]`);if(tile){tile.scrollIntoView({block:'center',behavior:'smooth'});tile.classList.add('is-search-target');setTimeout(()=>tile.classList.remove('is-search-target'),1800);}},120));
  }

  function bind(){
    $('#playersDbSearch')?.addEventListener('input',e=>{search=e.target.value;page=1;apply();});
    $('#playersDbTeamFilter')?.addEventListener('change',e=>{teamFilter=e.target.value;page=1;apply();});
    $('#playersDbReset')?.addEventListener('click',()=>{search='';teamFilter='';page=1;sortKey='name';sortDir='asc';if($('#playersDbSearch'))$('#playersDbSearch').value='';buildFilters();$$('[data-player-db-sort]').forEach(b=>b.classList.remove('is-active'));apply();});
    $$('[data-player-db-sort]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.playerDbSort;if(sortKey===k)sortDir=sortDir==='asc'?'desc':'asc';else{sortKey=k;sortDir=k==='teams'?'desc':'asc';}$$('[data-player-db-sort]').forEach(x=>x.classList.toggle('is-active',x===b));page=1;apply();}));
  }

  async function init(){bind();try{await load();await loadFavorites();}catch(e){console.error('Base joueurs',e);const body=$('#playersDbRows');if(body)body.innerHTML=`<tr><td colspan="3" class="players-db-empty">Chargement impossible : ${esc(e.message||e)}</td></tr>`;}}
  function toggleFavoritesOnly(){favoriteOnly=!favoriteOnly;page=1;const b=$('#favoritesOnlyBtn'),badge=b?.querySelector('.favorites-count-badge');b?.classList.toggle('is-active',favoriteOnly);if(badge){badge.hidden=!favoriteIds.size;badge.textContent=String(favoriteIds.size);}apply();}
  window.BLEUS3000_PLAYERS_DB={reload:load,openPlayer:openInSelections,toggleFavorite,loadFavorites,toggleFavoritesOnly,get favorites(){return [...favoriteIds];},get players(){return players;}};
  window.addEventListener('bleus:supabase-ready',()=>{if(players.length){loadFavorites().catch(()=>{});return;}load().then(()=>loadFavorites()).catch(e=>console.warn('Base joueurs · reprise Supabase',e));});
  window.addEventListener('c3k:account-state',()=>{loadFavorites().catch(e=>console.warn('Favoris joueurs · profil',e));});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
