/* Bleus 3000 V1.1.36 — TheSportsDB calendar synchronizer + tags globaux */
const SPORTSDB='https://www.thesportsdb.com/api/v2/json';

const BUILTIN_TEAM_IDS={
  'FRA-A-M':[133913],
  'FRA-ESP-M':[136843,143161], // U21 + U23 = Espoirs Bleus 3000
  'FRA-U20-M':[152249],
  'FRA-U19-M':[149863],
  'FRA-U17-M':[149609],
  'FRA-A-F':[136801],
  'FRA-U17-F':[153623]
};
const SEARCH_TERMS={
  'FRA-U18-M':['France U18'],
  'FRA-U16-M':['France U16'],
  'FRA-U23-F':['France U23 W','France Women U23','France U23 Women'],
  'FRA-U20-F':['France U20 W','France Women U20','France U20 Women'],
  'FRA-U19-F':['France U19 W','France Women U19','France U19 Women'],
  'FRA-U18-F':['France U18 W','France Women U18','France U18 Women'],
  'FRA-U16-F':['France U16 W','France Women U16','France U16 Women']
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const arr=v=>(Array.isArray(v)?v:[v]).map(Number).filter(Number.isFinite).filter(Boolean);
const unique=a=>[...new Set(a)];
const cleanText=v=>String(v??'').trim();
const toInt=v=>v===''||v==null||Number.isNaN(Number(v))?null:Number(v);
const slug=v=>encodeURIComponent(String(v||'').trim().toLowerCase().replace(/\s+/g,'_'));
const escFilter=v=>encodeURIComponent(String(v??''));

function sbHeaders(secret,extra={}){
  const h={'apikey':secret,'Content-Type':'application/json',...extra};
  if(!String(secret).startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;
  return h;
}
function extractObjects(data,preferred=[]){
  for(const key of preferred){if(Array.isArray(data?.[key]))return data[key];}
  if(Array.isArray(data))return data;
  if(data&&typeof data==='object'){
    for(const v of Object.values(data)){if(Array.isArray(v))return v;}
  }
  return [];
}
function findObjects(data,predicate,out=[]){
  if(Array.isArray(data)){for(const v of data)findObjects(v,predicate,out);return out;}
  if(data&&typeof data==='object'){if(predicate(data))out.push(data);for(const v of Object.values(data))findObjects(v,predicate,out);}
  return out;
}
function eventDate(e){
  let raw=cleanText(e?.strTimestamp||e?.strTimeStamp);
  if(raw){
    if(!/(Z|[+-]\d\d:?\d\d)$/i.test(raw))raw+='Z';
    const d=new Date(raw);if(!Number.isNaN(+d))return d.toISOString();
  }
  const date=cleanText(e?.dateEvent),time=cleanText(e?.strTime)||'00:00:00';
  if(date){const d=new Date(`${date}T${time}Z`);if(!Number.isNaN(+d))return d.toISOString();}
  return null;
}
function idsFromProvider(obj){return arr(obj?.thesportsdb||obj?.sportsdb||[]);}
function franceSide(e,teamIds){
  const home=Number(e?.idHomeTeam),away=Number(e?.idAwayTeam);
  if(teamIds.includes(home))return {home:true,franceId:home,oppId:away,oppName:e?.strAwayTeam};
  if(teamIds.includes(away))return {home:false,franceId:away,oppId:home,oppName:e?.strHomeTeam};
  return null;
}
function statusFrom(e,dateIso){
  const s=cleanText(e?.strStatus);
  if(s)return s;
  const d=dateIso?Date.parse(dateIso):NaN;
  if(Number.isFinite(d)&&d<Date.now()&&e?.intHomeScore!=null&&e?.intAwayScore!=null)return 'Match Finished';
  return 'Not Started';
}
function providerMapFromEnv(){
  const raw=process.env.BLEUS_SPORTSDB_TEAM_MAP||'';
  if(!raw)return {};
  try{return JSON.parse(raw)||{};}catch(e){throw new Error(`BLEUS_SPORTSDB_TEAM_MAP JSON invalide: ${e.message}`);}
}

exports.runCalendarSync=async()=>{
  const sportsKey=process.env.THESPORTSDB_KEY||process.env.SPORTSDB_KEY;
  const supabaseUrl=process.env.SUPABASE_URL;
  const supabaseSecret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  let envMap={};
  try{envMap=providerMapFromEnv();}catch(e){console.error('calendar-sync:',e.message);return {statusCode:200,body:JSON.stringify({ok:false,error:e.message})};}
  const config={event:'bleus3000-calendar-config',provider:'thesportsdb',THESPORTSDB_KEY:!!sportsKey,SUPABASE_URL:!!supabaseUrl,SUPABASE_SECRET_KEY:!!supabaseSecret,one_run_now:true};
  if(!sportsKey||!supabaseUrl||!supabaseSecret){console.log(JSON.stringify({...config,ok:false}));return {statusCode:200,body:JSON.stringify({ok:false,reason:'configuration incomplete',config})};}
  console.log(JSON.stringify({...config,ok:true}));

  const rest=`${supabaseUrl.replace(/\/$/,'')}/rest/v1`;
  async function sb(path,opts={}){
    const headers=sbHeaders(supabaseSecret,{Prefer:'return=representation',...(opts.headers||{})});
    const r=await fetch(rest+path,{...opts,headers});
    const t=await r.text();
    if(!r.ok)throw new Error(`Supabase ${r.status} ${path}: ${t}`);
    return t?JSON.parse(t):[];
  }
  async function sports(path){
    const r=await fetch(`${SPORTSDB}${path}`,{headers:{'X-API-KEY':sportsKey,accept:'application/json'}});
    const t=await r.text();let data={};
    try{data=t?JSON.parse(t):{};}catch{data={raw:t};}
    if(!r.ok)throw new Error(`TheSportsDB ${r.status} ${path}: ${t.slice(0,500)}`);
    return data;
  }
  async function inBatches(items,size,worker){
    const out=[];for(let i=0;i<items.length;i+=size){out.push(...await Promise.all(items.slice(i,i+size).map(worker)));if(i+size<items.length)await sleep(120);}return out;
  }

  let selections=[];
  try{selections=await sb('/selection_teams?active=eq.true&select=id,code,name,gender,category,provider_ids&order=sort_order.asc');}
  catch(e){console.error('calendar-sync selections',e.message);return {statusCode:200,body:JSON.stringify({ok:false,error:e.message})};}

  const providerBySelection=new Map();
  let discoveryRequests=0,discovered=0,discoveryErrors=0;
  for(const s of selections){
    let ids=unique([...arr(BUILTIN_TEAM_IDS[s.code]||[]),...idsFromProvider(s.provider_ids),...arr(envMap[s.code]||[])]);
    if(!ids.length&&SEARCH_TERMS[s.code]?.length){
      for(const term of SEARCH_TERMS[s.code]){
        try{
          discoveryRequests++;
          const data=await sports(`/search/team/${slug(term)}`);
          const candidates=findObjects(data,x=>x&&x.idTeam&&String(x.strSport||'Soccer').toLowerCase()==='soccer').filter(x=>{
            const name=norm(x.strTeam);const g=norm(x.strGender);
            return s.gender==='F'?(g.includes('female')||g.includes('women')||name.includes('women')||/\bw\b/.test(name)):(g?!(g.includes('female')||g.includes('women')):!name.includes('women'));
          });
          const want=norm(term);
          const exact=candidates.filter(x=>norm(x.strTeam)===want||norm(x.strTeamAlternate)===want);
          const cat=norm(String(s.category||'').split('/')[0]);
          const fuzzy=candidates.filter(x=>norm(x.strTeam).includes('france')&&(!cat||norm(x.strTeam).includes(cat)));
          const found=unique((exact.length?exact:fuzzy).map(x=>Number(x.idTeam)).filter(Boolean));
          if(found.length){ids=found;discovered+=found.length;break;}
        }catch(e){discoveryErrors++;console.error('calendar-sync discovery',s.code,term,e.message);}
      }
    }
    if(ids.length){
      providerBySelection.set(s.code,{selection:s,ids});
      const current={...(s.provider_ids||{}),thesportsdb:ids};
      try{await sb(`/selection_teams?id=eq.${s.id}`,{method:'PATCH',body:JSON.stringify({provider_ids:current,updated_at:new Date().toISOString()})});}catch(e){console.error('calendar-sync provider_ids',s.code,e.message);}
    }else console.warn('calendar-sync no TheSportsDB id',s.code);
  }

  const teamJobs=[];
  for(const [code,obj] of providerBySelection){for(const teamId of obj.ids)teamJobs.push({code,teamId,selection:obj.selection,allIds:obj.ids});}
  let apiRequests=discoveryRequests,apiErrors=discoveryErrors;
  const remote=await inBatches(teamJobs,8,async job=>{
    const result={job,next:[],previous:[]};
    try{apiRequests++;const d=await sports(`/schedule/next/team/${job.teamId}`);result.next=extractObjects(d,['schedule','events','event']);}catch(e){apiErrors++;console.error('calendar-sync next',job.code,job.teamId,e.message);}
    try{apiRequests++;const d=await sports(`/schedule/previous/team/${job.teamId}`);result.previous=extractObjects(d,['schedule','events','event']);}catch(e){apiErrors++;console.error('calendar-sync previous',job.code,job.teamId,e.message);}
    return result;
  });

  // Déduplique par sélection + idEvent. Les U21 et U23 restent tous les deux sous le tag ESPOIRS.
  const eventMap=new Map();
  for(const pack of remote){for(const [bucket,events] of [['next',pack.next],['previous',pack.previous]]){for(const e of events||[]){if(!e?.idEvent)continue;const key=`${pack.job.selection.id}:${e.idEvent}`;const prior=eventMap.get(key);if(!prior||bucket==='next')eventMap.set(key,{e,selection:pack.job.selection,teamIds:pack.job.allIds,bucket});}}}
  const eventRows=[...eventMap.values()].filter(({e,teamIds})=>franceSide(e,teamIds));

  // Charge les référentiels une seule fois pour éviter des dizaines d'allers-retours Supabase.
  const [opponents,competitions,places,providerMatches,recentMatches]=await Promise.all([
    sb('/opponents?select=id,name&limit=5000').catch(()=>[]),
    sb('/competitions?select=id,name,edition,external_ids,tag_id&limit=5000').catch(()=>[]),
    sb('/places?select=id,name,city,country&limit=5000').catch(()=>[]),
    sb('/matches?provider=eq.thesportsdb&select=id,provider_fixture_id,data_state,manual_overrides,selection_team_id,match_date,opponent_id&limit=5000').catch(()=>[]),
    sb('/matches?select=id,selection_team_id,match_date,opponent_id,provider,provider_fixture_id,data_state,manual_overrides&order=match_date.desc&limit=5000').catch(()=>[])
  ]);
  const oppMap=new Map(opponents.map(x=>[norm(x.name),x]));
  const compMap=new Map(competitions.map(x=>[norm(x.name),x]));
  const placeMap=new Map(places.map(x=>[`${norm(x.name)}|${norm(x.city)}`,x]));
  const placeNameMap=new Map(places.map(x=>[norm(x.name),x]));
  const providerMatchMap=new Map(providerMatches.map(x=>[String(x.provider_fixture_id),x]));

  async function createOne(table,payload){const rows=await sb(`/${table}`,{method:'POST',body:JSON.stringify(payload)});return rows[0]||null;}
  async function opponentFor(name,externalId){const key=norm(name||'Adversaire à confirmer');if(oppMap.has(key))return oppMap.get(key);const row=await createOne('opponents',{name:name||'Adversaire à confirmer'});if(row)oppMap.set(key,row);return row;}
  async function ensureCompetitionTag(comp){
    if(!comp)return comp;
    if(comp.tag_id)return comp;
    const tagSlug=`competition-${String(comp.id||'').replace(/-/g,'').slice(0,12)}`;
    let tag=null;
    try{
      const found=await sb(`/tags?slug=eq.${escFilter(tagSlug)}&select=id,slug&limit=1`);
      tag=found[0]||null;
      if(!tag){
        tag=await createOne('tags',{slug:tagSlug,kind:'tag',label_text:cleanText(comp.name).slice(0,40)||'Compétition',icon_text:'🏆',aliases:[cleanText(comp.name),cleanText(comp.edition)].filter(Boolean),appearance:'gradient',color_start:'#eef4fb',color_end:'#dce8f6',text_color:'#18304e',border_color:'#c5d4e6',gradient_angle:135,border_radius:16,border_width:1,created_by:null,is_active:true});
      }
      if(tag?.id){
        await sb(`/competitions?id=eq.${comp.id}`,{method:'PATCH',body:JSON.stringify({tag_id:tag.id,updated_at:new Date().toISOString()})});
        try{await createOne('tag_reference_links',{tag_id:tag.id,reference_type:'competition',reference_id:comp.id,relation_kind:'membership',created_by:null});}catch(err){if(!/duplicate key|23505/i.test(err.message))throw err;}
        comp.tag_id=tag.id;
      }
    }catch(err){console.warn('calendar-sync competition tag',comp.id,err.message);}
    return comp;
  }
  async function competitionFor(e,selection){
    const name=cleanText(e.strLeague)||'Match international',key=norm(name);
    if(compMap.has(key))return ensureCompetitionTag(compMap.get(key));
    const row=await createOne('competitions',{name,edition:cleanText(e.strSeason)||null,organizer:null,competition_type:null,gender:selection.gender,selection_category:selection.category,status:'active',external_ids:{thesportsdb_league_id:e.idLeague||null}});
    if(row){compMap.set(key,row);await ensureCompetitionTag(row);}
    return row;
  }
  async function placeFor(e){const name=cleanText(e.strVenue);if(!name)return null;const city=cleanText(e.strCity)||null,key=`${norm(name)}|${norm(city)}`;if(placeMap.has(key))return placeMap.get(key);if(placeNameMap.has(norm(name)))return placeNameMap.get(norm(name));const row=await createOne('places',{place_type:'stadium',name,city,country:cleanText(e.strCountry)||null});if(row){placeMap.set(key,row);placeNameMap.set(norm(name),row);}return row;}

  let imported=0,updated=0,attached=0,skippedLocked=0,skippedHistorical=0,preservedVerified=0,dbErrors=0;
  const nowIso=new Date().toISOString();
  const futureProviderEvents=[];
  const oppNameById=new Map(opponents.map(x=>[String(x.id),x.name]));
  const comparableTeamName=v=>norm(v).replace(/\bu ?\d{2}\b/g,'').replace(/\b(w|women|woman|female|feminin|feminine|espoirs?)\b/g,'').trim();
  const metadataOnly=(e,side)=>({
    provider:'thesportsdb',provider_fixture_id:String(e.idEvent),provider_updated_at:nowIso,
    source_calendar_url:`https://www.thesportsdb.com/team/${side.franceId}`,source_detail_url:`https://www.thesportsdb.com/event/${e.idEvent}`,
    api_payload:e,external_ids:{thesportsdb_event_id:String(e.idEvent),thesportsdb_team_id:String(side.franceId),thesportsdb_league_id:e.idLeague?String(e.idLeague):null}
  });
  function sameDayCandidate(selection,dateIso,oppName){
    const day=dateIso.slice(0,10);
    const candidates=recentMatches.filter(m=>String(m.selection_team_id)===String(selection.id)&&String(m.match_date||'').slice(0,10)===day);
    if(!candidates.length)return null;
    const wanted=comparableTeamName(oppName);
    const exact=candidates.find(m=>comparableTeamName(oppNameById.get(String(m.opponent_id))||'')===wanted);
    return exact||(candidates.length===1?candidates[0]:null);
  }

  for(const {e,selection,teamIds,bucket} of eventRows){
    try{
      const side=franceSide(e,teamIds);if(!side)continue;
      const dateIso=eventDate(e);if(!dateIso)continue;
      let existing=providerMatchMap.get(String(e.idEvent))||null;
      let attachedExisting=false;

      // Les résultats historiques déjà vérifiés dans Bleus 3000 restent prioritaires.
      // On peut leur rattacher l'id TheSportsDB, mais on n'écrase pas leurs données métier.
      if(!existing){
        const candidate=sameDayCandidate(selection,dateIso,side.oppName||'');
        if(candidate){
          if(candidate.data_state==='locked'){skippedLocked++;continue;}
          await sb(`/matches?id=eq.${candidate.id}`,{method:'PATCH',body:JSON.stringify(metadataOnly(e,side))});
          attached++;attachedExisting=true;existing={...candidate,provider:'thesportsdb',provider_fixture_id:String(e.idEvent)};
          providerMatchMap.set(String(e.idEvent),existing);
        }else if(bucket==='previous'){
          skippedHistorical++;
          continue;
        }
      }

      if(existing&&existing.data_state==='locked'){skippedLocked++;continue;}
      if(existing&&(existing.data_state==='verified'||attachedExisting)){
        // Les lignes historiques/éditoriales sont conservées telles quelles ; seul le lien fournisseur est ajouté.
        if(!attachedExisting)await sb(`/matches?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify(metadataOnly(e,side))});
        preservedVerified++;
        if(Date.parse(dateIso)>=Date.now()-6*60*60*1000)futureProviderEvents.push({id:String(e.idEvent),dateIso});
        continue;
      }

      // Les lignes créées par l'API peuvent être resynchronisées entièrement. Les éventuels
      // manual_overrides restent séparés et continuent de gagner à l'affichage.
      const opp=await opponentFor(side.oppName||'Adversaire à confirmer',side.oppId);
      const comp=await competitionFor(e,selection);
      const plc=await placeFor(e);
      const body={
        match_date:dateIso,gender:selection.gender,selection_category:selection.category,selection_team_id:selection.id,
        opponent_id:opp?.id||null,competition_id:comp?.id||null,place_id:plc?.id||null,home_away:side.home?'home':'away',
        france_score:side.home?toInt(e.intHomeScore):toInt(e.intAwayScore),opponent_score:side.home?toInt(e.intAwayScore):toInt(e.intHomeScore),
        status:statusFrom(e,dateIso),phase:cleanText(e.strGroup)|| (e.intRound!=null?`Tour ${e.intRound}`:null),spectators:toInt(e.intSpectators),
        ...metadataOnly(e,side)
      };
      if(existing){
        await sb(`/matches?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify(body)});updated++;
      }else{
        const rows=await sb('/matches',{method:'POST',body:JSON.stringify({...body,data_state:'api',manual_overrides:{}})});
        if(rows[0])providerMatchMap.set(String(e.idEvent),rows[0]);imported++;
      }
      if(Date.parse(dateIso)>=Date.now()-6*60*60*1000)futureProviderEvents.push({id:String(e.idEvent),dateIso});
    }catch(e2){dbErrors++;console.error('calendar-sync event',e?.idEvent,e2.message);}
  }

  // TV : enrichit progressivement les prochains matchs. Une correction manuelle reste prioritaire côté UI.
  const tvLimit=Math.max(0,Math.min(25,Number(process.env.SPORTSDB_TV_ENRICH_LIMIT||12)));
  const tvTargets=[...new Map(futureProviderEvents.sort((a,b)=>Date.parse(a.dateIso)-Date.parse(b.dateIso)).map(x=>[x.id,x])).values()].slice(0,tvLimit);
  let tvRequests=0,tvUpdated=0;
  await inBatches(tvTargets,6,async x=>{
    try{
      apiRequests++;tvRequests++;
      const data=await sports(`/lookup/event_tv/${x.id}`);const rows=extractObjects(data,['lookup','tv','events']);
      if(!rows.length)return null;
      const french=rows.filter(r=>/france|french|fr\b/i.test(cleanText(r.strCountry)));
      const use=(french.length?french:rows).map(r=>cleanText(r.strChannel)).filter(Boolean);
      const channels=unique(use).slice(0,4).join(' · ');if(!channels)return null;
      await sb(`/matches?provider=eq.thesportsdb&provider_fixture_id=eq.${escFilter(x.id)}`,{method:'PATCH',body:JSON.stringify({broadcast_text:channels,provider_updated_at:new Date().toISOString()})});tvUpdated++;
    }catch(e){apiErrors++;console.error('calendar-sync tv',x.id,e.message);}return null;
  });

  const missing=selections.filter(s=>!providerBySelection.has(s.code)).map(s=>s.code);
  const summary={event:'bleus3000-calendar-sync',provider:'thesportsdb',oneRunNow:true,selectionMappings:providerBySelection.size,teamIds:teamJobs.length,discovered,missing,apiRequests,apiErrors,eventsSeen:eventRows.length,imported,updated,attached,preservedVerified,skippedHistorical,skippedLocked,dbErrors,tvRequests,tvUpdated};
  console.log(JSON.stringify(summary));
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:apiErrors===0&&dbErrors===0,...summary})};
};
