/* 3615 Bleus V1.1.39 — référentiel Statistiques relationnel */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.BLEUS3000_SUPABASE||null;
  const state={loaded:false,loading:false,players:[],selections:[],tags:[],stats:[],matches:[],competitions:[],opponents:[],appearances:[],goals:[],metric:'goals',gender:'all',selection:'all',competition:'all',view:'ranking',query:''};
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const dateFr=v=>{const d=new Date(v);return Number.isNaN(+d)?'—':new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(d);};
  const byId=(arr,key='id')=>new Map(arr.map(x=>[String(x?.[key]),x]));
  const teamTag=s=>state.tags.find(t=>String(t.id)===String(s?.team_tag_id));
  const sectionName=s=>teamTag(s)?.label_text||s?.name||s?.code||'Sélection';
  const playerName=id=>state.playerMap?.get(String(id))?.display_name||'Joueur';
  const matchLabel=m=>{if(!m)return 'Match';const opp=state.opponentMap?.get(String(m.opponent_id))?.name||'Adversaire';const team=state.selectionMap?.get(String(m.selection_team_id));const france=sectionName(team);return m.home_away==='away'?`${opp} – ${france}`:`${france} – ${opp}`;};
  const compName=id=>state.competitionMap?.get(String(id))?.name||'Compétition';
  function resetMaps(){state.playerMap=byId(state.players);state.selectionMap=byId(state.selections);state.competitionMap=byId(state.competitions);state.opponentMap=byId(state.opponents);state.matchMap=byId(state.matches);}

  async function fetchAll(make,pageSize=1000){
    const out=[];for(let from=0;;from+=pageSize){const {data,error}=await make().range(from,from+pageSize-1);if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<pageSize)break;}return out;
  }
  async function load(force=false){
    if(state.loaded&&!force)return;
    if(state.loading)return;
    const c=db();if(!c)throw new Error('Supabase indisponible');state.loading=true;
    try{
      const [players,selections,tags,stats,matches,competitions,opponents,appearances,goals]=await Promise.all([
        fetchAll(()=>c.from('players').select('id,display_name,gender,active').eq('active',true).order('display_name')),
        fetchAll(()=>c.from('selection_teams').select('id,code,name,gender,category,sort_order,team_tag_id').eq('active',true).order('sort_order')),
        fetchAll(()=>c.from('tags').select('id,slug,label_text,icon_text,color_start,color_end,gradient_colors,text_color,border_color,appearance,gradient_angle').eq('is_active',true)),
        fetchAll(()=>c.from('player_selection_stats').select('player_id,selection_id,selections,goals,starts,wins,draws,losses,minutes,appearance_status')),
        fetchAll(()=>c.from('matches').select('id,match_date,selection_team_id,competition_id,opponent_id,home_away,france_score,opponent_score,status')),
        fetchAll(()=>c.from('competitions').select('id,name,edition,tag_id,gender,selection_category').order('name')),
        fetchAll(()=>c.from('opponents').select('id,name')),
        fetchAll(()=>c.from('match_appearances').select('match_id,player_id,captain,starter,minutes,goals').eq('captain',true)),
        fetchAll(()=>c.from('match_goal_events').select('id,match_id,player_id,scorer_name,minute_text,score_after'))
      ]);
      state.players=players;state.selections=selections;state.tags=tags;state.stats=stats;state.matches=matches;state.competitions=competitions;state.opponents=opponents;state.appearances=appearances;state.goals=goals;resetMaps();state.loaded=true;
    }finally{state.loading=false;}
  }

  function option(value,label,current){return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;}
  function controls(){
    const teams=state.selections.filter(s=>state.gender==='all'||s.gender===state.gender);
    const comps=state.competitions.filter(c=>state.gender==='all'||!c.gender||c.gender===state.gender);
    return `<section class="stats-controls">
      <label>Classement<select id="statsMetric">${option('goals','Buteurs',state.metric)}${option('captaincy','Capitanat',state.metric)}${option('selections','Sélections',state.metric)}</select></label>
      <label>Sexe<select id="statsGender">${option('all','Mixte',state.gender)}${option('M','Masculin',state.gender)}${option('F','Féminin',state.gender)}</select></label>
      <label>Section<select id="statsSelection">${option('all','Toutes les sections',state.selection)}${teams.map(s=>option(s.id,sectionName(s),state.selection)).join('')}</select></label>
      <label>Compétition<select id="statsCompetition">${option('all','Toutes les compétitions',state.competition)}${comps.map(c=>option(c.id,c.name+(c.edition?` · ${c.edition}`:''),state.competition)).join('')}</select></label>
      <label>Vue<select id="statsView">${option('ranking','Classement joueurs',state.view)}${option('by-selection','Par sélection',state.view)}${option('by-competition','Par compétition',state.view)}${option('by-match','Par match',state.view)}</select></label>
      <button type="button" id="statsReset" class="secondary-btn">Réinitialiser</button>
    </section>`;
  }
  function summary(){
    const totalGoals=state.stats.reduce((s,x)=>s+n(x.goals),0),scorers=new Set(state.stats.filter(x=>n(x.goals)>0).map(x=>x.player_id)).size;
    const capt=state.appearances.length,captains=new Set(state.appearances.map(x=>x.player_id)).size;
    const selections=state.stats.reduce((s,x)=>s+n(x.selections),0);
    return `<section class="stats-summary"><article><strong>${totalGoals.toLocaleString('fr-FR')}</strong><span>buts recensés</span></article><article><strong>${scorers.toLocaleString('fr-FR')}</strong><span>buteurs</span></article><article><strong>${capt.toLocaleString('fr-FR')}</strong><span>capitanats match</span></article><article><strong>${captains.toLocaleString('fr-FR')}</strong><span>capitaines</span></article><article><strong>${selections.toLocaleString('fr-FR')}</strong><span>sélections cumulées</span></article></section>`;
  }
  function eligiblePlayer(playerId){const p=state.playerMap.get(String(playerId));if(!p)return false;if(state.gender!=='all'&&p.gender!==state.gender)return false;if(state.query&&!String(p.display_name||'').toLocaleLowerCase('fr').includes(state.query))return false;return true;}
  function eligibleMatch(matchId){const m=state.matchMap.get(String(matchId));if(!m)return false;const sel=state.selectionMap.get(String(m.selection_team_id));if(state.gender!=='all'&&sel?.gender!==state.gender)return false;if(state.selection!=='all'&&String(m.selection_team_id)!==String(state.selection))return false;if(state.competition!=='all'&&String(m.competition_id)!==String(state.competition))return false;return true;}
  function rankingRows(){
    if(state.metric==='captaincy'){
      const map=new Map();for(const a of state.appearances){if(!eligiblePlayer(a.player_id)||!eligibleMatch(a.match_id))continue;const x=map.get(String(a.player_id))||{player_id:a.player_id,value:0};x.value++;map.set(String(a.player_id),x);}return [...map.values()].sort((a,b)=>b.value-a.value||playerName(a.player_id).localeCompare(playerName(b.player_id),'fr'));
    }
    if(state.metric==='goals'&&state.competition!=='all'){
      const map=new Map();for(const g of state.goals){if(!g.player_id||!eligiblePlayer(g.player_id)||!eligibleMatch(g.match_id))continue;const x=map.get(String(g.player_id))||{player_id:g.player_id,value:0};x.value++;map.set(String(g.player_id),x);}return [...map.values()].sort((a,b)=>b.value-a.value||playerName(a.player_id).localeCompare(playerName(b.player_id),'fr'));
    }
    const key=state.metric==='selections'?'selections':'goals',map=new Map();for(const r of state.stats){const sel=state.selectionMap.get(String(r.selection_id));if(!eligiblePlayer(r.player_id))continue;if(state.gender!=='all'&&sel?.gender!==state.gender)continue;if(state.selection!=='all'&&String(r.selection_id)!==String(state.selection))continue;const x=map.get(String(r.player_id))||{player_id:r.player_id,value:0};x.value+=n(r[key]);map.set(String(r.player_id),x);}return [...map.values()].filter(x=>x.value>0).sort((a,b)=>b.value-a.value||playerName(a.player_id).localeCompare(playerName(b.player_id),'fr'));
  }
  function generalRanking(){const rows=rankingRows();const unit=state.metric==='captaincy'?'capitanat':state.metric==='selections'?'sélection':'but';return `<div class="stats-ranking">${rows.map((r,i)=>`<button type="button" class="stats-rank-row" data-stats-player="${esc(r.player_id)}"><span class="stats-rank-pos">${i+1}</span><span class="stats-rank-name">${esc(playerName(r.player_id))}</span><strong>${n(r.value).toLocaleString('fr-FR')}</strong><small>${unit}${n(r.value)>1?'s':''}</small></button>`).join('')||'<div class="stats-empty">Aucune donnée pour ces filtres.</div>'}</div>`;}
  function selectionView(){
    const key=state.metric==='selections'?'selections':'goals';
    if(state.metric==='captaincy'){
      const groups=new Map();for(const a of state.appearances){if(!eligiblePlayer(a.player_id)||!eligibleMatch(a.match_id))continue;const m=state.matchMap.get(String(a.match_id)),sid=String(m?.selection_team_id||'');const k=`${sid}|${a.player_id}`,x=groups.get(k)||{selection_id:sid,player_id:a.player_id,value:0};x.value++;groups.set(k,x);}return groupCards([...groups.values()],'selection');
    }
    const rows=[];for(const r of state.stats){const sel=state.selectionMap.get(String(r.selection_id));if(!eligiblePlayer(r.player_id))continue;if(state.gender!=='all'&&sel?.gender!==state.gender)continue;if(state.selection!=='all'&&String(r.selection_id)!==String(state.selection))continue;const value=n(r[key]);if(value>0)rows.push({selection_id:r.selection_id,player_id:r.player_id,value});}return groupCards(rows,'selection');
  }
  function groupCards(rows,type){
    const map=new Map();for(const r of rows){const gid=type==='selection'?String(r.selection_id):String(r.competition_id);const a=map.get(gid)||[];a.push(r);map.set(gid,a);}
    const groups=[...map.entries()].sort((a,b)=>{const an=type==='selection'?sectionName(state.selectionMap.get(a[0])):compName(a[0]);const bn=type==='selection'?sectionName(state.selectionMap.get(b[0])):compName(b[0]);return an.localeCompare(bn,'fr');});
    return `<div class="stats-groups">${groups.map(([id,list])=>{list.sort((a,b)=>b.value-a.value||playerName(a.player_id).localeCompare(playerName(b.player_id),'fr'));const title=type==='selection'?sectionName(state.selectionMap.get(id)):compName(id);return `<section class="stats-group"><h3>${esc(title)}</h3>${list.map((r,i)=>`<button type="button" data-stats-player="${esc(r.player_id)}"><span>${i+1}. ${esc(playerName(r.player_id))}</span><strong>${n(r.value).toLocaleString('fr-FR')}</strong></button>`).join('')}</section>`;}).join('')||'<div class="stats-empty">Aucune donnée pour ces filtres.</div>'}</div>`;
  }
  function detailedCompetitionView(){
    const rows=[];
    if(state.metric==='captaincy'){
      const map=new Map();for(const a of state.appearances){if(!eligiblePlayer(a.player_id)||!eligibleMatch(a.match_id))continue;const m=state.matchMap.get(String(a.match_id));if(!m?.competition_id)continue;const k=`${m.competition_id}|${a.player_id}`,x=map.get(k)||{competition_id:m.competition_id,player_id:a.player_id,value:0};x.value++;map.set(k,x);}return groupCards([...map.values()],'competition');
    }
    if(state.metric==='goals'){
      const map=new Map();for(const g of state.goals){if(!g.player_id||!eligiblePlayer(g.player_id)||!eligibleMatch(g.match_id))continue;const m=state.matchMap.get(String(g.match_id));if(!m?.competition_id)continue;const k=`${m.competition_id}|${g.player_id}`,x=map.get(k)||{competition_id:m.competition_id,player_id:g.player_id,value:0};x.value++;map.set(k,x);}return coverageNote()+groupCards([...map.values()],'competition');
    }
    return '<div class="stats-empty">La vue par compétition s’applique aux buts détaillés et au capitanat.</div>';
  }
  function coverageNote(){return `<div class="stats-coverage">Détail match/compétition basé sur les événements déjà collectés : ${state.goals.length} but${state.goals.length>1?'s':''} enregistrés, dont ${state.goals.filter(g=>g.player_id).length} reliés à une fiche joueur. Le classement général des buteurs reste basé sur les statistiques de sélection, plus complètes.</div>`;}
  function matchView(){
    if(state.metric==='goals'){
      const list=state.goals.filter(g=>g.player_id&&eligiblePlayer(g.player_id)&&eligibleMatch(g.match_id)).sort((a,b)=>+new Date(state.matchMap.get(String(b.match_id))?.match_date||0)-+new Date(state.matchMap.get(String(a.match_id))?.match_date||0));
      return coverageNote()+`<div class="stats-match-list">${list.map(g=>{const m=state.matchMap.get(String(g.match_id));return `<button type="button" data-stats-player="${esc(g.player_id)}"><span class="stats-match-date">${esc(dateFr(m?.match_date))}</span><span><strong>${esc(playerName(g.player_id))}</strong><small>${esc(matchLabel(m))} · ${esc(compName(m?.competition_id))}${g.minute_text?` · ${esc(g.minute_text)}`:''}</small></span><b>⚽</b></button>`;}).join('')||'<div class="stats-empty">Aucun but détaillé pour ces filtres.</div>'}</div>`;
    }
    if(state.metric==='captaincy'){
      const list=state.appearances.filter(a=>eligiblePlayer(a.player_id)&&eligibleMatch(a.match_id)).sort((a,b)=>+new Date(state.matchMap.get(String(b.match_id))?.match_date||0)-+new Date(state.matchMap.get(String(a.match_id))?.match_date||0));
      return `<div class="stats-match-list">${list.map(a=>{const m=state.matchMap.get(String(a.match_id));return `<button type="button" data-stats-player="${esc(a.player_id)}"><span class="stats-match-date">${esc(dateFr(m?.match_date))}</span><span><strong>${esc(playerName(a.player_id))}</strong><small>${esc(matchLabel(m))} · ${esc(compName(m?.competition_id))}</small></span><b>©</b></button>`;}).join('')||'<div class="stats-empty">Aucun capitanat pour ces filtres.</div>'}</div>`;
    }
    return '<div class="stats-empty">La vue par match est disponible pour les buteurs détaillés et le capitanat.</div>';
  }
  function content(){if(state.view==='by-selection')return selectionView();if(state.view==='by-competition')return detailedCompetitionView();if(state.view==='by-match')return matchView();const note=state.metric==='goals'&&state.competition!=='all'?coverageNote():'';return note+generalRanking();}
  function bind(){
    $('#statsMetric')?.addEventListener('change',e=>{state.metric=e.target.value;rerender();});
    $('#statsGender')?.addEventListener('change',e=>{state.gender=e.target.value;state.selection='all';state.competition='all';rerender();});
    $('#statsSelection')?.addEventListener('change',e=>{state.selection=e.target.value;rerender();});
    $('#statsCompetition')?.addEventListener('change',e=>{state.competition=e.target.value;rerender();});
    $('#statsView')?.addEventListener('change',e=>{state.view=e.target.value;rerender();});
    $('#statsReset')?.addEventListener('click',()=>{state.metric='goals';state.gender='all';state.selection='all';state.competition='all';state.view='ranking';rerender();});
    document.querySelectorAll('[data-stats-player]').forEach(b=>b.addEventListener('click',()=>window.BLEUS3000_PLAYERS_DB?.openPlayer?.(b.dataset.statsPlayer)));
  }
  function rerender(){render(state.query);}
  async function render(query=''){
    state.query=String(query||'').trim().toLocaleLowerCase('fr');
    const host=$('#referenceEntries');if(!host)return;
    $('#selectionCategoryTabs')?.setAttribute('hidden','');$('#selectionFilterBar')?.setAttribute('hidden','');
    const add=$('#addReferenceEntry');if(add)add.hidden=true;
    $('#referenceModalTitle').textContent='Statistiques';$('#referenceModalSub').textContent='Classements relationnels · sélections, buts, capitanat, matchs et compétitions';
    if(!state.loaded){host.innerHTML='<div class="stats-empty">Chargement des statistiques…</div>';try{await load();}catch(e){host.innerHTML=`<div class="stats-empty">Impossible de charger les statistiques : ${esc(e.message||e)}</div>`;return;}}
    const rows=rankingRows();$('#referenceCount').textContent=`${rows.length} joueur${rows.length>1?'s':''}`;
    host.innerHTML=`<div class="stats-reference">${summary()}${controls()}${content()}<footer class="stats-source-note">Sources de calcul : tables relationnelles 3615 Bleus. Les totaux généraux utilisent <code>player_selection_stats</code>. Les vues par match/compétition utilisent les événements actuellement collectés.</footer></div>`;
    bind();
  }
  window.BLEUS3000_STATISTICS={render,refresh:async()=>{state.loaded=false;await load(true);}};
})();
