/* 3615 Bleus V1.1.46 — import JO 2024 France U23 depuis TheSportsDB
   - récupère Olympics Soccer 2024 (league 5039)
   - filtre France U23 (team 143161)
   - crée/rattache les 6 matchs au référentiel FRA-ESP-M
   - applique le tag de section OLYMPIQUE U23
   - associe la compétition Jeux Olympiques 2024
   - ne crée aucun doublon et n'écrase pas les lignes locked
*/
const SPORTSDB='https://www.thesportsdb.com/api/v2/json';
const FRANCE_U23_TEAM_ID=143161;
const OLYMPICS_LEAGUE_ID='5039';
const OLYMPICS_SEASON='2024';

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=v=>encodeURIComponent(String(v??''));
const toInt=v=>(v==null||v===''||Number.isNaN(Number(v)))?null:Number(v);
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
function franceSide(e){
  const h=Number(e?.idHomeTeam),a=Number(e?.idAwayTeam);
  if(h===FRANCE_U23_TEAM_ID)return {home:true,oppId:a,oppName:e?.strAwayTeam};
  if(a===FRANCE_U23_TEAM_ID)return {home:false,oppId:h,oppName:e?.strHomeTeam};
  const homeName=norm(e?.strHomeTeam),awayName=norm(e?.strAwayTeam);
  if(homeName==='france u23')return {home:true,oppId:a,oppName:e?.strAwayTeam};
  if(awayName==='france u23')return {home:false,oppId:h,oppName:e?.strHomeTeam};
  return null;
}
function eventDate(e){
  let ts=clean(e?.strTimestamp||e?.strTimeStamp);
  if(ts){
    if(!/(Z|[+-]\d\d:?\d\d)$/i.test(ts))ts+='Z';
    const d=new Date(ts);if(!Number.isNaN(+d))return d.toISOString();
  }
  const day=clean(e?.dateEvent||e?.dateEventLocal);
  const time=clean(e?.strTime||e?.strTimeLocal)||'00:00:00';
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)){
    const d=new Date(`${day}T${/^\d\d:\d\d/.test(time)?time:'00:00:00'}Z`);
    if(!Number.isNaN(+d))return d.toISOString();
  }
  return null;
}
function phaseFor(e,dateIso){
  const group=clean(e?.strGroup);
  if(group)return group;
  const round=Number(e?.intRound);
  if(round===125)return 'Quart de finale';
  if(round===150)return 'Demi-finale';
  if(round===200)return 'Finale';
  const day=String(dateIso||'').slice(0,10);
  if(day==='2024-08-02')return 'Quart de finale';
  if(day==='2024-08-05')return 'Demi-finale';
  if(day==='2024-08-09')return 'Finale';
  if(day>='2024-07-24'&&day<='2024-07-30')return 'Groupe A';
  return round?`Tour ${round}`:null;
}

