/* 3615 Bleus V1.1.61.24 — recherche statistique en langage naturel */
(() => {
  'use strict';

  const S = window.BLEUS3000_SEARCH;
  if (!S) return;
  const norm = S.normalize;
  const escReg = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cfg = window.BLEUS3000_CONFIG || {};
  let client = null;
  let catalog = null;
  let catalogPromise = null;

  const INTENT_WORDS = [
    'but','buts','buteur','buteurs','marque','marques','marqué','marques',
    'passe','passes','passeur','passeurs','assist','assists','decisive','décisive','décisives',
    'carton','cartons','jaune','rouge','titulaire','titulaires','capitaine','capitanat',
    'remplace','remplacé','remplacant','remplaçant','remplacants','remplaçants',
    'numero','numéro','maillot','selection','sélection','match','matchs','victoire','victoires',
    'doublé','double','triplé','triple','premier','première','dernier','dernière','mi temps','pause'
  ];

  function waitClient(timeout = 5000) {
    client = window.BLEUS3000_SUPABASE || client;
    if (client) return Promise.resolve(client);
    return new Promise(resolve => {
      let done = false;
      const finish = c => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('bleus:supabase-ready', ready);
        client = c || window.BLEUS3000_SUPABASE || null;
        resolve(client);
      };
      const ready = e => finish(e.detail?.client);
      window.addEventListener('bleus:supabase-ready', ready);
      const timer = setTimeout(() => finish(null), timeout);
    });
  }

  const playerPhoto = p => {
    const path = String(p?.photo_path || '').trim();
    if (!path || !client) return '';
    try { return client.storage.from('player-photos').getPublicUrl(path).data.publicUrl || ''; }
    catch { return ''; }
  };

  const displayDate = value => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0,10);
    return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(d);
  };

  const minuteInfo = value => {
    const raw = String(value || '').trim();
    const m = raw.match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
    if (!m) return {base:null,total:null,text:raw};
    const base = Number(m[1]);
    const extra = Number(m[2] || 0);
    return {base,total:base + extra,text:raw};
  };

  function shouldHandle(query) {
    const q = norm(query);
    if (q.length < 4) return false;
    return INTENT_WORDS.some(w => q.includes(norm(w))) || /\b\d{1,3}\s*(?:e|eme)?\s*(?:minute|min)?\b/.test(q);
  }

  function nameParts(p) {
    const full = norm(p.display_name || '');
    const words = full.split(' ').filter(Boolean);
    return {
      full,
      first: words[0] || '',
      last: words[words.length - 1] || '',
      keys: [...new Set([full, words[0], words[words.length-1], ...words].filter(x => x && x.length >= 3))]
    };
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    if (catalogPromise) return catalogPromise;
    catalogPromise = (async () => {
      const db = await waitClient();
      if (!db) throw new Error('Supabase indisponible');

      // Le store relationnel contient déjà les noms éditoriaux corrigés des matchs.
      try { await window.BLEUS3000_RELATIONAL_REFS?.load?.(); } catch {}
      const refs = window.BLEUS3000_RELATIONAL_REFS;

      const [{data:players,error:pe},{data:people,error:ppe},{data:allCompetitions,error:ace},{data:competitionEntities,error:cee},{data:competitionFamilies,error:cfe},{data:familyLinks,error:fle}] = await Promise.all([
        db.from('players').select('id,display_name,photo_path,first_name,last_name').eq('gender','M').order('display_name').limit(5000),
        db.from('personnel').select('id,display_name,person_type,photo_path,photo_url').order('display_name').limit(1000),
        db.from('competitions').select('id,name,edition,logo_url,canonical_entity_id,canonical_edition_id').order('name').limit(5000),
        db.from('competition_entities').select('id,name,aliases').order('name').limit(1000),
        db.from('competition_families').select('id,name,slug').order('name').limit(1000),
        db.from('competition_family_entities').select('family_id,competition_entity_id').limit(5000)
      ]);
      if (pe) throw pe;
      if (ppe) console.warn('Smart search personnel', ppe);
      if (ace) console.warn('Smart search competitions', ace);
      if (cee) console.warn('Smart search entités compétitions', cee);
      if (cfe) console.warn('Smart search familles compétitions', cfe);
      if (fle) console.warn('Smart search liens compétitions', fle);

      let matches = refs?.matches ? refs.matches.map(x => ({...x})) : [];
      let opponents = refs?.getOpponents?.() || [];
      let competitions = refs?.getCompetitions?.() || [];
      let stadiums = refs?.getStadiums?.() || [];
      let staff = refs?.people || people || [];

      // Fallback si le store relationnel n'est pas encore prêt.
      if (!matches.length) {
        const {data:mm,error:me} = await db.from('matches')
          .select('id,match_date,gender,selection_category,home_away,france_score,opponent_score,status,phase,opponent_id,competition_id,place_id,coach_id,manual_overrides')
          .eq('gender',cfg.SELECTION_GENDER || 'M')
          .eq('selection_category',cfg.SELECTION_CATEGORY || 'A')
          .order('match_date',{ascending:false}).limit(5000);
        if (me) throw me;
        matches = mm || [];
        const oppIds=[...new Set(matches.map(x=>x.opponent_id).filter(Boolean))];
        const compIds=[...new Set(matches.map(x=>x.competition_id).filter(Boolean))];
        const placeIds=[...new Set(matches.map(x=>x.place_id).filter(Boolean))];
        const coachIds=[...new Set(matches.map(x=>x.coach_id).filter(Boolean))];
        const [o,c,p,co] = await Promise.all([
          oppIds.length?db.from('opponents').select('id,name,flag_url,federation_logo_url').in('id',oppIds):Promise.resolve({data:[]}),
          compIds.length?db.from('competitions').select('id,name,edition,logo_url').in('id',compIds):Promise.resolve({data:[]}),
          placeIds.length?db.from('places').select('id,name,city,country,photo_path,photo_url').in('id',placeIds):Promise.resolve({data:[]}),
          coachIds.length?db.from('personnel').select('id,display_name,person_type,photo_path,photo_url').in('id',coachIds):Promise.resolve({data:[]})
        ]);
        opponents=o.data||[]; competitions=c.data||[]; stadiums=p.data||[];
        const coachMap=new Map((co.data||[]).map(x=>[String(x.id),x]));
        const om=new Map(opponents.map(x=>[String(x.id),x]));
        const cm=new Map(competitions.map(x=>[String(x.id),x]));
        const pm=new Map(stadiums.map(x=>[String(x.id),x]));
        matches=matches.map(m=>({...m,opponent:om.get(String(m.opponent_id))||null,competition:cm.get(String(m.competition_id))||null,place:pm.get(String(m.place_id))||null,coach:coachMap.get(String(m.coach_id))||null}));
        staff = people || [];
      }

      const directCompetitionMap=new Map((allCompetitions||[]).map(x=>[String(x.id),x]));
      competitions=(competitions||[]).map(c=>({...c,...(directCompetitionMap.get(String(c.id))||{})}));
      matches=matches.map(m=>{const dc=directCompetitionMap.get(String(m.competition_id));return dc?{...m,competition:{...(m.competition||{}),...dc}}:m;});
      const entityRows=(competitionEntities||[]).map(x=>({...x,_searchKind:'entity'}));
      const familyRows=(competitionFamilies||[]).map(x=>({...x,_searchKind:'family'}));
      const directRows=(allCompetitions||[]).map(x=>({...x,_searchKind:'competition'}));
      const entityIdsByFamily=new Map();
      for(const link of (familyLinks||[])){const key=String(link.family_id);if(!entityIdsByFamily.has(key))entityIdsByFamily.set(key,new Set());entityIdsByFamily.get(key).add(String(link.competition_entity_id));}
      const competitionSearch=[...directRows,...entityRows,...familyRows];
      const playerRows=(players||[]).map(p=>({...p,_name:nameParts(p)}));
      catalog = {
        players: playerRows,
        playerById: new Map(playerRows.map(x=>[String(x.id),x])),
        matches,
        matchById: new Map(matches.map(x=>[String(x.id),x])),
        opponents,
        competitions,
        competitionSearch,
        competitionById: directCompetitionMap,
        entityIdsByFamily,
        stadiums,
        staff: staff || people || []
      };
      return catalog;
    })().finally(() => { catalogPromise = null; });
    return catalogPromise;
  }

  function findMentionedEntities(q, rows, valueFn) {
    const nq=norm(q),stop=new Set(['de','du','des','la','le','les','pour','en','et','fifa','uefa']);
    const hits=[];
    for(const row of rows||[]){
      const raw=valueFn(row),values=(Array.isArray(raw)?raw:[raw]).map(norm).filter(Boolean);
      let best=-Infinity,bestValue='';
      for(const value of values){
        if(nq.includes(value)){const score=10000+value.length;if(score>best){best=score;bestValue=value;}continue;}
        const toks=value.split(' ').filter(x=>x.length>=3&&!stop.has(x));
        if(!toks.length)continue;
        const matched=toks.filter(t=>new RegExp(`(?:^| )${escReg(t)}(?: |$)`).test(nq));
        const ratio=matched.length/toks.length;
        if((toks.length===1&&matched.length===1)||(matched.length>=2&&ratio>=.5)){
          const score=matched.length*100+ratio*50-value.length*.01;
          if(score>best){best=score;bestValue=value;}
        }
      }
      if(Number.isFinite(best)&&best>-Infinity)hits.push({row,value:bestValue,score:best});
    }
    return hits.sort((a,b)=>b.score-a.score||b.value.length-a.value.length);
  }

  function resolvePlayer(text, cat, excludeIds = new Set()) {
    const n = norm(text).replace(/\b(de|du|des|la|le|les|un|une|pour|vers|a|avec|sur|en|par)\b/g,' ').replace(/\s+/g,' ').trim();
    if (!n) return null;
    let best=null,bestScore=Infinity;
    for (const p of cat.players) {
      if (excludeIds.has(String(p.id))) continue;
      const np=p._name;
      let score=Infinity;
      if(n===np.full||n===np.last||n===np.first)score=0;
      else if(n.includes(np.full)||np.full.includes(n))score=.04;
      else if(np.last.length>=3&&(n===np.last||n.endsWith(' '+np.last)||n.includes(np.last)))score=.06;
      else score=S.scoreAny(n,[p.display_name,p.first_name,p.last_name,np.last]);
      if(score<bestScore){bestScore=score;best=p;}
    }
    return bestScore<=.34?best:null;
  }

  function playersMentioned(query,cat) {
    const nq=norm(query),hits=[];
    for(const p of cat.players){
      const np=p._name;
      let pos=-1,key='';
      for(const k of [np.full,np.last,np.first]){
        if(!k||k.length<3)continue;
        const i=nq.indexOf(k);
        if(i>=0&&(pos<0||k.length>key.length)){pos=i;key=k;}
      }
      if(pos>=0)hits.push({player:p,pos,len:key.length});
    }
    hits.sort((a,b)=>a.pos-b.pos||b.len-a.len);
    const unique=[];const seen=new Set();
    for(const h of hits){if(seen.has(String(h.player.id)))continue;seen.add(String(h.player.id));unique.push(h.player);}
    return unique;
  }

  function parseTime(q) {
    const n=norm(q);
    const between=n.match(/\bentre\s+(\d{1,3})\s+(?:et|a)\s+(\d{1,3})/);
    if(between)return {kind:'between',min:Number(between[1]),max:Number(between[2])};
    const after=n.match(/\b(?:apres|a partir de|plus de)\s+(?:la\s+)?(\d{1,3})/);
    if(after)return {kind:'after',min:Number(after[1])};
    const before=n.match(/\bavant\s+(?:la\s+)?(\d{1,3})/);
    if(before)return {kind:'before',max:Number(before[1])};
    if(/\b(premiere mi temps|1ere mi temps|premiere periode|avant la pause|0 45)\b/.test(n))return {kind:'first_half'};
    if(/\b(deuxieme mi temps|seconde mi temps|2e mi temps|2eme mi temps|deuxieme periode|apres la pause|46 90)\b/.test(n))return {kind:'second_half'};
    return null;
  }

  function timeMatches(value,filter){
    if(!filter)return true;
    const m=minuteInfo(value);if(m.base==null)return false;
    if(filter.kind==='first_half')return m.base<=45;
    if(filter.kind==='second_half')return m.base>=46;
    if(filter.kind==='after')return m.total>=filter.min;
    if(filter.kind==='before')return m.total<=filter.max;
    if(filter.kind==='between')return m.total>=filter.min&&m.total<=filter.max;
    return true;
  }

  function detectPhase(q){
    const n=norm(q);
    if(n.includes('demi finale'))return 'demi';
    if(n.includes('quart de finale')||n.includes('quarts de finale'))return 'quart';
    if(n.includes('finale'))return 'finale';
    return '';
  }

  function parseQuery(query,cat){
    const n=norm(query);
    const mentioned=playersMentioned(query,cat);
    const opponentHit=findMentionedEntities(query,cat.opponents,x=>x.name)[0]?.row||null;
    const competitionHit=findMentionedEntities(query,cat.competitionSearch||cat.competitions,x=>[x.name||'',...(Array.isArray(x.aliases)?x.aliases:[]),x.edition||''])[0]?.row||null;
    const stadiumHit=findMentionedEntities(query,cat.stadiums,x=>`${x.name||''} ${x.city||''}`)[0]?.row||null;
    const staffHit=findMentionedEntities(query,cat.staff,x=>x.display_name||'')[0]?.row||null;
    const time=parseTime(query),phase=detectPhase(query);
    const shirt=n.match(/\b(?:numero|num)\s*(\d{1,2})\b/);
    const cardColor=n.includes('rouge')?'red':(n.includes('jaune')?'yellow':'');
    const goalType=n.includes('tete')?'header':n.includes('penalty')||n.includes('penalties')?'penalty':n.includes('coup franc')?'free_kick':'';

    let intent='';
    if(/\b(doubles|double|doublé|double)\b/.test(n)&&/\bbut/.test(n))intent='multi_goal';
    else if(/\btriple|triplé\b/.test(n)&&/\bbut/.test(n))intent='multi_goal';
    else if(/\b(passe|passes|passeur|assist|assists)\b/.test(n)&&mentioned.length>=2)intent='assist_pair';
    else if(/\b(carton|cartons)\b/.test(n))intent='cards';
    else if(/\b(remplace|remplace par|remplacant|remplaçant)\b/.test(n))intent='replacement';
    else if(/\b(capitaine|capitanat)\b/.test(n))intent='appearances';
    else if(/\b(titulaire|titulaires)\b/.test(n))intent='appearances';
    else if(shirt)intent='appearances';
    else if(/\b(victoire|victoires)\b/.test(n)&&/\b(selectionneur|coach|entraineur)\b/.test(n))intent='coach_matches';
    else if(/\bbut|buts|buteur|buteurs\b/.test(n))intent='goals';
    else if(/\bmatch|matchs|selection|selections\b/.test(n)&&mentioned.length)intent='appearances';
    else if(/\bpasse|passes|assist|assists\b/.test(n))intent='assists';

    let scorer=null,assist=null,incoming=null,outgoing=null;
    if(intent==='assist_pair'){
      let m=n.match(/(?:passe(?:s)?(?: decisive(?:s)?)?|assist(?:s)?)\s+(?:de\s+)?(.+?)\s+(?:pour|vers|a)\s+(.+)$/);
      if(m){assist=resolvePlayer(m[1],cat);scorer=resolvePlayer(m[2],cat,new Set(assist?[String(assist.id)]:[]));}
      if((!assist||!scorer)&&/\bbut/.test(n)&&/\bassist/.test(n)){
        m=n.match(/but(?:s)?(?: de)?\s+(.+?)\s+assist(?:e|s|ance)?\s+(.+)$/);
        if(m){scorer=scorer||resolvePlayer(m[1],cat);assist=assist||resolvePlayer(m[2],cat,new Set(scorer?[String(scorer.id)]:[]));}
      }
      if((!assist||!scorer)&&mentioned.length>=2){
        if(/\bbut/.test(n)&&/\bassist/.test(n)){scorer=scorer||mentioned[0];assist=assist||mentioned[1];}
        else{assist=assist||mentioned[0];scorer=scorer||mentioned[1];}
      }
    }else if(intent==='replacement'){
      let m=n.match(/^(.+?)\s+remplace\s+(.+)$/);
      if(m){incoming=resolvePlayer(m[1],cat);outgoing=resolvePlayer(m[2],cat,new Set(incoming?[String(incoming.id)]:[]));}
      m=n.match(/^(.+?)\s+(?:est\s+)?remplace\s+par\s+(.+)$/);
      if(m){outgoing=resolvePlayer(m[1],cat);incoming=resolvePlayer(m[2],cat,new Set(outgoing?[String(outgoing.id)]:[]));}
      incoming=incoming||mentioned[0]||null;outgoing=outgoing||mentioned.find(p=>!incoming||String(p.id)!==String(incoming.id))||null;
    }else{
      scorer=mentioned[0]||null;
    }

    return {
      raw:query,norm:n,intent,players:mentioned,player:scorer,scorer,assist,incoming,outgoing,
      opponent:opponentHit,competition:competitionHit,stadium:stadiumHit,staff:staffHit,
      time,phase,shirtNumber:shirt?Number(shirt[1]):null,cardColor,goalType,
      onlyFirst:/\b(premier but|premiere passe|premier carton)\b/.test(n),
      onlyLast:/\b(dernier but|derniere passe|dernier carton)\b/.test(n),
      starters:/\btitulaire|titulaires\b/.test(n),captain:/\bcapitaine|capitanat\b/.test(n),
      substituteGoals:/\bbut(?:s)?\s+(?:de|des)\s+remplacant/.test(n),
      multiNeeded:/\btriple|triplé\b/.test(n)?3:2
    };
  }

  function matchMeta(m,cat){
    if(!m)return {opponent:'Adversaire',competition:'Match international',place:'',coach:'',date:''};
    const refs=window.BLEUS3000_RELATIONAL_REFS;
    const eff=(field,fallback='')=>refs?.effective?refs.effective(m,field):(m[field]??fallback);
    const opp=eff('opponent_name')||m.opponent?.name||cat.opponents.find(x=>String(x.id)===String(m.opponent_id))?.name||'Adversaire';
    const comp=eff('competition_name')||m.competition?.name||cat.competitions.find(x=>String(x.id)===String(m.competition_id))?.name||'Match international';
    const place=eff('venue_name')||m.place?.name||cat.stadiums.find(x=>String(x.id)===String(m.place_id))?.name||'';
    const coach=m.coach?.display_name||cat.staff.find(x=>String(x.id)===String(m.coach_id))?.display_name||'';
    return {opponent:opp,competition:comp,place,coach,date:eff('match_date')||m.match_date||''};
  }

  function matchPassesFilters(m,p,cat){
    if(!m)return false;
    const meta=matchMeta(m,cat);
    if(p.opponent&&String(m.opponent_id)!==String(p.opponent.id)&&norm(meta.opponent)!==norm(p.opponent.name))return false;
    if(p.competition){
      const comp=cat.competitionById?.get(String(m.competition_id))||m.competition||{};
      let ok=false;
      if(p.competition._searchKind==='competition')ok=String(m.competition_id)===String(p.competition.id)||norm(meta.competition).includes(norm(p.competition.name));
      else if(p.competition._searchKind==='entity')ok=String(comp.canonical_entity_id||'')===String(p.competition.id)||norm(meta.competition).includes(norm(p.competition.name));
      else if(p.competition._searchKind==='family'){
        const ids=cat.entityIdsByFamily?.get(String(p.competition.id))||new Set();ok=ids.has(String(comp.canonical_entity_id||''))||norm(meta.competition).includes(norm(p.competition.name));
      }else ok=norm(meta.competition).includes(norm(p.competition.name));
      if(!ok)return false;
    }
    if(p.stadium&&String(m.place_id)!==String(p.stadium.id)&&!norm(meta.place).includes(norm(p.stadium.name)))return false;
    if(p.phase&& !norm(m.phase||'').includes(p.phase))return false;
    return true;
  }

  function scoreText(m,cat){
    if(!m)return '';
    const fs=m.france_score,os=m.opponent_score;
    if(fs==null||os==null)return '';
    const away=String(m.home_away||'').toLowerCase()==='away';
    const meta=matchMeta(m,cat);
    return away?`${meta.opponent} ${os}–${fs} France`:`France ${fs}–${os} ${meta.opponent}`;
  }

  function resultAction(matchId,openSheet=true){
    return () => openSheet?window.BLEUS3000_RELATIONAL_REFS?.openMatchSheet?.(matchId):window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(matchId);
  }

  function eventResult(type,icon,row,m,cat,title,extra='',image=''){
    const meta=matchMeta(m,cat);const score=scoreText(m,cat);
    return {
      type,icon,image,title,
      meta:[extra,score,meta.competition,displayDate(meta.date)].filter(Boolean).join(' · '),
      score:-1,smart:true,action:resultAction(row.match_id||m?.id,true)
    };
  }

  function chronologicalKey(row,cat){
    const m=cat.matchById.get(String(row.match_id));
    const d=new Date(matchMeta(m,cat).date||0).getTime()||0;
    const mi=minuteInfo(row.minute_text).total||0;
    return d*1000+mi;
  }

  async function queryGoals(p,cat){
    let q=client.from('match_goal_events').select('id,match_id,player_id,scorer_name,team_name,minute_text,score_after,assist_player_id,assist_name,goal_type,body_part,is_penalty,is_own_goal');
    if(p.scorer?.id)q=q.eq('player_id',p.scorer.id);else q=q.not('player_id','is',null);
    if(p.assist?.id)q=q.eq('assist_player_id',p.assist.id);
    if(p.goalType==='header')q=q.or('goal_type.eq.header,body_part.eq.head');
    if(p.goalType==='penalty')q=q.eq('is_penalty',true);
    if(p.goalType==='free_kick')q=q.eq('goal_type','free_kick');
    const {data,error}=await q.order('created_at',{ascending:true}).limit(3000);if(error)throw error;
    let rows=(data||[]).filter(r=>timeMatches(r.minute_text,p.time)&&matchPassesFilters(cat.matchById.get(String(r.match_id)),p,cat));

    if(p.substituteGoals){
      const mids=[...new Set(rows.map(x=>x.match_id))];
      if(mids.length){
        const ids=[...new Set(rows.map(x=>x.player_id).filter(Boolean))];
        const {data:apps,error:ae}=await client.from('match_appearances').select('match_id,player_id,starter,appeared').in('match_id',mids).in('player_id',ids).eq('appeared',true).eq('starter',false).limit(5000);
        if(ae)throw ae;const keys=new Set((apps||[]).map(a=>`${a.match_id}|${a.player_id}`));rows=rows.filter(r=>keys.has(`${r.match_id}|${r.player_id}`));
      }else rows=[];
    }

    rows.sort((a,b)=>chronologicalKey(a,cat)-chronologicalKey(b,cat));
    if(p.onlyFirst)rows=rows.slice(0,1);if(p.onlyLast)rows=rows.slice(-1);

    if(p.intent==='multi_goal'){
      const by=new Map();for(const r of rows){const key=String(r.match_id);if(!by.has(key))by.set(key,[]);by.get(key).push(r);}const out=[];
      for(const group of by.values()){
        if(group.length<p.multiNeeded)continue;const r=group[0],m=cat.matchById.get(String(r.match_id)),pl=cat.playerById.get(String(r.player_id));
        out.push(eventResult('Statistiques',p.multiNeeded===3?'🎩':'⚽',r,m,cat,`${p.multiNeeded===3?'Triplé':'Doublé'} de ${pl?.display_name||r.scorer_name}`,`${group.length} buts dans ce match`,playerPhoto(pl)));
      }
      return out.reverse().slice(0,80);
    }

    return rows.slice().reverse().slice(0,100).map(r=>{
      const m=cat.matchById.get(String(r.match_id)),pl=cat.playerById.get(String(r.player_id)),ap=cat.playerById.get(String(r.assist_player_id));
      const minute=r.minute_text?`⚽ ${r.minute_text}'`: '⚽ But';
      const assist=r.assist_name||ap?.display_name;
      const title=p.intent==='assist_pair'?`${assist||p.assist?.display_name||'Passeur'} → ${pl?.display_name||r.scorer_name}`:`${pl?.display_name||r.scorer_name} · ${minute}`;
      const extra=p.intent==='assist_pair'?`${minute}${r.score_after?` · ${r.score_after}`:''}`:[minute,assist?`passe ${assist}`:'',r.score_after||''].filter(Boolean).join(' · ');
      return eventResult(p.intent==='assist_pair'?'Passes décisives':'Buts',p.intent==='assist_pair'?'➡️':'⚽',r,m,cat,title,extra,playerPhoto(p.intent==='assist_pair'?(p.assist||ap):pl));
    });
  }

  async function queryAssists(p,cat){
    // Une passe décisive est stockée sur le but : on délègue au même moteur.
    if(!p.assist&&p.player)p.assist=p.player;
    const copy={...p,scorer:null,intent:'assists'};
    let q=client.from('match_goal_events').select('id,match_id,player_id,scorer_name,team_name,minute_text,score_after,assist_player_id,assist_name,goal_type,body_part,is_penalty,is_own_goal');
    if(copy.assist?.id)q=q.eq('assist_player_id',copy.assist.id);else q=q.not('assist_player_id','is',null);
    const {data,error}=await q.limit(3000);if(error)throw error;
    let rows=(data||[]).filter(r=>timeMatches(r.minute_text,p.time)&&matchPassesFilters(cat.matchById.get(String(r.match_id)),p,cat));
    rows.sort((a,b)=>chronologicalKey(a,cat)-chronologicalKey(b,cat));if(p.onlyFirst)rows=rows.slice(0,1);if(p.onlyLast)rows=rows.slice(-1);
    return rows.slice().reverse().slice(0,100).map(r=>{const m=cat.matchById.get(String(r.match_id)),ap=cat.playerById.get(String(r.assist_player_id)),sc=cat.playerById.get(String(r.player_id));return eventResult('Passes décisives','➡️',r,m,cat,`${ap?.display_name||r.assist_name||'Passeur'} → ${sc?.display_name||r.scorer_name}`,`⚽ ${r.minute_text?`${r.minute_text}' · `:''}${r.scorer_name}`,playerPhoto(ap));});
  }

  async function queryCards(p,cat){
    let q=client.from('match_card_events').select('id,match_id,player_id,player_name,team_name,card_type,minute_text');
    if(p.player?.id)q=q.eq('player_id',p.player.id);else q=q.not('player_id','is',null);
    if(p.cardColor==='red')q=q.in('card_type',['red','second_yellow']);
    else if(p.cardColor==='yellow')q=q.in('card_type',['yellow','second_yellow']);
    const {data,error}=await q.limit(3000);if(error)throw error;
    let rows=(data||[]).filter(r=>timeMatches(r.minute_text,p.time)&&matchPassesFilters(cat.matchById.get(String(r.match_id)),p,cat));
    rows.sort((a,b)=>chronologicalKey(a,cat)-chronologicalKey(b,cat));if(p.onlyFirst)rows=rows.slice(0,1);if(p.onlyLast)rows=rows.slice(-1);
    return rows.slice().reverse().slice(0,100).map(r=>{const m=cat.matchById.get(String(r.match_id)),pl=cat.playerById.get(String(r.player_id)),red=/red/.test(r.card_type),icon=red?'🟥':'🟨';return eventResult('Cartons',icon,r,m,cat,`${pl?.display_name||r.player_name} · ${icon} ${r.minute_text?`${r.minute_text}'`:''}`,r.card_type==='second_yellow'?'Second jaune':'' ,playerPhoto(pl));});
  }

  async function queryAppearances(p,cat){
    const players=p.players?.length?p.players:(p.player?[p.player]:[]);
    if(!players.length)return [];
    let q=client.from('match_appearances').select('id,match_id,player_id,player_name,starter,minutes,captain,position,shirt_number,squad_status,appeared,replaced_by_player_id,replaced_by_name');
    q=q.in('player_id',players.map(x=>x.id)).eq('appeared',true);
    if(p.starters)q=q.eq('starter',true);if(p.captain)q=q.eq('captain',true);if(p.shirtNumber!=null)q=q.eq('shirt_number',p.shirtNumber);
    const {data,error}=await q.limit(5000);if(error)throw error;
    let rows=data||[];
    if(players.length>1){const wanted=new Set(players.map(x=>String(x.id))),by=new Map();for(const r of rows){const key=String(r.match_id);if(!by.has(key))by.set(key,new Set());by.get(key).add(String(r.player_id));}const ok=new Set([...by].filter(([,ids])=>[...wanted].every(x=>ids.has(x))).map(([id])=>id));rows=rows.filter(r=>ok.has(String(r.match_id)));}
    const seen=new Set(),out=[];
    rows.sort((a,b)=>new Date(matchMeta(cat.matchById.get(String(b.match_id)),cat).date||0)-new Date(matchMeta(cat.matchById.get(String(a.match_id)),cat).date||0));
    for(const r of rows){if(seen.has(String(r.match_id)))continue;const m=cat.matchById.get(String(r.match_id));if(!matchPassesFilters(m,p,cat))continue;seen.add(String(r.match_id));const meta=matchMeta(m,cat);const detail=[];if(p.starters)detail.push('Titulaire');if(p.captain)detail.push('Capitaine');if(p.shirtNumber!=null)detail.push(`N° ${p.shirtNumber}`);if(players.length>1)detail.push(players.map(x=>x.display_name).join(' + '));out.push({type:'Matchs',icon:p.captain?'©️':'👕',title:scoreText(m,cat)||`France – ${meta.opponent}`,meta:[detail.join(' · '),meta.competition,displayDate(meta.date)].filter(Boolean).join(' · '),score:-1,smart:true,action:resultAction(r.match_id,true)});if(out.length>=100)break;}
    return out;
  }

  async function queryReplacements(p,cat){
    let q=client.from('match_appearances').select('id,match_id,player_id,player_name,replaced_by_player_id,replaced_by_name,appeared');
    if(p.incoming?.id)q=q.eq('replaced_by_player_id',p.incoming.id);if(p.outgoing?.id)q=q.eq('player_id',p.outgoing.id);
    if(!p.incoming&&!p.outgoing)return [];
    const {data,error}=await q.limit(3000);if(error)throw error;
    return (data||[]).filter(r=>r.replaced_by_player_id&&matchPassesFilters(cat.matchById.get(String(r.match_id)),p,cat)).slice(0,100).map(r=>{const m=cat.matchById.get(String(r.match_id)),out=cat.playerById.get(String(r.player_id)),inc=cat.playerById.get(String(r.replaced_by_player_id));const meta=matchMeta(m,cat);return {type:'Remplacements',icon:'🔄',image:playerPhoto(inc),title:`${out?.display_name||r.player_name||'Joueur'} → ${inc?.display_name||r.replaced_by_name||'Remplaçant'}`,meta:[scoreText(m,cat),meta.competition,displayDate(meta.date)].filter(Boolean).join(' · '),score:-1,smart:true,action:resultAction(r.match_id,true)};});
  }

  async function queryCoachMatches(p,cat){
    const coach=p.staff;if(!coach)return [];
    return cat.matches.filter(m=>String(m.coach_id)===String(coach.id)&&matchPassesFilters(m,p,cat)).filter(m=>{if(!/victoire/.test(p.norm))return true;return Number(m.france_score)>Number(m.opponent_score);}).sort((a,b)=>new Date(matchMeta(b,cat).date||0)-new Date(matchMeta(a,cat).date||0)).slice(0,100).map(m=>{const meta=matchMeta(m,cat);return {type:'Matchs',icon:'👔',title:scoreText(m,cat)||`France – ${meta.opponent}`,meta:[coach.display_name,meta.competition,displayDate(meta.date)].filter(Boolean).join(' · '),score:-1,smart:true,action:resultAction(m.id,false)};});
  }

  function interpretation(p){
    const parts=[];
    const intentLabel={goals:'Buts',assist_pair:'Passes décisives',assists:'Passes décisives',cards:'Cartons',appearances:'Matchs / apparitions',replacement:'Remplacements',multi_goal:p.multiNeeded===3?'Triplés':'Doublés',coach_matches:'Matchs du sélectionneur'}[p.intent];
    if(intentLabel)parts.push(intentLabel);
    if(p.assist&&p.scorer)parts.push(`${p.assist.display_name} → ${p.scorer.display_name}`);else if(p.player)parts.push(p.player.display_name);else if(p.players?.length>1)parts.push(p.players.map(x=>x.display_name).join(' + '));
    if(p.opponent)parts.push(`contre ${p.opponent.name}`);if(p.competition)parts.push(p.competition.name);if(p.stadium)parts.push(p.stadium.name);if(p.phase)parts.push(p.phase);
    if(p.time?.kind==='first_half')parts.push('1re mi-temps');if(p.time?.kind==='second_half')parts.push('2e mi-temps');if(p.time?.kind==='after')parts.push(`après ${p.time.min}'`);if(p.time?.kind==='before')parts.push(`avant ${p.time.max}'`);if(p.time?.kind==='between')parts.push(`${p.time.min}'–${p.time.max}'`);
    if(p.cardColor)parts.push(p.cardColor==='red'?'rouges':'jaunes');if(p.shirtNumber!=null)parts.push(`n° ${p.shirtNumber}`);if(p.captain)parts.push('capitaine');if(p.starters)parts.push('titulaire');
    return parts.join(' · ');
  }

  async function search(query){
    if(!shouldHandle(query))return {handled:false,rows:[],interpretation:''};
    const cat=await loadCatalog();const p=parseQuery(query,cat);
    if(!p.intent)return {handled:false,rows:[],interpretation:''};
    let rows=[];
    if(p.intent==='goals'||p.intent==='assist_pair'||p.intent==='multi_goal')rows=await queryGoals(p,cat);
    else if(p.intent==='assists')rows=await queryAssists(p,cat);
    else if(p.intent==='cards')rows=await queryCards(p,cat);
    else if(p.intent==='appearances')rows=await queryAppearances(p,cat);
    else if(p.intent==='replacement')rows=await queryReplacements(p,cat);
    else if(p.intent==='coach_matches')rows=await queryCoachMatches(p,cat);
    return {handled:true,rows,interpretation:interpretation(p),parsed:p};
  }

  function invalidate(){catalog=null;catalogPromise=null;}
  window.addEventListener('bleus:player-registry',invalidate);
  window.addEventListener('bleus:relational-registry',invalidate);

  window.BLEUS3000_SMART_SEARCH={shouldHandle,search,parseQuery:async q=>parseQuery(q,await loadCatalog()),invalidate};
})();
