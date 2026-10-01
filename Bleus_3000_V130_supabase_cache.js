/* 3615 Bleus V1.3 — cache-first Supabase : mémoire + IndexedDB + invalidation ciblée */
(()=>{
  'use strict';

  const nativeFetch=window.fetch.bind(window);
  const cfg=window.BLEUS3000_CONFIG||{};
  const base=String(cfg.SUPABASE_URL||'').replace(/\/+$/,'');
  const REST_PREFIX=base?`${base}/rest/v1/`:'';
  const CACHE_VERSION='1.3.18-cache-v1';
  const DB_NAME='bleus3000-data-cache';
  const DB_VERSION=1;
  const STORE='responses';
  const META_KEY='bleus3000.cache.meta.v1';
  const MEMORY_MAX=240;
  const PERSIST_MAX=260;
  const PERSIST_MAX_BYTES=28*1024*1024;
  const MAX_ITEM_BYTES=7*1024*1024;
  const DEFAULT_MEMORY_TTL=20*1000;
  const DAY=24*60*60*1000, HOUR=60*60*1000, MIN=60*1000;

  /* Les données liées à un compte ne sont jamais persistées dans IndexedDB. */
  const PRIVATE_TABLES=new Set([
    'profiles','user_preferences','reports','user_compositions','goal_ratings'
  ]);

  /* Référentiels publics : TTL adaptés à leur volatilité réelle. */
  const TTL_BY_TABLE={
    players:24*HOUR,
    player_selection_stats:6*HOUR,
    player_jersey_numbers:6*HOUR,
    player_achievements:12*HOUR,
    selection_teams:24*HOUR,
    tags:24*HOUR,
    tag_reference_links:24*HOUR,
    entity_tags:12*HOUR,
    achievements:24*HOUR,
    achievement_reference_scopes:24*HOUR,
    competitions:24*HOUR,
    competition_entities:24*HOUR,
    competition_editions:24*HOUR,
    competition_entity_tags:24*HOUR,
    competition_edition_tags:24*HOUR,
    competition_families:24*HOUR,
    competition_family_entities:24*HOUR,
    competition_patches:24*HOUR,
    competition_patch_tags:24*HOUR,
    opponents:24*HOUR,
    places:24*HOUR,
    personnel:24*HOUR,
    football_positions:24*HOUR,
    equipment_manufacturers:24*HOUR,
    jerseys:12*HOUR,
    jersey_selection_teams:12*HOUR,
    jersey_competitions:12*HOUR,
    jersey_competition_editions:12*HOUR,
    jersey_photos:12*HOUR,
    jersey_kit_components:12*HOUR,
    jersey_variants:12*HOUR,
    jersey_opponents:12*HOUR,
    jersey_patches:12*HOUR,
    kit_components:12*HOUR,
    football_balls:12*HOUR,
    books:24*HOUR,
    panini_albums:24*HOUR,
    panini_stickers:24*HOUR,
    fifa_rankings:24*HOUR,
    broadcast_channels:6*HOUR,
    entity_sources:12*HOUR,
    entity_contributors:30*MIN,

    /* Données de match : plus courtes, mais immédiatement invalidées lors d'une édition locale. */
    matches:15*MIN,
    match_appearances:30*MIN,
    match_goal_events:15*MIN,
    match_card_events:30*MIN,
    match_officials:2*HOUR,
    match_media_assets:30*MIN,
    match_jerseys:30*MIN,
    match_jersey_patches:30*MIN,
    match_balls:30*MIN,
    match_broadcast_channels:15*MIN,

    /* Rassemblements actifs : données les plus susceptibles d'évoluer. */
    callups:3*MIN,
    callup_players:3*MIN,
    callup_matches:3*MIN,
    callup_events:3*MIN,
    callup_announced_players:5*MIN,
    callup_roster_history:5*MIN,
    callup_competition_editions:5*MIN,
    callup_broadcast_channels:5*MIN,
    homepage_news:10*MIN,
    homepage_news_broadcast_channels:10*MIN
  };

  const READ_ONLY_RPC=new Set(['get_bleu_moyen_stats','get_bleu_moyen_player_comparison','bleu_moyen_player_metrics','bleu_moyen_stats_version','get_staff_best_xi_data']);
  const RPC_INVALIDATIONS={
    save_match_sheet:['matches','personnel','match_appearances','match_goal_events','match_card_events','match_officials','match_jerseys','match_balls','players','player_selection_stats','player_jersey_numbers','player_achievements'],
    adjust_selection_stat:['player_selection_stats'],
    record_selection_contribution:['entity_contributors','player_selection_stats']
  };

  const RELATED={
    players:['player_selection_stats','player_jersey_numbers','player_achievements','match_appearances','match_goal_events','callup_players','callup_announced_players','callup_roster_history'],
    player_selection_stats:['players'],
    player_jersey_numbers:['players'],
    player_achievements:['players'],
    matches:['match_appearances','match_goal_events','match_card_events','match_officials','match_media_assets','match_jerseys','match_jersey_patches','match_balls','match_broadcast_channels','callup_matches','personnel'],
    match_appearances:['matches','players','player_selection_stats','player_jersey_numbers','player_achievements'],
    match_goal_events:['matches','players','player_selection_stats'],
    match_card_events:['matches'],
    match_officials:['matches','personnel'],
    match_media_assets:['matches'],
    match_jerseys:['matches','jerseys','jersey_variants','jersey_kit_components'],
    match_balls:['matches','football_balls'],
    match_broadcast_channels:['matches','broadcast_channels'],
    tags:['entity_tags','tag_reference_links','competition_entity_tags','competition_edition_tags','competition_patch_tags'],
    entity_tags:['tags','players'],
    tag_reference_links:['tags','selection_teams'],
    competitions:['competition_entities','competition_editions','matches'],
    competition_entities:['competitions','competition_editions','competition_entity_tags','competition_family_entities'],
    competition_editions:['competitions','competition_entities','competition_edition_tags','jersey_competition_editions','callup_competition_editions'],
    opponents:['matches','jersey_opponents'],
    places:['matches'],
    personnel:['matches','match_officials','callups'],
    callups:['callup_players','callup_matches','callup_events','callup_announced_players','callup_roster_history','callup_competition_editions','callup_broadcast_channels'],
    callup_players:['callups','callup_announced_players','callup_roster_history'],
    callup_matches:['callups','matches'],
    callup_events:['callups','callup_roster_history'],
    callup_announced_players:['callups','callup_players'],
    callup_roster_history:['callups','callup_players'],
    callup_competition_editions:['callups','competition_editions'],
    callup_broadcast_channels:['callups','broadcast_channels'],
    homepage_news:['homepage_news_broadcast_channels','broadcast_channels'],
    homepage_news_broadcast_channels:['homepage_news','broadcast_channels'],
    jerseys:['jersey_selection_teams','jersey_competitions','jersey_competition_editions','jersey_photos','jersey_kit_components','jersey_variants','jersey_opponents','jersey_patches','match_jerseys'],
    jersey_selection_teams:['jerseys'],jersey_competitions:['jerseys'],jersey_competition_editions:['jerseys'],jersey_photos:['jerseys'],jersey_kit_components:['jerseys'],jersey_variants:['jerseys','match_jerseys'],jersey_opponents:['jerseys'],jersey_patches:['jerseys','match_jersey_patches'],
    kit_components:['jerseys','jersey_kit_components','match_jerseys'],
    football_balls:['match_balls'],
    broadcast_channels:['match_broadcast_channels','callup_broadcast_channels']
  };

  const memory=new Map();
  const inflight=new Map();
  const stats={network:0,memoryHits:0,persistentHits:0,staleHits:0,deduped:0,writes:0,invalidations:0,persisted:0,persistErrors:0};
  let dbPromise=null,persistDisabled=false,cleanupScheduled=false;
  let channel=null;try{if('BroadcastChannel' in window)channel=new BroadcastChannel('bleus3000-cache-v1');}catch{}

  const headerValue=(headers,name)=>{
    try{
      const needle=String(name||'').toLowerCase();
      if(headers instanceof Headers)return headers.get(name)||'';
      if(Array.isArray(headers)){const row=headers.find(x=>String(x?.[0]||'').toLowerCase()===needle);return row?.[1]||'';}
      const obj=headers||{},key=Object.keys(obj).find(k=>k.toLowerCase()===needle);return key?obj[key]:'';
    }catch{return '';}
  };
  const requestMeta=(input,init={})=>{
    const req=input instanceof Request?input:null;
    return {url:String(req?.url||input||''),method:String(init.method||req?.method||'GET').toUpperCase(),headers:init.headers||req?.headers||{}};
  };
  const restName=meta=>{
    if(!REST_PREFIX||!meta.url.startsWith(REST_PREFIX))return '';
    return decodeURIComponent(meta.url.slice(REST_PREFIX.length).split(/[?#]/,1)[0]||'');
  };
  const tableName=meta=>{const n=restName(meta);return n.startsWith('rpc/')?'':n;};
  const rpcName=meta=>{const n=restName(meta);return n.startsWith('rpc/')?n.slice(4):'';};
  const isRest=meta=>!!REST_PREFIX&&meta.url.startsWith(REST_PREFIX);
  const isReadOnlyRpc=meta=>meta.method==='POST'&&READ_ONLY_RPC.has(rpcName(meta));
  const isCacheableRead=meta=>isRest(meta)&&meta.method==='GET'&&!!tableName(meta);
  const isPersistentTable=t=>!!t&&!PRIVATE_TABLES.has(t)&&Object.prototype.hasOwnProperty.call(TTL_BY_TABLE,t);

  const jwtSubject=auth=>{
    try{
      const token=String(auth||'').replace(/^Bearer\s+/i,'');
      const part=token.split('.')[1];if(!part)return '';
      const padded=(part.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((part.length+3)%4));
      const json=JSON.parse(atob(padded));return String(json.sub||'');
    }catch{return '';}
  };
  const stableScopeHash=value=>{
    let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);
  };
  // Cache entries are scoped per signed-in identity even for public reference tables.
  // This preserves RLS semantics and prevents one browser account from reusing another account's cached response.
  const scopeFor=(meta)=>{const sub=jwtSubject(headerValue(meta.headers,'authorization'));return sub?`user:${stableScopeHash(sub)}`:'anon';};
  const keyFor=(meta,table)=>{
    const vary=['range','range-unit','accept-profile','content-profile','prefer','accept'].map(k=>`${k}:${String(headerValue(meta.headers,k)||'')}`).join('\n');
    return `${CACHE_VERSION}\n${scopeFor(meta,table)}\n${meta.method} ${meta.url}\n${vary}`;
  };
  const ttlFor=(table,url)=>{
    let ttl=TTL_BY_TABLE[table]||DEFAULT_MEMORY_TTL;
    if(table==='matches'){
      try{
        const q=new URL(url).searchParams;
        const vals=q.getAll('match_date').join(' ');
        const years=[...vals.matchAll(/(19|20)\d{2}/g)].map(x=>Number(x[0]));
        if(years.length&&Math.max(...years)<=new Date().getFullYear()-2)ttl=14*DAY;
      }catch{}
    }
    return ttl;
  };
  const snapshot=async(response,meta,table,key,ttl)=>{
    const body=await response.arrayBuffer();
    const now=Date.now();
    return {key,table,url:meta.url,body,status:response.status,statusText:response.statusText,headers:[...response.headers.entries()],at:now,expiresAt:now+ttl,bytes:body.byteLength||0,version:CACHE_VERSION};
  };
  const restore=s=>new Response(s.body.slice(0),{status:s.status,statusText:s.statusText,headers:s.headers});
  const touchMemory=(key,s)=>{memory.delete(key);memory.set(key,s);while(memory.size>MEMORY_MAX)memory.delete(memory.keys().next().value);};

  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'null')||{};}catch{return {};}}
  function writeMeta(patch={}){try{localStorage.setItem(META_KEY,JSON.stringify({...readMeta(),version:CACHE_VERSION,...patch}));}catch{}}

  function openDb(){
    if(persistDisabled||!('indexedDB' in window))return Promise.resolve(null);
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      try{
        const req=indexedDB.open(DB_NAME,DB_VERSION);
        req.onupgradeneeded=()=>{const db=req.result;if(db.objectStoreNames.contains(STORE))db.deleteObjectStore(STORE);const s=db.createObjectStore(STORE,{keyPath:'key'});s.createIndex('table','table',{unique:false});s.createIndex('expiresAt','expiresAt',{unique:false});s.createIndex('at','at',{unique:false});};
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>{persistDisabled=true;stats.persistErrors++;resolve(null);};
        req.onblocked=()=>resolve(null);
      }catch{persistDisabled=true;stats.persistErrors++;resolve(null);}
    });
    return dbPromise;
  }
  async function idbGet(key){
    const db=await openDb();if(!db)return null;
    return new Promise(resolve=>{try{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);}catch{resolve(null);}});
  }
  async function idbPut(row){
    if(!row||row.bytes>MAX_ITEM_BYTES)return;
    const db=await openDb();if(!db)return;
    await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(row);tx.oncomplete=()=>{stats.persisted++;resolve();};tx.onerror=()=>{stats.persistErrors++;resolve();};tx.onabort=()=>{stats.persistErrors++;resolve();};}catch{stats.persistErrors++;resolve();}});
    scheduleCleanup();
  }
  async function idbDeleteKey(key){const db=await openDb();if(!db)return;await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve();}});}
  async function idbClearAll(){const db=await openDb();if(!db)return;await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve();}});}
  async function idbClearTables(tables){
    const db=await openDb();if(!db||!tables?.size)return;
    await new Promise(resolve=>{
      try{
        const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),idx=store.index('table');
        for(const table of tables){const r=idx.openCursor(IDBKeyRange.only(table));r.onsuccess=()=>{const c=r.result;if(c){c.delete();c.continue();}};}
        tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
      }catch{resolve();}
    });
  }
  async function cleanup(){
    cleanupScheduled=false;const db=await openDb();if(!db)return;
    const rows=await new Promise(resolve=>{try{const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>resolve([]);}catch{resolve([]);}});
    const now=Date.now();let total=0;const keep=[];for(const r of rows){if(r.version!==CACHE_VERSION||r.expiresAt<now-7*DAY)continue;total+=Number(r.bytes||0);keep.push(r);}
    const remove=new Set(rows.filter(r=>r.version!==CACHE_VERSION||r.expiresAt<now-7*DAY).map(r=>r.key));
    keep.sort((a,b)=>b.at-a.at);
    for(let i=PERSIST_MAX;i<keep.length;i++)remove.add(keep[i].key);
    if(total>PERSIST_MAX_BYTES){let bytes=total;for(let i=keep.length-1;i>=0&&bytes>PERSIST_MAX_BYTES;i--){if(remove.has(keep[i].key))continue;remove.add(keep[i].key);bytes-=Number(keep[i].bytes||0);}}
    if(remove.size){await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);remove.forEach(k=>s.delete(k));tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve();}});}
    writeMeta({lastCleanup:Date.now(),entries:Math.max(0,rows.length-remove.size)});
  }
  function scheduleCleanup(){if(cleanupScheduled)return;cleanupScheduled=true;const run=()=>cleanup().catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:2500});else setTimeout(run,1200);}

  const expandTables=tables=>{
    const out=new Set((tables||[]).filter(Boolean));
    for(const t of [...out])for(const x of RELATED[t]||[])out.add(x);
    return out;
  };
  async function invalidateTables(tables,{broadcast=true,reason='write'}={}){
    const expanded=expandTables(tables);
    if(!expanded.size)return;
    for(const [k,v] of memory)if(expanded.has(v.table))memory.delete(k);
    await idbClearTables(expanded);
    stats.invalidations++;
    writeMeta({lastInvalidation:Date.now(),lastInvalidationTables:[...expanded].slice(0,40)});
    if(broadcast)try{channel?.postMessage({type:'invalidate',tables:[...expanded],at:Date.now()});}catch{}
    window.dispatchEvent(new CustomEvent('bleus:data-mutated',{detail:{tables:[...expanded],reason}}));
  }
  async function clearAll({broadcast=true,reason='manual'}={}){
    memory.clear();inflight.clear();await idbClearAll();stats.invalidations++;
    writeMeta({lastInvalidation:Date.now(),lastInvalidationTables:['*']});
    if(broadcast)try{channel?.postMessage({type:'clear',at:Date.now()});}catch{}
    window.dispatchEvent(new CustomEvent('bleus:data-mutated',{detail:{tables:['*'],reason}}));
  }

  async function fetchOptimized(input,init={}){
    const meta=requestMeta(input,init);
    if(!isRest(meta)){stats.network++;return nativeFetch(input,init);}

    if(meta.method!=='GET'){
      stats.network++;
      const response=await nativeFetch(input,init);
      if(response.ok&&!isReadOnlyRpc(meta)){
        stats.writes++;
        const table=tableName(meta),rpc=rpcName(meta);
        if(table)await invalidateTables([table],{reason:'rest-write'});
        else if(rpc&&RPC_INVALIDATIONS[rpc])await invalidateTables(RPC_INVALIDATIONS[rpc],{reason:`rpc:${rpc}`});
        else if(rpc)await clearAll({reason:`rpc:${rpc}`});
      }
      return response;
    }

    if(!isCacheableRead(meta)){stats.network++;return nativeFetch(input,init);}
    const table=tableName(meta),ttl=isPersistentTable(table)?ttlFor(table,meta.url):DEFAULT_MEMORY_TTL,key=keyFor(meta,table),now=Date.now();
    const mem=memory.get(key);
    if(mem&&mem.expiresAt>now){stats.memoryHits++;touchMemory(key,mem);return restore(mem);}
    if(mem&&mem.expiresAt<=now)memory.delete(key);

    let stale=null;
    if(isPersistentTable(table)){
      const persisted=await idbGet(key);
      if(persisted?.version===CACHE_VERSION){
        if(persisted.expiresAt>now){stats.persistentHits++;touchMemory(key,persisted);return restore(persisted);}
        stale=persisted;
      }else if(persisted)idbDeleteKey(key).catch(()=>{});
    }

    const pending=inflight.get(key);
    if(pending){stats.deduped++;return restore(await pending);}

    const task=(async()=>{
      try{
        stats.network++;
        const response=await nativeFetch(input,init);
        const snap=await snapshot(response,meta,table,key,ttl);
        if(response.ok){touchMemory(key,snap);if(isPersistentTable(table))idbPut(snap).catch(()=>{});}
        return snap;
      }catch(err){
        if(stale){stats.staleHits++;touchMemory(key,stale);return stale;}
        throw err;
      }
    })().finally(()=>inflight.delete(key));
    inflight.set(key,task);
    return restore(await task);
  }

  async function forceRefresh(tables=null){
    if(Array.isArray(tables)&&tables.length)await invalidateTables(tables,{reason:'admin-force'});else await clearAll({reason:'admin-force'});
    window.dispatchEvent(new CustomEvent('bleus:force-refresh',{detail:{tables:Array.isArray(tables)?tables:['*']}}));
  }
  const statsSnapshot=()=>({...stats,memoryEntries:memory.size,inflight:inflight.size,version:CACHE_VERSION,persistence:!persistDisabled&&('indexedDB' in window),meta:readMeta()});

  channel?.addEventListener('message',e=>{const d=e.data||{};if(d.type==='invalidate'&&Array.isArray(d.tables))invalidateTables(d.tables,{broadcast:false,reason:'cross-tab'}).catch(()=>{});else if(d.type==='clear')clearAll({broadcast:false,reason:'cross-tab'}).catch(()=>{});});

  // Un autre onglet peut modifier les données pendant que celui-ci conserve encore ses stores JS en mémoire.
  // On invalide uniquement les stores concernés, sans déclencher de lecture réseau immédiate.
  window.addEventListener('bleus:data-mutated',e=>{
    if(e?.detail?.reason!=='cross-tab')return;
    const tables=new Set(e.detail.tables||[]),all=tables.has('*'),has=(...names)=>all||names.some(x=>tables.has(x));
    if(has('players','matches','match_appearances','match_goal_events','match_card_events','opponents','competitions','competition_entities','competition_editions','places','personnel','match_officials')){
      window.BLEUS3000_RELATIONAL_REFS?.invalidate?.();
      window.BLEUS3000_SMART_SEARCH?.invalidate?.();
      window.BLEUS3000_STATISTICS?.invalidate?.();
    }
    if(has('players','player_selection_stats','player_jersey_numbers','player_achievements','selection_teams','achievements','achievement_reference_scopes'))window.BLEUS3000_SELECTIONS?.invalidate?.();
    if(has('jerseys','jersey_selection_teams','jersey_competitions','jersey_competition_editions','jersey_photos','jersey_kit_components','jersey_variants','jersey_opponents','jersey_patches','kit_components','match_jerseys','match_jersey_patches'))window.BLEUS3000_JERSEYS?.invalidate?.();
    if(has('football_balls','match_balls','equipment_manufacturers'))window.BLEUS3000_BALLS?.invalidate?.();
    if(has('callups','callup_players','callup_matches','callup_events','callup_announced_players','callup_roster_history','callup_competition_editions','callup_broadcast_channels')){window.BLEUS3000_GATHERINGS?.invalidate?.();window.BLEUS3000_GATHERINGS_ENRICHED?.invalidate?.();}
    if(has('homepage_news','homepage_news_broadcast_channels','broadcast_channels'))window.BLEUS3000_HOME_NEWS?.refresh?.();
    const collectionKinds=[];if(has('books'))collectionKinds.push('books');if(has('match_goal_events','goal_ratings'))collectionKinds.push('goals');if(has('panini_albums','panini_stickers'))collectionKinds.push('panini');if(all||collectionKinds.length)window.BLEUS3000_COLLECTIONS?.invalidate?.(all?'all':collectionKinds);
  });

  const meta=readMeta();
  if(meta.version&&meta.version!==CACHE_VERSION)idbClearAll().catch(()=>{});
  writeMeta({initializedAt:Date.now()});
  scheduleCleanup();

  window.BLEUS3000_SUPABASE_FETCH=fetchOptimized;
  window.BLEUS3000_DATA_CACHE={
    version:CACHE_VERSION,fetch:fetchOptimized,stats:statsSnapshot,clear:clearAll,invalidateTables,forceRefresh,
    ttlForTable:t=>TTL_BY_TABLE[t]||DEFAULT_MEMORY_TTL,isPersistentTable
  };
  window.BLEUS3000_SUPABASE_TRANSPORT=window.BLEUS3000_DATA_CACHE;
})();
