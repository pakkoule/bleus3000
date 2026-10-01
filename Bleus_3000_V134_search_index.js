/* 3615 Bleus V1.3.4 — index local transversal de recherche 3615 */
(()=>{
  'use strict';

  const S=window.BLEUS3000_SEARCH;
  if(!S)return;
  const norm=S.normalize;
  const cfg=window.BLEUS3000_CONFIG||{};
  const INDEX_VERSION='1.3.9-search-v3';
  const DB_NAME='bleus3000-search-index';
  const DB_VERSION=1;
  const STORE='index';
  const RECORD_KEY='global';
  const INDEX_TTL=12*60*60*1000;
  const PAGE=1000;
  const MAX_DOCS=12000;

  let docs=[];
  let builtAt=0;
  let ready=false;
  let building=null;
  let dbPromise=null;
  let rebuildTimer=0;
  let searchStats={builds:0,restores:0,queries:0,lastBuildMs:0,lastDocCount:0};

  const $=(s,p=document)=>p.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq=a=>[...new Set((a||[]).flat(Infinity).filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(v=>String(v).trim()))];
  const asArray=v=>Array.isArray(v)?v:(v===null||v===undefined?[]:[v]);
  const yearOf=v=>{const m=String(v||'').match(/\b(18|19|20|21)\d{2}\b/);return m?m[0]:'';};
  const fmtDate=v=>{if(!v)return'';const d=new Date(v);if(Number.isNaN(+d))return String(v).slice(0,10);return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(d);};
  const monthYear=v=>{if(!v)return'';const d=new Date(v);if(Number.isNaN(+d))return'';return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(d);};

  const CANON=new Map(Object.entries({
    buts:'but',buteur:'but',buteurs:'but',marque:'but',marques:'but',marquer:'but',
    passes:'passe',passeur:'passe',passeurs:'passe',assist:'passe',assists:'passe',assistance:'passe',assistances:'passe',
    matchs:'match',rencontres:'match',rencontre:'match',
    finales:'finale',demifinale:'demi',demifinales:'demi',demi:'demi',
    capitaines:'capitaine',capitanat:'capitaine',
    numeros:'numero',numero:'numero',
    selections:'selection',selectionnes:'selection',selectionne:'selection',
    selectionneurs:'selectionneur',coachs:'selectionneur',coach:'selectionneur',
    arbitres:'arbitre',
    maillots:'maillot',
    ballons:'ballon',
    stades:'stade',
    villes:'ville',
    pays:'pays',
    lieux:'lieu',
    equipementiers:'equipementier',equipementier:'equipementier',
    rassemblements:'rassemblement',
    medias:'media',
    livres:'livre',bibliographie:'livre',
    accomplissements:'accomplissement',
    editions:'edition',
    competitions:'competition',
    adversaires:'adversaire',
    joueurs:'joueur',
    titulaires:'titulaire',
    remplacants:'remplacant',remplacant:'remplacant',
    entrees:'entre',entree:'entre',
    olympiques:'olympique',olympique:'olympique'
  }));
  const STOP=new Set(['de','du','des','le','la','les','un','une','en','pendant','a','au','aux','dans','sur','pour','par','avec','et','ou','qui','que','quel','quelle','quels','quelles','ce','cette','ces','lors','chez']);
  const SHORTHANDS=[
    [/\bcdm\b/g,'coupe du monde'],[/\bmondial\b/g,'coupe du monde'],[/\bworld cup\b/g,'coupe du monde'],
    [/\bedf\b/g,'equipe de france'],[/\bldn\b/g,'ligue des nations'],[/\bnations league\b/g,'ligue des nations'],
    [/\bjo\b/g,'jeux olympiques'],[/\beuro\b/g,'championnat europe euro'],
    [/\bpd\b/g,'passe decisive'],[/\bpeno\b/g,'penalty'],[/\btit\b/g,'titulaire'],[/\bcap\b/g,'capitaine']
  ];
  function canonical(t){
    let x=norm(t).replace(/\s+/g,'');
    if(!x)return'';
    if(CANON.has(x))return CANON.get(x);
    if(x.length>4&&x.endsWith('s')&&!x.endsWith('ss'))x=x.slice(0,-1);
    return CANON.get(x)||x;
  }
  function expandQuery(q){let n=norm(q);for(const [rx,r] of SHORTHANDS)n=n.replace(rx,r);return n.replace(/\s+/g,' ').trim();}
  function queryTerms(q){
    const expanded=expandQuery(q),special=[];
    const score=String(q||'').match(/\b(\d{1,2})\s*[-–:]\s*(\d{1,2})\b/);if(score)special.push(`score_${score[1]}_${score[2]}`);
    const raw=expanded.split(' ').map(canonical).filter(Boolean).filter(t=>!STOP.has(t));
    return {expanded,terms:uniq(raw),special};
  }
  function tokenSet(values,special=[]){
    const base=uniq(values).join(' '),tokens=norm(base).split(' ').map(canonical).filter(Boolean);
    return uniq([...tokens,...special]);
  }
  function makeDoc(typeKey,id,type,icon,title,meta,values=[],extra={}){
    const special=extra.specialTokens||[];
    const all=uniq([type,typeKey,title,meta,...values]);
    const tokens=tokenSet(all,special);
    return {typeKey:String(typeKey),id:String(id),type,icon,title:String(title||''),meta:String(meta||''),image:String(extra.image||''),values:all,tokens,searchText:norm(all.join(' ')),specialTokens:special,extra:extra.extra||{}};
  }

  function openDb(){
    if(!('indexedDB'in window))return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{try{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(db.objectStoreNames.contains(STORE))db.deleteObjectStore(STORE);db.createObjectStore(STORE,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);}catch{resolve(null);}});
    return dbPromise;
  }
  async function restore(){
    const db=await openDb();if(!db)return false;
    const row=await new Promise(resolve=>{try{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(RECORD_KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);}catch{resolve(null);}});
    if(!row||row.version!==INDEX_VERSION||!Array.isArray(row.docs))return false;
    docs=row.docs.slice(0,MAX_DOCS);builtAt=Number(row.builtAt||0);ready=docs.length>0;searchStats.restores++;searchStats.lastDocCount=docs.length;
    return ready;
  }
  async function persist(){const db=await openDb();if(!db)return;const row={key:RECORD_KEY,version:INDEX_VERSION,builtAt,docs};await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(row);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();}catch{resolve();}});}
  async function clearPersisted(){const db=await openDb();if(!db)return;await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(RECORD_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve();}});}

  async function waitClient(timeout=5000){
    if(window.BLEUS3000_SUPABASE)return window.BLEUS3000_SUPABASE;
    return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('bleus:supabase-ready',onReady);resolve(window.BLEUS3000_SUPABASE||null);};const onReady=()=>finish();window.addEventListener('bleus:supabase-ready',onReady,{once:true});const timer=setTimeout(finish,timeout);});
  }
  async function paged(table,select,{filter=null,page=PAGE,max=50000}={}){
    const c=await waitClient();if(!c)return[];const out=[];
    for(let from=0;from<max;from+=page){let q=c.from(table).select(select).range(from,from+page-1);if(filter)q=filter(q);const {data,error}=await q;if(error){console.warn(`Recherche 3615 · ${table}`,error);break;}const rows=data||[];out.push(...rows);if(rows.length<page)break;}
    return out;
  }
  const mapBy=(rows,key='id')=>new Map((rows||[]).filter(x=>x?.[key]!=null).map(x=>[String(x[key]),x]));
  const groupBy=(rows,key)=>{const m=new Map();for(const r of rows||[]){const k=String(r?.[key]??'');if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
  const addSet=(map,key,...vals)=>{key=String(key||'');if(!key)return;if(!map.has(key))map.set(key,new Set());for(const v of vals.flat(Infinity))if(v!==null&&v!==undefined&&String(v).trim())map.get(key).add(String(v).trim());};
  const setVals=(m,k)=>[...(m.get(String(k))||[])];
  function publicPlayerPhoto(p,c){const path=String(p?.photo_path||'').trim();if(!path||!c)return'';try{return c.storage.from('player-photos').getPublicUrl(path).data.publicUrl||'';}catch{return'';}}

  function matchCore(m,maps){
    const opponent=maps.opponents.get(String(m.opponent_id))||m.opponent||{};
    const comp=maps.competitions.get(String(m.competition_id))||m.competition||{};
    const ed=maps.editions.get(String(m.competition_edition_id||comp.canonical_edition_id))||m.competitionEdition||{};
    const ent=maps.entities.get(String(comp.canonical_entity_id||ed.competition_entity_id))||m.competitionEntity||{};
    const place=maps.places.get(String(m.place_id))||m.place||{};
    const coach=maps.people.get(String(m.coach_id))||m.coach||{};
    const date=m.match_date||'';const year=yearOf(date);const fs=m.france_score,os=m.opponent_score;
    const score=(fs!==null&&fs!==undefined&&os!==null&&os!==undefined)?`${fs}-${os}`:'';
    return {opponent,comp,ed,ent,place,coach,date,year,score,competition:ent.name||comp.name||m.sheet_competition_name||'',edition:ed.edition_label||ed.edition_year||comp.edition||'',venue:place.name||m.sheet_stadium_name||'',city:place.city||m.sheet_city_name||'',country:place.country||''};
  }

  async function collectData(){
    const c=await waitClient();if(!c)throw new Error('Supabase indisponible');
    const refs=window.BLEUS3000_RELATIONAL_REFS;
    try{await refs?.load?.();}catch{}
    const baseMatches=(refs?.matches||[]).map(x=>({...x}));
    const baseCompetitions=refs?.getCompetitions?.()||[];
    const baseEntities=refs?.getCompetitionEntities?.()||[];
    const baseEditions=refs?.getCompetitionEditions?.()||[];
    const baseOpponents=refs?.getOpponents?.()||[];
    const basePeople=refs?.people||[];

    const tasks={
      players:paged('players','id,first_name,last_name,display_name,birth_date,death_date,birth_place,primary_position,secondary_positions,keywords,photo_path,gender', {filter:q=>q.eq('gender',cfg.SELECTION_GENDER||'M'),max:5000}),
      stats:paged('player_selection_stats','player_id,selections,goals,starts,international_number,first_year,last_year,appearance_status', {max:5000}),
      jerseyNumbers:paged('player_jersey_numbers','player_id,shirt_number', {max:10000}),
      playerAchievements:paged('player_achievements','player_id,achievement_id,achievement_value,achieved_on', {max:5000}),
      achievements:paged('achievements','id,slug,label_text,icon_text,description_short,is_active', {filter:q=>q.eq('is_active',true),max:2000}),
      tags:Promise.resolve(refs?.getTags?.()||[]),
      entityTags:paged('entity_tags','entity_type,entity_id,tag_id', {max:10000}),
      appearances:paged('match_appearances','id,match_id,player_id,player_name,starter,appeared,captain,position,shirt_number,squad_status,replaced_by_player_id,replaced_by_name,goals,assists', {max:25000}),
      goals:paged('match_goal_events','id,match_id,player_id,scorer_name,assist_player_id,assist_name,team_name,minute_text,score_after,goal_type,body_part,is_penalty,is_own_goal,video_url,video_title', {max:10000}),
      cards:paged('match_card_events','id,match_id,player_id,player_name,team_name,card_type,minute_text', {max:5000}),
      officials:paged('match_officials','match_id,person_id,role', {max:5000}),
      media:paged('match_media_assets','id,match_id,asset_type,title,url,image_path,image_url,image_copyright_source', {max:5000}),
      matchJerseys:paged('match_jerseys','match_id,jersey_id,role,short_component_id,socks_component_id,jersey_variant_id', {max:5000}),
      jerseys:paged('jerseys','id,title,season_label,year_start,year_end,usage_type,manufacturer,manufacturer_id,manufacturer_reference,template_name,primary_color,secondary_color,accent_colors,sleeve_type,pattern_description,notes_short,main_photo_url,main_photo_path', {max:5000}),
      components:paged('kit_components','id,component_type,title,season_label,year_start,year_end,usage_type,primary_color,secondary_color,notes_short', {max:5000}),
      manufacturers:paged('equipment_manufacturers','id,name,slug,aliases,website_url,tag_id,active', {filter:q=>q.eq('active',true),max:2000}),
      balls:paged('football_balls','id,model_name,manufacturer_id,manufacturer_alias,competition_entity_id,competition_edition_id,year_start,year_end,photo_url,photo_path,notes_short,active', {max:5000}),
      matchBalls:paged('match_balls','match_id,ball_id,notes', {max:5000}),
      channels:paged('broadcast_channels','id,name,aliases,active', {max:2000}),
      matchChannels:paged('match_broadcast_channels','match_id,broadcast_channel_id,source', {max:5000}),
      books:paged('books','id,title,author,isbn,edition_text,publication_year,publisher,photo_url,photo_path,notes_short', {max:5000}),
      bibliographyMedia:paged('bibliography_media','id,media_type,title,author_director,year,publisher_broadcaster,duration_minutes,pages,language,cover_url,availability,keywords', {max:5000}),
      albums:paged('panini_albums','id,title,edition_text,publication_year,publisher,competition_entity_id,competition_edition_id,cover_url,cover_path,notes_short', {max:5000}),
      stickers:paged('panini_stickers','id,album_id,player_id,sticker_number,title,image_url,image_path,notes_short,sort_order', {max:10000}),
      callups:paged('callups','id,title,announcement_date,start_date,end_date,coach_id,competition_id,place_id,notes_short,status,selection_team_id', {filter:q=>q.eq('gender',cfg.SELECTION_GENDER||'M').eq('selection_category',cfg.SELECTION_CATEGORY||'A'),max:5000}),
      callupPlayers:paged('callup_players','callup_id,player_id,position_group,status,first_callup,replacement_for,notes_short,not_replaced', {max:10000}),
      callupEvents:paged('callup_events','id,callup_id,event_date,event_type,title,description,player_id,related_player_id', {max:10000}),
      callupMatches:paged('callup_matches','callup_id,match_id,sort_order', {max:10000})
    };
    const keys=Object.keys(tasks),vals=await Promise.all(keys.map(k=>tasks[k].catch?.(e=>{console.warn('Recherche 3615',k,e);return[]})||tasks[k]));const data=Object.fromEntries(keys.map((k,i)=>[k,vals[i]||[]]));
    data.matches=baseMatches.length?baseMatches:await paged('matches','*',{filter:q=>q.eq('gender',cfg.SELECTION_GENDER||'M').eq('selection_category',cfg.SELECTION_CATEGORY||'A'),max:5000});
    data.competitions=baseCompetitions.length?baseCompetitions:await paged('competitions','*',{max:5000});
    data.entities=baseEntities.length?baseEntities:await paged('competition_entities','*',{max:5000});
    data.editions=baseEditions.length?baseEditions:await paged('competition_editions','*',{max:5000});
    data.opponents=baseOpponents.length?baseOpponents:await paged('opponents','*',{max:5000});
    // Tous les lieux doivent etre indexes, pas uniquement les stades deja exposes par RELATIONAL_REFS.
    data.places=await paged('places','*',{max:5000});
    data.people=basePeople.length?basePeople:await paged('personnel','*',{max:5000});
    if(!data.tags.length)data.tags=await paged('tags','*',{filter:q=>q.eq('is_active',true),max:5000});
    return data;
  }

  function buildDocs(data,c){
    const out=[];
    const players=mapBy(data.players),statsBy=groupBy(data.stats,'player_id'),numsBy=groupBy(data.jerseyNumbers,'player_id'),achievements=mapBy(data.achievements),playerAchBy=groupBy(data.playerAchievements,'player_id'),tags=mapBy(data.tags),entityTagsBy=new Map();
    for(const et of data.entityTags||[]){const k=`${et.entity_type}:${et.entity_id}`;if(!entityTagsBy.has(k))entityTagsBy.set(k,[]);entityTagsBy.get(k).push(et);}
    const matches=mapBy(data.matches),competitions=mapBy(data.competitions),entities=mapBy(data.entities),editions=mapBy(data.editions),opponents=mapBy(data.opponents),places=mapBy(data.places),people=mapBy(data.people),peopleByName=new Map((data.people||[]).map(x=>[norm(x.display_name||''),x]).filter(x=>x[0]));
    const appearancesByMatch=groupBy(data.appearances,'match_id'),goalsByMatch=groupBy(data.goals,'match_id'),cardsByMatch=groupBy(data.cards,'match_id'),officialsByMatch=groupBy(data.officials,'match_id'),mediaByMatch=groupBy(data.media,'match_id'),jerseyByMatch=groupBy((data.matchJerseys||[]).filter(x=>String(x.role||'outfield')==='outfield'),'match_id'),ballByMatch=groupBy(data.matchBalls,'match_id'),channelByMatch=groupBy(data.matchChannels,'match_id');
    const jerseys=mapBy(data.jerseys),components=mapBy(data.components),manufacturers=mapBy(data.manufacturers),balls=mapBy(data.balls),channels=mapBy(data.channels),albums=mapBy(data.albums);
    const playerRelations=new Map(),oppRelations=new Map(),placeRelations=new Map(),personRelations=new Map(),competitionRelations=new Map(),editionRelations=new Map();
    const playerGoalRelations=new Map();
    const matchMetaById=new Map();

    for(const m of data.matches||[]){
      const core=matchCore(m,{opponents,competitions,editions,entities,places,people});matchMetaById.set(String(m.id),core);
      const apps=appearancesByMatch.get(String(m.id))||[],goals=goalsByMatch.get(String(m.id))||[],cards=cardsByMatch.get(String(m.id))||[],officials=officialsByMatch.get(String(m.id))||[],media=mediaByMatch.get(String(m.id))||[];
      const appearanceWords=[];
      for(const a of apps){const p=players.get(String(a.player_id)),name=p?.display_name||a.player_name||'';appearanceWords.push(name,a.position||'',a.shirt_number!=null?`numero ${a.shirt_number}`:'',a.starter?'titulaire':'remplacant',a.appeared?'entre en jeu':'',a.captain?'capitaine capitanat':'',a.squad_status||'');if(a.replaced_by_player_id){const rp=players.get(String(a.replaced_by_player_id));appearanceWords.push(`remplace par ${rp?.display_name||a.replaced_by_name||''}`);}addSet(playerRelations,a.player_id,core.opponent.name,core.competition,core.edition,core.venue,core.city,core.country,core.year,m.phase,'match',a.starter?'titulaire':'remplacant',a.captain?'capitaine':'',a.shirt_number!=null?`numero ${a.shirt_number}`:'');addSet(oppRelations,m.opponent_id,name);addSet(placeRelations,m.place_id,name);addSet(personRelations,m.coach_id,name);addSet(competitionRelations,m.competition_id,name);addSet(editionRelations,m.competition_edition_id,name);}
      const goalWords=[];for(const g of goals){const scorer=players.get(String(g.player_id))?.display_name||g.scorer_name||'',assist=players.get(String(g.assist_player_id))?.display_name||g.assist_name||'';goalWords.push('but',scorer,assist?`passe decisive ${assist}`:'',g.minute_text?`minute ${g.minute_text}`:'',g.goal_type||'',g.body_part||'',g.is_penalty?'penalty':'',g.is_own_goal?'contre son camp':'',g.score_after||'');if(g.player_id)addSet(playerGoalRelations,g.player_id,'but',core.opponent.name,core.competition,core.edition,core.venue,core.city,core.year);if(g.assist_player_id)addSet(playerGoalRelations,g.assist_player_id,'passe decisive',core.opponent.name,core.competition,core.edition,core.venue,core.city,core.year);}
      const cardWords=[];for(const x of cards)cardWords.push('carton',x.card_type||'',players.get(String(x.player_id))?.display_name||x.player_name||'',x.minute_text||'');
      const officialWords=[];for(const o of officials){const p=people.get(String(o.person_id));officialWords.push(o.role||'',p?.display_name||'');addSet(personRelations,o.person_id,core.opponent.name,core.competition,core.edition,core.venue,core.city,core.year,'arbitre',o.role||'');}
      const coachPerson=people.get(String(m.coach_id))||peopleByName.get(norm(m.sheet_coach_name||''));if(coachPerson)addSet(personRelations,coachPerson.id,core.opponent.name,core.competition,core.edition,core.venue,core.city,core.year,'selectionneur');
      const sheetRef=peopleByName.get(norm(m.sheet_referee_name||''));if(sheetRef)addSet(personRelations,sheetRef.id,core.opponent.name,core.competition,core.edition,core.venue,core.city,core.year,'arbitre principal');
      const jerseyWords=[];for(const link of jerseyByMatch.get(String(m.id))||[]){const j=jerseys.get(String(link.jersey_id));if(!j)continue;const sh=components.get(String(link.short_component_id)),so=components.get(String(link.socks_component_id));jerseyWords.push('maillot porte porté',j.title,j.season_label,j.manufacturer,j.primary_color,j.secondary_color,...asArray(j.accent_colors),j.sleeve_type,j.pattern_description,sh?.title,sh?.primary_color,so?.title,so?.primary_color);}
      const ballWords=[];for(const link of ballByMatch.get(String(m.id))||[]){const b=balls.get(String(link.ball_id));if(b)ballWords.push('ballon',b.model_name,b.manufacturer_alias,manufacturers.get(String(b.manufacturer_id))?.name);}
      const mediaWords=[];for(const x of media)mediaWords.push('media',x.asset_type,x.title,x.image_copyright_source);
      const broadcastWords=[m.broadcast_text||''];for(const link of channelByMatch.get(String(m.id))||[]){const ch=channels.get(String(link.broadcast_channel_id));broadcastWords.push(ch?.name,...asArray(ch?.aliases));}
      const scoreSpecial=core.score?`score_${core.score.replace('-','_')}`:'';
      const title=`France - ${core.opponent.name||'Adversaire'}`;
      const meta=[m.chronological_number?`Match n°${m.chronological_number}`:'',fmtDate(core.date),core.score,core.competition,core.edition,core.venue].filter(Boolean).join(' · ');
      out.push(makeDoc('match',m.id,'Matchs','⚽',title,meta,[
        'match france equipe de france',core.opponent.name,core.opponent.fifa_code,fmtDate(core.date),monthYear(core.date),core.year,core.score,core.competition,core.edition,m.phase,core.venue,core.city,core.country,core.coach.display_name,m.sheet_coach_name,m.sheet_referee_name,m.notes_short,m.sheet_formation,
        ...appearanceWords,...goalWords,...cardWords,...officialWords,...jerseyWords,...ballWords,...mediaWords,...broadcastWords
      ],{specialTokens:scoreSpecial?[scoreSpecial]:[],extra:{matchId:m.id}}));
    }

    for(const g of data.goals||[]){const m=matches.get(String(g.match_id));if(!m)continue;const core=matchMetaById.get(String(m.id))||matchCore(m,{opponents,competitions,editions,entities,places,people}),scorer=players.get(String(g.player_id))?.display_name||g.scorer_name||'Buteur',assist=players.get(String(g.assist_player_id))?.display_name||g.assist_name||'';if(norm(g.team_name||'france')!=='france'&&!g.player_id)continue;out.push(makeDoc('goal',g.id,'Buts','⚽',`${scorer} · ${core.opponent.name||'Adversaire'}`,[g.minute_text?`${g.minute_text}’`:null,core.competition,core.edition,core.year].filter(Boolean).join(' · '),['but','buteur','equipe de france france edf',scorer,assist?`passe decisive ${assist}`:'',core.opponent.name,core.competition,core.edition,m.phase,core.venue,core.city,core.country,fmtDate(core.date),monthYear(core.date),core.year,g.goal_type,g.body_part,g.is_penalty?'penalty':'',g.is_own_goal?'contre son camp':'',g.score_after,g.video_title,g.video_url?'video media':''],{extra:{matchId:g.match_id,goalId:g.id}}));}

    for(const p of data.players||[]){const st=(statsBy.get(String(p.id))||[])[0]||{},nums=uniq((numsBy.get(String(p.id))||[]).map(x=>x.shirt_number).filter(x=>x!==null&&x!==undefined)),achs=(playerAchBy.get(String(p.id))||[]).map(x=>{const a=achievements.get(String(x.achievement_id));return a?[a.label_text,a.slug,x.achievement_value!=null?`${a.label_text} ${x.achievement_value}`:'']:[];}).flat(),tagWords=(entityTagsBy.get(`player:${p.id}`)||[]).map(x=>tags.get(String(x.tag_id))).filter(Boolean).flatMap(t=>[t.label_text,t.slug,...asArray(t.aliases)]),rel=[...setVals(playerRelations,p.id),...setVals(playerGoalRelations,p.id)];const birthYear=yearOf(p.birth_date),deathYear=yearOf(p.death_date);out.push(makeDoc('player',p.id,'Joueurs','👤',p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' '),[st.selections!=null?`${st.selections} sélections`:'',st.goals!=null?`${st.goals} buts`:'',p.primary_position].filter(Boolean).join(' · '),['equipe de france france edf',p.display_name,p.first_name,p.last_name,p.birth_date,fmtDate(p.birth_date),birthYear,p.death_date,fmtDate(p.death_date),deathYear,p.birth_place,p.primary_position,...asArray(p.secondary_positions),...asArray(p.keywords),st.selections!=null?`selections ${st.selections}`:'',st.goals!=null?`buts ${st.goals}`:'',st.starts!=null?`titularisations ${st.starts}`:'',st.international_number!=null?`international numero ${st.international_number}`:'',...nums.flatMap(n=>[`numero ${n}`,String(n)]),...achs,...tagWords,...rel],{image:publicPlayerPhoto(p,c),extra:{playerId:p.id}}));}

    for(const o of data.opponents||[]){const linked=(data.matches||[]).filter(m=>String(m.opponent_id)===String(o.id)),vals=[];for(const m of linked){const core=matchMetaById.get(String(m.id));vals.push(core?.year,core?.competition,core?.edition,core?.venue,core?.city,...setVals(oppRelations,o.id));}out.push(makeDoc('opponent',o.id,'Adversaires','🌍',o.name,[o.confederation,o.continent].filter(Boolean).join(' · '),[o.name,o.fifa_code,o.confederation,o.continent,o.federation_name,'adversaire',...vals],{image:o.flag_url||o.federation_logo_url||'',extra:{referenceKind:'adversaires',selector:`[data-opponent-id="${o.id}"]`}}));}

    for(const pl of data.places||[]){const kind=norm(pl.place_type||'').includes('stad')?'Stades':'Lieux',vals=setVals(placeRelations,pl.id);out.push(makeDoc('place',pl.id,kind,kind==='Stades'?'🏟️':'📍',pl.name,[pl.city,pl.country].filter(Boolean).join(' · '),[pl.name,pl.place_type,pl.city,pl.country,pl.capacity,pl.opened_year,pl.description_short,kind==='Stades'?'stade':'lieu',...vals],{extra:{referenceKind:'lieux',selector:`[data-stadium-id="${pl.id}"]`}}));}

    const cities=new Map(),countries=new Map();for(const pl of data.places||[]){if(pl.city){if(!cities.has(pl.city))cities.set(pl.city,[]);cities.get(pl.city).push(pl);}if(pl.country){if(!countries.has(pl.country))countries.set(pl.country,[]);countries.get(pl.country).push(pl);}}
    for(const [city,rows] of cities){out.push(makeDoc('city',`city:${city}`,'Villes','🏙️',city,`${rows.length} lieu${rows.length>1?'x':''}`,[city,'ville',...rows.flatMap(pl=>[pl.name,pl.country,...setVals(placeRelations,pl.id)])],{extra:{referenceKind:'lieux'}}));}
    for(const [country,rows] of countries){out.push(makeDoc('country',`country:${country}`,'Pays','🌐',country,`${rows.length} lieu${rows.length>1?'x':''}`,[country,'pays',...rows.flatMap(pl=>[pl.name,pl.city,...setVals(placeRelations,pl.id)])],{extra:{referenceKind:'lieux'}}));}

    for(const p of data.people||[]){const k=norm(p.person_type),isRef=k.includes('arbitr'),isCoach=k.includes('selection')||k.includes('coach')||k.includes('entraine'),type=isRef?'Arbitres':isCoach?'Sélectionneurs':'Staff',kind=isRef?'referee':'staff',icon=isRef?'🧑‍⚖️':'👔',vals=setVals(personRelations,p.id);out.push(makeDoc(kind,p.id,type,icon,p.display_name,[p.person_type,p.nationality].filter(Boolean).join(' · '),[p.display_name,p.person_type,p.nationality,p.organization,p.birth_date,fmtDate(p.birth_date),p.death_date,fmtDate(p.death_date),...asArray(p.keywords),...vals,isRef?'arbitre':isCoach?'selectionneur':'staff'],{image:p.photo_url||'',extra:{referenceKind:isRef?'arbitres':'staff',selector:isRef?`[data-referee-id="${p.id}"]`:`[data-staff-id="${p.id}"]`}}));}

    for(const e of data.entities||[]){const linked=(data.competitions||[]).filter(c=>String(c.canonical_entity_id)===String(e.id));out.push(makeDoc('competition_entity',e.id,'Compétitions','🏆',e.name,e.competition_type||'Compétition',[e.name,e.slug,...asArray(e.aliases),e.competition_type,e.notes,'competition',...linked.flatMap(c=>[c.name,c.edition,c.host_country])],{extra:{referenceKind:'competitions'}}));}
    for(const ed of data.editions||[]){const ent=entities.get(String(ed.competition_entity_id))||{},linked=(data.matches||[]).filter(m=>String(m.competition_edition_id)===String(ed.id));const vals=[];for(const m of linked){const core=matchMetaById.get(String(m.id));vals.push(core?.opponent?.name,core?.venue,core?.city,m.phase,...(appearancesByMatch.get(String(m.id))||[]).map(a=>players.get(String(a.player_id))?.display_name||a.player_name));}const title=[ent.name,ed.edition_label||ed.edition_year].filter(Boolean).join(' · ');out.push(makeDoc('competition_edition',ed.id,'Éditions','🏆',title,`Édition ${ed.edition_label||ed.edition_year||''}`,[ent.name,...asArray(ent.aliases),ed.edition_label,ed.edition_year,ed.notes,'edition competition',...vals],{extra:{referenceKind:'competitions'}}));}

    for(const j of data.jerseys||[]){const links=(data.matchJerseys||[]).filter(x=>String(x.jersey_id)===String(j.id)),vals=[];for(const l of links){const core=matchMetaById.get(String(l.match_id));vals.push(core?.opponent?.name,core?.competition,core?.edition,core?.year,core?.venue,core?.city);}out.push(makeDoc('jersey',j.id,'Maillots','👕',j.title||'Maillot France',[j.season_label,j.manufacturer,j.usage_type].filter(Boolean).join(' · '),['maillot porte porté','equipe de france france edf',j.title,j.season_label,j.year_start,j.year_end,j.usage_type,j.manufacturer,j.manufacturer_reference,j.template_name,j.primary_color,j.secondary_color,...asArray(j.accent_colors),j.sleeve_type,j.pattern_description,j.notes_short,...vals],{extra:{referenceKind:'maillots',selector:`[data-jersey-id="${j.id}"]`}}));}

    for(const m of data.manufacturers||[]){const linked=(data.jerseys||[]).filter(j=>String(j.manufacturer_id)===String(m.id)||norm(j.manufacturer)===norm(m.name));out.push(makeDoc('manufacturer',m.id,'Équipementiers','🏷️',m.name,'Équipementier',[m.name,m.slug,...asArray(m.aliases),m.website_url,'equipementier',...linked.flatMap(j=>[j.title,j.season_label,j.year_start,j.year_end])],{extra:{detail:true}}));}

    for(const b of data.balls||[]){const links=(data.matchBalls||[]).filter(x=>String(x.ball_id)===String(b.id)),ent=entities.get(String(b.competition_entity_id)),ed=editions.get(String(b.competition_edition_id)),maker=manufacturers.get(String(b.manufacturer_id));const rel=[];for(const l of links){const core=matchMetaById.get(String(l.match_id));rel.push(core?.opponent?.name,core?.competition,core?.edition,core?.year,core?.venue,core?.city);}out.push(makeDoc('ball',b.id,'Ballons','⚽',b.model_name,[maker?.name||b.manufacturer_alias,ed?.edition_label||ed?.edition_year||ent?.name].filter(Boolean).join(' · '),['ballon',b.model_name,maker?.name,b.manufacturer_alias,ent?.name,ed?.edition_label,ed?.edition_year,b.year_start,b.year_end,b.notes_short,...rel],{image:b.photo_url||'',extra:{detail:true,matchIds:links.map(x=>x.match_id)}}));}

    for(const x of data.media||[]){const core=matchMetaById.get(String(x.match_id));const typeLabel={newspaper_front:'Une de journal',team_photo:"Photo d'équipe",ball:'Ballon du match',ticket:'Billet historique'}[x.asset_type]||x.asset_type||'Média';out.push(makeDoc('media',x.id,'Médias','🖼️',x.title||typeLabel,[core?.opponent?.name,core?.year,typeLabel].filter(Boolean).join(' · '),['media',typeLabel,x.asset_type,x.title,x.image_copyright_source,core?.opponent?.name,core?.competition,core?.edition,core?.year,core?.venue,core?.city],{image:x.image_url||'',extra:{matchId:x.match_id,mediaId:x.id}}));}

    for(const b of data.books||[])out.push(makeDoc('book',b.id,'Bibliographie','📚',b.title,[b.author,b.publication_year].filter(Boolean).join(' · '),['livre bibliographie',b.title,b.author,b.isbn,b.edition_text,b.publication_year,b.publisher,b.notes_short],{image:b.photo_url||'',extra:{referenceKind:'livres',selector:`[data-book-id="${b.id}"]`}}));
    for(const bm of data.bibliographyMedia||[]){const mt=String(bm.media_type||'Média');out.push(makeDoc('bibliography_media',bm.id,'Médias','🎬',bm.title,[bm.author_director,bm.year,mt].filter(Boolean).join(' · '),['media bibliographie',mt,bm.title,bm.author_director,bm.year,bm.publisher_broadcaster,bm.duration_minutes?`${bm.duration_minutes} minutes`:'',bm.pages?`${bm.pages} pages`:'',bm.language,bm.availability,...asArray(bm.keywords)],{image:bm.cover_url||'',extra:{detail:true}}));}
    for(const a of data.albums||[]){const stickers=(data.stickers||[]).filter(x=>String(x.album_id)===String(a.id));out.push(makeDoc('panini_album',a.id,'Panini','🟨',a.title,[a.edition_text,a.publication_year].filter(Boolean).join(' · '),['panini album',a.title,a.edition_text,a.publication_year,a.publisher,a.notes_short,...stickers.flatMap(s=>[s.title,s.sticker_number,players.get(String(s.player_id))?.display_name])],{image:a.cover_url||'',extra:{referenceKind:'panini'}}));}

    for(const a of data.achievements||[]){const linked=(data.playerAchievements||[]).filter(x=>String(x.achievement_id)===String(a.id)),names=linked.map(x=>players.get(String(x.player_id))?.display_name).filter(Boolean);out.push(makeDoc('achievement',a.id,'Accomplissements','🏅',a.label_text,a.description_short||'Accomplissement',['accomplissement',a.label_text,a.slug,a.description_short,...names],{extra:{detail:true,playerIds:uniq(linked.map(x=>x.player_id))}}));}

    const cpBy=groupBy(data.callupPlayers,'callup_id'),ceBy=groupBy(data.callupEvents,'callup_id'),cmBy=groupBy(data.callupMatches,'callup_id');
    for(const r of data.callups||[]){const coach=people.get(String(r.coach_id)),place=places.get(String(r.place_id)),comp=competitions.get(String(r.competition_id)),ps=cpBy.get(String(r.id))||[],ev=ceBy.get(String(r.id))||[],ml=cmBy.get(String(r.id))||[],vals=['equipe de france france edf',r.title,r.announcement_date,fmtDate(r.announcement_date),monthYear(r.announcement_date),r.start_date,fmtDate(r.start_date),monthYear(r.start_date),r.end_date,fmtDate(r.end_date),r.notes_short,r.status,coach?.display_name,place?.name,place?.city,place?.country,comp?.name,'rassemblement',...ps.flatMap(x=>[players.get(String(x.player_id))?.display_name,x.position_group,x.status,x.first_callup?'premiere convocation':'',players.get(String(x.replacement_for))?.display_name]),...ev.flatMap(x=>[x.event_type,x.title,x.description,players.get(String(x.player_id))?.display_name,players.get(String(x.related_player_id))?.display_name]),...ml.flatMap(x=>{const core=matchMetaById.get(String(x.match_id));return[core?.opponent?.name,core?.competition,core?.year];})];out.push(makeDoc('gathering',r.id,'Rassemblements','📋',r.title,[r.announcement_date?`Annonce ${fmtDate(r.announcement_date)}`:'',ps.length?`${ps.length} joueur(s)`:'' ].filter(Boolean).join(' · '),vals,{extra:{gatheringId:r.id}}));}

    return out.slice(0,MAX_DOCS);
  }

  async function build({force=false}={}){
    if(building)return building;
    if(ready&&!force&&Date.now()-builtAt<INDEX_TTL)return docs;
    building=(async()=>{const t0=performance.now();const c=await waitClient();if(!c)throw new Error('Supabase indisponible');const data=await collectData();docs=buildDocs(data,c);builtAt=Date.now();ready=true;searchStats.builds++;searchStats.lastBuildMs=Math.round(performance.now()-t0);searchStats.lastDocCount=docs.length;await persist();window.dispatchEvent(new CustomEvent('bleus:search-index-ready',{detail:{count:docs.length,builtAt}}));return docs;})().finally(()=>building=null);
    return building;
  }
  async function ensure(){
    if(ready)return docs;
    if(!building){const restored=await restore();if(restored){if(Date.now()-builtAt>INDEX_TTL)scheduleRebuild(1200);return docs;}}
    return build();
  }

  function termQuality(term,doc){
    if(doc.tokens.includes(term))return 1;
    if(term.length>=3&&doc.searchText.includes(term))return .88;
    if(term.length<3)return 0;
    let best=0;
    for(const tok of doc.tokens){if(!tok)continue;if(tok.startsWith(term)||term.startsWith(tok)&&tok.length>=4)best=Math.max(best,.82);else if(term.length>=4&&tok.includes(term))best=Math.max(best,.76);}
    if(best)return best;
    if(term.length<4)return 0;
    const limit=term.length<=5?1:term.length<=8?2:3;
    for(const tok of doc.tokens){if(tok.length<3||Math.abs(tok.length-term.length)>limit)continue;const d=S.levenshtein(term,tok);if(d<=limit)return .62-(d-1)*.08;}
    return 0;
  }
  function typeBoost(q,doc){
    const t=new Set(q.terms),k=doc.typeKey;let b=0;
    if(t.has('but')&&k==='goal')b-=.34;
    if(t.has('match')&&k==='match')b-=.30;
    if(t.has('joueur')&&k==='player')b-=.25;
    if(t.has('rassemblement')&&k==='gathering')b-=.30;
    if(t.has('maillot')&&k==='jersey')b-=.30;
    if(t.has('ballon')&&k==='ball')b-=.30;
    if(t.has('arbitre')&&k==='referee')b-=.30;
    if(t.has('selectionneur')&&k==='staff')b-=.28;
    if(t.has('competition')&&k.startsWith('competition_'))b-=.24;
    if(t.has('edition')&&k==='competition_edition')b-=.28;
    if(t.has('media')&&k==='media')b-=.28;
    if(t.has('livre')&&k==='book')b-=.28;
    if(t.has('accomplissement')&&k==='achievement')b-=.28;
    return b;
  }
  function scoreDoc(parsed,doc){
    let sum=0;for(const term of parsed.terms){const q=termQuality(term,doc);if(!q)return Infinity;sum+=q;}
    for(const sp of parsed.special)if(!doc.tokens.includes(sp))return Infinity;
    let score=1-(sum/Math.max(1,parsed.terms.length));
    if(parsed.expanded&&doc.searchText.includes(parsed.expanded))score-=.18;
    const titleN=norm(doc.title);if(parsed.expanded===titleN)score-=.32;else if(titleN.startsWith(parsed.expanded))score-=.18;
    score+=typeBoost(parsed,doc);
    return score;
  }

  function referenceTarget(kind,title,selector=''){
    window.BLEUS3000_APP?.openReferences?.(kind);
    setTimeout(()=>{const input=$('#referenceSearch');if(input){input.value=title||'';input.dispatchEvent(new Event('input',{bubbles:true}));}setTimeout(()=>{const el=selector?$(selector):null;if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('is-search-target');setTimeout(()=>el.classList.remove('is-search-target'),2400);}},260);},90);
  }
  function detailModal(){
    let m=$('#universalSearchDetailModal');if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="universalSearchDetailModal" hidden><section class="modal-dialog universal-search-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="universalSearchDetailTitle"><header class="modal-head"><div><h2 id="universalSearchDetailTitle">Résultat</h2><p id="universalSearchDetailSub">Recherche 3615</p></div><button class="modal-close" type="button" data-search-detail-close>×</button></header><div class="modal-body" id="universalSearchDetailBody"></div></section></div>`);
    m=$('#universalSearchDetailModal');m.addEventListener('pointerdown',e=>{if(e.target===m)window.BLEUS3000_APP?.closeModal?.('universalSearchDetailModal');});m.querySelector('[data-search-detail-close]')?.addEventListener('click',()=>window.BLEUS3000_APP?.closeModal?.('universalSearchDetailModal'));return m;
  }
  function showDetail(doc){
    const m=detailModal(),body=$('#universalSearchDetailBody',m);$('#universalSearchDetailTitle',m).textContent=doc.title;$('#universalSearchDetailSub',m).textContent=doc.type;
    const related=uniq(doc.extra?.matchIds||[]).slice(0,12);const playerIds=uniq(doc.extra?.playerIds||[]).slice(0,12);
    body.innerHTML=`<article class="universal-search-detail-card">${doc.image?`<img src="${esc(doc.image)}" alt="" loading="lazy">`:''}<div><strong>${esc(doc.title)}</strong>${doc.meta?`<p>${esc(doc.meta)}</p>`:''}</div></article>${related.length?`<section class="universal-search-detail-links"><h3>Matchs liés</h3>${related.map(id=>`<button type="button" data-search-detail-match="${esc(id)}">Ouvrir le match ↗</button>`).join('')}</section>`:''}${playerIds.length?`<section class="universal-search-detail-links"><h3>Joueurs liés</h3>${playerIds.map(id=>`<button type="button" data-search-detail-player="${esc(id)}">Ouvrir la fiche joueur ↗</button>`).join('')}</section>`:''}`;
    body.querySelectorAll('[data-search-detail-match]').forEach(b=>b.addEventListener('click',()=>{window.BLEUS3000_APP?.closeModal?.('universalSearchDetailModal');window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.searchDetailMatch,true);}));body.querySelectorAll('[data-search-detail-player]').forEach(b=>b.addEventListener('click',()=>{window.BLEUS3000_APP?.closeModal?.('universalSearchDetailModal');window.BLEUS3000_PLAYERS_DB?.openPlayer?.(b.dataset.searchDetailPlayer);}));window.BLEUS3000_APP?.openModal?.('universalSearchDetailModal');
  }
  function actionFor(doc){
    const e=doc.extra||{};
    if(doc.typeKey==='player')return()=>window.BLEUS3000_PLAYERS_DB?.openPlayer?.(e.playerId||doc.id);
    if(doc.typeKey==='match')return()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(e.matchId||doc.id,false);
    if(doc.typeKey==='goal')return()=>window.BLEUS3000_RELATIONAL_REFS?.openMatchGoal?.(e.matchId,e.goalId||doc.id);
    if(doc.typeKey==='gathering')return()=>window.BLEUS3000_GATHERINGS?.open?.(e.gatheringId||doc.id);
    if(doc.typeKey==='media')return()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(e.matchId,true);
    if(e.referenceKind)return()=>referenceTarget(e.referenceKind,doc.title,e.selector||'');
    return()=>showDetail(doc);
  }
  function iconFor(doc){return doc.icon||({player:'👤',match:'⚽',goal:'⚽',gathering:'📋',jersey:'👕',ball:'⚽',media:'🖼️'}[doc.typeKey]||'▦');}
  function preferLegacySmart(query){const n=expandQuery(query);return /\b(combien|plus jeune|plus vieux|plus age|plus grosse|dernier 0 0|premier match|derniere selection|derniere sélection|doubl|tripl|carton|avant \d|apres \d|après \d|entre \d|mi temps|clean sheet|sans encaisser|prolongation)\b/.test(n);}

  function bleuMoyenIntent(query){const n=expandQuery(query);return /\b(bleu moyen|bleu ordinaire|age moyen premiere selection|age moyen derniere selection)\b/.test(n);}
  function bleuMoyenSearchRow(query){
    const q=norm(query),blocked=new Set(['bleu','moyen','ordinaire','rapport','selection','selections','age','premiere','derniere','combien']);
    let best=null,bestLen=0;
    for(const d of docs){if(d.typeKey!=='player')continue;for(const t of norm(d.title).split(' ')){if(t.length<4||blocked.has(t))continue;if(q.includes(t)&&t.length>bestLen){best=d;bestLen=t.length;}}}
    if(best)return {type:'Comparaison',icon:'👤',image:best.image,title:`${best.title} · Bleu moyen`,meta:'Comparer cette carrière à la référence statistique 3615',score:-1,localIndex:true,action:()=>window.BLEUS3000_PLAYERS_DB?.openPlayer?.(best.id)};
    return {type:'Statistiques',icon:'👤',image:'',title:'LE BLEU MOYEN',meta:'Carrière statistique moyenne des internationaux France A',score:-1,localIndex:true,action:()=>window.BLEUS3000_BLEU_MOYEN?.open?.()};
  }

  async function search(query,{limit=100}={}){
    const parsed=queryTerms(query);if(!parsed.terms.length&&!parsed.special.length)return {handled:false,rows:[],interpretation:''};
    if(bleuMoyenIntent(query)){await ensure();searchStats.queries++;return {handled:true,rows:[bleuMoyenSearchRow(query)],interpretation:'Bleu moyen',parsed,preferLegacySmart:false};}
    await ensure();searchStats.queries++;
    const ranked=[];for(const d of docs){const s=scoreDoc(parsed,d);if(Number.isFinite(s)&&s<=.52)ranked.push({d,s});}
    ranked.sort((a,b)=>a.s-b.s||a.d.type.localeCompare(b.d.type,'fr')||a.d.title.localeCompare(b.d.title,'fr',{sensitivity:'base'}));
    const perType=new Map(),rows=[];for(const {d,s} of ranked){const n=perType.get(d.type)||0;if(n>=18)continue;perType.set(d.type,n+1);rows.push({type:d.type,icon:iconFor(d),image:d.image,title:d.title,meta:d.meta,score:s,localIndex:true,action:actionFor(d)});if(rows.length>=limit)break;}
    return {handled:rows.length>0,rows,interpretation:parsed.terms.join(' · '),parsed,preferLegacySmart:preferLegacySmart(query)};
  }

  function scheduleRebuild(delay=500){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>{ready=false;build({force:true}).catch(err=>console.warn('Index 3615 · reconstruction',err));},delay);}
  const relevant=new Set(['players','player_selection_stats','player_jersey_numbers','player_achievements','achievements','tags','entity_tags','matches','match_appearances','match_goal_events','match_card_events','match_officials','match_media_assets','match_jerseys','match_balls','match_broadcast_channels','competitions','competition_entities','competition_editions','opponents','places','personnel','callups','callup_players','callup_events','callup_matches','jerseys','kit_components','equipment_manufacturers','football_balls','books','bibliography_media','panini_albums','panini_stickers','broadcast_channels','homepage_news','homepage_news_broadcast_channels']);
  window.addEventListener('bleus:data-mutated',e=>{const t=e.detail?.tables||[];if(t.includes('*')||t.some(x=>relevant.has(x))){ready=false;docs=[];builtAt=0;clearPersisted().catch(()=>{});scheduleRebuild(650);}});
  window.addEventListener('bleus:force-refresh',()=>{ready=false;docs=[];builtAt=0;clearPersisted().catch(()=>{});scheduleRebuild(800);});

  async function boot(){
    const restored=await restore();
    // Aucun préchargement réseau imposé : un index déjà construit est disponible immédiatement.
    // Sur une première visite, la construction complète ne démarre qu'à la première recherche 3615.
    if(restored&&Date.now()-builtAt>INDEX_TTL)scheduleRebuild(2600);
  }
  window.BLEUS3000_SEARCH_INDEX={ensure,build,search,invalidate:()=>{ready=false;docs=[];builtAt=0;clearPersisted().catch(()=>{});},get size(){return docs.length;},get builtAt(){return builtAt;},stats:()=>({...searchStats,ready,builtAt,size:docs.length,version:INDEX_VERSION}),preferLegacySmart,bleuMoyenIntent};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
