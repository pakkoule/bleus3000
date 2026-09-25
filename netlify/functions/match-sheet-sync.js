/* 3615 Bleus V1.1.61.16 — synchronisation live match ↔ feuille de match ↔ calendrier */
const crypto=require('crypto');
const API='https://www.thesportsdb.com/api/v2/json';
const FINISHED=new Set(['FT','MATCH FINISHED','FINISHED','COMPLETED','AET','PEN','AFTER PENALTIES']);
const LIVE=new Set(['1H','2H','HT','ET','P','LIVE','IN PLAY','IN_PLAY','PLAYING']);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const clean=v=>String(v??'').trim();
const toInt=v=>v===''||v==null||Number.isNaN(Number(v))?null:Number(v);
const bool=v=>['1','true','yes','y','oui'].includes(norm(v));
const stableHash=v=>crypto.createHash('sha1').update(String(v||'')).digest('hex').slice(0,18);
const escFilter=v=>encodeURIComponent(String(v??''));
function sbHeaders(secret,extra={}){const h={apikey:secret,'Content-Type':'application/json',...extra};if(!String(secret).startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;return h;}
function extractObjects(data,preferred=[]){for(const k of preferred){if(Array.isArray(data?.[k]))return data[k];}if(Array.isArray(data))return data;if(data&&typeof data==='object'){for(const v of Object.values(data)){if(Array.isArray(v))return v;}}return [];}
function firstObject(data,preferred=[]){const rows=extractObjects(data,preferred);return rows[0]||((data&&typeof data==='object'&&!Array.isArray(data))?data:null);}
function eventTime(e){const raw=clean(e?.strTimestamp||e?.strTimeStamp);if(raw){const d=new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(raw)?raw:`${raw}Z`);if(!Number.isNaN(+d))return d;}const date=clean(e?.dateEvent),time=clean(e?.strTime)||'00:00:00';if(date){const d=new Date(`${date}T${time}Z`);if(!Number.isNaN(+d))return d;}return null;}
function eventStatus(e,fallback=''){const s=clean(e?.strStatus);if(s)return s;const progress=clean(e?.strProgress);if(progress&&progress!=='0'&&progress!=='NS')return 'LIVE';const d=eventTime(e);if(d&&Date.now()-d.getTime()>3*60*60*1000&&e?.intHomeScore!=null&&e?.intAwayScore!=null)return 'FT';return fallback;}
function rowSide(row,e){const ha=norm(row?.strHomeAway||row?.strSide||row?.strTeamSide);if(ha.startsWith('home'))return 'home';if(ha.startsWith('away'))return 'away';const tid=String(row?.idTeam||row?.idTeamPlayer||'');if(tid&&String(e?.idHomeTeam||'')===tid)return 'home';if(tid&&String(e?.idAwayTeam||'')===tid)return 'away';const tn=norm(row?.strTeam||row?.strTeamName);if(tn&&tn===norm(e?.strHomeTeam))return 'home';if(tn&&tn===norm(e?.strAwayTeam))return 'away';return null;}
function playerName(row){return clean(row?.strPlayer||row?.strPlayerName||row?.strName||row?.namePlayer||row?.player);}
function playerProviderId(row){return clean(row?.idPlayer||row?.idPlayerTSDB||row?.id);}
function lineupStarter(row){const sub=row?.strSubstitute??row?.intSubstitute??row?.isSubstitute;if(sub!=null&&sub!=='')return !bool(sub)&&!['substitute','bench','replacement','remplacant'].includes(norm(sub));const role=norm(row?.strPosition||row?.strRole||row?.strLineup);return !(role.includes('substitute')||role.includes('bench')||role.includes('remplac'));}
function lineupPosition(row){return clean(row?.strPosition||row?.strPositionShort||row?.strRole)||null;}
function lineupNumber(row){return toInt(row?.intSquadNumber??row?.strNumber??row?.intNumber??row?.strSquadNumber);}
function lineupCaptain(row){return bool(row?.strCaptain??row?.intCaptain??row?.isCaptain);}
function minuteText(row){const v=row?.strTime??row?.intTime??row?.strMinute??row?.intMinute??row?.strProgress;return clean(v).replace(/'$/,'')||null;}
function timelineKind(row){return norm([row?.strTimeline,row?.strEvent,row?.strType,row?.strEventType,row?.strTimelineDetail,row?.strDetail].filter(Boolean).join(' '));}
function timelinePlayer(row){return clean(row?.strPlayer||row?.strPlayerName||row?.strTimelinePlayer||row?.strScorer);}
function timelineAssist(row){return clean(row?.strAssist||row?.strAssistPlayer||row?.strAssistName);}
function timelineTeam(row,e){const side=rowSide(row,e);if(side==='home')return clean(e?.strHomeTeam)||'Domicile';if(side==='away')return clean(e?.strAwayTeam)||'Extérieur';return clean(row?.strTeam||row?.strTeamName)||null;}
function scoreAfter(row){return clean(row?.strScore||row?.strResult||row?.strScoreAfter)||((row?.intHomeScore!=null&&row?.intAwayScore!=null)?`${row.intHomeScore}-${row.intAwayScore}`:null);}
function providerSource(eventId){return `https://www.thesportsdb.com/event/${eventId}`;}
function playerAliases(p){const out=new Set();for(const v of [p.display_name,p.name_normalized,[p.first_name,p.last_name].filter(Boolean).join(' '),[p.last_name,p.first_name].filter(Boolean).join(' ')]){const n=norm(v);if(n)out.add(n);}return [...out];}
function isProviderVerification(v){return /^thesportsdb/i.test(String(v||''));}
function timelineSourceId(eventId,kind,row,index){const raw=row?.idTimeline||row?.idEventTimeline||row?.id||`${kind}|${minuteText(row)||''}|${timelinePlayer(row)}|${timelineTeam(row,{})||''}|${index}`;return `sportsdb:${eventId}:${kind}:${stableHash(raw)}`;}

exports.handler=async(event={})=>{
  const key=process.env.THESPORTSDB_KEY||process.env.SPORTSDB_KEY;
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const json=(body,statusCode=200)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
  if(!key||!url||!secret)return json({ok:false,configured:false,reason:'configuration incomplete'});
  const rest=`${url.replace(/\/$/,'')}/rest/v1`;
  async function sb(path,opts={}){const headers=sbHeaders(secret,{Prefer:'return=representation',...(opts.headers||{})});const r=await fetch(rest+path,{...opts,headers});const t=await r.text();if(!r.ok)throw new Error(`Supabase ${r.status} ${path}: ${t}`);return t?JSON.parse(t):[];}
  async function sports(path){const r=await fetch(`${API}${path}`,{headers:{'X-API-KEY':key,accept:'application/json'}});const t=await r.text();let data={};try{data=t?JSON.parse(t):{};}catch{data={raw:t};}if(!r.ok)throw new Error(`TheSportsDB ${r.status} ${path}: ${t.slice(0,300)}`);return data;}
  const force=String(event?.queryStringParameters?.force||'')==='1';
  const now=Date.now(),min=now-5*60*60*1000,max=now+2*60*60*1000;
  try{
    const [allMatches,players]=await Promise.all([
      sb('/matches?provider=eq.thesportsdb&select=id,match_date,status,lineup_status,provider,provider_fixture_id,provider_updated_at,data_state,api_payload,manual_overrides,home_away,france_score,opponent_score,selection_team_id&order=match_date.asc&limit=1000'),
      sb('/players?active=eq.true&select=id,display_name,first_name,last_name,name_normalized,external_ids&limit=5000')
    ]);
    const byProviderId=new Map(),byName=new Map();
    for(const p of players){const pid=clean(p.external_ids?.thesportsdb_player_id);if(pid)byProviderId.set(pid,p);for(const a of playerAliases(p)){if(!byName.has(a))byName.set(a,p);else byName.set(a,null);}}
    const targets=allMatches.filter(m=>{if(m.data_state==='locked'||!m.provider_fixture_id)return false;const t=Date.parse(m.match_date),s=String(m.status||'').toUpperCase();return (Number.isFinite(t)&&t>=min&&t<=max)||LIVE.has(s)||(FINISHED.has(s)&&Number.isFinite(t)&&t>=now-2*60*60*1000);}).slice(0,12);
    const changedMatchIds=[],summaries=[];let apiRequests=0;
    for(const m of targets){
      const previousSync=Date.parse(m.api_payload?._bleus_live_sheet?.synced_at||'');if(!force&&Number.isFinite(previousSync)&&now-previousSync<75000){summaries.push({matchId:m.id,fixture:m.provider_fixture_id,skipped:'fresh'});continue;}
      const eventId=String(m.provider_fixture_id);
      let eventData={},lineupData={},timelineData={};
      try{[eventData,lineupData,timelineData]=await Promise.all([sports(`/lookup/event/${eventId}`),sports(`/lookup/event_lineup/${eventId}`).catch(()=>({})),sports(`/lookup/event_timeline/${eventId}`).catch(()=>({}))]);apiRequests+=3;}catch(err){summaries.push({matchId:m.id,fixture:eventId,error:err.message});continue;}
      const remoteEvent=firstObject(eventData,['lookup','events','event'])||m.api_payload||{};
      const lineup=extractObjects(lineupData,['lineup','event_lineup','lookup','players']);
      const timeline=extractObjects(timelineData,['timeline','event_timeline','lookup','events']);
      const franceSide=m.home_away==='away'?'away':'home';
      const franceLineup=lineup.filter(r=>rowSide(r,remoteEvent)===franceSide||(!rowSide(r,remoteEvent)&&norm(r?.strTeam).includes('france')));
      const existingApps=await sb(`/match_appearances?match_id=eq.${escFilter(m.id)}&select=*`);
      const existingByPlayer=new Map(existingApps.map(x=>[String(x.player_id),x]));
      const matched=[],unmatched=[],providerIds=new Set();
      for(const row of franceLineup){const name=playerName(row);if(!name)continue;const providerId=playerProviderId(row);let p=providerId?byProviderId.get(providerId):null;if(!p)p=byName.get(norm(name))||null;if(!p){unmatched.push({name,number:lineupNumber(row),position:lineupPosition(row),starter:lineupStarter(row)});continue;}providerIds.add(String(p.id));matched.push({row,p});if(providerId&&!p.external_ids?.thesportsdb_player_id){const ext={...(p.external_ids||{}),thesportsdb_player_id:providerId};await sb(`/players?id=eq.${escFilter(p.id)}`,{method:'PATCH',body:JSON.stringify({external_ids:ext,updated_at:new Date().toISOString()})});p.external_ids=ext;byProviderId.set(providerId,p);}}
      for(const {row,p} of matched){const old=existingByPlayer.get(String(p.id));if(old&&!isProviderVerification(old.verification)&&clean(old.verification))continue;const payload={match_id:m.id,player_id:p.id,starter:lineupStarter(row),minutes:old?.minutes??null,captain:lineupCaptain(row),position:lineupPosition(row),shirt_number:lineupNumber(row),squad_status:lineupStarter(row)?'Titulaire':'Remplaçant(e)',source_composition_url:providerSource(eventId),verification:'thesportsdb-live'};await sb('/match_appearances?on_conflict=match_id,player_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});}
      if(franceLineup.length){for(const old of existingApps){if(isProviderVerification(old.verification)&&!providerIds.has(String(old.player_id)))await sb(`/match_appearances?match_id=eq.${escFilter(m.id)}&player_id=eq.${escFilter(old.player_id)}`,{method:'DELETE'});}}
      const playerFor=(name,id)=>{if(id&&byProviderId.get(clean(id)))return byProviderId.get(clean(id));return byName.get(norm(name))||null;};
      const goals=[],cards=[];
      timeline.forEach((row,index)=>{const k=timelineKind(row);const name=timelinePlayer(row);const providerPlayerId=clean(row?.idPlayer||row?.idPlayerTimeline);const p=playerFor(name,providerPlayerId);const team=timelineTeam(row,remoteEvent);if(k.includes('goal')&&!k.includes('disallow')&&!k.includes('miss')){const assist=timelineAssist(row),assistId=clean(row?.idAssist||row?.idAssistPlayer),ap=playerFor(assist,assistId);goals.push({source_goal_id:timelineSourceId(eventId,'goal',row,index),match_id:m.id,player_id:p?.id||null,scorer_name:name||'Buteur non renseigné',team_name:team,minute_text:minuteText(row),score_after:scoreAfter(row),source_url:providerSource(eventId),assist_player_id:ap?.id||null,assist_name:assist||null,updated_at:new Date().toISOString()});}else if(k.includes('yellow')||k.includes('red')||k.includes('card')){let type=k.includes('red')?'red':'yellow';if(k.includes('second')&&k.includes('yellow'))type='second_yellow';cards.push({source_card_id:timelineSourceId(eventId,'card',row,index),match_id:m.id,player_id:p?.id||null,player_name:name||'Joueur non renseigné',team_name:team,card_type:type,minute_text:minuteText(row),source_url:providerSource(eventId),updated_at:new Date().toISOString()});}});
      const oldGoals=await sb(`/match_goal_events?match_id=eq.${escFilter(m.id)}&select=id,source_goal_id`);for(const g of oldGoals.filter(x=>String(x.source_goal_id||'').startsWith(`sportsdb:${eventId}:goal:`))){if(!goals.some(n=>n.source_goal_id===g.source_goal_id))await sb(`/match_goal_events?id=eq.${escFilter(g.id)}`,{method:'DELETE'});}
      for(const g of goals)await sb('/match_goal_events?on_conflict=source_goal_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(g)});
      const oldCards=await sb(`/match_card_events?match_id=eq.${escFilter(m.id)}&select=id,source_card_id`);for(const c of oldCards.filter(x=>String(x.source_card_id||'').startsWith(`sportsdb:${eventId}:card:`))){if(!cards.some(n=>n.source_card_id===c.source_card_id))await sb(`/match_card_events?id=eq.${escFilter(c.id)}`,{method:'DELETE'});}
      for(const c of cards)await sb('/match_card_events?on_conflict=source_card_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(c)});
      const [allGoals,allCards,appsAfter]=await Promise.all([sb(`/match_goal_events?match_id=eq.${escFilter(m.id)}&select=player_id,assist_player_id`),sb(`/match_card_events?match_id=eq.${escFilter(m.id)}&select=player_id,card_type`),sb(`/match_appearances?match_id=eq.${escFilter(m.id)}&select=player_id`)]);
      const counters=new Map(appsAfter.map(x=>[String(x.player_id),{goals:0,assists:0,yellow_cards:0,red_cards:0}]));for(const g of allGoals){if(g.player_id&&counters.has(String(g.player_id)))counters.get(String(g.player_id)).goals++;if(g.assist_player_id&&counters.has(String(g.assist_player_id)))counters.get(String(g.assist_player_id)).assists++;}for(const c of allCards){if(!c.player_id||!counters.has(String(c.player_id)))continue;if(c.card_type==='red')counters.get(String(c.player_id)).red_cards++;else counters.get(String(c.player_id)).yellow_cards++;}for(const [pid,count] of counters)await sb(`/match_appearances?match_id=eq.${escFilter(m.id)}&player_id=eq.${escFilter(pid)}`,{method:'PATCH',body:JSON.stringify(count)});
      const h=toInt(remoteEvent?.intHomeScore),a=toInt(remoteEvent?.intAwayScore),status=eventStatus(remoteEvent,m.status);const franceScore=m.home_away==='away'?a:h,opponentScore=m.home_away==='away'?h:a;
      const manualApps=existingApps.filter(x=>clean(x.verification)&&!isProviderVerification(x.verification));
      const sheetMeta={provider:'thesportsdb',synced_at:new Date().toISOString(),fixture_id:eventId,lineup_count:franceLineup.length,matched_count:matched.length,unmatched_players:unmatched,timeline_count:timeline.length,goals_count:goals.length,cards_count:cards.length};
      const apiPayload={...(m.api_payload||{}),...remoteEvent,_bleus_live_sheet:sheetMeta};
      const lineupStatus=franceLineup.length?(manualApps.length?`Feuille éditoriale + direct · ${matched.length}/${franceLineup.length} joueurs reliés`:`TheSportsDB · feuille synchronisée · ${matched.length}/${franceLineup.length} joueurs reliés`):m.lineup_status;
      const patch={status:status||m.status,provider_updated_at:new Date().toISOString(),api_payload:apiPayload,lineup_status:lineupStatus};if(franceScore!=null)patch.france_score=franceScore;if(opponentScore!=null)patch.opponent_score=opponentScore;
      await sb(`/matches?id=eq.${escFilter(m.id)}`,{method:'PATCH',body:JSON.stringify(patch)});
      changedMatchIds.push(m.id);summaries.push({matchId:m.id,fixture:eventId,status:patch.status,lineup:franceLineup.length,matched:matched.length,unmatched:unmatched.length,timeline:timeline.length,goals:goals.length,cards:cards.length});
    }
    return json({ok:true,configured:true,updatedAt:new Date().toISOString(),targets:targets.length,apiRequests,changedMatchIds,summaries});
  }catch(err){console.error('match-sheet-sync',err);return json({ok:false,error:err.message},200);}
};
