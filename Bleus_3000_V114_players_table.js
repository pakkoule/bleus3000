/* 3615 Bleus V1.1.62 — registre joueurs France A (ancienne UI tableau/favoris retirée) */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s);
  let client=null,teams=[],tags=new Map(),tagLinks=[],players=[];

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
  const nameVariants=(name,lastName='')=>[...new Set([...S.buildNameKeys(name),...S.buildNameKeys(lastName)].filter(Boolean))];
  const isJwtFuture=e=>/jwt\s+issued\s+at\s+future|issued\s+at\s+future/i.test(String(e?.message||e||''));

  async function fetchFranceAStats(selectionIds){
    if(!selectionIds.length)return [];
    const out=[];let from=0;const chunk=1000;
    while(true){
      const {data,error}=await client.from('player_selection_stats').select(`player_id,selection_id,appearance_status,selections,international_number,player:players!player_selection_stats_player_id_fkey(id,display_name,last_name,primary_position,secondary_positions,birth_date,death_date,photo_path,gender)`).in('selection_id',selectionIds).range(from,from+chunk-1);
      if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<chunk)break;from+=chunk;
    }
    return out;
  }

  async function hydratePlayerTeamTags(list){
    const ids=new Set(list.map(p=>String(p.id)));if(!ids.size)return;
    const all=[];let from=0;const chunk=1000;
    while(true){
      const {data,error}=await client.from('entity_tags').select('entity_id,tag_id').eq('entity_type','player').range(from,from+chunk-1);
      if(error)throw error;const rows=data||[];all.push(...rows);if(rows.length<chunk)break;from+=chunk;
    }
    const teamMap=new Map(teams.map(t=>[String(t.id),t]));
    const refsByTag=new Map();
    for(const l of tagLinks){const arr=refsByTag.get(String(l.tag_id))||[];arr.push({...l,team:teamMap.get(String(l.reference_id))||null});refsByTag.set(String(l.tag_id),arr);}
    const playerTags=new Map();
    for(const x of all){if(!ids.has(String(x.entity_id)))continue;const arr=playerTags.get(String(x.entity_id))||[];arr.push(String(x.tag_id));playerTags.set(String(x.entity_id),arr);}
    for(const p of list){
      const explicit=[...new Set(playerTags.get(String(p.id))||[])].map(id=>{const tag=tags.get(id);if(!tag)return null;const refs=(refsByTag.get(id)||[]).filter(r=>r.reference_type==='selection');return refs.length?{tag,refs}:null;}).filter(Boolean);
      p.teamTags=explicit.length?explicit:p.teams.map(team=>{const tag=team.team_tag_id?tags.get(String(team.team_tag_id)):null;return tag?{tag,refs:[{reference_type:'selection',reference_id:team.id,relation_kind:'membership',team}]}:null;}).filter(Boolean);
    }
  }

  function publishRegistry(){
    const reg=players.map(p=>({
      id:p.id,name:p.name,display_name:p.name,name_variants:p.nameVariants||nameVariants(p.name,p.last_name),position:p.position||'',positions:p.positions||[],
      international_number:p.teams.find(t=>t.code==='FRA-A-M')?.international_number||null,
      selection_code:'FRA-A-M',selection_names:p.teams.map(t=>t.name),team_codes:p.teams.map(t=>t.code),
      team_tag_ids:(p.teamTags||[]).map(x=>x.tag.id),team_tag_labels:(p.teamTags||[]).map(x=>x.tag.label_text),
      jersey_numbers:p.jerseyNumbers||[],birth_date:p.birth_date,death_date:p.death_date||null,photo_path:p.photo_path
    })).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    window.BLEUS3000_PLAYER_REGISTRY_ALL=reg;
    window.BLEUS3000_PLAYER_REGISTRY=reg;
    window.dispatchEvent(new CustomEvent('bleus:player-registry',{detail:{players:reg,scope:'FRA-A-M'}}));
  }

  async function loadOnce(){
    if(!client)await waitClient();if(!client)throw new Error('Supabase indisponible');
    const [{data:teamRows,error:teamError},{data:tagRows,error:tagError},{data:linkRows,error:linkError},{data:jerseyRows,error:jerseyError}]=await Promise.all([
      client.from('selection_teams').select('id,code,name,gender,category,sort_order,team_tag_id').eq('active',true).eq('code','FRA-A-M').order('sort_order'),
      client.from('tags').select('*').eq('is_active',true),
      client.from('tag_reference_links').select('tag_id,reference_type,reference_id,relation_kind').eq('reference_type','selection'),
      client.from('player_jersey_numbers').select('player_id,shirt_number').order('shirt_number',{ascending:true})
    ]);
    if(teamError)throw teamError;if(tagError)throw tagError;if(linkError)throw linkError;if(jerseyError)throw jerseyError;
    teams=teamRows||[];tags=new Map((tagRows||[]).map(t=>[String(t.id),t]));tagLinks=linkRows||[];
    const teamMap=new Map(teams.map(t=>[String(t.id),t]));
    const stats=await fetchFranceAStats(teams.map(t=>t.id));
    const map=new Map();
    for(const row of stats){
      const team=teamMap.get(String(row.selection_id)),p=row.player||{};if(!team||!p.id)continue;
      let item=map.get(String(p.id));
      if(!item){const cleanName=String(p.display_name||'Joueur').replace(/\s+/g,' ').trim();item={id:p.id,name:cleanName,last_name:String(p.last_name||'').replace(/\s+/g,' ').trim(),nameVariants:nameVariants(cleanName,p.last_name||''),position:p.primary_position||'',positions:[...new Set([p.primary_position,...(p.secondary_positions||[])].filter(Boolean))],birth_date:p.birth_date||null,death_date:p.death_date||null,gender:p.gender||'',photo_path:p.photo_path||null,teams:[]};map.set(String(p.id),item);}
      if(!item.teams.some(x=>String(x.id)===String(team.id)))item.teams.push({...team,appearance_status:row.appearance_status,international_number:row.international_number,selections:row.selections});
    }
    players=[...map.values()];
    const jerseyMap=new Map();
    for(const row of jerseyRows||[]){const id=String(row.player_id),n=Number(row.shirt_number);if(!map.has(id)||!Number.isInteger(n))continue;const arr=jerseyMap.get(id)||[];arr.push(n);jerseyMap.set(id,arr);}
    players.forEach(p=>{p.teams.sort((a,b)=>(a.sort_order||999)-(b.sort_order||999));p.jerseyNumbers=[...new Set(jerseyMap.get(String(p.id))||[])].sort((a,b)=>a-b);});
    await hydratePlayerTeamTags(players);publishRegistry();return players;
  }

  async function load(retry=true){
    try{return await loadOnce();}
    catch(e){
      if(retry&&isJwtFuture(e)&&client){
        console.warn('Registre joueurs · JWT temporel invalide, refresh + nouvelle tentative.');
        const rr=await client.auth.refreshSession().catch(err=>({error:err}));
        if(!rr?.error){await new Promise(r=>setTimeout(r,1400));return load(false);}
      }
      throw e;
    }
  }

  async function openPlayer(id){
    const source=players.length?players:(window.BLEUS3000_PLAYER_REGISTRY||[]);
    const p=source.find(x=>String(x.id)===String(id))||null;
    const app=window.BLEUS3000_APP,sel=window.BLEUS3000_SELECTIONS;if(!app||!sel)return;
    app.openReferences('selections');await sel.selectCategory('FRA-A-M');
    const label=String(p?.name||p?.display_name||'').trim(),input=$('#referenceSearch');
    if(input&&label){input.value=label;input.dispatchEvent(new Event('input',{bubbles:true}));}
    requestAnimationFrame(()=>setTimeout(()=>{const tile=document.querySelector(`[data-player-tile="${CSS.escape(String(id))}"]`);if(tile){tile.scrollIntoView({block:'center',behavior:'smooth'});tile.classList.add('is-search-target');const toggle=tile.querySelector('[data-player-row-toggle]');if(toggle&&toggle.getAttribute('aria-expanded')!=='true')toggle.click();setTimeout(()=>tile.classList.remove('is-search-target'),1800);}},120));
  }

  // Le registre enrichi est désormais chargé à la demande. Le référentiel Joueurs
  // publie déjà un registre suffisant au démarrage, ce qui évite 5–7 lectures
  // Supabase redondantes sur chaque chargement de page.
  window.BLEUS3000_PLAYERS_DB={
    reload:load,
    openPlayer,
    get players(){return players.length?players:(window.BLEUS3000_PLAYER_REGISTRY||[]);}
  };
})();
