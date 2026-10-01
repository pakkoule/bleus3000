/* 3615 Bleus V1.3.1 — Statistiques V2 · records fun des XI + indice Équipe type */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.BLEUS3000_SUPABASE||null;
  const canEdit=()=>['admin','superadmin'].includes(String(window.C3K_ACCOUNT_STATE?.profile?.role||window.C3K_ACCOUNT_STATE?.role||'').toLowerCase());
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const pct=(a,b)=>b?`${(100*a/b).toLocaleString('fr-FR',{maximumFractionDigits:1})} %`:'—';
  const byId=(arr,key='id')=>new Map(arr.map(x=>[String(x?.[key]),x]));
  const frDate=v=>{const d=new Date(v);return Number.isNaN(+d)?'—':new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(d);};
  const fmt1=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
  const matchDateValue=m=>m?.manual_overrides?.match_date||m?.match_date||null;
  const teamTypeRaw=m=>{const raw=m?.team_type_score_raw;if(raw===null||raw===undefined||raw==='')return null;const v=Number(raw);return Number.isFinite(v)?v:null;};
  const ageAt=(birth,when)=>{const b=new Date(birth),d=new Date(when);if(Number.isNaN(+b)||Number.isNaN(+d)||d<b)return null;return (d-b)/(365.2425*24*3600*1000);};
  const stages=['A'];
  const stageLabels={A:'Équipe de France'};
  const state={loaded:false,loading:false,tab:'bleu_moyen',gender:'M',generation:null,balanceDimension:'decade',balanceSelection:'all',recordMetric:'goals',recordSelection:'all',query:'',detail:null,
    players:[],selections:[],tags:[],stats:[],matches:[],competitions:[],opponents:[],places:[],personnel:[],appearances:[],goals:[],officials:[],fifa:[]};

  async function fetchAll(make,pageSize=1000){const out=[];for(let from=0;;from+=pageSize){const {data,error}=await make().range(from,from+pageSize-1);if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<pageSize)break;}return out;}
  function resetMaps(){state.playerMap=byId(state.players);state.selectionMap=byId(state.selections);state.tagMap=byId(state.tags);state.competitionMap=byId(state.competitions);state.opponentMap=byId(state.opponents);state.placeMap=byId(state.places);state.personnelMap=byId(state.personnel);state.matchMap=byId(state.matches);state.statsByPlayer=new Map();for(const r of state.stats){const k=String(r.player_id);if(!state.statsByPlayer.has(k))state.statsByPlayer.set(k,[]);state.statsByPlayer.get(k).push(r);}state.appearancesByMatch=new Map();for(const a of state.appearances){const k=String(a.match_id);if(!state.appearancesByMatch.has(k))state.appearancesByMatch.set(k,[]);state.appearancesByMatch.get(k).push(a);}state.officialsByMatch=new Map();for(const o of state.officials){const k=String(o.match_id);if(!state.officialsByMatch.has(k))state.officialsByMatch.set(k,[]);state.officialsByMatch.get(k).push(o);}}
  async function load(force=false){if(state.loaded&&!force)return;if(state.loading)return;const c=db();if(!c)throw new Error('Supabase indisponible');state.loading=true;try{
    const [players,selections,tags,stats,matches,competitions,opponents,places,personnel,appearances,goals,officials,fifa]=await Promise.all([
      fetchAll(()=>c.from('players').select('id,display_name,gender,birth_date,active').eq('active',true).eq('gender','M').order('display_name')),
      fetchAll(()=>c.from('selection_teams').select('id,code,name,gender,category,sort_order,team_tag_id').eq('active',true).eq('code','FRA-A-M').order('sort_order')),
      fetchAll(()=>c.from('tags').select('id,slug,label_text').eq('is_active',true)),
      fetchAll(()=>c.from('player_selection_stats').select('player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,appearance_status,first_year,last_year')),
      fetchAll(()=>c.from('matches').select('id,match_date,manual_overrides,chronological_number,gender,selection_team_id,selection_category,competition_id,opponent_id,place_id,coach_id,home_away,france_score,opponent_score,status,team_type_score_raw,team_type_confidence').eq('gender','M').eq('selection_category','A')),
      fetchAll(()=>c.from('competitions').select('id,name,edition,parent_id,gender,selection_category').order('name')),
      fetchAll(()=>c.from('opponents').select('id,name')),
      fetchAll(()=>c.from('places').select('id,name,city,country,place_type')),
      fetchAll(()=>c.from('personnel').select('id,display_name,person_type,nationality')),
      fetchAll(()=>c.from('match_appearances').select('match_id,player_id,starter,appeared,goals,assists,captain,squad_status')),
      fetchAll(()=>c.from('match_goal_events').select('id,match_id,player_id,scorer_name,assist_player_id,assist_name,minute_text')),
      fetchAll(()=>c.from('match_officials').select('match_id,person_id,role')),
      fetchAll(()=>c.from('fifa_rankings').select('id,ranking_date,rank,variation,marker,source_url').order('ranking_date',{ascending:true}))
    ]);
    Object.assign(state,{players,selections,tags,stats,matches,competitions,opponents,places,personnel,appearances,goals,officials,fifa});resetMaps();state.loaded=true;setDefaultGeneration();
  }finally{state.loading=false;}}

  const teamTag=s=>state.tagMap?.get(String(s?.team_tag_id));
  const sectionName=s=>teamTag(s)?.label_text||s?.name||s?.code||'Sélection';
  const playerName=id=>state.playerMap?.get(String(id))?.display_name||'Joueur';
  const matchSelection=m=>state.selectionMap?.get(String(m?.selection_team_id));
  const matchGender=m=>matchSelection(m)?.gender||m?.gender||'';
  function stageKeyFromSelection(s){return String(s?.code||'')==='FRA-A-M'||String(s?.category||'').toUpperCase()==='A'?'A':null;}
  function playerMatchesGender(p){return state.gender==='all'||p?.gender===state.gender;}
  function matchMatchesGender(m){return state.gender==='all'||matchGender(m)===state.gender;}
  function resultOf(m){if(m?.france_score==null||m?.opponent_score==null)return null;const a=n(m.france_score),b=n(m.opponent_score);return a>b?'V':a<b?'D':'N';}
  function matchLabel(m){if(!m)return'Match';const opp=state.opponentMap.get(String(m.opponent_id))?.name||'Adversaire',sel=sectionName(matchSelection(m)),score=m.france_score==null||m.opponent_score==null?'–':`${m.france_score}-${m.opponent_score}`;return `${sel} ${score} ${opp}`;}
  function openPlayer(id){window.BLEUS3000_PLAYERS_DB?.openPlayer?.(id);}
  function openMatch(id){window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(id);}
  function option(value,label,current){return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`;}
  function setDefaultGeneration(){const years=generationYears();if(!years.length){state.generation=null;return;}if(years.includes(2005))state.generation=2005;else if(!years.includes(Number(state.generation)))state.generation=years[Math.floor(years.length/2)]||years[0];}
  function generationYears(){const counts=new Map();for(const p of state.players){if(!playerMatchesGender(p)||!p.birth_date)continue;const y=new Date(p.birth_date).getUTCFullYear();if(Number.isFinite(y))counts.set(y,(counts.get(y)||0)+1);}return [...counts.keys()].sort((a,b)=>b-a);}
  function stageSets(){const out=new Map(stages.map(k=>[k,new Set()]));for(const r of state.stats){const p=state.playerMap.get(String(r.player_id)),s=state.selectionMap.get(String(r.selection_id));if(!p||!s||!playerMatchesGender(p)||state.gender!=='all'&&s.gender!==state.gender)continue;const k=stageKeyFromSelection(s);if(k)out.get(k).add(String(r.player_id));}return out;}
  function genderLabel(){return 'Équipe de France';}
  function globalHeader(){return `<div class="stats-v2-header"><div><span class="stats-v2-kicker">STATISTIQUES</span><h2>Équipe de France</h2><p>Connexions, bilans, records et évolution historique du classement FIFA.</p></div></div><nav class="stats-v2-tabs" aria-label="Statistiques"><button type="button" data-stats-tab="bleu_moyen" class="${state.tab==='bleu_moyen'?'is-active':''}">👤 Bleu moyen</button><button type="button" data-stats-tab="connections" class="${state.tab==='connections'?'is-active':''}">🤝 Connexions</button><button type="button" data-stats-tab="balances" class="${state.tab==='balances'?'is-active':''}">📊 Bilans</button><button type="button" data-stats-tab="records" class="${state.tab==='records'?'is-active':''}">🏅 Records</button><button type="button" data-stats-tab="fifa" class="${state.tab==='fifa'?'is-active':''}">📈 Classement FIFA</button></nav>`;}

  function detailPlayers(title,ids,subtitle=''){const rows=(ids||[]).map(id=>state.playerMap.get(String(id))).filter(Boolean).filter(p=>!state.query||String(p.display_name).toLocaleLowerCase('fr').includes(state.query));return `<section class="stats-v2-detail"><div class="stats-v2-detail-head"><div><strong>${esc(title)}</strong>${subtitle?`<small>${esc(subtitle)}</small>`:''}</div><button type="button" data-stats-close-detail>×</button></div><div class="stats-v2-player-list">${rows.map(p=>`<button type="button" data-stats-player="${esc(p.id)}"><span>${esc(p.display_name)}</span><small>Équipe de France</small><b>↗</b></button>`).join('')||'<div class="stats-v2-empty">Aucun joueur dans ce périmètre.</div>'}</div></section>`;}
  function detailMatches(title,matchIds,subtitle=''){const rows=(matchIds||[]).map(id=>state.matchMap.get(String(id))).filter(Boolean).sort((a,b)=>+new Date(b.match_date||0)-+new Date(a.match_date||0));return `<section class="stats-v2-detail"><div class="stats-v2-detail-head"><div><strong>${esc(title)}</strong>${subtitle?`<small>${esc(subtitle)}</small>`:''}</div><button type="button" data-stats-close-detail>×</button></div><div class="stats-v2-match-list">${rows.map(m=>`<button type="button" data-stats-match="${esc(m.id)}"><span>${esc(frDate(m.match_date))}</span><strong>${esc(matchLabel(m))}</strong><small>${esc(state.competitionMap.get(String(m.competition_id))?.name||'Match international')}</small><b>↗</b></button>`).join('')||'<div class="stats-v2-empty">Aucun match relié.</div>'}</div></section>`;}


  function connectionData(){const pairMap=new Map();for(const [matchId,rows] of state.appearancesByMatch){const m=state.matchMap.get(String(matchId));if(!m||!matchMatchesGender(m))continue;const ids=[...new Set(rows.map(r=>String(r.player_id)).filter(id=>state.playerMap.has(id)))].sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=`${ids[i]}|${ids[j]}`,x=pairMap.get(k)||{a:ids[i],b:ids[j],count:0,matches:[]};x.count++;x.matches.push(matchId);pairMap.set(k,x);}}const pairs=[...pairMap.values()].sort((a,b)=>b.count-a.count||`${playerName(a.a)} ${playerName(a.b)}`.localeCompare(`${playerName(b.a)} ${playerName(b.b)}`,'fr'));
    const duoMap=new Map();for(const g of state.goals){if(!g.player_id||!g.assist_player_id)continue;const m=state.matchMap.get(String(g.match_id));if(!m||!matchMatchesGender(m))continue;const k=`${g.player_id}|${g.assist_player_id}`,x=duoMap.get(k)||{scorer:String(g.player_id),assist:String(g.assist_player_id),count:0,matches:[]};x.count++;x.matches.push(String(g.match_id));duoMap.set(k,x);}const duos=[...duoMap.values()].sort((a,b)=>b.count-a.count);return{pairs,duos};}
  function connectionsView(){const {pairs,duos}=connectionData(),shownPairs=pairs.filter(x=>!state.query||`${playerName(x.a)} ${playerName(x.b)}`.toLocaleLowerCase('fr').includes(state.query)).slice(0,30),shownDuos=duos.slice(0,30);let detail='';if(state.detail?.type==='pair'){const p=pairs.find(x=>x.a===state.detail.a&&x.b===state.detail.b);if(p)detail=detailMatches(`${playerName(p.a)} + ${playerName(p.b)}`,p.matches,`${p.count} feuille${p.count>1?'s':''} de match partagée${p.count>1?'s':''}.`);}else if(state.detail?.type==='duo'){const d=duos.find(x=>x.scorer===state.detail.scorer&&x.assist===state.detail.assist);if(d)detail=detailMatches(`${playerName(d.assist)} → ${playerName(d.scorer)}`,d.matches,`${d.count} but${d.count>1?'s':''} sur passe décisive.`);}return `<div class="stats-v2-module"><section class="stats-v2-intro"><div><span>🤝</span><div><h3>Connexions</h3><p>Les joueurs qui ont le plus souvent partagé les mêmes feuilles de match et les associations offensives.</p></div></div><div class="stats-v2-mini-kpis"><span><strong>${state.appearancesByMatch.size}</strong> matchs avec composition</span><span><strong>${pairs.length}</strong> duos observés</span><span><strong>${duos.length}</strong> duos offensifs</span></div></section><div class="stats-connections-grid"><section><div class="stats-v2-section-title"><strong>Coéquipiers les plus fréquents</strong><small>Basé sur les feuilles de match disponibles</small></div><div class="stats-pair-list">${shownPairs.map((p,i)=>`<button type="button" data-stats-pair="${esc(p.a)}|${esc(p.b)}"><span class="stats-pair-rank">${i+1}</span><span><strong>${esc(playerName(p.a))}</strong><i>+</i><strong>${esc(playerName(p.b))}</strong></span><b>${p.count}</b><small>match${p.count>1?'s':''}</small></button>`).join('')||'<div class="stats-v2-empty">Pas encore assez de feuilles de match communes.</div>'}</div></section><section><div class="stats-v2-section-title"><strong>Duos offensifs</strong><small>Buteur + passeur décisif</small></div><div class="stats-pair-list is-offensive">${shownDuos.map((d,i)=>`<button type="button" data-stats-duo="${esc(d.scorer)}|${esc(d.assist)}"><span class="stats-pair-rank">${i+1}</span><span><strong>${esc(playerName(d.assist))}</strong><i>→</i><strong>${esc(playerName(d.scorer))}</strong></span><b>${d.count}</b><small>but${d.count>1?'s':''}</small></button>`).join('')||'<div class="stats-v2-empty">Aucune passe décisive reliée pour le moment.<small>Le module s’alimentera automatiquement dès que <code>assist_player_id</code> sera renseigné.</small></div>'}</div></section></div><div class="stats-v2-coverage">Couverture actuelle : ${state.appearances.length.toLocaleString('fr-FR')} lignes de composition sur ${state.appearancesByMatch.size} matchs. Les classements de duos ne représentent donc que les feuilles déjà saisies.</div>${detail}</div>`;}

  function balanceName(dim,key){if(dim==='decade')return `${key}–${Number(key)+9}`;if(dim==='selection')return sectionName(state.selectionMap.get(String(key)));if(dim==='coach'||dim==='referee')return state.personnelMap.get(String(key))?.display_name||'Non renseigné';if(dim==='stadium'){const p=state.placeMap.get(String(key));return p?[p.name,p.city].filter(Boolean).join(' · '):'Non renseigné';}if(dim==='competition'){const c=state.competitionMap.get(String(key));return c?[c.name,c.edition].filter(Boolean).join(' · '):'Non renseignée';}if(dim==='opponent')return state.opponentMap.get(String(key))?.name||'Adversaire';return String(key);}
  function balanceGroups(){const groups=new Map(),matches=state.matches.filter(m=>matchMatchesGender(m)&&resultOf(m)&& (state.balanceSelection==='all'||String(m.selection_team_id)===String(state.balanceSelection)));function add(key,m){if(key==null||key==='')return;const k=String(key),x=groups.get(k)||{key:k,matches:0,wins:0,draws:0,losses:0,gf:0,ga:0,ids:[]};x.matches++;const r=resultOf(m);if(r==='V')x.wins++;else if(r==='N')x.draws++;else x.losses++;x.gf+=n(m.france_score);x.ga+=n(m.opponent_score);x.ids.push(String(m.id));groups.set(k,x);}for(const m of matches){switch(state.balanceDimension){case'decade':{const y=new Date(m.match_date).getUTCFullYear();if(Number.isFinite(y))add(Math.floor(y/10)*10,m);break;}case'selection':add(m.selection_team_id,m);break;case'coach':add(m.coach_id,m);break;case'stadium':add(m.place_id,m);break;case'competition':add(m.competition_id,m);break;case'opponent':add(m.opponent_id,m);break;case'referee':for(const o of state.officialsByMatch.get(String(m.id))||[])if(String(o.role).toLocaleLowerCase('fr').includes('principal'))add(o.person_id,m);break;}}
    return [...groups.values()].sort((a,b)=>b.matches-a.matches||balanceName(state.balanceDimension,a.key).localeCompare(balanceName(state.balanceDimension,b.key),'fr'));}
  function balancesView(){const groups=balanceGroups(),teams=state.selections.filter(s=>state.gender==='all'||s.gender===state.gender);let detail='';if(state.detail?.type==='balance'&&state.detail.dimension===state.balanceDimension){const g=groups.find(x=>x.key===String(state.detail.key));if(g)detail=detailMatches(balanceName(state.balanceDimension,g.key),g.ids,`${g.matches} matchs · ${g.wins} V · ${g.draws} N · ${g.losses} D`);}return `<div class="stats-v2-module"><section class="stats-v2-intro"><div><span>📊</span><div><h3>Bilans croisés</h3><p>Décennie, sélectionneur, stade, arbitre, compétition ou adversaire : tous les calculs portent sur les matchs de l’Équipe de France.</p></div></div></section><div class="stats-balance-controls"><label>Bilan par<select id="statsBalanceDimension">${option('decade','Décennie',state.balanceDimension)}${option('coach','Sélectionneur',state.balanceDimension)}${option('stadium','Stade',state.balanceDimension)}${option('referee','Arbitre principal',state.balanceDimension)}${option('competition','Compétition',state.balanceDimension)}${option('opponent','Adversaire',state.balanceDimension)}</select></label></div><div class="stats-balance-table"><div class="stats-balance-row is-head"><span>Référence</span><span>MJ</span><span>V</span><span>N</span><span>D</span><span>BP</span><span>BC</span><span>% V</span></div>${groups.map(g=>`<button type="button" class="stats-balance-row" data-stats-balance="${esc(g.key)}"><strong>${esc(balanceName(state.balanceDimension,g.key))}</strong><span>${g.matches}</span><span>${g.wins}</span><span>${g.draws}</span><span>${g.losses}</span><span>${g.gf}</span><span>${g.ga}</span><b>${pct(g.wins,g.matches)}</b></button>`).join('')||'<div class="stats-v2-empty">Aucun match avec score dans ce périmètre.</div>'}</div><div class="stats-v2-coverage">Bilan calculé uniquement sur les matchs dont les deux scores sont renseignés. Les arbitres utilisent uniquement le rôle <strong>Arbitre principal</strong>.</div>${detail}</div>`;}


  function funLineupSnapshot(){
    const capCounts=new Map(),lineups=[],captains=[];
    const sorted=state.matches
      .filter(m=>matchMatchesGender(m)&&matchDateValue(m)&&resultOf(m))
      .slice()
      .sort((a,b)=>+new Date(matchDateValue(a))-+new Date(matchDateValue(b))||String(a.id).localeCompare(String(b.id)));
    for(const m of sorted){
      const rows=state.appearancesByMatch.get(String(m.id))||[];
      const playedIds=[...new Set(rows
        .filter(a=>a?.player_id&&(a.starter===true||a.appeared===true))
        .map(a=>String(a.player_id)))];
      for(const id of playedIds)capCounts.set(id,(capCounts.get(id)||0)+1);

      const starterMap=new Map();
      for(const a of rows){
        if(a?.starter!==true||!a.player_id||!state.playerMap.has(String(a.player_id)))continue;
        starterMap.set(String(a.player_id),a);
      }
      const starters=[...starterMap.values()];
      if(starters.length!==11)continue;

      const when=matchDateValue(m);
      const ages=starters.map(a=>ageAt(state.playerMap.get(String(a.player_id))?.birth_date,when));
      const caps=starters.map(a=>capCounts.get(String(a.player_id))||0);
      const allAges=ages.every(Number.isFinite),allCaps=caps.length===11&&caps.every(Number.isFinite);
      const item={
        match:m,
        starters,
        avgAge:allAges?ages.reduce((s,v)=>s+v,0)/11:null,
        avgCaps:allCaps?caps.reduce((s,v)=>s+v,0)/11:null
      };
      lineups.push(item);
      for(let i=0;i<starters.length;i++){
        const a=starters[i];
        if(!a.captain||!Number.isFinite(ages[i]))continue;
        captains.push({match:m,player_id:String(a.player_id),age:ages[i]});
      }
    }
    return {lineups,captains};
  }
  function funRecordRows(){
    const {lineups,captains}=funLineupSnapshot();
    const ageRows=lineups.filter(x=>Number.isFinite(x.avgAge));
    const capRows=lineups.filter(x=>Number.isFinite(x.avgCaps));
    const youngestXI=ageRows.slice().sort((a,b)=>a.avgAge-b.avgAge)[0]||null;
    const oldestXI=ageRows.slice().sort((a,b)=>b.avgAge-a.avgAge)[0]||null;
    const mostExperienced=capRows.slice().sort((a,b)=>b.avgCaps-a.avgCaps)[0]||null;
    const leastExperienced=capRows.slice().sort((a,b)=>a.avgCaps-b.avgCaps)[0]||null;
    const youngestCaptain=captains.slice().sort((a,b)=>a.age-b.age)[0]||null;
    const oldestCaptain=captains.slice().sort((a,b)=>b.age-a.age)[0]||null;
    const highestTeamType=state.matches
      .filter(m=>matchMatchesGender(m)&&teamTypeRaw(m)!==null)
      .map(m=>({match:m,score:teamTypeRaw(m)}))
      .sort((a,b)=>b.score-a.score||(+new Date(matchDateValue(b.match)||0))-(+new Date(matchDateValue(a.match)||0)))[0]||null;
    const mkLine=(kind,label,x,metric,unit,icon)=>x?{
      kind,label,icon,match:x.match,
      value:`${fmt1(x[metric])} ${unit}`,
      note:`${frDate(matchDateValue(x.match))} · ${matchLabel(x.match)}`
    }:null;
    const mkCaptain=(kind,label,x,icon)=>x?{
      kind,label:`${label} · ${playerName(x.player_id)}`,icon,match:x.match,
      value:`${fmt1(x.age)} ans`,
      note:`${frDate(matchDateValue(x.match))} · ${matchLabel(x.match)}`
    }:null;
    const mkTeamType=x=>x?{
      kind:'highest-team-type',label:'Équipe type la plus élevée',icon:'🎯',match:x.match,
      value:`${Math.round(x.score)} / 100`,
      note:`${frDate(matchDateValue(x.match))} · ${matchLabel(x.match)} · score brut ${x.score.toLocaleString('fr-FR',{minimumFractionDigits:4,maximumFractionDigits:4})}`
    }:null;
    return [
      mkTeamType(highestTeamType),
      mkLine('youngest-xi','Onze titulaire le plus jeune',youngestXI,'avgAge','ans','🍼'),
      mkLine('oldest-xi','Onze titulaire le plus âgé',oldestXI,'avgAge','ans','🧓'),
      mkLine('most-caps','Onze titulaire le plus expérimenté',mostExperienced,'avgCaps','sél.','🎖️'),
      mkLine('least-caps','Onze titulaire le moins expérimenté',leastExperienced,'avgCaps','sél.','🌱'),
      mkCaptain('youngest-captain','Plus jeune capitaine',youngestCaptain,'©️'),
      mkCaptain('oldest-captain','Capitaine le plus âgé',oldestCaptain,'🧭')
    ].filter(Boolean);
  }

  function recordRows(){const map=new Map();if(state.recordMetric==='captaincy'){for(const a of state.appearances){const m=state.matchMap.get(String(a.match_id));if(!a.captain||!m||!matchMatchesGender(m)||state.recordSelection!=='all'&&String(m.selection_team_id)!==String(state.recordSelection))continue;const k=String(a.player_id),x=map.get(k)||0;map.set(k,x+1);}}else{const field=state.recordMetric==='selections'?'selections':'goals';for(const r of state.stats){const p=state.playerMap.get(String(r.player_id)),s=state.selectionMap.get(String(r.selection_id));if(!p||!s||!playerMatchesGender(p)||state.gender!=='all'&&s.gender!==state.gender||state.recordSelection!=='all'&&String(r.selection_id)!==String(state.recordSelection))continue;map.set(String(r.player_id),(map.get(String(r.player_id))||0)+n(r[field]));}}return [...map.entries()].map(([player_id,value])=>({player_id,value})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value||playerName(a.player_id).localeCompare(playerName(b.player_id),'fr'));}
  function recordsView(){const rows=recordRows().filter(x=>!state.query||playerName(x.player_id).toLocaleLowerCase('fr').includes(state.query)).slice(0,100),funRows=funRecordRows(),unit=state.recordMetric==='captaincy'?'capitanat':state.recordMetric==='selections'?'sélection':'but';return `<div class="stats-v2-module"><section class="stats-v2-intro"><div><span>🏅</span><div><h3>Records</h3><p>Records individuels et lignes “fun” calculées directement depuis les feuilles de match.</p></div></div></section><section class="stats-fun-records"><div class="stats-v2-section-title"><strong>🎲 Stats fun des XI</strong><small>11 titulaires identifiés · âge et expérience au jour du match</small></div><div class="stats-fun-record-list">${funRows.map(r=>`<button type="button" data-stats-match="${esc(r.match.id)}"><span class="stats-fun-icon">${esc(r.icon)}</span><span class="stats-fun-copy"><strong>${esc(r.label)}</strong><small>${esc(r.note)}</small></span><b>${esc(r.value)}</b><i>↗</i></button>`).join('')||'<div class="stats-v2-empty">Pas encore assez de feuilles complètes pour calculer ces records.</div>'}</div><div class="stats-v2-coverage">L’indice Équipe type utilise <strong>team_type_score_raw</strong> pour déterminer le record, sans se baser sur l’arrondi affiché. L’âge moyen exige les 11 dates de naissance. L’expérience correspond à la moyenne des sélections cumulées par les 11 titulaires <strong>à la date du match</strong>, match concerné inclus. Les capitaines utilisent uniquement les feuilles où le brassard est renseigné.</div></section><div class="stats-balance-controls"><label>Classement individuel<select id="statsRecordMetric">${option('goals','Buteurs',state.recordMetric)}${option('selections','Sélections',state.recordMetric)}${option('captaincy','Capitanat',state.recordMetric)}</select></label></div><div class="stats-record-list">${rows.map((r,i)=>`<button type="button" data-stats-player="${esc(r.player_id)}"><span>${i+1}</span><strong>${esc(playerName(r.player_id))}</strong><b>${r.value.toLocaleString('fr-FR')}</b><small>${unit}${r.value>1?'s':''}</small></button>`).join('')||'<div class="stats-v2-empty">Aucune donnée pour ces filtres.</div>'}</div></div>`;}

  function fifaView(){
    const rows=(state.fifa||[]).slice().sort((a,b)=>new Date(a.ranking_date)-new Date(b.ranking_date));if(!rows.length)return `<div class="stats-v2-module"><section class="stats-v2-intro"><div><span>📈</span><div><h3>Classement FIFA</h3><p>Aucune entrée enregistrée.</p></div></div>${canEdit()?'<button type="button" class="primary-btn" data-fifa-add>＋ Ajouter</button>':''}</section></div>`;
    const latest=rows[rows.length-1],best=rows.reduce((a,b)=>Number(b.rank)<Number(a.rank)?b:a,rows[0]),worst=rows.reduce((a,b)=>Number(b.rank)>Number(a.rank)?b:a,rows[0]);
    const W=1000,H=300,PX=46,PY=32,t0=+new Date(rows[0].ranking_date),t1=+new Date(latest.ranking_date),minR=Math.min(...rows.map(r=>Number(r.rank))),maxR=Math.max(...rows.map(r=>Number(r.rank))),dx=Math.max(1,t1-t0),dr=Math.max(1,maxR-minR);
    const x=r=>PX+((+new Date(r.ranking_date)-t0)/dx)*(W-PX*2),y=r=>PY+((Number(r.rank)-minR)/dr)*(H-PY*2);const d=rows.map((r,i)=>`${i?'L':'M'}${x(r).toFixed(1)},${y(r).toFixed(1)}`).join(' ');
    const years=[];let last=-1;for(const r of rows){const yr=new Date(r.ranking_date).getUTCFullYear();if(yr!==last&&(yr%4===0||yr===new Date(rows[0].ranking_date).getUTCFullYear()||yr===new Date(latest.ranking_date).getUTCFullYear())){years.push({yr,x:x(r)});last=yr;}}
    const recent=rows.slice(-12).reverse();
    return `<div class="stats-v2-module stats-fifa-module"><section class="stats-v2-intro"><div><span>📈</span><div><h3>Classement FIFA</h3><p>Historique des publications depuis 1992. Plus la courbe est haute, meilleur est le classement.</p></div></div>${canEdit()?'<button type="button" class="primary-btn" data-fifa-add>＋ Ajouter</button>':''}</section><div class="stats-fifa-kpis"><span><small>Dernier classement</small><b>N° ${latest.rank}</b><em>${frDate(latest.ranking_date)}</em></span><span><small>Meilleur classement</small><b>N° ${best.rank}</b><em>${frDate(best.ranking_date)}</em></span><span><small>Plus bas classement</small><b>N° ${worst.rank}</b><em>${frDate(worst.ranking_date)}</em></span><span><small>Publications</small><b>${rows.length}</b><em>depuis 1992</em></span></div><div class="stats-fifa-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du classement FIFA de la France"><line x1="${PX}" y1="${PY}" x2="${PX}" y2="${H-PY}" class="axis"/><line x1="${PX}" y1="${H-PY}" x2="${W-PX}" y2="${H-PY}" class="axis"/><text x="8" y="${PY+5}">N°${minR}</text><text x="8" y="${H-PY}">N°${maxR}</text>${years.map(v=>`<text x="${v.x.toFixed(1)}" y="${H-8}" text-anchor="middle">${v.yr}</text>`).join('')}<path d="${d}" class="rank-line" fill="none"/><circle cx="${x(latest).toFixed(1)}" cy="${y(latest).toFixed(1)}" r="5" class="rank-last"/></svg></div><div class="stats-fifa-recent"><div class="stats-v2-section-title"><strong>Dernières publications</strong><small>${rows.length} entrées historiques</small></div>${recent.map(r=>`<div><time>${esc(frDate(r.ranking_date))}</time><strong>N° ${r.rank}</strong><span class="${Number(r.variation)>0?'is-up':Number(r.variation)<0?'is-down':''}">${r.variation==null?'—':Number(r.variation)>0?`+${r.variation}`:r.variation}</span></div>`).join('')}</div></div>`;
  }
  function ensureFifaEditor(){let m=$('#fifaRankingEditor');if(m)return m;document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="fifaRankingEditor" hidden><section class="modal-dialog fifa-ranking-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Ajouter un classement FIFA</h2><p>Une date de publication et un rang.</p></div><button type="button" class="modal-close" data-fifa-close>×</button></header><div class="modal-body"><form id="fifaRankingForm" class="fifa-ranking-form"><label>Date de mise à jour<input name="ranking_date" type="date" required></label><label>Classement<input name="rank" type="number" min="1" max="250" required></label><div class="c3k-v8-actions"><button type="button" class="secondary-btn" data-fifa-close>Annuler</button><button type="submit" class="primary-btn">Enregistrer</button></div><div class="c3k-v8-status" data-fifa-status hidden></div></form></div></section></div>`);m=$('#fifaRankingEditor');$$('[data-fifa-close]',m).forEach(b=>b.addEventListener('click',()=>m.hidden=true));m.addEventListener('pointerdown',e=>{if(e.target===m)m.hidden=true;});$('#fifaRankingForm',m).addEventListener('submit',saveFifaEntry);return m;}
  async function saveFifaEntry(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),date=String(fd.get('ranking_date')||''),rank=Number(fd.get('rank')),st=$('[data-fifa-status]',f);st.hidden=false;st.className='c3k-v8-status';st.textContent='Enregistrement…';try{const c=db(),prev=(state.fifa||[]).filter(r=>r.ranking_date<date).sort((a,b)=>String(b.ranking_date).localeCompare(String(a.ranking_date)))[0],variation=prev?Number(prev.rank)-rank:null;const {error}=await c.from('fifa_rankings').upsert({ranking_date:date,rank,variation,marker:rank===1?'N°1':null,created_by:window.C3K_ACCOUNT_STATE?.profile?.id||null,updated_at:new Date().toISOString()},{onConflict:'ranking_date'});if(error)throw error;const {data,error:re}=await c.from('fifa_rankings').select('id,ranking_date,rank,variation,marker,source_url').order('ranking_date',{ascending:true});if(re)throw re;state.fifa=data||[];st.className='c3k-v8-status is-ok';st.textContent='Classement enregistré ✓';setTimeout(()=>{ensureFifaEditor().hidden=true;rerender();},300);}catch(err){st.className='c3k-v8-status is-error';st.textContent=String(err?.message||err);}}

  function body(){if(state.tab==='bleu_moyen')return '<div id="bleuMoyenMount" class="bm-host"><div class="stats-v2-empty">Chargement du Bleu Moyen…</div></div>';if(state.tab==='connections')return connectionsView();if(state.tab==='balances')return balancesView();if(state.tab==='records')return recordsView();return fifaView();}
  function bind(){
    $('#statsV2Gender')?.addEventListener('change',e=>{state.gender=e.target.value;state.detail=null;state.balanceSelection='all';state.recordSelection='all';setDefaultGeneration();rerender();});
    $$('[data-stats-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.statsTab;state.detail=null;if(state.tab!=='bleu_moyen'&&!state.loaded){render(state.query);return;}rerender();}));
    $('[data-fifa-add]')?.addEventListener('click',()=>{const m=ensureFifaEditor();const f=$('#fifaRankingForm',m);f.reset();m.hidden=false;});
    $('#statsGenerationYear')?.addEventListener('change',e=>{state.generation=Number(e.target.value);state.detail=null;rerender();});
    $$('[data-path-stage]').forEach(b=>b.addEventListener('click',()=>{state.detail={type:'stage',stage:b.dataset.pathStage};rerender();}));
    $$('[data-path-from]').forEach(b=>b.addEventListener('click',()=>{state.detail={type:'transition',from:b.dataset.pathFrom,to:b.dataset.pathTo};rerender();}));
    $$('[data-generation-transition]').forEach(b=>b.addEventListener('click',()=>{const [from,to]=b.dataset.generationTransition.split('|');state.detail={type:'generation-transition',from,to};rerender();}));
    $$('[data-stats-pair]').forEach(b=>b.addEventListener('click',()=>{const [a,c]=b.dataset.statsPair.split('|');state.detail={type:'pair',a,b:c};rerender();}));
    $$('[data-stats-duo]').forEach(b=>b.addEventListener('click',()=>{const [scorer,assist]=b.dataset.statsDuo.split('|');state.detail={type:'duo',scorer,assist};rerender();}));
    $('#statsBalanceDimension')?.addEventListener('change',e=>{state.balanceDimension=e.target.value;state.detail=null;rerender();});
    $('#statsBalanceSelection')?.addEventListener('change',e=>{state.balanceSelection=e.target.value;state.detail=null;rerender();});
    $$('[data-stats-balance]').forEach(b=>b.addEventListener('click',()=>{state.detail={type:'balance',dimension:state.balanceDimension,key:b.dataset.statsBalance};rerender();}));
    $('#statsRecordMetric')?.addEventListener('change',e=>{state.recordMetric=e.target.value;rerender();});$('#statsRecordSelection')?.addEventListener('change',e=>{state.recordSelection=e.target.value;rerender();});
    $$('[data-stats-player]').forEach(b=>b.addEventListener('click',()=>openPlayer(b.dataset.statsPlayer)));$$('[data-stats-match]').forEach(b=>b.addEventListener('click',()=>openMatch(b.dataset.statsMatch)));$$('[data-stats-close-detail]').forEach(b=>b.addEventListener('click',()=>{state.detail=null;rerender();}));
    if(state.tab==='bleu_moyen')window.BLEUS3000_BLEU_MOYEN?.mount?.($('#bleuMoyenMount'));
  }
  function rerender(){render(state.query,{skipLoad:true});}
  async function render(query='',opts={}){state.query=String(query||'').trim().toLocaleLowerCase('fr');const host=$('#referenceEntries');if(!host)return;$('#selectionCategoryTabs')?.setAttribute('hidden','');$('#selectionFilterBar')?.setAttribute('hidden','');const add=$('#addReferenceEntry');if(add)add.hidden=true;$('#referenceModalTitle').textContent='Statistiques';$('#referenceModalSub').textContent='Bleu moyen · connexions · bilans · records · classement FIFA';if(!state.loaded&&!opts.skipLoad&&state.tab!=='bleu_moyen'){host.innerHTML='<div class="stats-v2-empty">Chargement des statistiques V2…</div>';try{await load();}catch(e){host.innerHTML=`<div class="stats-v2-empty">Impossible de charger les statistiques : ${esc(e.message||e)}</div>`;return;}}$('#referenceCount').textContent=`${genderLabel()}`;host.innerHTML=`<div class="stats-v2">${globalHeader()}${body()}<footer class="stats-v2-footer">Calculs réalisés à partir des référentiels relationnels de 3615 Bleus. Les modules signalent explicitement les zones où la couverture des feuilles de match, dates de naissance ou passes décisives est encore partielle.</footer></div>`;bind();}
  window.BLEUS3000_STATISTICS={render,invalidate:()=>{state.loaded=false;},refresh:async()=>{state.loaded=false;await load(true);rerender();},setTab:tab=>{if(['bleu_moyen','connections','balances','records','fifa'].includes(tab)){state.tab=tab;state.detail=null;if(tab!=='bleu_moyen'&&!state.loaded)render(state.query);else rerender();}}};
})();
