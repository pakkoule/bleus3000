/* 3615 Bleus V1.1.45 — pilote historique TheSportsDB : Espoirs U21 + Olympique U23
   - lecture non destructive des saisons TheSportsDB
   - rattache les événements aux matchs déjà présents dans Supabase
   - complète uniquement les champs vides (score / stade / phase)
   - n'importe PAS les événements distants sans correspondance locale
   - audite la disponibilité lineups / timeline / stats / TV / highlights sur un petit échantillon
*/
const SPORTSDB='https://www.thesportsdb.com/api/v2/json';
const TEAM_IDS=[136843,143161]; // même référentiel FRA-ESP-M ; France U23 aux JO reçoit le tag OLYMPIQUE U23
const LEAGUE_SEARCH_TERMS=[
  'UEFA European Under-21 Championship',
  'International Friendlies'
];

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const arr=v=>(Array.isArray(v)?v:[v]).filter(Boolean);
const unique=a=>[...new Set(a)];
const toInt=v=>(v==null||v===''||Number.isNaN(Number(v)))?null:Number(v);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>encodeURIComponent(String(v??''));
const slug=v=>encodeURIComponent(clean(v).toLowerCase().replace(/\s+/g,'_'));
const countryOnlyName=v=>clean(v)
  .replace(/\s+(Women\s+)?U(16|17|18|19|20|21|23)$/i,'')
  .replace(/\s+(Women|Woman|Female|Féminine|Feminine|Espoirs)$/i,'')
  .trim();

