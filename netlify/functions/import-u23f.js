/* 3615 Bleus V1.1.44 — import France U23 / Espoirs féminines 2014-2026 */
const fs=require('fs');
const path=require('path');
const DATA_PATH=path.join(process.cwd(),'data','U23_FEMININES_2014_2026_V1.json');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const slugify=v=>norm(v).replace(/\s+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'joueuse';
const n=v=>v==null||v===''||Number.isNaN(Number(v))?null:Number(v);
const asArr=v=>Array.isArray(v)?v:[];
function sbHeaders(secret,extra={}){const h={'apikey':secret,'Content-Type':'application/json',...extra};if(!String(secret).startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;return h;}

exports.handler=async()=>{
  const supabaseUrl=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config={event:'3615bleus-import-u23f-config',SUPABASE_URL:!!supabaseUrl,SUPABASE_SECRET_KEY:!!secret,dataFile:fs.existsSync(DATA_PATH)};
  if(!supabaseUrl||!secret||!config.dataFile){console.log(JSON.stringify({...config,ok:false}));return{statusCode:200,body:JSON.stringify({ok:false,config})};}
  console.log(JSON.stringify({...config,ok:true}));
  const data=JSON.parse(fs.readFileSync(DATA_PATH,'utf8'));
  const rest=`${supabaseUrl.replace(/\/$/,'')}/rest/v1`;
  async function sb(route,opts={}){
    const headers=sbHeaders(secret,{Prefer:opts.prefer||'return=representation',...(opts.headers||{})});
    const r=await fetch(rest+route,{...opts,headers});const t=await r.text();let parsed=[];try{parsed=t?JSON.parse(t):[];}catch{parsed=t;}
    if(!r.ok)throw new Error(`Supabase ${r.status} ${route}: ${typeof parsed==='string'?parsed:JSON.stringify(parsed)}`);return parsed;
  }
  async function insert(table,rows){if(!rows.length)return[];return sb(`/${table}`,{method:'POST',body:JSON.stringify(rows)});}
  async function upsert(table,rows,onConflict){if(!rows.length)return[];return sb(`/${table}?on_conflict=${encodeURIComponent(onConflict)}`,{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:JSON.stringify(rows)});}

  const summary={event:'3615bleus-import-u23f',ok:false,players:{source:data.players.length,created:0,reused:0,stats:0,tagged:0},matches:{source:data.matches.length,created:0,reused:0},appearances:{source:data.appearances.length,upserted:0},goals:{source:data.goals.length,upserted:0},personnel:{created:0},sources:{created:0,linked:0},warnings:[]};
  try{
    const selection=(await sb('/selection_teams?code=eq.FRA-U23-F&select=id,code,name,gender,category,team_tag_id&limit=1'))?.[0];
    if(!selection||!selection.team_tag_id)throw new Error('FRA-U23-F ou son tag ESPOIRS F est absent.');
    summary.selection={id:selection.id,code:selection.code,tag_id:selection.team_tag_id};

    const [playersDb,oppsDb,compsDb,placesDb,peopleDb,sourcesDb,matchesDb]=await Promise.all([
      sb('/players?gender=eq.F&select=id,display_name,primary_position,external_ids,keywords,legacy_key&limit=5000'),
      sb('/opponents?select=id,name&limit=5000'),
      sb('/competitions?select=id,name,edition,gender,selection_category,tag_id&limit=5000'),
      sb('/places?select=id,name,city,place_type&limit=5000'),
      sb('/personnel?select=id,display_name,person_type,external_ids,keywords&limit=5000'),
      sb('/sources?select=id,title,url&limit=5000'),
      sb(`/matches?selection_team_id=eq.${selection.id}&select=id,external_ids&limit=5000`)
    ]);
    const tagAmical=(await sb('/tags?slug=eq.match-amical&select=id&limit=1'))?.[0]||null;

    // Sources FFF.
    const sourceByUrl=new Map(sourcesDb.filter(x=>x.url).map(x=>[x.url,x]));
    const missingSources=data.sources.filter(s=>s.url&&!sourceByUrl.has(s.url)).map(s=>({source_type:'web',title:s.title||'FFF — source U23 féminine',publisher_author:'FFF',url:s.url,notes_short:s.usage||'France U23 / Espoirs féminines 2014-2026'}));
    const createdSources=await insert('sources',missingSources);summary.sources.created=createdSources.length;
    for(const s of createdSources)if(s.url)sourceByUrl.set(s.url,s);

    // Joueuses : on réutilise les profils féminins existants, sinon création.
    const playerByName=new Map(playersDb.map(x=>[norm(x.display_name),x]));
    const missingPlayers=data.players.filter(p=>!playerByName.has(norm(p.name))).map(p=>({
      first_name:null,last_name:p.name,display_name:p.name,gender:'F',primary_position:p.position||null,secondary_positions:[],france_eligibility:true,senior_a_called:false,active:true,
      external_ids:{u23f_v1_id:p.source_id},keywords:uniq(p.keywords),legacy_key:p.source_id,profile_slug:slugify(p.name),name_normalized:norm(p.name),data_status:p.status,active_source:true
    }));
    const createdPlayers=await insert('players',missingPlayers);summary.players.created=createdPlayers.length;summary.players.reused=data.players.length-createdPlayers.length;
    for(const p of createdPlayers)playerByName.set(norm(p.display_name),p);
    const playerBySource=new Map(data.players.map(p=>[p.source_id,playerByName.get(norm(p.name))]).filter(([,v])=>v));

    const statsRows=data.players.map(p=>{const row=playerBySource.get(p.source_id);if(!row)return null;return{player_id:row.id,selection_id:selection.id,selections:n(p.selections),goals:n(p.goals),wins:n(p.wins),draws:n(p.draws),losses:n(p.losses),starts:n(p.starts),minutes:n(p.minutes),appearance_status:'capped',data_status:p.status,source_quality:p.status,updated_at:new Date().toISOString()};}).filter(Boolean);
    await upsert('player_selection_stats',statsRows,'player_id,selection_id');summary.players.stats=statsRows.length;
    const tagRows=statsRows.map(x=>({entity_type:'player',entity_id:x.player_id,tag_id:selection.team_tag_id,added_by:null}));
    await upsert('entity_tags',tagRows,'entity_type,entity_id,tag_id');summary.players.tagged=tagRows.length;

    // Référentiels personnes.
    const peopleByKey=new Map(peopleDb.map(x=>[`${norm(x.display_name)}|${x.person_type}`,x]));
    const wantedPeople=[];
    for(const c of data.coaches)wantedPeople.push({name:c.name,type:'selectionneur',source:c.source,notes:`U23 F : ${c.matches} matchs · ${c.wins} V · ${c.draws} N · ${c.losses} D`,external_ids:{u23f_period:`${c.start}→${c.end}`}});
    for(const o of data.officials)if(o.name&&!/^non communiqu/i.test(o.name))wantedPeople.push({name:o.name,type:'arbitre',source:o.source,notes:null,external_ids:{}});
    const peopleUnique=[...new Map(wantedPeople.map(x=>[`${norm(x.name)}|${x.type}`,x])).values()];
    const missingPeople=peopleUnique.filter(x=>!peopleByKey.has(`${norm(x.name)}|${x.type}`)).map(x=>({display_name:x.name,nationality:null,person_type:x.type,organization:x.type==='selectionneur'?'FFF':null,active:true,external_ids:x.external_ids,keywords:uniq([x.name,'France U23 féminine','Espoirs féminines',x.type]),notes_short:x.notes}));
    const createdPeople=await insert('personnel',missingPeople);summary.personnel.created=createdPeople.length;
    for(const p of createdPeople)peopleByKey.set(`${norm(p.display_name)}|${p.person_type}`,p);

    // Adversaires.
    const oppByName=new Map(oppsDb.map(x=>[norm(x.name),x]));
    const oppNames=uniq(data.matches.map(m=>m.opponent));
    const createdOpp=await insert('opponents',oppNames.filter(x=>!oppByName.has(norm(x))).map(name=>({name})));
    for(const o of createdOpp)oppByName.set(norm(o.name),o);

    // Compétitions FFF annuelles, toutes rattachées au tag Match Amical.
    const compKey=(name)=>`${norm(name)}|f|${norm(selection.category)}`;
    const compByKey=new Map(compsDb.map(x=>[`${norm(x.name)}|${String(x.gender||'').toLowerCase()}|${norm(x.selection_category)}`,x]));
    const compNames=uniq(data.matches.map(m=>m.competition));
    const missingComps=compNames.filter(name=>!compByKey.has(compKey(name))).map(name=>({name,edition:(name.match(/\b(20\d{2})\b/)||[])[1]||null,organizer:'FFF',competition_type:'Amical',gender:'F',selection_category:selection.category,status:'active',external_ids:{u23f_v1_name:name},tag_id:tagAmical?.id||null}));
    const createdComps=await insert('competitions',missingComps);
    for(const c of createdComps)compByKey.set(compKey(c.name),c);
    if(tagAmical?.id){const links=createdComps.map(c=>({tag_id:tagAmical.id,reference_type:'competition',reference_id:c.id,relation_kind:'membership',created_by:null}));await upsert('tag_reference_links',links,'tag_id,reference_type,reference_id,relation_kind');}

    // Lieux.
    const placeKey=(name,city)=>`${norm(name)}|${norm(city)}`;
    const placeByKey=new Map(placesDb.map(x=>[placeKey(x.name,x.city),x]));
    const wantedPlaces=[...new Map(data.matches.filter(m=>m.stadium||m.city).map(m=>{const name=m.stadium||m.city;return[placeKey(name,m.city),{name,city:m.city||null,place_type:m.stadium?'stadium':'city'}];})).values()];
    const createdPlaces=await insert('places',wantedPlaces.filter(x=>!placeByKey.has(placeKey(x.name,x.city))).map(x=>({...x,country:null})));
    for(const p of createdPlaces)placeByKey.set(placeKey(p.name,p.city),p);

    // Matchs U23 F.
    const matchBySource=new Map(matchesDb.map(m=>[m.external_ids?.u23f_v1_id,m]).filter(([k])=>k));
    const matchPayload=data.matches.filter(m=>!matchBySource.has(m.source_id)).map(m=>{
      const opp=oppByName.get(norm(m.opponent)),comp=compByKey.get(compKey(m.competition)),place=placeByKey.get(placeKey(m.stadium||m.city,m.city)),coach=peopleByKey.get(`${norm(m.coach)}|selectionneur`);
      const notes=[];if(m.tab)notes.push(`TAB : ${m.tab}`);if(m.context)notes.push(`Contexte : ${m.context}`);
      return{match_date:`${m.date}T00:00:00Z`,gender:'F',selection_category:selection.category,selection_team_id:selection.id,opponent_id:opp?.id||null,competition_id:comp?.id||null,place_id:place?.id||null,home_away:m.home_away,france_score:n(m.france_score),opponent_score:n(m.opponent_score),status:'finished',coach_id:coach?.id||null,notes_short:notes.length?notes.join(' · '):null,external_ids:{u23f_v1_id:m.source_id},phase:m.context||null,source_calendar_url:m.source_calendar||null,source_detail_url:m.source_detail||null,data_state:'verified',api_payload:{u23f_v1:{result:m.result,tab:m.tab,sheet_status:m.sheet_status,home:m.home,away:m.away}},manual_overrides:{}};
    });
    const createdMatches=await insert('matches',matchPayload);summary.matches.created=createdMatches.length;summary.matches.reused=data.matches.length-createdMatches.length;
    for(const m of createdMatches)matchBySource.set(m.external_ids?.u23f_v1_id,m);

    // Sources liées aux joueuses, matchs, sélectionneurs et officiels.
    const sourceLinks=[];
    for(const s of data.meta.sources_method||[]){const src=sourceByUrl.get(s.url);if(src)sourceLinks.push({entity_type:'selection',entity_id:selection.id,source_id:src.id,field_scope:s.usage||null});}
    for(const p of data.players){const row=playerBySource.get(p.source_id);if(!row)continue;for(const url of uniq([p.source_stats,...asArr(p.source_pool)])){const src=sourceByUrl.get(url);if(src)sourceLinks.push({entity_type:'player',entity_id:row.id,source_id:src.id,field_scope:url===p.source_stats?'stats U23':'identité / pool U23'});}}
    for(const m of data.matches){const row=matchBySource.get(m.source_id);if(!row)continue;for(const [url,scope] of [[m.source_calendar,'calendrier'],[m.source_detail,'feuille de match']]){const src=sourceByUrl.get(url);if(src)sourceLinks.push({entity_type:'match',entity_id:row.id,source_id:src.id,field_scope:scope});}}
    for(const c of data.coaches){const row=peopleByKey.get(`${norm(c.name)}|selectionneur`),src=sourceByUrl.get(c.source);if(row&&src)sourceLinks.push({entity_type:'personnel',entity_id:row.id,source_id:src.id,field_scope:'sélectionneur U23 F'});}
    for(const o of data.officials){const row=peopleByKey.get(`${norm(o.name)}|arbitre`),src=sourceByUrl.get(o.source);if(row&&src)sourceLinks.push({entity_type:'personnel',entity_id:row.id,source_id:src.id,field_scope:'officiel match U23 F'});}
    const uniqueLinks=[...new Map(sourceLinks.map(x=>[`${x.entity_type}|${x.entity_id}|${x.source_id}`,x])).values()];
    await upsert('entity_sources',uniqueLinks,'entity_type,entity_id,source_id');summary.sources.linked=uniqueLinks.length;

    // Feuilles de match + capitanat + buts par apparition.
    const goalsByAppearance=new Map();
    for(const g of data.goals){if(norm(g.team_name)!=='france')continue;const p=data.players.find(x=>norm(x.name)===norm(g.scorer_name));if(!p)continue;const k=`${g.match_source_id}|${p.source_id}`;goalsByAppearance.set(k,(goalsByAppearance.get(k)||0)+1);}
    const appRows=data.appearances.map(a=>{const m=matchBySource.get(a.match_source_id),p=playerBySource.get(a.player_source_id);if(!m||!p)return null;return{match_id:m.id,player_id:p.id,starter:a.status==='Titulaire',minutes:null,goals:goalsByAppearance.get(`${a.match_source_id}|${a.player_source_id}`)||0,assists:null,yellow_cards:null,red_cards:null,captain:!!a.captain,position:null,shirt_number:n(a.shirt_number),squad_status:a.status,source_composition_url:a.source_comp||null,source_number_url:a.source_num||null,verification:a.verification||null};}).filter(Boolean);
    await upsert('match_appearances',appRows,'match_id,player_id');summary.appearances.upserted=appRows.length;

    const goalRows=data.goals.map(g=>{const m=matchBySource.get(g.match_source_id);if(!m)return null;const p=norm(g.team_name)==='france'?playerByName.get(norm(g.scorer_name)):null;return{source_goal_id:g.source_goal_id,match_id:m.id,player_id:p?.id||null,scorer_name:g.scorer_name,team_name:g.team_name,minute_text:g.minute_text||null,score_after:g.score_after||null,source_url:g.source_url||null};}).filter(Boolean);
    await upsert('match_goal_events',goalRows,'source_goal_id');summary.goals.upserted=goalRows.length;

    const officialRows=data.officials.map(o=>{const m=matchBySource.get(o.match_source_id),p=peopleByKey.get(`${norm(o.name)}|arbitre`);return m&&p?{match_id:m.id,person_id:p.id,role:o.role}:null;}).filter(Boolean);
    await upsert('match_officials',officialRows,'match_id,person_id,role');

    summary.ok=true;console.log(JSON.stringify(summary));return{statusCode:200,body:JSON.stringify(summary)};
  }catch(e){summary.error=e.message;console.error('import-u23f',e);console.log(JSON.stringify(summary));return{statusCode:200,body:JSON.stringify(summary)};}
};