async function runOlympicsU23Import({skipIfComplete=true}={}){
  const sportsKey=process.env.THESPORTSDB_KEY||process.env.SPORTSDB_KEY;
  const supabaseUrl=process.env.SUPABASE_URL;
  const supabaseSecret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config={event:'3615bleus-import-olympique-u23-config',provider:'thesportsdb',THESPORTSDB_KEY:!!sportsKey,SUPABASE_URL:!!supabaseUrl,SUPABASE_SECRET_KEY:!!supabaseSecret,leagueId:OLYMPICS_LEAGUE_ID,season:OLYMPICS_SEASON,teamId:FRANCE_U23_TEAM_ID};
  if(!sportsKey||!supabaseUrl||!supabaseSecret){console.log(JSON.stringify({...config,ok:false}));return {ok:false,...config};}

  const rest=`${supabaseUrl.replace(/\/$/,'')}/rest/v1`;
  async function sb(path,opts={}){
    const headers=sbHeaders(supabaseSecret,{Prefer:'return=representation',...(opts.headers||{})});
    const r=await fetch(rest+path,{...opts,headers});
    const t=await r.text();
    if(!r.ok)throw new Error(`Supabase ${r.status} ${path}: ${t}`);
    return t?JSON.parse(t):[];
  }
  let apiRequests=0,apiErrors=0,dbErrors=0;
  async function sports(path){
    apiRequests++;
    const r=await fetch(`${SPORTSDB}${path}`,{headers:{'X-API-KEY':sportsKey,accept:'application/json'}});
    const t=await r.text();let data={};
    try{data=t?JSON.parse(t):{};}catch{data={raw:t};}
    if(!r.ok){apiErrors++;throw new Error(`TheSportsDB ${r.status} ${path}: ${t.slice(0,350)}`);}
    return data;
  }
  async function createOne(table,payload){const rows=await sb(`/${table}`,{method:'POST',body:JSON.stringify(payload)});return rows[0]||null;}

  const selection=(await sb('/selection_teams?code=eq.FRA-ESP-M&select=id,code,name,gender,category&limit=1'))[0];
  const olympicTag=(await sb('/tags?slug=eq.olympique-u23&select=id,slug,label_text&limit=1'))[0];
  let competition=(await sb('/competitions?name=eq.Jeux%20Olympiques%202024&select=*&limit=1'))[0]||null;
  if(!selection||!olympicTag)throw new Error('Référentiel FRA-ESP-M ou tag olympique-u23 introuvable');
  if(!competition){
    const compTag=(await sb('/tags?slug=eq.jeux-olympiques&select=id&limit=1'))[0]||null;
    competition=await createOne('competitions',{name:'Jeux Olympiques 2024',edition:'Paris 2024',organizer:'CIO / FIFA',competition_type:'Tournoi olympique',gender:'M',selection_category:'Espoirs/U21',start_date:'2024-07-24',end_date:'2024-08-09',host_country:'France',status:'finished',external_ids:{thesportsdb_league_id:OLYMPICS_LEAGUE_ID,thesportsdb_season:OLYMPICS_SEASON},tag_id:compTag?.id||null});
  }

  const existingWindow=await sb(`/matches?selection_team_id=eq.${selection.id}&match_date=gte.2024-07-20T00:00:00Z&match_date=lte.2024-08-12T23:59:59Z&select=id,match_date,opponent_id,competition_id,place_id,france_score,opponent_score,status,phase,data_state,provider,provider_fixture_id,external_ids,api_payload,manual_overrides&limit=50`);
  const completeRows=existingWindow.filter(m=>String(m.competition_id||'')===String(competition?.id||'')&&String(m.manual_overrides?.selection_tag_id||'')===String(olympicTag.id)&&m.provider_fixture_id);
  if(skipIfComplete&&completeRows.length>=6){
    const summary={event:'3615bleus-import-olympique-u23',ok:true,skipped:true,reason:'already_complete',matches:existingWindow.length,providerLinked:completeRows.length,apiRequests:0,apiErrors:0,dbErrors:0};
    console.log(JSON.stringify(summary));return summary;
  }

  const opponents=await sb('/opponents?select=id,name&limit=5000');
  const places=await sb('/places?select=id,name,city,country&limit=5000');
  const oppById=new Map(opponents.map(x=>[String(x.id),x]));
  const oppByName=new Map(opponents.map(x=>[norm(x.name),x]));
  const placeByName=new Map(places.map(x=>[norm(x.name),x]));

  const data=await sports(`/schedule/league/${OLYMPICS_LEAGUE_ID}/${OLYMPICS_SEASON}`);
  const allEvents=extractObjects(data,['schedule','events','event']);
  const events=allEvents.filter(e=>franceSide(e)).sort((a,b)=>String(eventDate(a)||'').localeCompare(String(eventDate(b)||'')));

  let imported=0,reused=0,attached=0,enriched=0,locked=0;
  const importedIds=[];
  for(const e of events){
    try{
      const side=franceSide(e);if(!side||!e?.idEvent)continue;
      const dateIso=eventDate(e);if(!dateIso)continue;
      const opponentName=countryOnlyName(side.oppName)||'Adversaire à confirmer';
      let opp=oppByName.get(norm(opponentName))||null;
      if(!opp){opp=await createOne('opponents',{name:opponentName});if(opp){opponents.push(opp);oppByName.set(norm(opponentName),opp);}}

      let place=null;
      const venueName=clean(e?.strVenue);
      if(venueName){
        place=placeByName.get(norm(venueName))||null;
        if(!place){place=await createOne('places',{place_type:'stadium',name:venueName,city:clean(e?.strCity)||null,country:clean(e?.strCountry)||'France'});if(place){places.push(place);placeByName.set(norm(venueName),place);}}
      }

      const eventId=String(e.idEvent);
      let existing=(await sb(`/matches?provider=eq.thesportsdb&provider_fixture_id=eq.${esc(eventId)}&select=*&limit=1`))[0]||null;
      if(!existing){
        const day=dateIso.slice(0,10);
        const sameDay=existingWindow.filter(m=>String(m.match_date||'').slice(0,10)===day);
        existing=sameDay.find(m=>norm(oppById.get(String(m.opponent_id))?.name||'')===norm(opponentName))||null;
      }

      const payload={
        match_date:dateIso,
        gender:'M',
        selection_category:'Espoirs/U21',
        selection_team_id:selection.id,
        opponent_id:opp?.id||null,
        competition_id:competition?.id||null,
        place_id:place?.id||null,
        home_away:side.home?'home':'away',
        france_score:side.home?toInt(e.intHomeScore):toInt(e.intAwayScore),
        opponent_score:side.home?toInt(e.intAwayScore):toInt(e.intHomeScore),
        status:'finished',
        phase:phaseFor(e,dateIso),
        spectators:toInt(e.intSpectators),
        provider:'thesportsdb',
        provider_fixture_id:eventId,
        provider_updated_at:new Date().toISOString(),
        source_calendar_url:`https://www.thesportsdb.com/league/${OLYMPICS_LEAGUE_ID}-olympics-soccer`,
        source_detail_url:`https://www.thesportsdb.com/event/${eventId}`,
        external_ids:{thesportsdb_event_id:eventId,thesportsdb_team_id:String(FRANCE_U23_TEAM_ID),thesportsdb_league_id:OLYMPICS_LEAGUE_ID,thesportsdb_season:OLYMPICS_SEASON},
        api_payload:e,
        manual_overrides:{selection_tag_id:olympicTag.id}
      };

      if(existing){
        if(existing.data_state==='locked'){locked++;continue;}
        const patch={provider:'thesportsdb',provider_fixture_id:eventId,provider_updated_at:payload.provider_updated_at,source_calendar_url:payload.source_calendar_url,source_detail_url:payload.source_detail_url,external_ids:{...(existing.external_ids||{}),...payload.external_ids},api_payload:{...(existing.api_payload||{}),thesportsdb_olympics_2024:e},manual_overrides:{...(existing.manual_overrides||{}),selection_tag_id:existing.manual_overrides?.selection_tag_id||olympicTag.id}};
        if(!existing.competition_id)patch.competition_id=competition?.id||null;
        if(!existing.place_id&&place?.id)patch.place_id=place.id;
        if(existing.france_score==null&&payload.france_score!=null)patch.france_score=payload.france_score;
        if(existing.opponent_score==null&&payload.opponent_score!=null)patch.opponent_score=payload.opponent_score;
        if(!existing.phase&&payload.phase)patch.phase=payload.phase;
        await sb(`/matches?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify(patch)});
        reused++;attached++;if(Object.keys(patch).some(k=>['competition_id','place_id','france_score','opponent_score','phase'].includes(k)))enriched++;
        importedIds.push(eventId);continue;
      }

      const rows=await sb('/matches',{method:'POST',body:JSON.stringify({...payload,data_state:'api'})});
      if(rows[0]){imported++;importedIds.push(eventId);existingWindow.push(rows[0]);}
    }catch(err){dbErrors++;console.error('import-olympique-u23 event',e?.idEvent,err.message);}
  }

  const summary={event:'3615bleus-import-olympique-u23',provider:'thesportsdb',ok:apiErrors===0&&dbErrors===0,remoteEvents:events.length,imported,reused,attached,enriched,locked,competition:competition?.name||null,sectionTag:olympicTag?.label_text||null,providerEventIds:importedIds,apiRequests,apiErrors,dbErrors};
  console.log(JSON.stringify(summary));
  return summary;
}

module.exports={runOlympicsU23Import};
