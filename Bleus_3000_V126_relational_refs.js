/* 3615 Bleus V1.1.61.11 — Référentiels relationnels · filtres enrichis */
(() => {
  'use strict';

  const $=(s,p=document)=>p.querySelector(s);
  const $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=window.BLEUS3000_SEARCH;
  const norm=v=>S?.normalize?S.normalize(v):String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matchQuery=(q,vals)=>!String(q||'').trim()||(S?.matches?S.matches(q,vals,.5):vals.some(v=>norm(v).includes(norm(q))));
  const option=(v,l,sel)=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;
  const PAGE_SIZE=5;
  const role=()=>window.C3K_ACCOUNT_STATE?.profile?.role||'guest';
  const canEdit=()=>['editor','admin','superadmin'].includes(String(role()).toLowerCase());
  const countryCode=v=>window.BLEUS3000_FLAGS?.codeFor?.(v)||'';
  const flagEmojiFromCode=code=>{const c=String(code||'').toUpperCase();return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt(0))):'🌍';};
  let countryCatalogueCache=null;
  function countryCatalogue(){
    if(countryCatalogueCache)return countryCatalogueCache;
    const raw=Object.values(window.BLEUS3000_FLAGS?.map||{}).filter(c=>/^[a-z]{2}$/.test(String(c)));
    const codes=[...new Set(raw)].sort();
    let dn=null;try{dn=new Intl.DisplayNames(['fr'],{type:'region'});}catch{}
    countryCatalogueCache=codes.map(code=>({code,name:dn?.of?.(code.toUpperCase())||code.toUpperCase()})).filter(x=>x.name&&x.name!==x.code.toUpperCase()).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
    return countryCatalogueCache;
  }
  const countryOptionLabel=v=>`${flagEmojiFromCode(countryCode(v))} ${v}`;

  const matchFilters={team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all'};
  const relFilters={
    competitions:{gender:'all',selection:'all',type:'all',status:'all'},
    adversaires:{confederation:'all',continent:'all',team:'all',countryQuery:''},
    staff:{team:'all',gender:'all',nationality:'all'},
    arbitres:{team:'all',nationality:'all',year:'all'},
    lieux:{country:'all',city:'all',team:'all',year:'all',countryQuery:''}
  };

  let client=null,loaded=false,loading=null;
  let matches=[],people=[],staffRows=[],refereeRows=[],officialRows=[],opponentRows=[],stadiumRows=[],tagsById=new Map(),selectionRows=[],competitionRows=[],searchRegistry=[];
  let pendingMatchFocus=null,pendingMatchSheetFocus=null,referenceEditorState=null;
  const matchSheetCache=new Map();

  async function waitClient(timeout=15000){
    client=window.BLEUS3000_SUPABASE||null;if(client)return client;
    return await new Promise(resolve=>{
      let done=false,timer=null;
      const finish=c=>{if(done)return;done=true;if(timer)clearTimeout(timer);window.removeEventListener('bleus:supabase-ready',onReady);client=c||window.BLEUS3000_SUPABASE||null;resolve(client);};
      const onReady=e=>finish(e.detail?.client||window.BLEUS3000_SUPABASE||null);
      window.addEventListener('bleus:supabase-ready',onReady);
      timer=setTimeout(()=>finish(window.BLEUS3000_SUPABASE||null),timeout);
    });
  }

  const parseDate=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(+d)?null:d;};
  const fmtDate=v=>{const d=parseDate(v);return d?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}):String(v||'—');};
  const fmtDateLong=v=>{const d=parseDate(v);return d?new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(d):String(v||'—');};
  const overrides=m=>(m?.manual_overrides&&typeof m.manual_overrides==='object')?m.manual_overrides:{};
  const baseValue=(m,key)=>({
    match_date:m.match_date,
    opponent_name:m.opponent?.name||'',
    competition_name:m.competition?.name||'',
    venue_name:m.place?.name||'',
    city:m.place?.city||'',
    broadcast_text:m.broadcast_text||'',
    broadcast_url:m.broadcast_url||'',
    france_score:m.france_score,
    opponent_score:m.opponent_score,
    status:m.status||'',
    selection_tag_id:m.selection?.team_tag_id||'',
    competition_tag_id:m.competition?.tag_id||''
  })[key];
  const effective=(m,key)=>Object.prototype.hasOwnProperty.call(overrides(m),key)?overrides(m)[key]:baseValue(m,key);
  const selectionLabel=m=>m.selection?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||m.selection_category||'France';
  const resultLetter=m=>{
    const av=effective(m,'france_score'),bv=effective(m,'opponent_score');
    if(av===null||av===undefined||av===''||bv===null||bv===undefined||bv==='')return '—';
    const a=Number(av),b=Number(bv);
    if(!Number.isFinite(a)||!Number.isFinite(b))return '—';
    return a>b?'V':a<b?'D':'N';
  };
  const scoreClass=m=>({V:'is-win',N:'is-draw',D:'is-loss'}[resultLetter(m)]||'');
  const flagImg=name=>window.BLEUS3000_FLAGS?.img?.(name,'rel-svg-flag')||'';
  const countryName=v=>window.BLEUS3000_FLAGS?.countryName?.(v)||String(v||'');
  const uniqueSorted=arr=>[...new Set(arr.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));

  function tagChip(t,extra=''){
    if(!t)return '';
    if(window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(t,extra);
    const colors=Array.isArray(t.gradient_colors)&&t.gradient_colors.length?t.gradient_colors.filter(Boolean).slice(0,5):[t.color_start||'#123B8F',t.color_end||'#4dc6ff'];
    const bg=t.appearance==='solid'?colors[0]:`linear-gradient(${Number(t.gradient_angle||135)}deg,${colors.join(',')})`;
    return `<span class="rel-tag-fallback ${extra}" style="background:${bg};color:${esc(t.text_color||'#fff')};border-color:${esc(t.border_color||'#123B8F')}">${esc(t.icon_text||'🏷️')} ${esc(t.label_text||'TAG')}</span>`;
  }

  const competitionTagForMatch=m=>{const id=effective(m,'competition_tag_id');return id?tagsById.get(id)||null:null;};
  const isOlympicMatch=m=>{
    const t=competitionTagForMatch(m);
    return String(t?.slug||'')==='jeux-olympiques'||norm(t?.label_text)==='jeux olympiques'||norm(effective(m,'competition_name')).includes('jeux olympiques');
  };
  function sectionTagForMatch(m){
    const id=effective(m,'selection_tag_id')||m.selection?.team_tag_id||'';
    return id?tagsById.get(id)||null:null;
  }
  function chipForMatch(m){
    // JO : le tag de compétition est le seul tag affiché sur la tuile du match.
    if(isOlympicMatch(m))return '';
    const t=sectionTagForMatch(m);
    if(!t)return `<span class="rel-tag-fallback">${esc((m.selection?.category||m.selection_category||'FRANCE').replace('Espoirs/U21','ESPOIRS'))}</span>`;
    return tagChip(t,'relational-team-chip');
  }
  function competitionChipForMatch(m){
    const t=competitionTagForMatch(m);
    return t?tagChip(t,'relational-competition-chip'):'';
  }

  const isMainRefereeRole=role=>{
    const r=norm(role).replace(/[._-]+/g,' ').replace(/\s+/g,' ').trim();
    if(!r)return false;
    if(/\b(var|video|assistant|assistante|linesman|lineswoman|fourth|quatrieme|4e|4eme|reserve)\b/.test(r))return false;
    return /\b(arbitre|referee)\b/.test(r);
  };

  async function fetchIn(table,columns,ids){
    if(!ids.length)return[];
    const {data,error}=await client.from(table).select(columns).in('id',ids);
    if(error)throw error;
    return data||[];
  }

  function balance(list){
    const played=list.filter(m=>resultLetter(m)!=='—');
    return {matches:list.length,played:played.length,wins:played.filter(m=>resultLetter(m)==='V').length,draws:played.filter(m=>resultLetter(m)==='N').length,losses:played.filter(m=>resultLetter(m)==='D').length};
  }
  function buildStaffRows(){
    const byCoach=new Map();
    for(const m of matches){
      if(!m.coach_id)continue;
      const id=String(m.coach_id);if(!byCoach.has(id))byCoach.set(id,[]);byCoach.get(id).push(m);
    }
    return people.filter(p=>byCoach.has(String(p.id))||/selectionneur|coach|entraineur/.test(norm(p.person_type))).map(p=>{
      const linked=(byCoach.get(String(p.id))||[]).sort((a,b)=>(parseDate(effective(b,'match_date'))||0)-(parseDate(effective(a,'match_date'))||0));
      return {...p,linked_matches:linked};
    }).sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||''),'fr'));
  }
  function buildRefereeRows(){
    const matchMap=new Map(matches.map(m=>[String(m.id),m]));
    const byPerson=new Map();
    for(const row of officialRows){
      if(!isMainRefereeRole(row.role))continue;
      const m=matchMap.get(String(row.match_id));if(!m)continue;
      const id=String(row.person_id);if(!byPerson.has(id))byPerson.set(id,[]);byPerson.get(id).push(m);
    }
    return people.filter(p=>byPerson.has(String(p.id))).map(p=>{
      const linked=[...new Map((byPerson.get(String(p.id))||[]).map(m=>[String(m.id),m])).values()].sort((a,b)=>(parseDate(effective(b,'match_date'))||0)-(parseDate(effective(a,'match_date'))||0));
      return {...p,linked_matches:linked};
    }).sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||''),'fr'));
  }

  async function load(){
    if(loaded)return matches;
    if(loading)return loading;
    loading=(async()=>{
      if(!await waitClient())throw new Error('Supabase indisponible');
      const [{data:mm,error:me},{data:ss,error:se},{data:pp,error:pe},{data:ooRel,error:oe},{data:tagRows,error:te}]=await Promise.all([
        client.from('matches').select('id,match_date,gender,selection_category,selection_team_id,home_away,france_score,opponent_score,status,notes_short,phase,spectators,lineup_status,source_calendar_url,source_detail_url,opponent_id,competition_id,competition_edition_id,place_id,coach_id,external_ids,broadcast_text,broadcast_url,provider,provider_fixture_id,provider_updated_at,data_state,api_payload,manual_overrides,feature_frame_mode,homepage_pinned,homepage_pinned_at,homepage_pinned_by').order('match_date',{ascending:false}).limit(5000),
        client.from('selection_teams').select('id,code,name,gender,category,team_tag_id,provider_ids,sort_order').order('sort_order'),
        client.from('personnel').select('*').order('display_name').limit(5000),
        client.from('match_officials').select('match_id,person_id,role').limit(10000),
        client.from('tags').select('*').eq('kind','tag').eq('is_active',true).limit(1000)
      ]);
      if(me)throw me;
      if(se)throw se;
      if(pe)console.warn('Personnel',pe);
      if(oe)console.warn('Officiels de match',oe);
      if(te)console.warn('Tags',te);

      selectionRows=ss||[];
      people=pp||[];
      officialRows=ooRel||[];
      const selections=new Map(selectionRows.map(x=>[x.id,x]));
      tagsById=new Map((tagRows||[]).map(x=>[x.id,x]));
      const rows=mm||[];
      const oppIds=[...new Set(rows.map(x=>x.opponent_id).filter(Boolean))];

      const [oo,ccRes,llRes]=await Promise.all([
        fetchIn('opponents','id,name,fifa_code,confederation,continent,federation_name,flag_url,federation_logo_url,active',oppIds),
        client.from('competitions').select('id,name,edition,tag_id,gender,selection_category,competition_type,status').order('name').limit(5000),
        client.from('places').select('*').order('name').limit(5000)
      ]);
      if(ccRes.error)throw ccRes.error;
      if(llRes.error)throw llRes.error;

      opponentRows=oo||[];
      competitionRows=ccRes.data||[];
      const allPlaces=llRes.data||[];
      stadiumRows=allPlaces.filter(x=>String(x.place_type||'')==='stadium');
      const om=new Map(opponentRows.map(x=>[x.id,x]));
      const cm=new Map(competitionRows.map(x=>[x.id,x]));
      const lm=new Map(allPlaces.map(x=>[x.id,x]));
      const pm=new Map(people.map(x=>[x.id,x]));
      matches=rows.map(x=>({...x,selection:selections.get(x.selection_team_id)||null,opponent:om.get(x.opponent_id)||null,competition:cm.get(x.competition_id)||null,place:lm.get(x.place_id)||null,coach:pm.get(x.coach_id)||null}));
      staffRows=buildStaffRows();
      refereeRows=buildRefereeRows();

      const d=window.BLEUS3000_DATA;
      if(d?.references){
        const counts={matchs:String(matches.length),competitions:String(competitionRows.length),adversaires:String(opponentRows.length),staff:String(staffRows.length),arbitres:String(refereeRows.length),lieux:String(stadiumRows.length)};
        for(const [key,value] of Object.entries(counts)){const r=d.references.find(x=>x.key===key);if(r)r.count=value;}
      }

      searchRegistry=[
        ...matches.map(m=>({kind:'matchs',id:m.id,title:`${selectionLabel(m)} - ${effective(m,'opponent_name')||'Adversaire'}`,meta:`${fmtDate(effective(m,'match_date'))} · ${effective(m,'competition_name')||selectionLabel(m)}`,values:[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),m.provider]})),
        ...competitionRows.map(c=>({kind:'competitions',id:c.id,title:c.name,meta:[c.edition,c.selection_category,c.gender==='F'?'Féminin':c.gender==='M'?'Masculin':''].filter(Boolean).join(' · '),values:[c.name,c.edition,c.selection_category,c.competition_type,c.status,tagsById.get(c.tag_id)?.label_text]})),
        ...opponentRows.map(o=>({kind:'adversaires',id:o.id,title:o.name,meta:[o.confederation,o.continent].filter(Boolean).join(' · ')||'Adversaire',values:[o.name,o.fifa_code,o.confederation,o.continent,o.federation_name]})),
        ...staffRows.map(p=>({kind:'staff',id:p.id,title:p.display_name,meta:'Sélectionneur',values:[p.display_name,p.person_type,p.nationality,...p.linked_matches.map(selectionLabel),'sélectionneur','staff']})),
        ...refereeRows.map(p=>({kind:'arbitres',id:p.id,title:p.display_name,meta:[p.nationality,'Arbitre principal'].filter(Boolean).join(' · '),values:[p.display_name,p.nationality,'arbitre principal',...p.linked_matches.map(selectionLabel),...p.linked_matches.map(m=>effective(m,'opponent_name'))]})),
        ...stadiumRows.map(v=>({kind:'lieux',id:v.id,title:v.name,meta:[v.city,v.country].filter(Boolean).join(' · ')||'Stade',values:[v.name,v.city,v.country,'stade','stadium',String(v.capacity||''),String(v.opened_year||''),...stadiumMatches(v.id).map(selectionLabel),...stadiumMatches(v.id).map(m=>effective(m,'opponent_name'))]}))
      ];

      loaded=true;
      window.dispatchEvent(new CustomEvent('bleus:matches-ready',{detail:{matches}}));
      window.dispatchEvent(new CustomEvent('bleus:relational-registry',{detail:{count:searchRegistry.length}}));
      return matches;
    })().finally(()=>loading=null);
    return loading;
  }

  function resetForeignUi(){
    const cat=$('#selectionCategoryTabs');if(cat)cat.hidden=true;
    const sf=$('#selectionFilterBar');if(sf)sf.hidden=true;
  }
  function facetBar(){return $('#referenceFacetFilters');}
  function hideFacetBar(){const bar=facetBar();if(bar){bar.hidden=true;bar.innerHTML='';bar.onchange=null;bar.oninput=null;}}
  function renderFacetBar(kind,html){
    const bar=facetBar();if(!bar)return;
    bar.hidden=false;bar.innerHTML=html;
    bar.onchange=e=>{
      const k=e.target.dataset.relFilter;if(!k)return;
      relFilters[kind][k]=e.target.value;
      render(kind,$('#referenceSearch')?.value||'');
    };
    bar.oninput=e=>{
      if(kind==='adversaires'&&e.target.matches('[data-rel-country-search]')){
        relFilters.adversaires.countryQuery=e.target.value;
        applyOpponentCountrySearch($('#referenceEntries'));
      }
      if(kind==='lieux'&&e.target.matches('[data-rel-stadium-country-search]')){
        relFilters.lieux.countryQuery=e.target.value;
        applyStadiumCountrySearch($('#referenceEntries'));
      }
    };
  }

  function ensureMatchFilters(){
    const toolbar=$('#referenceSearch')?.closest('.modal-toolbar');if(!toolbar)return null;
    let bar=$('#matchReferenceFilters');
    if(!bar){
      bar=document.createElement('div');bar.id='matchReferenceFilters';bar.className='match-reference-filters';toolbar.insertAdjacentElement('afterend',bar);
      bar.addEventListener('change',e=>{const k=e.target.dataset.matchFilter;if(!k)return;matchFilters[k]=e.target.value;render('matchs',$('#referenceSearch')?.value||'');});
    }
    return bar;
  }
  function renderMatchFilters(){
    hideFacetBar();
    const bar=ensureMatchFilters();if(!bar)return;bar.hidden=false;
    const teams=[...new Map(matches.filter(m=>m.selection_team_id).map(m=>[m.selection_team_id,selectionLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
    const comps=[...new Set(matches.map(m=>effective(m,'competition_name')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    const years=[...new Set(matches.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
    const stadiums=[...new Map(matches.filter(m=>m.place_id).map(m=>[String(m.place_id),effective(m,'venue_name')||m.place?.name||'Stade'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
    const coaches=[...new Map(matches.filter(m=>m.coach_id).map(m=>[String(m.coach_id),m.coach?.display_name||'Sélectionneur'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
    bar.innerHTML=`<select data-match-filter="team">${option('all','Toutes les sélections',matchFilters.team)}${teams.map(([v,l])=>option(v,l,matchFilters.team)).join('')}</select><select data-match-filter="gender">${option('all','Masculin + Féminin',matchFilters.gender)}${option('M','Masculin',matchFilters.gender)}${option('F','Féminin',matchFilters.gender)}</select><select data-match-filter="competition">${option('all','Toutes les compétitions',matchFilters.competition)}${comps.map(v=>option(v,v,matchFilters.competition)).join('')}</select><select data-match-filter="year">${option('all','Toutes les années',matchFilters.year)}${years.map(v=>option(String(v),String(v),matchFilters.year)).join('')}</select><select data-match-filter="result">${option('all','Tous les résultats',matchFilters.result)}${option('V','Victoires',matchFilters.result)}${option('N','Nuls',matchFilters.result)}${option('D','Défaites',matchFilters.result)}${option('—','Sans score',matchFilters.result)}</select><select data-match-filter="stadium">${option('all','Tous les stades',matchFilters.stadium)}${stadiums.map(([v,l])=>option(v,l,matchFilters.stadium)).join('')}</select><select data-match-filter="coach">${option('all','Tous les sélectionneurs',matchFilters.coach)}${coaches.map(([v,l])=>option(v,l,matchFilters.coach)).join('')}</select><select data-match-filter="sheet">${option('all','Toutes les feuilles',matchFilters.sheet)}${option('yes','Feuille renseignée',matchFilters.sheet)}${option('no','Feuille à compléter',matchFilters.sheet)}</select><button type="button" class="reference-filter-reset" data-match-filter-reset>Réinitialiser</button>`;
    bar.querySelector('[data-match-filter-reset]')?.addEventListener('click',()=>{Object.assign(matchFilters,{team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all'});render('matchs',$('#referenceSearch')?.value||'');});
  }
  function hideMatchFilters(){const bar=$('#matchReferenceFilters');if(bar)bar.hidden=true;}
  function applyMatchFilters(list){
    return list.filter(m=>{
      if(matchFilters.team!=='all'&&String(m.selection_team_id)!==matchFilters.team)return false;
      if(matchFilters.gender!=='all'&&String(m.gender)!==matchFilters.gender)return false;
      if(matchFilters.competition!=='all'&&String(effective(m,'competition_name'))!==matchFilters.competition)return false;
      const y=parseDate(effective(m,'match_date'))?.getFullYear();if(matchFilters.year!=='all'&&String(y)!==matchFilters.year)return false;
      if(matchFilters.result!=='all'&&resultLetter(m)!==matchFilters.result)return false;
      if(matchFilters.stadium!=='all'&&String(m.place_id||'')!==matchFilters.stadium)return false;
      if(matchFilters.coach!=='all'&&String(m.coach_id||'')!==matchFilters.coach)return false;
      const hasSheet=/feuille détaillée/i.test(String(m.lineup_status||''));
      if(matchFilters.sheet==='yes'&&!hasSheet)return false;
      if(matchFilters.sheet==='no'&&hasSheet)return false;
      return true;
    });
  }

  const teamOptionsFromMatches=list=>[...new Map(list.filter(m=>m.selection_team_id).map(m=>[String(m.selection_team_id),selectionLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
  function renderRelFilters(kind){
    hideMatchFilters();
    if(kind==='competitions'){
      const f=relFilters.competitions;
      const cats=uniqueSorted(competitionRows.map(x=>x.selection_category));
      const types=uniqueSorted(competitionRows.map(x=>x.competition_type));
      const statuses=uniqueSorted(competitionRows.map(x=>x.status));
      renderFacetBar(kind,`<label>Sexe<select data-rel-filter="gender">${option('all','Masculin + Féminin',f.gender)}${option('M','Masculin',f.gender)}${option('F','Féminin',f.gender)}</select></label><label>Sélection<select data-rel-filter="selection">${option('all','Toutes les catégories',f.selection)}${cats.map(v=>option(v,v,f.selection)).join('')}</select></label><label>Type<select data-rel-filter="type">${option('all','Tous les types',f.type)}${types.map(v=>option(v,v,f.type)).join('')}</select></label><label>Statut<select data-rel-filter="status">${option('all','Tous les statuts',f.status)}${statuses.map(v=>option(v,v,f.status)).join('')}</select></label>`);
    }else if(kind==='adversaires'){
      const f=relFilters.adversaires;
      const confs=uniqueSorted(opponentRows.map(o=>o.confederation));
      const continents=uniqueSorted(opponentRows.map(o=>o.continent));
      const teams=teamOptionsFromMatches(matches);
      renderFacetBar(kind,`<label class="reference-filter-search">Pays<input type="search" data-rel-country-search value="${esc(f.countryQuery||'')}" placeholder="Rechercher un pays…" autocomplete="off"></label><label>Confédération<select data-rel-filter="confederation">${option('all','Toutes les confédérations',f.confederation)}${confs.map(v=>option(v,v,f.confederation)).join('')}</select></label><label>Continent<select data-rel-filter="continent">${option('all','Tous les continents',f.continent)}${continents.map(v=>option(v,v,f.continent)).join('')}</select></label><label>Sélection française<select data-rel-filter="team">${option('all','Toutes les sélections',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label>`);
    }else if(kind==='staff'){
      const f=relFilters.staff;
      const linked=staffRows.flatMap(p=>p.linked_matches||[]),teams=teamOptionsFromMatches(linked),nations=uniqueSorted(staffRows.map(p=>p.nationality));
      renderFacetBar(kind,`<label>Sélection<select data-rel-filter="team">${option('all','Toutes les sélections',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Sexe<select data-rel-filter="gender">${option('all','Masculin + Féminin',f.gender)}${option('M','Masculin',f.gender)}${option('F','Féminin',f.gender)}</select></label><label>Nationalité<select data-rel-filter="nationality">${option('all','Toutes les nationalités',f.nationality)}${nations.map(v=>option(v,v,f.nationality)).join('')}</select></label>`);
    }else if(kind==='arbitres'){
      const f=relFilters.arbitres;
      const linked=refereeRows.flatMap(p=>p.linked_matches||[]),teams=teamOptionsFromMatches(linked),nations=uniqueSorted(refereeRows.map(p=>p.nationality));
      const years=[...new Set(linked.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
      renderFacetBar(kind,`<label>Nationalité<select data-rel-filter="nationality">${option('all','Toutes les nationalités',f.nationality)}${nations.map(v=>option(v,v,f.nationality)).join('')}</select></label><label>Sélection française<select data-rel-filter="team">${option('all','Toutes les sélections',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Année<select data-rel-filter="year">${option('all','Toutes les années',f.year)}${years.map(v=>option(String(v),String(v),f.year)).join('')}</select></label>`);
    }else if(kind==='lieux'){
      const f=relFilters.lieux;
      const stadiumIds=new Set(stadiumRows.map(v=>String(v.id)));
      const linked=matches.filter(m=>stadiumIds.has(String(m.place_id))),teams=teamOptionsFromMatches(linked);
      const countries=uniqueSorted(stadiumRows.map(v=>v.country)),cities=uniqueSorted(stadiumRows.map(v=>v.city));
      const years=[...new Set(linked.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
      renderFacetBar(kind,`<label class="reference-filter-search">Recherche pays<input type="search" data-rel-stadium-country-search value="${esc(f.countryQuery||'')}" placeholder="Rechercher un pays…" autocomplete="off"></label><label>Pays<select data-rel-filter="country">${option('all','🌍 Tous les pays',f.country)}${countries.map(v=>option(v,countryOptionLabel(v),f.country)).join('')}</select></label><label>Ville<select data-rel-filter="city">${option('all','Toutes les villes',f.city)}${cities.map(v=>option(v,v,f.city)).join('')}</select></label><label>Sélection française<select data-rel-filter="team">${option('all','Toutes les sélections',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Année<select data-rel-filter="year">${option('all','Toutes les années',f.year)}${years.map(v=>option(String(v),String(v),f.year)).join('')}</select></label>`);
    }else hideFacetBar();
  }

  function applyRelFilters(kind,list){
    const f=relFilters[kind];
    if(kind==='competitions')return list.filter(c=>(f.gender==='all'||String(c.gender||'')===f.gender)&&(f.selection==='all'||String(c.selection_category||'')===f.selection)&&(f.type==='all'||String(c.competition_type||'')===f.type)&&(f.status==='all'||String(c.status||'')===f.status));
    if(kind==='adversaires')return list.filter(o=>{
      const om=matches.filter(m=>String(m.opponent_id)===String(o.id));
      return (f.confederation==='all'||String(o.confederation||'')===f.confederation)&&(f.continent==='all'||String(o.continent||'')===f.continent)&&(f.team==='all'||om.some(m=>String(m.selection_team_id)===f.team));
    });
    if(kind==='staff')return list.filter(p=>{
      const lm=p.linked_matches||[];
      return (f.team==='all'||lm.some(m=>String(m.selection_team_id)===f.team))&&(f.gender==='all'||lm.some(m=>String(m.gender||'')===f.gender))&&(f.nationality==='all'||String(p.nationality||'')===f.nationality);
    });
    if(kind==='arbitres')return list.filter(p=>{
      const lm=p.linked_matches||[];
      return (f.nationality==='all'||String(p.nationality||'')===f.nationality)&&(f.team==='all'||lm.some(m=>String(m.selection_team_id)===f.team))&&(f.year==='all'||lm.some(m=>String(parseDate(effective(m,'match_date'))?.getFullYear())===f.year));
    });
    if(kind==='lieux')return list.filter(v=>{
      const lm=stadiumMatches(v.id);
      return (f.country==='all'||String(v.country||'')===f.country)&&(f.city==='all'||String(v.city||'')===f.city)&&(f.team==='all'||lm.some(m=>String(m.selection_team_id)===f.team))&&(f.year==='all'||lm.some(m=>String(parseDate(effective(m,'match_date'))?.getFullYear())===f.year));
    });
    return list;
  }

  function referencePhotoUrl(row){
    const path=String(row?.photo_path||'').trim();
    if(path&&client){try{return client.storage.from('reference-photos').getPublicUrl(path).data.publicUrl||'';}catch{}}
    return String(row?.photo_url||'').trim();
  }
  function referenceFrameStyle(row){
    const start=row?.tile_border_color_start||'#123B8F',end=row?.tile_border_color_end||'#2F6DFF';
    const bg=row?.tile_border_appearance==='solid'?start:`linear-gradient(${Number(row?.tile_border_gradient_angle??135)}deg,${start},${end})`;
    return `background:${bg};padding:${Math.max(0,Number(row?.tile_border_width??3))}px;border-radius:${Math.max(0,Number(row?.tile_border_radius??14))}px`;
  }
  function referencePhotoHtml(row,cls='rel-person-avatar'){
    const url=referencePhotoUrl(row),fallback=initials(row?.display_name||row?.name||'?');
    return `<div class="${cls}" style="${referenceFrameStyle(row)}"><div class="rel-entity-photo-inner">${url?`<img src="${esc(url)}" alt="${esc(row?.display_name||row?.name||'Photo')}" loading="lazy">`:`<span>${esc(fallback)}</span>`}</div></div>`;
  }
  function referenceEditButton(kind,row){return canEdit()?`<button type="button" class="rel-tile-edit" data-rel-edit-kind="${esc(kind)}" data-rel-edit-id="${esc(row.id)}" title="Modifier la tuile" aria-label="Modifier la tuile">⚙</button>`:'';}

  function renderMatchCard(m){
    const opp=countryName(effective(m,'opponent_name')||'Adversaire');
    const home=m.home_away==='home';const sel='France';const left=home?sel:opp,right=home?opp:sel;
    const a=effective(m,'france_score'),b=effective(m,'opponent_score');
    const has=a!==null&&a!==undefined&&a!==''&&b!==null&&b!==undefined&&b!==''&&Number.isFinite(Number(a))&&Number.isFinite(Number(b));
    const future=(parseDate(effective(m,'match_date'))?.getTime()||0)>=Date.now();
    const score=has?(home?`${a} – ${b}`:`${b} – ${a}`):(future?'VS':'—');
    const place=[effective(m,'venue_name'),effective(m,'city')].filter(Boolean).join(' · ');const comp=effective(m,'competition_name')||sel;
    return `<article class="rel-ref-tile rel-match-tile" data-match-id="${esc(m.id)}"><div class="rel-ref-head"><div><small>${esc(fmtDateLong(effective(m,'match_date')))}</small><h3><span class="rel-team-name">${flagImg(left)}${esc(left)}</span> <span class="rel-score ${scoreClass(m)}">${esc(score)}</span> <span class="rel-team-name">${esc(right)}${flagImg(right)}</span></h3><div class="subtitle">${esc(comp)}${m.phase?` · ${esc(m.phase)}`:''}</div></div><span class="rel-result ${scoreClass(m)}">${resultLetter(m)}</span></div><div class="rel-facts">${place?`<span>🏟 ${esc(place)}</span>`:''}${m.coach?.display_name?`<span>👔 ${esc(m.coach.display_name)}</span>`:''}${m.spectators?`<span>👥 ${Number(m.spectators).toLocaleString('fr-FR')}</span>`:''}${effective(m,'broadcast_text')?(window.BLEUS3000_BROADCASTS?.renderText?.(effective(m,'broadcast_text'))||`<span>📺 ${esc(effective(m,'broadcast_text'))}</span>`):''}<span>${esc(m.lineup_status||m.notes_short||m.status||'Match')}</span></div><div class="rel-match-bottom"><div class="rel-tags">${chipForMatch(m)}${competitionChipForMatch(m)}</div><div class="rel-match-actions"><button class="rel-match-sheet-toggle" type="button" data-match-sheet-toggle="${esc(m.id)}" aria-expanded="false"><span class="match-sheet-pitch-icon" aria-hidden="true"><i></i></span><span>Feuille de match</span></button><button class="rel-edit-match" type="button" data-calendar-edit="${esc(m.id)}">✎ Modifier</button></div></div><div class="rel-match-sheet-panel" data-match-sheet-panel="${esc(m.id)}" hidden></div></article>`;
  }

  const registryPlayers=()=>window.BLEUS3000_PLAYER_REGISTRY_ALL||window.BLEUS3000_PLAYER_REGISTRY||[];
  const minuteRank=v=>{const s=String(v||'').trim();const m=s.match(/(\d+)(?:\s*\+\s*(\d+))?/);return m?Number(m[1])*100+Number(m[2]||0):999999;};
  const playerCardIcon=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="10" r="2"></circle><path d="M6.5 16c.7-2 4.3-2 5 0M14 9h3M14 13h3"></path></svg>`;
  const openPlayerIcon=id=>id?`<button class="match-sheet-player-link" type="button" data-open-match-player="${esc(id)}" title="Ouvrir la tuile joueur" aria-label="Ouvrir la tuile joueur">${playerCardIcon()}</button>`:'';
  function openMatchPlayer(id){if(!id)return;window.BLEUS3000_PLAYERS_DB?.openPlayer?.(id);}

  async function loadMatchSheet(matchId){
    if(matchSheetCache.has(String(matchId)))return matchSheetCache.get(String(matchId));
    const promise=(async()=>{
      const [appearanceRes,goalRes,cardRes]=await Promise.all([
        client.from('match_appearances').select('*').eq('match_id',matchId).order('starter',{ascending:false}).order('shirt_number',{ascending:true}),
        client.from('match_goal_events').select('id,source_goal_id,match_id,player_id,scorer_name,team_name,minute_text,score_after,source_url,assist_player_id,assist_name,created_at,updated_at').eq('match_id',matchId),
        client.from('match_card_events').select('*').eq('match_id',matchId)
      ]);
      if(appearanceRes.error)throw appearanceRes.error;
      if(goalRes.error)throw goalRes.error;
      if(cardRes.error&&String(cardRes.error.code||'')!=='42P01')throw cardRes.error;
      const appearances=appearanceRes.data||[],goals=goalRes.data||[],cards=cardRes.data||[];
      const ids=[...new Set([
        ...appearances.flatMap(x=>[x.player_id]),
        ...goals.flatMap(x=>[x.player_id,x.assist_player_id]),
        ...cards.flatMap(x=>[x.player_id])
      ].filter(Boolean))];
      const players=ids.length?await fetchIn('players','id,display_name,primary_position,photo_path',ids):[];const pm=new Map(players.map(x=>[String(x.id),x]));
      let jersey=null;try{jersey=await window.BLEUS3000_JERSEYS?.getMatchJersey?.(matchId)||null;}catch(err){console.warn('Feuille de match · maillot',err);}
      return {
        appearances:appearances.map(x=>({...x,player:pm.get(String(x.player_id))||null})),
        goals:goals.map(x=>({...x,player:pm.get(String(x.player_id))||null,assist_player:pm.get(String(x.assist_player_id))||null})).sort((a,b)=>minuteRank(a.minute_text)-minuteRank(b.minute_text)),
        cards:cards.map(x=>({...x,player:pm.get(String(x.player_id))||null})).sort((a,b)=>minuteRank(a.minute_text)-minuteRank(b.minute_text)),
        jersey
      };
    })();
    matchSheetCache.set(String(matchId),promise);
    try{const sheet=await promise;matchSheetCache.set(String(matchId),sheet);return sheet;}catch(e){matchSheetCache.delete(String(matchId));throw e;}
  }
  function matchSheetPlayerRow(r){
    const p=r.player||{},name=p.display_name||'Joueur',num=Number.isInteger(Number(r.shirt_number))?`<b>${Number(r.shirt_number)}</b>`:'<b>—</b>';
    const markers=[r.captain?'C':'',Number(r.goals)>0?`⚽×${Number(r.goals)}`:'',Number(r.assists)>0?`➜×${Number(r.assists)}`:'',Number(r.yellow_cards)>0?'🟨':'',Number(r.red_cards)>0?'🟥':''].filter(Boolean).join(' ');
    return `<div class="match-sheet-player">${num}<span><strong>${esc(name)}</strong><small>${esc(r.position||p.primary_position||r.squad_status||'')}</small></span><div class="match-sheet-player-actions">${markers?`<em>${esc(markers)}</em>`:''}${openPlayerIcon(r.player_id)}</div></div>`;
  }
  function matchEventPlayerName(player,name){return player?.display_name||name||'Joueur non renseigné';}
  function matchEventGoalRow(g){
    const scorer=matchEventPlayerName(g.player,g.scorer_name),assist=matchEventPlayerName(g.assist_player,g.assist_name),hasAssist=!!String(g.assist_player?.display_name||g.assist_name||'').trim();
    return `<div class="match-event-row is-goal"><div class="match-event-minute">${g.minute_text?esc(g.minute_text)+"'":'—'}</div><span class="match-event-kind-icon" title="But">⚽</span><div class="match-event-main"><strong>${esc(scorer)}</strong>${hasAssist?`<small class="match-event-assist"><span aria-hidden="true">➜</span><em>Passe décisive : ${esc(assist)}</em>${openPlayerIcon(g.assist_player_id)}</small>`:''}<small>${esc(g.team_name||'')}${g.score_after?` · score ${esc(g.score_after)}`:''}</small></div>${openPlayerIcon(g.player_id)}</div>`;
  }
  function matchEventCardRow(c){
    const name=matchEventPlayerName(c.player,c.player_name),red=c.card_type==='red',second=c.card_type==='second_yellow';
    const label=red?'Carton rouge':second?'Second jaune':'Carton jaune';
    return `<div class="match-event-row is-card"><div class="match-event-minute">${c.minute_text?esc(c.minute_text)+"'":'—'}</div><span class="match-event-card-icon ${red?'is-red':'is-yellow'}" title="${esc(label)}"></span><div class="match-event-main"><strong>${esc(name)}</strong><small>${esc(label)}${c.team_name?` · ${esc(c.team_name)}`:''}</small></div>${openPlayerIcon(c.player_id)}</div>`;
  }
  function renderMatchFacts(sheet,m){
    const goals=sheet.goals||[],cards=sheet.cards||[],apps=sheet.appearances||[];
    const aggregateAssists=!goals.some(g=>g.assist_player_id||g.assist_name)?apps.filter(r=>Number(r.assists)>0):[];
    const aggregateCards=!cards.length?apps.filter(r=>Number(r.yellow_cards)>0||Number(r.red_cards)>0):[];
    const goalHtml=goals.map(matchEventGoalRow).join('');
    const cardHtml=cards.map(matchEventCardRow).join('')||aggregateCards.map(r=>`${Number(r.yellow_cards)>0?`<div class="match-event-row is-card"><div class="match-event-minute">—</div><span class="match-event-card-icon is-yellow"></span><div class="match-event-main"><strong>${esc(r.player?.display_name||'Joueur')}</strong><small>${Number(r.yellow_cards)} carton${Number(r.yellow_cards)>1?'s':''} jaune${Number(r.yellow_cards)>1?'s':''} · minute non renseignée</small></div>${openPlayerIcon(r.player_id)}</div>`:''}${Number(r.red_cards)>0?`<div class="match-event-row is-card"><div class="match-event-minute">—</div><span class="match-event-card-icon is-red"></span><div class="match-event-main"><strong>${esc(r.player?.display_name||'Joueur')}</strong><small>${Number(r.red_cards)} carton${Number(r.red_cards)>1?'s':''} rouge${Number(r.red_cards)>1?'s':''} · minute non renseignée</small></div>${openPlayerIcon(r.player_id)}</div>`:''}`).join('');
    const assistHtml=aggregateAssists.map(r=>`<div class="match-event-row is-assist"><div class="match-event-minute">—</div><span class="match-event-kind-icon">➜</span><div class="match-event-main"><strong>${esc(r.player?.display_name||'Joueur')}</strong><small><em>${Number(r.assists)} passe${Number(r.assists)>1?'s':''} décisive${Number(r.assists)>1?'s':''} · but associé non renseigné</em></small></div>${openPlayerIcon(r.player_id)}</div>`).join('');
    if(!goalHtml&&!cardHtml&&!assistHtml)return `<div class="match-sheet-empty is-events"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Aucun fait de jeu détaillé</strong><small>Les buts, cartons et passes décisives pourront être renseignés depuis l’éditeur de la feuille de match.</small></div></div>`;
    return `<div class="match-events-summary">${goalHtml?`<section><h4>Buts · ${goals.length}</h4><div class="match-event-list">${goalHtml}</div></section>`:''}${assistHtml?`<section><h4>Passes décisives</h4><div class="match-event-list">${assistHtml}</div></section>`:''}${cardHtml?`<section><h4>Cartons</h4><div class="match-event-list">${cardHtml}</div></section>`:''}</div>`;
  }
  function renderMatchSheet(sheet,m){
    const rows=sheet.appearances||[],starters=rows.filter(r=>r.starter===true||norm(r.squad_status)==='starter'||norm(r.squad_status)==='titulaire'),others=rows.filter(r=>!starters.includes(r));
    const factsCount=(sheet.goals?.length||0)+(sheet.cards?.length||0)+rows.reduce((n,r)=>n+Number(r.assists||0)+Number(r.yellow_cards||0)+Number(r.red_cards||0),0);
    const composition=rows.length?`<div class="match-sheet-columns"><section><h4>Titulaires · ${starters.length}</h4><div class="match-sheet-list">${starters.map(matchSheetPlayerRow).join('')||'<span class="match-sheet-none">Non renseignés</span>'}</div></section><section><h4>Remplaçants / groupe · ${others.length}</h4><div class="match-sheet-list">${others.map(matchSheetPlayerRow).join('')||'<span class="match-sheet-none">Non renseignés</span>'}</div></section></div>`:`<div class="match-sheet-empty"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Composition non renseignée</strong><small>Aucune apparition n’est encore enregistrée dans match_appearances pour cette rencontre.</small></div></div>`;
    const jersey=sheet.jersey||null;
    const jerseyHtml=jersey?`<div class="match-sheet-current-jersey" data-jersey-link="${esc(jersey.link||'')}">${jersey.photo?`<img src="${esc(jersey.photo)}" alt="Maillot ${esc(jersey.year||'')}">`:'<span class="match-sheet-current-jersey-placeholder">👕</span>'}<div><small>Maillot utilisé</small><strong>${esc([jersey.year,jersey.manufacturer,jersey.usage].filter(Boolean).join(' · '))}</strong></div></div>`:'';
    return `<div class="match-sheet-head"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Feuille de match</strong><small>${esc(m.lineup_status||`${rows.length} joueur${rows.length>1?'s':''} renseigné${rows.length>1?'s':''}`)}</small></div>${canEdit()?`<button type="button" class="match-sheet-edit-btn" data-match-sheet-edit="${esc(m.id)}">⚙ Modifier la feuille</button>`:''}</div>${jerseyHtml}<div class="match-sheet-tabs" role="tablist"><button type="button" class="is-active" data-match-sheet-tab="composition" role="tab" aria-selected="true">Composition <span>${rows.length}</span></button><button type="button" data-match-sheet-tab="events" role="tab" aria-selected="false">Faits de jeu <span>${factsCount}</span></button></div><div class="match-sheet-tab-pane" data-match-sheet-pane="composition">${composition}</div><div class="match-sheet-tab-pane" data-match-sheet-pane="events" hidden>${renderMatchFacts(sheet,m)}</div>`;
  }
  function bindMatchSheetPanel(panel,matchId,sheet,m){
    $$('[data-match-sheet-tab]',panel).forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.matchSheetTab;$$('[data-match-sheet-tab]',panel).forEach(x=>{const active=x===btn;x.classList.toggle('is-active',active);x.setAttribute('aria-selected',active?'true':'false');});$$('[data-match-sheet-pane]',panel).forEach(x=>x.hidden=x.dataset.matchSheetPane!==tab);}));
    $$('[data-open-match-player]',panel).forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openMatchPlayer(btn.dataset.openMatchPlayer);}));
    const editBtn=$('[data-match-sheet-edit]',panel);
    if(editBtn&&!editBtn.dataset.sheetEditorBound){
      editBtn.dataset.sheetEditorBound='1';
      editBtn.addEventListener('click',async e=>{
        e.preventDefault();e.stopPropagation();
        editBtn.disabled=true;
        try{
          const currentMatch=matches.find(x=>String(x.id)===String(matchId))||m||{};
          let currentSheet=sheet;
          if(!currentSheet||!Array.isArray(currentSheet.appearances)||!Array.isArray(currentSheet.goals)||!Array.isArray(currentSheet.cards))currentSheet=await loadMatchSheet(matchId);
          openMatchSheetEditor(matchId,currentSheet,currentMatch);
        }catch(err){
          console.error('Ouverture éditeur feuille de match',err);
          alert(`Impossible d’ouvrir la feuille de match : ${String(err?.message||err)}`);
        }finally{editBtn.disabled=false;}
      });
    }
  }
  async function refreshMatchSheetPanel(matchId){
    matchSheetCache.delete(String(matchId));const card=$(`[data-match-id="${CSS.escape(String(matchId))}"]`),panel=card?$('[data-match-sheet-panel]',card):null;if(!panel)return;
    panel.innerHTML='<div class="match-sheet-loading">Actualisation de la feuille de match…</div>';
    try{const m=matches.find(x=>String(x.id)===String(matchId))||{};const sheet=await loadMatchSheet(matchId);panel.innerHTML=renderMatchSheet(sheet,m);panel.dataset.loaded='1';bindMatchSheetPanel(panel,matchId,sheet,m);}catch(e){panel.innerHTML=`<div class="match-sheet-empty"><strong>Feuille de match indisponible</strong><small>${esc(e?.message||e)}</small></div>`;}
  }
  function bindMatchCards(host){
    $$('[data-match-sheet-toggle]',host).forEach(btn=>btn.addEventListener('click',async()=>{
      const card=btn.closest('.rel-match-tile'),panel=$('[data-match-sheet-panel]',card);if(!card||!panel)return;
      const opening=panel.hidden;panel.hidden=!opening;btn.setAttribute('aria-expanded',opening?'true':'false');btn.classList.toggle('is-active',opening);if(!opening)return;
      if(panel.dataset.loaded==='1')return;panel.innerHTML='<div class="match-sheet-loading">Chargement de la feuille de match…</div>';
      try{const m=matches.find(x=>String(x.id)===String(btn.dataset.matchSheetToggle));const sheet=await loadMatchSheet(btn.dataset.matchSheetToggle);panel.innerHTML=renderMatchSheet(sheet,m||{});panel.dataset.loaded='1';bindMatchSheetPanel(panel,btn.dataset.matchSheetToggle,sheet,m||{});}
      catch(e){panel.innerHTML=`<div class="match-sheet-empty"><strong>Feuille de match indisponible</strong><small>${esc(e?.message||e)}</small></div>`;}
    }));
  }

  let matchSheetEditorState=null;
  function editorPlayerListHtml(){return registryPlayers().slice().sort((a,b)=>String(a.name||a.display_name||'').localeCompare(String(b.name||b.display_name||''),'fr')).map(p=>`<option value="${esc(p.name||p.display_name||'')}"></option>`).join('');}
  function editorResolvePlayer(name,currentId=''){
    const n=norm(name).trim();if(!n)return null;const reg=registryPlayers();const exact=reg.filter(p=>norm(p.name||p.display_name).trim()===n);if(currentId&&exact.some(p=>String(p.id)===String(currentId)))return String(currentId);return exact.length===1?String(exact[0].id):null;
  }
  function editorStatusOptions(value){const v=String(value||'').trim();const opts=['Titulaire','Remplaçant(e)','Venu sans jouer','Groupe'];return opts.map(x=>`<option value="${esc(x)}" ${norm(v)===norm(x)||((norm(v)==='remplacante'||norm(v)==='remplacant')&&x==='Remplaçant(e)')?'selected':''}>${esc(x)}</option>`).join('')+(v&&!opts.some(x=>norm(x)===norm(v))?`<option value="${esc(v)}" selected>${esc(v)}</option>`:'');}
  function appearanceEditorRow(r={}){const p=r.player||{},name=p.display_name||'';return `<div class="match-sheet-editor-lineup-row" data-editor-appearance data-original-player-id="${esc(r.player_id||'')}"><input class="match-sheet-editor-player" data-appearance-name list="matchSheetPlayerList" placeholder="Joueur / joueuse" value="${esc(name)}"><select data-appearance-status>${editorStatusOptions(r.squad_status||(r.starter?'Titulaire':'Remplaçant(e)'))}</select><input data-appearance-number type="number" min="0" max="99" placeholder="N°" value="${r.shirt_number??''}"><input data-appearance-position placeholder="Poste" value="${esc(r.position||p.primary_position||'')}"><input data-appearance-minutes type="number" min="0" max="180" placeholder="Min" value="${r.minutes??''}"><label class="match-sheet-editor-check"><input data-appearance-captain type="checkbox" ${r.captain?'checked':''}> C</label><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function goalEditorRow(g={},m={}){const team=g.player_id||norm(g.team_name)==='france'?'france':'opponent',scorer=g.player?.display_name||g.scorer_name||'',assist=g.assist_player?.display_name||g.assist_name||'';return `<div class="match-sheet-editor-event-row" data-editor-goal data-event-id="${esc(g.id||'')}" data-original-player-id="${esc(g.player_id||'')}" data-original-assist-id="${esc(g.assist_player_id||'')}"><select data-goal-team><option value="france" ${team==='france'?'selected':''}>France</option><option value="opponent" ${team==='opponent'?'selected':''}>Adversaire</option></select><input data-goal-scorer list="matchSheetPlayerList" placeholder="Buteur" value="${esc(scorer)}"><input data-goal-minute placeholder="Minute" value="${esc(g.minute_text||'')}"><input data-goal-score placeholder="Score après" value="${esc(g.score_after||'')}"><input data-goal-assist list="matchSheetPlayerList" placeholder="Passeur décisif (facultatif)" value="${esc(assist)}"><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function cardEditorRow(c={}){const team=c.player_id||norm(c.team_name)==='france'?'france':'opponent',name=c.player?.display_name||c.player_name||'';return `<div class="match-sheet-editor-event-row is-card" data-editor-card data-event-id="${esc(c.id||'')}" data-original-player-id="${esc(c.player_id||'')}"><select data-card-team><option value="france" ${team==='france'?'selected':''}>France</option><option value="opponent" ${team==='opponent'?'selected':''}>Adversaire</option></select><input data-card-player list="matchSheetPlayerList" placeholder="Joueur" value="${esc(name)}"><select data-card-type><option value="yellow" ${c.card_type!=='red'&&c.card_type!=='second_yellow'?'selected':''}>Jaune</option><option value="second_yellow" ${c.card_type==='second_yellow'?'selected':''}>2e jaune</option><option value="red" ${c.card_type==='red'?'selected':''}>Rouge</option></select><input data-card-minute placeholder="Minute" value="${esc(c.minute_text||'')}"><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function ensureMatchSheetEditor(){
    let modal=$('#matchSheetEditorModal');if(modal)return modal;
    modal=document.createElement('div');modal.className='modal-backdrop match-sheet-editor-modal';modal.id='matchSheetEditorModal';modal.hidden=true;modal.innerHTML=`<section class="modal-dialog match-sheet-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="matchSheetEditorTitle"><header class="modal-head"><div><h2 id="matchSheetEditorTitle">Modifier la feuille de match</h2><p id="matchSheetEditorMeta">Composition et faits de jeu</p></div><button class="modal-close" data-match-sheet-editor-close type="button">×</button></header><div class="modal-body"><datalist id="matchSheetPlayerList"></datalist><div class="match-sheet-editor-tabs"><button type="button" class="is-active" data-match-sheet-editor-tab="composition">Composition</button><button type="button" data-match-sheet-editor-tab="events">Faits de jeu</button></div><section data-match-sheet-editor-pane="composition"><div class="match-sheet-editor-help">Modifie les titulaires, remplaçants, numéros, postes, minutes et le capitanat. Le joueur doit exister dans la base joueurs.</div><div class="match-sheet-jersey-picker"><label><span>Maillot utilisé par la France</span><select id="matchSheetEditorJersey"><option value="">Chargement des maillots…</option></select></label><div class="match-sheet-jersey-preview" id="matchSheetEditorJerseyPreview"><span>👕</span><small>Aucun maillot associé</small></div></div><div class="match-sheet-editor-lineup-head"><span>Joueur</span><span>Statut</span><span>N°</span><span>Poste</span><span>Min.</span><span>C</span><span></span></div><div id="matchSheetEditorLineup"></div><button type="button" class="secondary-btn match-sheet-editor-add" data-add-appearance>＋ Ajouter un joueur</button></section><section data-match-sheet-editor-pane="events" hidden><div class="match-sheet-editor-help">Les buts détaillés déjà présents dans la base sont repris ici. Les passes décisives sont rattachées au but ; les cartons disposent de leur minute propre.</div><div class="match-sheet-editor-event-head"><h3>⚽ Buts</h3><button type="button" class="secondary-btn" data-add-goal>＋ Ajouter un but</button></div><div class="match-sheet-editor-event-labels goal"><span>Équipe</span><span>Buteur</span><span>Minute</span><span>Score</span><span>Passeur décisif</span><span></span></div><div id="matchSheetEditorGoals"></div><div class="match-sheet-editor-event-head"><h3>Cartons</h3><button type="button" class="secondary-btn" data-add-card>＋ Ajouter un carton</button></div><div class="match-sheet-editor-event-labels card"><span>Équipe</span><span>Joueur</span><span>Carton</span><span>Minute</span><span></span></div><div id="matchSheetEditorCards"></div></section><div class="match-sheet-editor-status" id="matchSheetEditorStatus" hidden></div><div class="match-sheet-editor-actions"><button class="secondary-btn" type="button" data-match-sheet-editor-close>Annuler</button><button class="primary-btn" type="button" data-match-sheet-editor-save>Enregistrer la feuille</button></div></div></section>`;document.body.appendChild(modal);
    $$('[data-match-sheet-editor-close]',modal).forEach(b=>b.addEventListener('click',()=>{modal.hidden=true;matchSheetEditorState=null;}));
    $$('[data-match-sheet-editor-tab]',modal).forEach(btn=>btn.addEventListener('click',()=>{const tab=btn.dataset.matchSheetEditorTab;$$('[data-match-sheet-editor-tab]',modal).forEach(x=>x.classList.toggle('is-active',x===btn));$$('[data-match-sheet-editor-pane]',modal).forEach(x=>x.hidden=x.dataset.matchSheetEditorPane!==tab);}));
    $('[data-add-appearance]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorLineup',modal);h?.insertAdjacentHTML('beforeend',appearanceEditorRow({}));if(matchSheetEditorState)matchSheetEditorState.compositionDirty=true;});
    $('[data-add-goal]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorGoals',modal);h?.insertAdjacentHTML('beforeend',goalEditorRow({},matchSheetEditorState?.match||{}));if(matchSheetEditorState)matchSheetEditorState.eventsDirty=true;});
    $('[data-add-card]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorCards',modal);h?.insertAdjacentHTML('beforeend',cardEditorRow({}));if(matchSheetEditorState)matchSheetEditorState.eventsDirty=true;});
    modal.addEventListener('click',e=>{const b=e.target.closest('[data-remove-editor-row]');if(!b)return;const row=b.closest('[data-editor-appearance],[data-editor-goal],[data-editor-card]');if(row?.hasAttribute('data-editor-appearance'))matchSheetEditorState.compositionDirty=true;else matchSheetEditorState.eventsDirty=true;row?.remove();});
    modal.addEventListener('input',e=>{if(!matchSheetEditorState)return;if(e.target.closest('[data-match-sheet-editor-pane="events"]'))matchSheetEditorState.eventsDirty=true;else if(e.target.closest('[data-match-sheet-editor-pane="composition"]'))matchSheetEditorState.compositionDirty=true;});
    modal.addEventListener('change',e=>{if(!matchSheetEditorState)return;if(e.target.closest('[data-match-sheet-editor-pane="events"]'))matchSheetEditorState.eventsDirty=true;else if(e.target.closest('[data-match-sheet-editor-pane="composition"]'))matchSheetEditorState.compositionDirty=true;});
    $('[data-match-sheet-editor-save]',modal)?.addEventListener('click',saveMatchSheetEditor);
    return modal;
  }
  async function populateMatchSheetJerseyPicker(modal,state){
    const select=$('#matchSheetEditorJersey',modal),preview=$('#matchSheetEditorJerseyPreview',modal);if(!select)return;
    select.disabled=true;select.innerHTML='<option value="">Chargement…</option>';
    const renderPreview=(data,opt)=>{if(!preview)return;const row=data?.options?.find(x=>String(x.id)===String(opt||''));preview.innerHTML=row?`${row.photo?`<img src="${esc(row.photo)}" alt="Maillot ${esc(row.year||'')}">`:'<span>👕</span>'}<div><strong>${esc(row.label)}</strong><small>${esc(row.link||'')}</small></div>`:'<span>👕</span><small>Aucun maillot associé</small>';};
    try{const api=window.BLEUS3000_JERSEYS;if(!api?.getMatchPickerData){select.innerHTML='<option value="">Module Maillots indisponible</option>';return;}const data=await api.getMatchPickerData(state.matchId,state.match||{});select.innerHTML=`<option value="">Aucun maillot associé</option>${data.options.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}`;select.value=String(data.selectedId||'');select.disabled=false;renderPreview(data,select.value);select.onchange=()=>{state.jerseyDirty=true;renderPreview(data,select.value);};}
    catch(err){console.warn('Sélecteur maillot',err);select.innerHTML='<option value="">Migration Maillots ↔ Matchs requise</option>';select.disabled=true;if(preview)preview.innerHTML='<span>⚠</span><small>Relation maillot/match non disponible</small>';}
  }
  function openMatchSheetEditor(matchId,sheet,m){
    if(!canEdit())return alert('Modification réservée aux éditeurs et administrateurs.');
    const modal=ensureMatchSheetEditor();
    const safeSheet=sheet||{appearances:[],goals:[],cards:[]},safeMatch=m||{};
    matchSheetEditorState={matchId:String(matchId),sheet:safeSheet,match:safeMatch,compositionDirty:false,eventsDirty:false,jerseyDirty:false};
    const playerList=$('#matchSheetPlayerList',modal),meta=$('#matchSheetEditorMeta',modal),lineup=$('#matchSheetEditorLineup',modal),goals=$('#matchSheetEditorGoals',modal),cards=$('#matchSheetEditorCards',modal);
    if(playerList)playerList.innerHTML=editorPlayerListHtml();
    const opp=countryName(effective(safeMatch,'opponent_name')||'Adversaire');
    if(meta)meta.textContent=`${fmtDateLong(effective(safeMatch,'match_date'))} · France – ${opp}`;
    if(lineup)lineup.innerHTML=(safeSheet.appearances||[]).map(appearanceEditorRow).join('');
    if(goals)goals.innerHTML=(safeSheet.goals||[]).map(g=>goalEditorRow(g,safeMatch)).join('');
    if(cards)cards.innerHTML=(safeSheet.cards||[]).map(cardEditorRow).join('');
    $$('[data-match-sheet-editor-tab]',modal).forEach((x,i)=>x.classList.toggle('is-active',i===0));
    $$('[data-match-sheet-editor-pane]',modal).forEach(x=>x.hidden=x.dataset.matchSheetEditorPane!=='composition');
    const st=$('#matchSheetEditorStatus',modal);if(st){st.hidden=true;st.textContent='';st.className='match-sheet-editor-status';}
    modal.hidden=false;
    requestAnimationFrame(()=>{populateMatchSheetJerseyPicker(modal,matchSheetEditorState).catch(err=>console.warn('Sélecteur maillot différé',err));});
  }
  function collectEditorAppearances(modal,state){
    const out=[],seen=new Set();for(const row of $$('[data-editor-appearance]',modal)){const input=$('[data-appearance-name]',row),name=String(input?.value||'').trim();if(!name)continue;const current=row.dataset.originalPlayerId||'';const playerId=editorResolvePlayer(name,current);if(!playerId)throw new Error(`Joueur introuvable dans la base : ${name}`);if(seen.has(playerId))throw new Error(`Le joueur ${name} est présent deux fois dans la composition.`);seen.add(playerId);const status=$('[data-appearance-status]',row)?.value||'Groupe';out.push({match_id:state.matchId,player_id:playerId,starter:status==='Titulaire',minutes:null,squad_status:status,shirt_number:$('[data-appearance-number]',row)?.value===''?null:Number($('[data-appearance-number]',row)?.value),position:String($('[data-appearance-position]',row)?.value||'').trim()||null,captain:!!$('[data-appearance-captain]',row)?.checked,_minutesValue:$('[data-appearance-minutes]',row)?.value});}return out.map(x=>{x.minutes=x._minutesValue===''?null:Number(x._minutesValue);delete x._minutesValue;return x;});
  }
  function collectEditorGoals(modal,state){
    const opp=countryName(effective(state.match,'opponent_name')||'Adversaire');return $$('[data-editor-goal]',modal).map(row=>{const scorer=String($('[data-goal-scorer]',row)?.value||'').trim();if(!scorer)return null;const team=$('[data-goal-team]',row)?.value||'france',current=row.dataset.originalPlayerId||'',assistName=String($('[data-goal-assist]',row)?.value||'').trim(),currentAssist=row.dataset.originalAssistId||'';const playerId=team==='france'?editorResolvePlayer(scorer,current):null;if(team==='france'&&!playerId)throw new Error(`Buteur France introuvable dans la base : ${scorer}`);const assistId=assistName?editorResolvePlayer(assistName,currentAssist):null;return {id:row.dataset.eventId||null,match_id:state.matchId,player_id:playerId,scorer_name:scorer,team_name:team==='france'?'France':opp,minute_text:String($('[data-goal-minute]',row)?.value||'').trim()||null,score_after:String($('[data-goal-score]',row)?.value||'').trim()||null,assist_player_id:assistId,assist_name:assistName||null,updated_at:new Date().toISOString()};}).filter(Boolean);}
  function collectEditorCards(modal,state){
    const opp=countryName(effective(state.match,'opponent_name')||'Adversaire');return $$('[data-editor-card]',modal).map(row=>{const name=String($('[data-card-player]',row)?.value||'').trim();if(!name)return null;const team=$('[data-card-team]',row)?.value||'france',current=row.dataset.originalPlayerId||'',playerId=team==='france'?editorResolvePlayer(name,current):null;if(team==='france'&&!playerId)throw new Error(`Joueur France introuvable dans la base : ${name}`);return {id:row.dataset.eventId||null,match_id:state.matchId,player_id:playerId,player_name:name,team_name:team==='france'?'France':opp,card_type:$('[data-card-type]',row)?.value||'yellow',minute_text:String($('[data-card-minute]',row)?.value||'').trim()||null,updated_at:new Date().toISOString()};}).filter(Boolean);}
  async function saveEditorAppearances(state,rows){
    const oldIds=new Set((state.sheet.appearances||[]).map(x=>String(x.player_id))),newIds=new Set(rows.map(x=>String(x.player_id))),removed=[...oldIds].filter(id=>!newIds.has(id));if(rows.length){const {error}=await client.from('match_appearances').upsert(rows,{onConflict:'match_id,player_id'});if(error)throw error;}if(removed.length){const {error}=await client.from('match_appearances').delete().eq('match_id',state.matchId).in('player_id',removed);if(error)throw error;}
  }
  async function saveEditorGoals(state,rows){
    const oldIds=new Set((state.sheet.goals||[]).map(x=>String(x.id)).filter(Boolean)),keep=new Set(rows.map(x=>String(x.id)).filter(Boolean)),removed=[...oldIds].filter(id=>!keep.has(id));if(removed.length){const {error}=await client.from('match_goal_events').delete().in('id',removed);if(error)throw error;}for(const row of rows){const payload={...row};delete payload.id;if(row.id){const {error}=await client.from('match_goal_events').update(payload).eq('id',row.id);if(error)throw error;}else{const {error}=await client.from('match_goal_events').insert(payload);if(error)throw error;}}
  }
  async function saveEditorCards(state,rows){
    const oldIds=new Set((state.sheet.cards||[]).map(x=>String(x.id)).filter(Boolean)),keep=new Set(rows.map(x=>String(x.id)).filter(Boolean)),removed=[...oldIds].filter(id=>!keep.has(id));if(removed.length){const {error}=await client.from('match_card_events').delete().in('id',removed);if(error)throw error;}for(const row of rows){const payload={...row};delete payload.id;if(row.id){const {error}=await client.from('match_card_events').update(payload).eq('id',row.id);if(error)throw error;}else{const {error}=await client.from('match_card_events').insert(payload);if(error)throw error;}}
  }
  async function syncAppearanceEventCounters(matchId,goals,cards){
    const {data:apps,error}=await client.from('match_appearances').select('player_id').eq('match_id',matchId);if(error)throw error;const counts=new Map((apps||[]).map(x=>[String(x.player_id),{goals:0,assists:0,yellow_cards:0,red_cards:0}]));for(const g of goals){if(g.player_id&&counts.has(String(g.player_id)))counts.get(String(g.player_id)).goals++;if(g.assist_player_id&&counts.has(String(g.assist_player_id)))counts.get(String(g.assist_player_id)).assists++;}for(const c of cards){if(!c.player_id||!counts.has(String(c.player_id)))continue;if(c.card_type==='red')counts.get(String(c.player_id)).red_cards++;else counts.get(String(c.player_id)).yellow_cards++;}await Promise.all([...counts.entries()].map(([player_id,payload])=>client.from('match_appearances').update(payload).eq('match_id',matchId).eq('player_id',player_id).then(({error})=>{if(error)throw error;})));
  }
  async function saveMatchSheetEditor(){
    const modal=ensureMatchSheetEditor(),state=matchSheetEditorState,st=$('#matchSheetEditorStatus',modal);if(!state||!client)return;if(st){st.hidden=false;st.className='match-sheet-editor-status';st.textContent='Enregistrement…';}
    try{const appearances=collectEditorAppearances(modal,state);const goals=collectEditorGoals(modal,state),cards=collectEditorCards(modal,state);await saveEditorAppearances(state,appearances);const jerseySelect=$('#matchSheetEditorJersey',modal);if(jerseySelect&&!jerseySelect.disabled&&window.BLEUS3000_JERSEYS?.setMatchJersey)await window.BLEUS3000_JERSEYS.setMatchJersey(state.matchId,jerseySelect.value||'',state.match?.selection_team_id||state.match?.selection?.id||null);if(state.eventsDirty){await saveEditorGoals(state,goals);await saveEditorCards(state,cards);await syncAppearanceEventCounters(state.matchId,goals,cards);}matchSheetCache.delete(state.matchId);if(st){st.className='match-sheet-editor-status is-ok';st.textContent='Feuille de match enregistrée ✓';}await refreshMatchSheetPanel(state.matchId);setTimeout(()=>{modal.hidden=true;matchSheetEditorState=null;},650);}catch(err){console.error('Édition feuille de match',err);if(st){st.hidden=false;st.className='match-sheet-editor-status is-error';st.textContent=String(err?.message||err);}}
  }

  function renderCompetitionCard(c){
    const tag=c.tag_id?tagsById.get(c.tag_id):null;
    const matchCount=matches.filter(m=>String(m.competition_id)===String(c.id)).length;
    return `<article class="rel-ref-tile rel-competition-tile"><div class="rel-ref-head"><div><h3>${esc(c.name)}</h3><div class="subtitle">${esc([c.edition,c.selection_category,c.gender==='F'?'Féminin':c.gender==='M'?'Masculin':''].filter(Boolean).join(' · ')||'Compétition')}</div></div><span class="rel-result">${matchCount}</span></div><div class="rel-facts"><span>⚽ ${matchCount} match${matchCount>1?'s':''} relié${matchCount>1?'s':''}</span>${c.status?`<span>État : ${esc(c.status)}</span>`:''}${c.competition_type?`<span>Type : ${esc(c.competition_type)}</span>`:''}</div><div class="rel-tags">${tag?tagChip(tag,'relational-competition-chip'):''}</div></article>`;
  }

  function relationSummaryHtml(b,label='Bilan général'){
    return `<div class="rel-relation-summary-label" data-relation-summary-label>${esc(label)}</div><div class="rel-stat-grid rel-relation-summary" data-relation-summary><span><small>Matchs</small><strong>${b.matches}</strong></span><span><small>V</small><strong>${b.wins}</strong></span><span><small>N</small><strong>${b.draws}</strong></span><span><small>D</small><strong>${b.losses}</strong></span></div>`;
  }
  function updateRelationSummary(card,b,label){
    const labelEl=$('[data-relation-summary-label]',card),grid=$('[data-relation-summary]',card);
    if(labelEl)labelEl.textContent=label;
    if(grid)grid.innerHTML=`<span><small>Matchs</small><strong>${b.matches}</strong></span><span><small>V</small><strong>${b.wins}</strong></span><span><small>N</small><strong>${b.draws}</strong></span><span><small>D</small><strong>${b.losses}</strong></span>`;
  }
  function relationSectionButton(teamId,label,tag,attr){
    const inside=tag?tagChip(tag,'relational-team-chip'):`<span class="rel-tag-fallback">${esc(label)}</span>`;
    return `<button type="button" class="rel-opponent-section-btn" ${attr}="${esc(teamId)}" title="Afficher / masquer les matchs de ${esc(label)}">${inside}</button>`;
  }
  function relationMatchMiniCard(m){
    const a=effective(m,'france_score'),b=effective(m,'opponent_score'),has=a!==null&&a!==undefined&&a!==''&&b!==null&&b!==undefined&&b!=='';
    const score=has?`${a} – ${b}`:((parseDate(effective(m,'match_date'))?.getTime()||0)>=Date.now()?'VS':'—');
    const opp=countryName(effective(m,'opponent_name')||'Adversaire');
    return `<button type="button" class="rel-linked-match-tile" data-linked-match="${esc(m.id)}"><span class="rel-linked-match-date">${esc(fmtDate(effective(m,'match_date')))}</span><span class="rel-linked-match-main"><strong>France <b class="rel-linked-score ${scoreClass(m)}">${esc(score)}</b> ${flagImg(opp)}${esc(opp)}</strong><small>${esc(effective(m,'competition_name')||'Match international')}${m.phase?` · ${esc(m.phase)}`:''}</small></span><span class="rel-linked-match-result ${scoreClass(m)}">${resultLetter(m)}</span><span class="rel-linked-match-open">↗</span></button>`;
  }
  function renderPagedMatches(details,list,label,page=1,rerender){
    const totalPages=Math.max(1,Math.ceil(list.length/PAGE_SIZE)),safePage=Math.max(1,Math.min(Number(page)||1,totalPages));
    const start=(safePage-1)*PAGE_SIZE,shown=list.slice(start,start+PAGE_SIZE);
    details.hidden=false;
    details.innerHTML=`<div class="rel-opponent-balance-head"><strong>${esc(label)}</strong><span>${list.length} match${list.length>1?'s':''}${totalPages>1?` · page ${safePage}/${totalPages}`:''}</span></div><div class="rel-opponent-match-list">${shown.map(relationMatchMiniCard).join('')||'<div class="rel-opponent-empty">Aucun match relié à cette section.</div>'}</div>${totalPages>1?`<div class="rel-match-pagination"><button type="button" data-rel-page="${safePage-1}" ${safePage<=1?'disabled':''}>‹</button>${Array.from({length:totalPages},(_,i)=>i+1).map(p=>`<button type="button" data-rel-page="${p}" class="${p===safePage?'is-active':''}">${p}</button>`).join('')}<button type="button" data-rel-page="${safePage+1}" ${safePage>=totalPages?'disabled':''}>›</button></div>`:''}`;
    $$('[data-linked-match]',details).forEach(b=>b.addEventListener('click',()=>openMatch(b.dataset.linkedMatch)));
    $$('[data-rel-page]',details).forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;rerender(Number(b.dataset.relPage));}));
  }

  function opponentMatches(id,teamId='all'){
    return matches.filter(m=>String(m.opponent_id)===String(id)&&(teamId==='all'||String(m.selection_team_id)===String(teamId))).sort((a,b)=>(parseDate(effective(b,'match_date'))||0)-(parseDate(effective(a,'match_date'))||0));
  }
  function renderOpponentCard(o){
    const all=opponentMatches(o.id);const bal=balance(all);
    const teamMap=new Map();
    for(const m of all){
      if(!m.selection_team_id)continue;
      teamMap.set(String(m.selection_team_id),{label:selectionLabel(m),tag:sectionTagForMatch(m)});
    }
    const sectionButtons=[...teamMap.entries()].map(([id,x])=>relationSectionButton(id,x.label,x.tag,'data-opponent-section')).join('');
    const meta=[o.confederation,o.continent,o.fifa_code].filter(Boolean).join(' · ')||'Sélection adverse';
    const countrySearch=[o.name,countryName(o.name),o.fifa_code].filter(Boolean).join(' ');
    return `<article class="rel-ref-tile rel-opponent-tile" data-opponent-id="${esc(o.id)}" data-country-search="${esc(norm(countrySearch))}"><div class="rel-ref-head"><div><h3><span class="rel-opponent-title">${flagImg(o.name)}${esc(countryName(o.name))}</span></h3><div class="subtitle">${esc(meta)}</div></div><span class="rel-result">${bal.matches}</span></div>${relationSummaryHtml(bal)}${o.federation_name?`<div class="rel-facts"><span>🏛 ${esc(o.federation_name)}</span></div>`:''}<div class="rel-opponent-section-title">Matchs par sélection française</div><div class="rel-opponent-sections">${sectionButtons||'<span class="rel-opponent-empty">Aucune section reliée</span>'}</div><div class="rel-opponent-details" hidden></div></article>`;
  }
  function renderOpponentDetails(card,opponentId,teamId,page=1){
    const list=opponentMatches(opponentId,teamId),bal=balance(list);
    const team=list[0]?.selection||selectionRows.find(x=>String(x.id)===String(teamId));
    const label=team?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||'Sélection';
    updateRelationSummary(card,bal,`Bilan · ${label}`);
    const details=$('.rel-opponent-details',card);if(!details)return;
    renderPagedMatches(details,list,`Matchs · ${label}`,page,p=>renderOpponentDetails(card,opponentId,teamId,p));
  }
  function bindOpponentCards(host){
    $$('.rel-opponent-tile',host).forEach(card=>{
      const allBal=balance(opponentMatches(card.dataset.opponentId));
      $$('[data-opponent-section]',card).forEach(btn=>btn.addEventListener('click',()=>{
        const same=btn.classList.contains('is-active');
        $$('[data-opponent-section]',card).forEach(x=>x.classList.remove('is-active'));
        const details=$('.rel-opponent-details',card);
        if(same){if(details)details.hidden=true;updateRelationSummary(card,allBal,'Bilan général');return;}
        btn.classList.add('is-active');
        renderOpponentDetails(card,card.dataset.opponentId,btn.dataset.opponentSection,1);
      }));
    });
  }
  function applyOpponentCountrySearch(host){
    if(!host)return;
    const q=norm(relFilters.adversaires.countryQuery||'').trim();let visible=0;
    $$('.rel-opponent-tile',host).forEach(card=>{const show=!q||String(card.dataset.countrySearch||'').includes(q);card.hidden=!show;if(show)visible++;});
    const count=$('#referenceCount');if(count)count.textContent=`${visible} adversaire${visible>1?'s':''}`;
  }

  function applyStadiumCountrySearch(host){
    if(!host)return;
    const q=norm(relFilters.lieux.countryQuery||'').trim();let visible=0;
    $$('.rel-stadium-tile',host).forEach(card=>{const show=!q||String(card.dataset.countrySearch||'').includes(q);card.hidden=!show;if(show)visible++;});
    const count=$('#referenceCount');if(count)count.textContent=`${visible} stade${visible>1?'s':''}`;
  }

  function teamMapForMatches(list){
    const map=new Map();
    for(const m of list){if(!m.selection_team_id)continue;map.set(String(m.selection_team_id),{label:selectionLabel(m),tag:sectionTagForMatch(m)});}
    return map;
  }
  function initials(name){return String(name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();}
  function renderStaffCard(p){
    const linked=p.linked_matches||[],bal=balance(linked),teams=teamMapForMatches(linked);
    const teamTags=[...teams.entries()].map(([id,x])=>`<span class="rel-static-section-tag" data-team-id="${esc(id)}">${x.tag?tagChip(x.tag,'relational-team-chip'):`<span class="rel-tag-fallback">${esc(x.label)}</span>`}</span>`).join('');
    return `<article class="selection-player-tile rel-ref-tile rel-person-tile rel-staff-tile" data-staff-id="${esc(p.id)}">${referencePhotoHtml(p)}${referenceEditButton('staff',p)}<div class="rel-ref-head"><div><h3>${esc(p.display_name)}</h3><div class="subtitle">Sélectionneur${p.organization?` · ${esc(p.organization)}`:''}</div></div><span class="rel-result">${linked.length}</span></div>${p.nationality?`<div class="rel-facts"><span>${flagImg(p.nationality)} ${esc(p.nationality)}</span></div>`:''}${relationSummaryHtml(bal,'Bilan comme sélectionneur')}<div class="rel-opponent-section-title">Sélections dirigées</div><div class="rel-opponent-sections">${teamTags||'<span class="rel-opponent-empty">Aucun match relié</span>'}</div></article>`;
  }

  function refereeMatches(personId,teamId='all'){
    const p=refereeRows.find(x=>String(x.id)===String(personId));const list=p?.linked_matches||[];
    return list.filter(m=>teamId==='all'||String(m.selection_team_id)===String(teamId));
  }
  function renderRefereeCard(p){
    const all=refereeMatches(p.id),bal=balance(all),teams=teamMapForMatches(all);
    const sectionButtons=[...teams.entries()].map(([id,x])=>relationSectionButton(id,x.label,x.tag,'data-referee-section')).join('');
    return `<article class="selection-player-tile rel-ref-tile rel-person-tile rel-referee-tile" data-referee-id="${esc(p.id)}">${referencePhotoHtml(p)}${referenceEditButton('arbitres',p)}<div class="rel-ref-head"><div><h3>${esc(p.display_name)}</h3><div class="subtitle">Arbitre principal</div></div><span class="rel-result">${all.length}</span></div>${p.nationality?`<div class="rel-facts"><span>${flagImg(p.nationality)} ${esc(p.nationality)}</span></div>`:''}${relationSummaryHtml(bal)}<div class="rel-opponent-section-title">Matchs arbitrés par sélection française</div><div class="rel-opponent-sections">${sectionButtons||'<span class="rel-opponent-empty">Aucun match relié</span>'}</div><div class="rel-opponent-details" hidden></div></article>`;
  }
  function renderRefereeDetails(card,personId,teamId,page=1){
    const list=refereeMatches(personId,teamId),bal=balance(list);
    const team=list[0]?.selection||selectionRows.find(x=>String(x.id)===String(teamId));
    const label=team?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||'Sélection';
    updateRelationSummary(card,bal,`Bilan France · ${label}`);
    const details=$('.rel-opponent-details',card);if(!details)return;
    renderPagedMatches(details,list,`Matchs arbitrés · ${label}`,page,p=>renderRefereeDetails(card,personId,teamId,p));
  }
  function bindRefereeCards(host){
    $$('.rel-referee-tile',host).forEach(card=>{
      const allBal=balance(refereeMatches(card.dataset.refereeId));
      $$('[data-referee-section]',card).forEach(btn=>btn.addEventListener('click',()=>{
        const same=btn.classList.contains('is-active');
        $$('[data-referee-section]',card).forEach(x=>x.classList.remove('is-active'));
        const details=$('.rel-opponent-details',card);
        if(same){if(details)details.hidden=true;updateRelationSummary(card,allBal,'Bilan général');return;}
        btn.classList.add('is-active');
        renderRefereeDetails(card,card.dataset.refereeId,btn.dataset.refereeSection,1);
      }));
    });
  }


  function stadiumMatches(placeId,teamId='all'){
    return matches.filter(m=>String(m.place_id)===String(placeId)&&(teamId==='all'||String(m.selection_team_id)===String(teamId))).sort((a,b)=>(parseDate(effective(b,'match_date'))||0)-(parseDate(effective(a,'match_date'))||0));
  }
  function renderStadiumCard(v){
    const all=stadiumMatches(v.id),bal=balance(all),teams=teamMapForMatches(all);
    const sectionButtons=[...teams.entries()].map(([id,x])=>relationSectionButton(id,x.label,x.tag,'data-stadium-section')).join('');
    const meta=[v.city,v.country].filter(Boolean).join(' · ')||'Stade';
    const facts=[
      v.capacity?`👥 ${Number(v.capacity).toLocaleString('fr-FR')} places`:'',
      v.opened_year?`📅 Ouvert en ${v.opened_year}`:'',
      v.country?`${flagImg(v.country)} ${esc(v.country)}`:''
    ].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
    const countrySearch=[v.country,countryName(v.country),countryCode(v.country)].filter(Boolean).join(' ');
    return `<article class="rel-ref-tile rel-stadium-tile" data-stadium-id="${esc(v.id)}" data-country-search="${esc(norm(countrySearch))}">${referencePhotoHtml(v,'rel-stadium-photo')}${referenceEditButton('lieux',v)}<div class="rel-ref-head"><div><h3>🏟 ${esc(v.name)}</h3><div class="subtitle">${esc(meta)}</div></div><span class="rel-result">${all.length}</span></div>${relationSummaryHtml(bal,'Bilan général dans ce stade')}${facts?`<div class="rel-facts">${facts}</div>`:''}<div class="rel-opponent-section-title">Matchs par sélection française</div><div class="rel-opponent-sections">${sectionButtons||'<span class="rel-opponent-empty">Aucun match relié</span>'}</div><div class="rel-opponent-details" hidden></div></article>`;
  }
  function renderStadiumDetails(card,placeId,teamId,page=1){
    const list=stadiumMatches(placeId,teamId),bal=balance(list);
    const team=list[0]?.selection||selectionRows.find(x=>String(x.id)===String(teamId));
    const label=team?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||'Sélection';
    updateRelationSummary(card,bal,`Bilan · ${label}`);
    const details=$('.rel-opponent-details',card);if(!details)return;
    renderPagedMatches(details,list,`Matchs dans ce stade · ${label}`,page,p=>renderStadiumDetails(card,placeId,teamId,p));
  }
  function bindStadiumCards(host){
    $$('.rel-stadium-tile',host).forEach(card=>{
      const allBal=balance(stadiumMatches(card.dataset.stadiumId));
      $$('[data-stadium-section]',card).forEach(btn=>btn.addEventListener('click',()=>{
        const same=btn.classList.contains('is-active');
        $$('[data-stadium-section]',card).forEach(x=>x.classList.remove('is-active'));
        const details=$('.rel-opponent-details',card);
        if(same){if(details)details.hidden=true;updateRelationSummary(card,allBal,'Bilan général dans ce stade');return;}
        btn.classList.add('is-active');
        renderStadiumDetails(card,card.dataset.stadiumId,btn.dataset.stadiumSection,1);
      }));
    });
  }

  function ensureReferenceEditor(){
    let modal=$('#relReferenceEditorModal');if(modal)return modal;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="relReferenceEditorModal" hidden><section class="modal-dialog rel-reference-editor-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2 id="relReferenceEditorTitle">Modifier la tuile</h2><p>Photo, informations et bordure de la tuile</p></div><button class="modal-close" type="button" data-rel-editor-close>×</button></header><div class="modal-body"><form id="relReferenceEditorForm" class="rel-reference-editor-form"></form></div></section></div>`);
    modal=$('#relReferenceEditorModal');modal.querySelector('[data-rel-editor-close]')?.addEventListener('click',()=>{modal.hidden=true;referenceEditorState=null;});modal.addEventListener('pointerdown',e=>{if(e.target===modal){modal.hidden=true;referenceEditorState=null;}});modal.querySelector('form')?.addEventListener('submit',saveReferenceEditor);return modal;
  }
  function countryPickerHtml(current=''){
    const currentCode=countryCode(current),list=countryCatalogue();
    const hiddenValue=current;
    return `<div class="rel-country-picker"><label>Rechercher un pays<input type="search" data-country-picker-search placeholder="France, Brésil, Japon…" autocomplete="off"></label><input type="hidden" name="country" value="${esc(hiddenValue||'')}"><div class="rel-country-picker-selected" data-country-picker-selected>${current?`${flagImg(current)}<strong>${esc(current)}</strong>`:'<span>🌍 Aucun pays sélectionné</span>'}</div><div class="rel-country-picker-list" data-country-picker-list>${list.map(x=>`<button type="button" data-country-code="${x.code}" data-country-name="${esc(x.name)}" data-country-search="${esc(norm(x.name+' '+x.code))}" class="${x.code===currentCode?'is-active':''}"><img src="${esc(window.BLEUS3000_FLAGS?.urlForCode?.(x.code)||'')}" alt=""><span>${esc(x.name)}</span></button>`).join('')}</div></div>`;
  }
  function bindCountryPicker(form){
    const search=$('[data-country-picker-search]',form),list=$('[data-country-picker-list]',form),hidden=form.elements.country,selected=$('[data-country-picker-selected]',form);if(!search||!list||!hidden)return;
    search.addEventListener('input',()=>{const q=norm(search.value);$$('[data-country-code]',list).forEach(b=>b.hidden=!!q&&!String(b.dataset.countrySearch||'').includes(q));});
    $$('[data-country-code]',list).forEach(b=>b.addEventListener('click',()=>{hidden.value=b.dataset.countryName||'';$$('[data-country-code]',list).forEach(x=>x.classList.toggle('is-active',x===b));if(selected)selected.innerHTML=`${flagImg(hidden.value)}<strong>${esc(hidden.value)}</strong>`;}));
  }
  function borderEditorHtml(row){return `<fieldset class="rel-border-editor"><legend>Bordure photo</legend><label>Style<select name="tile_border_appearance"><option value="gradient" ${row.tile_border_appearance!=='solid'?'selected':''}>Dégradé</option><option value="solid" ${row.tile_border_appearance==='solid'?'selected':''}>Uni</option></select></label><label>Couleur 1<input type="color" name="tile_border_color_start" value="${esc(row.tile_border_color_start||'#123B8F')}"></label><label>Couleur 2<input type="color" name="tile_border_color_end" value="${esc(row.tile_border_color_end||'#2F6DFF')}"></label><label>Épaisseur<input type="number" name="tile_border_width" min="0" max="12" value="${Number(row.tile_border_width??3)}"></label><label>Arrondi<input type="number" name="tile_border_radius" min="0" max="40" value="${Number(row.tile_border_radius??14)}"></label><label>Angle<input type="number" name="tile_border_gradient_angle" min="0" max="360" value="${Number(row.tile_border_gradient_angle??135)}"></label></fieldset>`;}
  function photoEditorHtml(row){return `<div class="rel-editor-photo-row"><div class="rel-editor-photo-preview" style="${referenceFrameStyle(row)}" data-rel-editor-photo-preview><div class="rel-entity-photo-inner">${referencePhotoUrl(row)?`<img src="${esc(referencePhotoUrl(row))}" alt="">`:`<span>${esc(initials(row.display_name||row.name||'?'))}</span>`}</div></div><div><label class="rel-editor-file">Photo<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label><label class="rel-editor-remove"><input type="checkbox" name="remove_photo" value="1"> Retirer la photo actuelle</label><small>PNG, JPG ou WebP · 5 Mo maximum.</small></div></div>`;}
  function openReferenceEditor(kind,id){
    if(!canEdit())return alert('Modification réservée aux éditeurs et administrateurs.');const row=kind==='lieux'?stadiumRows.find(x=>String(x.id)===String(id)):people.find(x=>String(x.id)===String(id));if(!row)return;
    referenceEditorState={kind,id,row};const modal=ensureReferenceEditor(),form=$('#relReferenceEditorForm');$('#relReferenceEditorTitle').textContent=kind==='lieux'?'Modifier le stade':kind==='arbitres'?'Modifier l’arbitre':'Modifier le sélectionneur';
    if(kind==='lieux')form.innerHTML=`${photoEditorHtml(row)}<div class="rel-editor-grid"><label>Nom<input name="name" required maxlength="160" value="${esc(row.name||'')}"></label><label>Ville<input name="city" maxlength="120" value="${esc(row.city||'')}"></label><label>Capacité<input name="capacity" type="number" min="0" max="250000" value="${row.capacity??''}"></label><label>Année d’ouverture<input name="opened_year" type="number" min="1800" max="2100" value="${row.opened_year??''}"></label></div>${countryPickerHtml(row.country||'')}<label>Description courte<textarea name="description_short" rows="3" maxlength="500">${esc(row.description_short||'')}</textarea></label>${borderEditorHtml(row)}<div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-rel-editor-cancel>Annuler</button><button class="primary-btn" type="submit">Enregistrer</button></div><div class="c3k-v8-status" data-rel-editor-status hidden></div>`;
    else form.innerHTML=`${photoEditorHtml(row)}<div class="rel-editor-grid"><label>Nom<input name="display_name" required maxlength="160" value="${esc(row.display_name||'')}"></label><label>Nationalité<input name="nationality" maxlength="100" value="${esc(row.nationality||'')}"></label><label>Date de naissance<input name="birth_date" type="date" value="${esc(row.birth_date||'')}"></label><label>Organisation<input name="organization" maxlength="160" value="${esc(row.organization||'')}"></label></div>${borderEditorHtml(row)}<div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-rel-editor-cancel>Annuler</button><button class="primary-btn" type="submit">Enregistrer</button></div><div class="c3k-v8-status" data-rel-editor-status hidden></div>`;
    $('[data-rel-editor-cancel]',form)?.addEventListener('click',()=>{modal.hidden=true;referenceEditorState=null;});if(kind==='lieux')bindCountryPicker(form);const file=form.elements.photo,preview=$('[data-rel-editor-photo-preview]',form);file?.addEventListener('change',()=>{const f=file.files?.[0];if(!f||!preview)return;const url=URL.createObjectURL(f);preview.querySelector('.rel-entity-photo-inner').innerHTML=`<img src="${url}" alt="Aperçu">`;});modal.hidden=false;
  }
  async function uploadReferencePhoto(kind,id,file){
    if(!file)return null;if(file.size>5*1024*1024)throw new Error('La photo dépasse 5 Mo.');const ext=(String(file.name||'').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const safe=['png','jpg','jpeg','webp'].includes(ext)?ext:'jpg';const path=`${kind}/${id}/${Date.now()}.${safe}`;const {error}=await client.storage.from('reference-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});if(error)throw error;return path;
  }
  async function saveReferenceEditor(e){
    e.preventDefault();if(!referenceEditorState||!client)return;const form=e.currentTarget,fd=new FormData(form),status=$('[data-rel-editor-status]',form);if(status){status.hidden=false;status.className='c3k-v8-status';status.textContent='Enregistrement…';}
    try{const {kind,id,row}=referenceEditorState;const base={tile_border_appearance:String(fd.get('tile_border_appearance')||'gradient'),tile_border_color_start:String(fd.get('tile_border_color_start')||'#123B8F'),tile_border_color_end:String(fd.get('tile_border_color_end')||'#2F6DFF'),tile_border_width:Number(fd.get('tile_border_width')||0),tile_border_radius:Number(fd.get('tile_border_radius')||0),tile_border_gradient_angle:Number(fd.get('tile_border_gradient_angle')||135)};const file=form.elements.photo?.files?.[0]||null;if(file)base.photo_path=await uploadReferencePhoto(kind,id,file);else if(fd.get('remove_photo')){base.photo_path=null;if(kind!=='lieux')base.photo_url=null;}
      let table,payload;if(kind==='lieux'){table='places';payload={...base,name:String(fd.get('name')||'').trim(),city:String(fd.get('city')||'').trim()||null,country:String(fd.get('country')||'').trim()||null,capacity:fd.get('capacity')===''?null:Number(fd.get('capacity')),opened_year:fd.get('opened_year')===''?null:Number(fd.get('opened_year')),description_short:String(fd.get('description_short')||'').trim()||null};}else{table='personnel';payload={...base,display_name:String(fd.get('display_name')||'').trim(),nationality:String(fd.get('nationality')||'').trim()||null,birth_date:String(fd.get('birth_date')||'').trim()||null,organization:String(fd.get('organization')||'').trim()||null};}
      const {error}=await client.from(table).update(payload).eq('id',id);if(error)throw error;ensureReferenceEditor().hidden=true;referenceEditorState=null;invalidate();await load();await render(kind,$('#referenceSearch')?.value||'');
    }catch(err){console.error('Édition référentiel',err);if(status){status.hidden=false;status.className='c3k-v8-status is-error';status.textContent=String(err?.message||err);}}
  }
  function bindReferenceEditors(host){$$('[data-rel-edit-kind]',host).forEach(b=>b.addEventListener('click',()=>openReferenceEditor(b.dataset.relEditKind,b.dataset.relEditId)));}

  async function render(kind,q=''){
    resetForeignUi();
    const host=$('#referenceEntries'),title=$('#referenceModalTitle'),sub=$('#referenceModalSub'),count=$('#referenceCount');
    if(!host)return;
    host.innerHTML='<div class="selection-loading">Chargement du référentiel relationnel…</div>';
    try{
      await load();
      if(kind==='matchs'){
        renderMatchFilters();
        let list=matches.filter(m=>matchQuery(q,[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),m.provider]));
        list=applyMatchFilters(list);
        if(title)title.textContent='Matchs';if(sub)sub.textContent='Toutes les sélections françaises · historique et calendrier · données modifiables';if(count)count.textContent=`${list.length} match${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid rel-match-grid">${list.map(renderMatchCard).join('')}</div>`:'<div class="universal-search-empty">Aucun match ne correspond aux filtres.</div>';
        bindMatchCards(host);
        if(pendingMatchFocus){
          const targetId=pendingMatchFocus,openSheet=String(pendingMatchSheetFocus||'')===String(targetId);pendingMatchFocus=null;pendingMatchSheetFocus=null;
          requestAnimationFrame(()=>{const tile=$(`[data-match-id="${CSS.escape(String(targetId))}"]`,host);if(tile){tile.classList.add('is-target-match');tile.scrollIntoView({behavior:'smooth',block:'center'});if(openSheet){setTimeout(()=>{const btn=$('[data-match-sheet-toggle]',tile);if(btn&&btn.getAttribute('aria-expanded')!=='true')btn.click();},180);}setTimeout(()=>tile.classList.remove('is-target-match'),2600);}});
        }
      }else if(kind==='competitions'){
        renderRelFilters(kind);
        let list=competitionRows.filter(c=>matchQuery(q,[c.name,c.edition,c.selection_category,c.competition_type,c.status,tagsById.get(c.tag_id)?.label_text]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Compétitions';if(sub)sub.textContent='Entrées de compétition relationnelles · tags de familles partagés entre les éditions';if(count)count.textContent=`${list.length} compétition${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderCompetitionCard).join('')}</div>`:'<div class="universal-search-empty">Aucune compétition ne correspond aux filtres.</div>';
      }else if(kind==='adversaires'){
        renderRelFilters(kind);
        let list=opponentRows.filter(o=>matchQuery(q,[o.name,o.fifa_code,o.confederation,o.continent,o.federation_name]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Adversaires';if(sub)sub.textContent='Sélections rencontrées · bilan calculé depuis les matchs · tags ouvrant les confrontations';if(count)count.textContent=`${list.length} adversaire${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderOpponentCard).join('')}</div>`:'<div class="universal-search-empty">Aucun adversaire ne correspond aux filtres.</div>';
        bindOpponentCards(host);applyOpponentCountrySearch(host);
      }else if(kind==='staff'){
        renderRelFilters(kind);
        let list=staffRows.filter(p=>matchQuery(q,[p.display_name,p.person_type,p.nationality,'sélectionneur','staff',...(p.linked_matches||[]).flatMap(m=>[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name')]) ]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Staff';if(sub)sub.textContent='Sélectionneurs reliés aux matchs des sélections françaises';if(count)count.textContent=`${list.length} sélectionneur${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderStaffCard).join('')}</div>`:'<div class="universal-search-empty">Aucun sélectionneur ne correspond aux filtres.</div>';
        bindReferenceEditors(host);
      }else if(kind==='arbitres'){
        renderRelFilters(kind);
        let list=refereeRows.filter(p=>matchQuery(q,[p.display_name,p.nationality,'arbitre principal',...(p.linked_matches||[]).flatMap(m=>[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name')]) ]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Arbitres';if(sub)sub.textContent='Arbitres principaux uniquement · VAR et assistants exclus · matchs accessibles par tag';if(count)count.textContent=`${list.length} arbitre${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderRefereeCard).join('')}</div>`:'<div class="universal-search-empty">Aucun arbitre principal ne correspond aux filtres.</div>';
        bindRefereeCards(host);bindReferenceEditors(host);
      }else if(kind==='lieux'){
        renderRelFilters(kind);
        let list=stadiumRows.filter(v=>matchQuery(q,[v.name,v.city,v.country,'stade','stadium',String(v.capacity||''),String(v.opened_year||''),...stadiumMatches(v.id).flatMap(m=>[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name')]) ]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Stades';if(sub)sub.textContent='Stades uniquement · matchs affiliés par sélection française · bilan et pagination par tag';if(count)count.textContent=`${list.length} stade${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderStadiumCard).join('')}</div>`:'<div class="universal-search-empty">Aucun stade ne correspond aux filtres.</div>';
        bindStadiumCards(host);bindReferenceEditors(host);applyStadiumCountrySearch(host);
      }
    }catch(e){
      console.error('Référentiels relationnels',e);
      hideMatchFilters();hideFacetBar();
      host.innerHTML=`<div class="selection-empty"><strong>Chargement impossible.</strong><span>${esc(e?.message||e)}</span></div>`;
    }
  }

  function search(q){
    if(!loaded||!String(q||'').trim())return [];
    const labels={matchs:'Matchs',competitions:'Compétitions',adversaires:'Adversaires',staff:'Staff',arbitres:'Arbitres',lieux:'Stades'};
    const icons={matchs:'⚽',competitions:'🏆',adversaires:'🌍',staff:'👔',arbitres:'🟨',lieux:'🏟️'};
    return searchRegistry.filter(x=>matchQuery(q,[x.title,x.meta,...x.values])).slice(0,24).map(x=>({
      type:labels[x.kind]||'Référentiels',icon:icons[x.kind]||'▦',title:x.title,meta:x.meta,score:0.18,
      action:()=>{window.BLEUS3000_APP?.openReferences?.(x.kind);setTimeout(()=>{const i=$('#referenceSearch');if(i){i.value=x.title;i.dispatchEvent(new Event('input',{bubbles:true}));}},80);}
    }));
  }

  function getMatch(id){return matches.find(m=>String(m.id)===String(id))||null;}
  function applyLocalOverride(id,manual_overrides){const m=getMatch(id);if(m)m.manual_overrides=manual_overrides||{};}
  function invalidate(){loaded=false;matches=[];people=[];staffRows=[];refereeRows=[];officialRows=[];opponentRows=[];stadiumRows=[];searchRegistry=[];matchSheetCache.clear();}
  function openMatch(id,openSheet=false){
    Object.keys(matchFilters).forEach(k=>matchFilters[k]='all');
    pendingMatchFocus=id;pendingMatchSheetFocus=openSheet?id:null;
    window.BLEUS3000_APP?.openReferences?.('matchs');
  }
  function openMatchSheet(id){openMatch(id,true);}

  window.BLEUS3000_RELATIONAL_REFS={
    render,load,search,getMatch,openMatch,openMatchSheet,effective,baseValue,applyLocalOverride,invalidate,
    getTag:id=>tagsById.get(id)||null,
    getTags:()=>[...tagsById.values()],
    getSelections:()=>selectionRows.map(x=>({...x})),
    getCompetitions:()=>competitionRows.map(x=>({...x})),
    getOpponents:()=>opponentRows.map(x=>({...x})),
    getStadiums:()=>stadiumRows.map(x=>({...x})),
    getSectionTags:()=>{const ids=new Set(selectionRows.map(x=>x.team_tag_id).filter(Boolean));return [...tagsById.values()].filter(t=>t.is_active!==false&&(ids.has(t.id)||t.reference_scope==='selection'));},
    getCompetitionTags:()=>{const ids=new Set(competitionRows.map(x=>x.tag_id).filter(Boolean));return [...tagsById.values()].filter(t=>t.is_active!==false&&(t.reference_scope==='competition'||ids.has(t.id)||String(t.slug||'').startsWith('competition-')||String(t.slug||'')==='match-amical'));},
    get matches(){return matches;},get people(){return people;},get opponents(){return opponentRows;},get staff(){return staffRows;},get referees(){return refereeRows;},get stadiums(){return stadiumRows;}
  };
  window.addEventListener('bleus:supabase-ready',()=>{if(loaded||loading)return;load().catch(e=>console.warn('Référentiels · reprise Supabase',e));});
  load().catch(()=>{});
})();