function sbHeaders(secret,extra={}){
  const h={'apikey':secret,'Content-Type':'application/json',...extra};
  if(!String(secret).startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;
  return h;
}
function extractObjects(data,preferred=[]){
  for(const key of preferred){if(Array.isArray(data?.[key]))return data[key];}
  if(Array.isArray(data))return data;
  if(data&&typeof data==='object')for(const value of Object.values(data))if(Array.isArray(value))return value;
  return [];
}
function findObjects(data,predicate,out=[]){
  if(Array.isArray(data)){for(const value of data)findObjects(value,predicate,out);return out;}
  if(data&&typeof data==='object'){
    if(predicate(data))out.push(data);
    for(const value of Object.values(data))findObjects(value,predicate,out);
  }
  return out;
}
function eventDateCandidates(e){
  const out=[];
  for(const raw of [e?.dateEventLocal,e?.dateEvent]){
    const s=clean(raw);if(/^\d{4}-\d{2}-\d{2}$/.test(s))out.push(s);
  }
  let ts=clean(e?.strTimestamp||e?.strTimeStamp);
  if(ts){if(!/(Z|[+-]\d\d:?\d\d)$/i.test(ts))ts+='Z';const d=new Date(ts);if(!Number.isNaN(+d))out.push(d.toISOString().slice(0,10));}
  return unique(out);
}
function remoteSide(e){
  const home=Number(e?.idHomeTeam),away=Number(e?.idAwayTeam);
  if(TEAM_IDS.includes(home))return {home:true,franceId:home,oppId:away,oppName:e?.strAwayTeam};
  if(TEAM_IDS.includes(away))return {home:false,franceId:away,oppId:home,oppName:e?.strHomeTeam};
  return null;
}
function isOlympicU23Event(e){const side=remoteSide(e);return Number(side?.franceId)===143161&&norm(e?.strLeague).includes('olympic');}
function seasonStart(v){const m=String(v||'').match(/(19|20)\d{2}/);return m?Number(m[0]):null;}
function dateDistanceDays(a,b){
  const x=Date.parse(`${a}T12:00:00Z`),y=Date.parse(`${b}T12:00:00Z`);
  return Number.isFinite(x)&&Number.isFinite(y)?Math.round(Math.abs(x-y)/86400000):999;
}

exports.handler=async()=>{
  const sportsKey=process.env.THESPORTSDB_KEY||process.env.SPORTSDB_KEY;
  const supabaseUrl=process.env.SUPABASE_URL;
  const supabaseSecret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fromYear=Math.max(1900,Number(process.env.ESPOIRS_HISTORY_FROM_YEAR||2004));
  const detailLimit=Math.max(0,Math.min(12,Number(process.env.ESPOIRS_HISTORY_DETAIL_LIMIT||6)));
  const config={event:'3615bleus-history-espoirs-config',provider:'thesportsdb',THESPORTSDB_KEY:!!sportsKey,SUPABASE_URL:!!supabaseUrl,SUPABASE_SECRET_KEY:!!supabaseSecret,fromYear,detailLimit,mode:'safe-link-enrich'};
  if(!sportsKey||!supabaseUrl||!supabaseSecret){console.log(JSON.stringify({...config,ok:false}));return {statusCode:200,body:JSON.stringify({ok:false,...config})};}
  console.log(JSON.stringify({...config,ok:true}));

  const rest=`${supabaseUrl.replace(/\/$/,'')}/rest/v1`;
  async function sb(path,opts={}){
    const headers=sbHeaders(supabaseSecret,{Prefer:'return=representation',...(opts.headers||{})});
    const r=await fetch(rest+path,{...opts,headers});
    const t=await r.text();
    if(!r.ok)throw new Error(`Supabase ${r.status} ${path}: ${t}`);
    return t?JSON.parse(t):[];
  }
  let apiRequests=0,apiErrors=0;
  async function sports(path){
    apiRequests++;
    const r=await fetch(`${SPORTSDB}${path}`,{headers:{'X-API-KEY':sportsKey,accept:'application/json'}});
    const t=await r.text();let data={};
    try{data=t?JSON.parse(t):{};}catch{data={raw:t};}
    if(!r.ok){apiErrors++;throw new Error(`TheSportsDB ${r.status} ${path}: ${t.slice(0,350)}`);}
    return data;
  }
  async function batches(items,size,worker,pause=180){
    const out=[];
    for(let i=0;i<items.length;i+=size){
      out.push(...await Promise.all(items.slice(i,i+size).map(worker)));
      if(i+size<items.length)await sleep(pause);
    }
    return out;
  }

  const selection=(await sb('/selection_teams?code=eq.FRA-ESP-M&select=id,code,name,provider_ids&limit=1'))[0];
  if(!selection)return {statusCode:200,body:JSON.stringify({ok:false,error:'FRA-ESP-M introuvable'})};
  const olympicTag=(await sb('/tags?slug=eq.olympique-u23&select=id,slug,label_text&limit=1').catch(()=>[]))[0]||null;
  const local=await sb(`/matches?selection_team_id=eq.${selection.id}&select=id,match_date,opponent_id,competition_id,place_id,france_score,opponent_score,status,phase,data_state,provider,provider_fixture_id,external_ids,api_payload,manual_overrides&order=match_date.asc&limit=5000`);
  const opponents=await sb('/opponents?select=id,name&limit=5000');
  const places=await sb('/places?select=id,name,city,country&limit=5000');
  const oppById=new Map(opponents.map(x=>[String(x.id),x]));
  const oppByName=new Map(opponents.map(x=>[norm(x.name),x]));
  const placeByName=new Map(places.map(x=>[norm(x.name),x]));

  const leagueIds=new Set();
  const seedEvents=[];

  // 1) Le calendrier complet de chaque Team ID permet de découvrir les compétitions actuellement reliées à l'équipe.
  for(const teamId of TEAM_IDS){
    for(const path of [`/schedule/full/team/${teamId}`,`/schedule/previous/team/${teamId}`]){
      try{
        const data=await sports(path);
        const rows=extractObjects(data,['schedule','events','event']);
        seedEvents.push(...rows);
        for(const e of rows)if(e?.idLeague)leagueIds.add(String(e.idLeague));
      }catch(err){console.warn('history-espoirs seed',teamId,path,err.message);}
    }
  }

  // 2) Ajoute les compétitions génériques utiles (amical + U21) sans dépendre d'un ID codé en dur.
  for(const term of LEAGUE_SEARCH_TERMS){
    try{
      const data=await sports(`/search/league/${slug(term)}`);
      const rows=findObjects(data,x=>x&&x.idLeague&&(!x.strSport||norm(x.strSport)==='soccer'));
      const wanted=norm(term);
      const scored=rows.map(x=>({x,score:(norm(x.strLeague)===wanted?0:(norm(x.strLeague).includes(wanted)||wanted.includes(norm(x.strLeague))?1:2))})).sort((a,b)=>a.score-b.score);
      for(const item of scored.slice(0,2))if(item.x.idLeague)leagueIds.add(String(item.x.idLeague));
    }catch(err){console.warn('history-espoirs league search',term,err.message);}
  }

  // 3) Récupère les saisons disponibles pour chaque compétition puis les calendriers complets.
  const seasonJobs=[];
  for(const leagueId of [...leagueIds].slice(0,6)){
    try{
      const data=await sports(`/list/seasons/${leagueId}`);
      const rows=findObjects(data,x=>x&&x.strSeason);
      const seasons=unique(rows.map(x=>clean(x.strSeason)).filter(Boolean))
        .filter(s=>{const y=seasonStart(s);return y==null||y>=fromYear;})
        .sort((a,b)=>(seasonStart(a)||9999)-(seasonStart(b)||9999));
      for(const season of seasons.slice(-30))seasonJobs.push({leagueId,season});
    }catch(err){console.warn('history-espoirs seasons',leagueId,err.message);}
  }

  // Pour le pilote, plafond dur afin de rester confortable sous 100 req/min et sous le timeout Netlify.
  const cappedJobs=seasonJobs.slice(-48);
  const seasonPacks=await batches(cappedJobs,8,async job=>{
    try{
      const data=await sports(`/schedule/league/${job.leagueId}/${encodeURIComponent(job.season)}`);
      return {job,events:extractObjects(data,['schedule','events','event'])};
    }catch(err){console.warn('history-espoirs season schedule',job.leagueId,job.season,err.message);return {job,events:[]};}
  },220);

  const remoteMap=new Map();
  for(const e of seedEvents){if(e?.idEvent&&remoteSide(e))remoteMap.set(String(e.idEvent),e);}
  for(const pack of seasonPacks){for(const e of pack.events){if(e?.idEvent&&remoteSide(e))remoteMap.set(String(e.idEvent),e);}}
  const remote=[...remoteMap.values()].filter(e=>eventDateCandidates(e).some(d=>Number(d.slice(0,4))>=fromYear));

  const localByDay=new Map();
  for(const m of local){const day=String(m.match_date||'').slice(0,10);if(!localByDay.has(day))localByDay.set(day,[]);localByDay.get(day).push(m);}
  function matchLocal(e){
    const side=remoteSide(e);if(!side)return null;
    const wanted=norm(countryOnlyName(side.oppName));
    const dates=eventDateCandidates(e);
    for(const day of dates){
      const rows=localByDay.get(day)||[];
      const exact=rows.find(m=>norm(oppById.get(String(m.opponent_id))?.name||'')===wanted);
      if(exact)return exact;
      if(rows.length===1&&!wanted)return rows[0];
    }
    // Tolérance ±1 jour uniquement si l'adversaire est identique (cas de timezone / date locale).
    for(const day of dates){
      for(const [localDay,rows] of localByDay){
        if(dateDistanceDays(day,localDay)!==1)continue;
        const exact=rows.find(m=>norm(oppById.get(String(m.opponent_id))?.name||'')===wanted);
        if(exact)return exact;
      }
    }
    return null;
  }
  async function ensurePlace(name,country){
    const key=norm(name);if(!key)return null;
    if(placeByName.has(key))return placeByName.get(key);
    const rows=await sb('/places',{method:'POST',body:JSON.stringify({place_type:'stadium',name:clean(name),city:null,country:clean(country)||null})});
    const row=rows[0]||null;if(row)placeByName.set(key,row);return row;
  }

  let matched=0,attached=0,enrichedScores=0,enrichedVenues=0,enrichedPhase=0,locked=0,dbErrors=0;
  const matchedRemote=[];
  const unmatchedRemote=[];
  const matchedLocalIds=new Set();

  for(const e of remote){
    const localMatch=matchLocal(e);
    if(!localMatch){unmatchedRemote.push(e);continue;}
    matched++;matchedLocalIds.add(String(localMatch.id));matchedRemote.push(e);
    if(localMatch.data_state==='locked'){locked++;continue;}
    try{
      const side=remoteSide(e);
      const patch={};
      if(!localMatch.provider_fixture_id){patch.provider='thesportsdb';patch.provider_fixture_id=String(e.idEvent);attached++;}
      patch.provider_updated_at=new Date().toISOString();
      patch.source_detail_url=`https://www.thesportsdb.com/event/${e.idEvent}`;
      patch.source_calendar_url=`https://www.thesportsdb.com/team/${side.franceId}`;
      patch.external_ids={...(localMatch.external_ids||{}),thesportsdb_event_id:String(e.idEvent),thesportsdb_team_id:String(side.franceId),thesportsdb_league_id:e.idLeague?String(e.idLeague):null};
      patch.api_payload={...(localMatch.api_payload||{}),thesportsdb_history:e};
      if(olympicTag?.id&&isOlympicU23Event(e)&&!localMatch.manual_overrides?.selection_tag_id){
        patch.manual_overrides={...(localMatch.manual_overrides||{}),selection_tag_id:olympicTag.id};
      }

      const homeScore=toInt(e.intHomeScore),awayScore=toInt(e.intAwayScore);
      const frScore=side.home?homeScore:awayScore,opScore=side.home?awayScore:homeScore;
      if(localMatch.france_score==null&&frScore!=null){patch.france_score=frScore;enrichedScores++;}
      if(localMatch.opponent_score==null&&opScore!=null){patch.opponent_score=opScore;}
      if(!localMatch.phase&&e.intRound!=null){patch.phase=`Tour ${e.intRound}`;enrichedPhase++;}
      if(!localMatch.place_id&&clean(e.strVenue)){
        const place=await ensurePlace(e.strVenue,e.strCountry);
        if(place?.id){patch.place_id=place.id;enrichedVenues++;}
      }
      await sb(`/matches?id=eq.${localMatch.id}`,{method:'PATCH',body:JSON.stringify(patch)});
    }catch(err){dbErrors++;console.error('history-espoirs match patch',e.idEvent,err.message);}
  }

  // 4) Audit riche sur les matchs récents matchés, sans écrire les lineups/timelines : on mesure d'abord la qualité réelle.
  const detailEvents=matchedRemote
    .slice()
    .sort((a,b)=>String(eventDateCandidates(b)[0]||'').localeCompare(String(eventDateCandidates(a)[0]||'')))
    .slice(0,detailLimit);
  const detail={sampled:detailEvents.length,lineups:0,timelines:0,stats:0,tv:0,highlights:0};
  await batches(detailEvents,3,async e=>{
    const specs=[
      ['lineups',`/lookup/event_lineup/${e.idEvent}`],
      ['timelines',`/lookup/event_timeline/${e.idEvent}`],
      ['stats',`/lookup/event_stats/${e.idEvent}`],
      ['tv',`/lookup/event_tv/${e.idEvent}`],
      ['highlights',`/lookup/event_highlights/${e.idEvent}`]
    ];
    for(const [key,path] of specs){
      try{const data=await sports(path);if(extractObjects(data,['lookup','events','event','lineup','timeline','statistics','stats','tv','highlights']).length)detail[key]++;}
      catch(err){console.warn('history-espoirs detail',key,e.idEvent,err.message);}
    }
    return null;
  },180);

  const unmatchedLocal=local.filter(m=>!matchedLocalIds.has(String(m.id)));
  const olympicU23Candidates=unmatchedRemote.filter(isOlympicU23Event);
  const samples=unmatchedRemote.slice(0,12).map(e=>({idEvent:String(e.idEvent),date:eventDateCandidates(e)[0]||null,event:e.strEvent||null,league:e.strLeague||null,season:e.strSeason||null,section_tag:isOlympicU23Event(e)?'OLYMPIQUE U23':null}));
  const summary={
    event:'3615bleus-history-espoirs',provider:'thesportsdb',mode:'safe-link-enrich',
    localMatches:local.length,teamIds:TEAM_IDS,leagueIds:[...leagueIds],seasonJobs:seasonJobs.length,seasonJobsFetched:cappedJobs.length,
    remoteEvents:remote.length,matched,attached,enrichedScores,enrichedVenues,enrichedPhase,locked,
    unmatchedLocal:unmatchedLocal.length,unmatchedRemote:unmatchedRemote.length,olympicU23Candidates:olympicU23Candidates.length,unmatchedRemoteSamples:samples,
    detail,apiRequests,apiErrors,dbErrors,
    note:'Aucun événement TheSportsDB sans correspondance locale n’est importé par ce pilote.'
  };
  console.log(JSON.stringify(summary));
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:apiErrors===0&&dbErrors===0,...summary})};
};
