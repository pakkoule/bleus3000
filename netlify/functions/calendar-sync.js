const API='https://v3.football.api-sports.io';
const jheaders=(secret,extra={})=>{
  const h={'apikey':secret,'Content-Type':'application/json',...extra};
  // Les nouvelles clés Supabase sb_secret_* ne sont pas des JWT : ne jamais les envoyer en Bearer.
  if(!String(secret).startsWith('sb_secret_')) h.Authorization=`Bearer ${secret}`;
  return h;
};
const enc=v=>encodeURIComponent(v);
exports.handler=async()=>{
  const footballKey=process.env.API_FOOTBALL_KEY||process.env.APISPORTS_KEY;
  const supabaseUrl=process.env.SUPABASE_URL;
  const supabaseSecret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawTeamMap=process.env.BLEUS_API_TEAM_MAP||'';
  let teamMap={}, teamMapParseError=null;
  try{teamMap=JSON.parse(rawTeamMap||'{}')}catch(e){teamMapParseError=e?.message||String(e)}
  const configStatus={
    event:'bleus3000-calendar-config',
    API_FOOTBALL_KEY:!!footballKey,
    SUPABASE_URL:!!supabaseUrl,
    SUPABASE_SECRET_KEY:!!supabaseSecret,
    BLEUS_API_TEAM_MAP_present:!!rawTeamMap,
    BLEUS_API_TEAM_MAP_valid:!teamMapParseError,
    BLEUS_API_TEAM_MAP_entries:Object.keys(teamMap).length
  };
  if(teamMapParseError) configStatus.BLEUS_API_TEAM_MAP_error=teamMapParseError;
  if(!footballKey||!supabaseUrl||!supabaseSecret||!Object.keys(teamMap).length){
    console.log(JSON.stringify(configStatus));
    console.log('calendar-sync: configuration incomplète');
    return {statusCode:200,body:JSON.stringify({ok:false,reason:'configuration incomplete',config:configStatus})};
  }
  console.log(JSON.stringify({...configStatus,ok:true}));
  const rest=`${supabaseUrl.replace(/\/$/,'')}/rest/v1`;
  async function sb(path,opts={}){const r=await fetch(rest+path,{...opts,headers:jheaders(supabaseSecret,{Prefer:'return=representation',...(opts.headers||{})})});const t=await r.text();if(!r.ok)throw new Error(`${r.status} ${path}: ${t}`);return t?JSON.parse(t):[]}
  async function first(table,filter){const rows=await sb(`/${table}?${filter}&limit=1`);return rows[0]||null}
  async function findOrCreate(table,name,payload){let x=await first(table,`name=eq.${enc(name)}&select=id`);if(x)return x.id;const rows=await sb(`/${table}`,{method:'POST',body:JSON.stringify({name,...payload})});return rows[0]?.id}
  const now=new Date(), from=new Date(now.getTime()-86400000).toISOString().slice(0,10), to=new Date(now.getTime()+370*86400000).toISOString().slice(0,10);
  let imported=0,updated=0,errors=0;
  for(const [selectionCode,teamIdsRaw] of Object.entries(teamMap)){
    const teamIds=(Array.isArray(teamIdsRaw)?teamIdsRaw:[teamIdsRaw]).map(Number).filter(Boolean);
    if(!teamIds.length)continue;
    let selection=null;
    try{
      selection=await first('selection_teams',`code=eq.${enc(selectionCode)}&select=id,code,name,gender,category`);
      if(!selection){console.log('Sélection inconnue',selectionCode);continue;}
    }catch(e){errors++;console.error('calendar-sync',selectionCode,'selection',e.message);continue;}
    for(const teamId of [...new Set(teamIds)]){
      try{
        const u=new URL(`${API}/fixtures`);u.searchParams.set('team',String(teamId));u.searchParams.set('from',from);u.searchParams.set('to',to);u.searchParams.set('timezone','Europe/Paris');
        const ar=await fetch(u,{headers:{'x-apisports-key':footballKey,accept:'application/json'}});const data=await ar.json();if(!ar.ok||data.errors&&Object.keys(data.errors).length)throw new Error(JSON.stringify(data.errors||data));
        for(const x of data.response||[]){
          const f=x.fixture||{}, home=x.teams?.home||{}, away=x.teams?.away||{};if(!f.id)continue;
          const franceHome=Number(home.id)===teamId, franceAway=Number(away.id)===teamId;if(!franceHome&&!franceAway)continue;
          const opp=franceHome?away:home;
          const opponentId=await findOrCreate('opponents',opp.name||'Adversaire à confirmer',{external_ids:{api_football_team_id:opp.id}});
          let competitionId=null;if(x.league?.name){let c=await first('competitions',`name=eq.${enc(x.league.name)}&select=id`);competitionId=c?.id||null;if(!competitionId){const rows=await sb('/competitions',{method:'POST',body:JSON.stringify({name:x.league.name,edition:String(x.league.season||''),organizer:x.league.country||null,competition_type:x.league.type||null,gender:selection.gender,selection_category:selection.category,external_ids:{api_football_league_id:x.league.id}})});competitionId=rows[0]?.id||null}}
          let placeId=null;if(f.venue?.name){let p=await first('places',`name=eq.${enc(f.venue.name)}&select=id`);placeId=p?.id||null;if(!placeId){const rows=await sb('/places',{method:'POST',body:JSON.stringify({place_type:'stadium',name:f.venue.name,city:f.venue.city||null,country:null})});placeId=rows[0]?.id||null}}
          const existing=await first('matches',`provider=eq.api-football&provider_fixture_id=eq.${enc(String(f.id))}&select=id,data_state`);
          const goals=x.goals||{};const body={match_date:f.date,gender:selection.gender,selection_category:selection.category,selection_team_id:selection.id,opponent_id:opponentId,competition_id:competitionId,place_id:placeId,home_away:franceHome?'home':'away',france_score:franceHome?goals.home:goals.away,opponent_score:franceHome?goals.away:goals.home,status:f.status?.short||'scheduled',phase:x.league?.round||null,provider:'api-football',provider_fixture_id:String(f.id),provider_updated_at:new Date().toISOString(),api_payload:x};
          if(existing){if(existing.data_state==='locked')continue;await sb(`/matches?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify(body)});updated++;}
          else{await sb('/matches',{method:'POST',body:JSON.stringify({...body,data_state:'api',external_ids:{api_football_fixture_id:f.id}})});imported++;}
        }
      }catch(e){errors++;console.error('calendar-sync',selectionCode,teamId,e.message)}
    }
  }
  console.log(JSON.stringify({event:'bleus3000-calendar-sync',imported,updated,errors}));
  return {statusCode:200,body:JSON.stringify({imported,updated,errors})};
};
