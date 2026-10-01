/* 3615 Bleus V1.3.1 — Référentiels relationnels · tri Équipe type · arbitre · export PNG */
(() => {
  'use strict';

  const $=(s,p=document)=>p?.querySelector?.(s)||null;
  const $$=(s,p=document)=>p?.querySelectorAll?[...p.querySelectorAll(s)]:[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=window.BLEUS3000_SEARCH;
  const norm=v=>S?.normalize?S.normalize(v):String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matchQuery=(q,vals)=>!String(q||'').trim()||(S?.matches?S.matches(q,vals,.5):vals.some(v=>norm(v).includes(norm(q))));
  const option=(v,l,sel)=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;
  const PAGE_SIZE=5;
  const MATCH_PAGE_SIZE=1;
  const role=()=>window.C3K_ACCOUNT_STATE?.profile?.role||'guest';
  const canEdit=()=>['admin','superadmin'].includes(String(role()).toLowerCase());
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
  const teamCodeAliases={france:'FRA',turquie:'TUR',turkey:'TUR',belgique:'BEL',belgium:'BEL',angleterre:'ENG',england:'ENG',allemagne:'GER',germany:'GER',espagne:'ESP',spain:'ESP',italie:'ITA',italy:'ITA',portugal:'POR',paysbas:'NED','pays bas':'NED',netherlands:'NED',hollande:'NED',bresil:'BRA',brazil:'BRA',argentine:'ARG',argentina:'ARG',croatie:'CRO',croatia:'CRO',maroc:'MAR',morocco:'MAR',ukraine:'UKR',ecosse:'SCO',scotland:'SCO',islande:'ISL',iceland:'ISL',suisse:'SUI',switzerland:'SUI'};
  const normTeam=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function teamCode(name){const label=window.BLEUS3000_FLAGS?.countryName?.(name)||String(name||'');const key=normTeam(label);if(teamCodeAliases[key])return teamCodeAliases[key];const words=key.split(/\s+/).filter(Boolean);if(words.length>=2)return words.slice(0,3).map(w=>w[0]).join('').toUpperCase();const raw=label.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z]/g,'').toUpperCase();return (raw.slice(0,3)||'---').padEnd(3,'-');}
  function matchScoreline(left,right,center,compact=false,matchId=''){return window.BLEUS3000_SCORELINE?.render?.(left,right,center,{compact,matchId})||`${esc(left)} ${esc(center||'VS')} ${esc(right)}`;}

  const matchFilters={team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all',teamTypeSort:'default',includeUpcoming:false};
  let matchPage=1;
  const relFilters={
    competitions:{gender:'all',selection:'all',type:'all',status:'all'},
    adversaires:{confederation:'all',continent:'all',team:'all',countryQuery:''},
    staff:{team:'all',gender:'all',nationality:'all'},
    arbitres:{team:'all',nationality:'all',year:'all'},
    lieux:{country:'all',city:'all',team:'all',year:'all',countryQuery:''}
  };

  let client=null,loaded=false,loading=null;
  let matches=[],people=[],staffRows=[],refereeRows=[],officialRows=[],opponentRows=[],stadiumRows=[],tagsById=new Map(),selectionRows=[],competitionRows=[],competitionEntities=[],competitionEditions=[],searchRegistry=[],footballPositions=[],competitionFamilies=[];
  let pendingMatchFocus=null,pendingMatchSheetFocus=null,pendingGoalFocus=null,referenceEditorState=null;
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
    competition_tag_id:m.competitionEntity?.competition_tag_id||m.competition?.tag_id||'',
    competition_edition_tag_id:m.competitionEdition?.edition_tag_id||''
  })[key];
  const effective=(m,key)=>Object.prototype.hasOwnProperty.call(overrides(m),key)?overrides(m)[key]:baseValue(m,key);
  const selectionLabel=()=> 'France';
  const resultLetter=m=>{
    const av=effective(m,'france_score'),bv=effective(m,'opponent_score');
    if(av===null||av===undefined||av===''||bv===null||bv===undefined||bv==='')return '—';
    const a=Number(av),b=Number(bv);
    if(!Number.isFinite(a)||!Number.isFinite(b))return '—';
    return a>b?'V':a<b?'D':'N';
  };
  const scoreClass=m=>({V:'is-win',N:'is-draw',D:'is-loss'}[resultLetter(m)]||'');
  const teamTypeRaw=m=>{const raw=m?.team_type_score_raw;if(raw===null||raw===undefined||raw==='')return null;const v=Number(raw);return Number.isFinite(v)?v:null;};
  function sortMatchesByTeamType(list){
    if(!['team_type_asc','team_type_desc'].includes(matchFilters.teamTypeSort))return list;
    const dir=matchFilters.teamTypeSort==='team_type_asc'?1:-1;
    return list.slice().sort((a,b)=>{
      const av=teamTypeRaw(a),bv=teamTypeRaw(b),aMissing=av===null,bMissing=bv===null;
      if(aMissing!==bMissing)return aMissing?1:-1;
      if(!aMissing&&av!==bv)return (av-bv)*dir;
      const ad=parseDate(effective(a,'match_date'))?.getTime()||0,bd=parseDate(effective(b,'match_date'))?.getTime()||0;
      return bd-ad||Number(b?.chronological_number||0)-Number(a?.chronological_number||0);
    });
  }
  const flagImg=name=>window.BLEUS3000_FLAGS?.img?.(name,'rel-svg-flag')||'';
  const countryName=v=>window.BLEUS3000_FLAGS?.countryName?.(v)||String(v||'');
  const uniqueSorted=arr=>[...new Set(arr.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
  function assignChronologicalMatchNumbers(list=matches,forceLocal=false){
    const rows=[...(list||[])];
    const dbReady=!forceLocal&&rows.length>0&&rows.every(m=>Number.isInteger(Number(m?.chronological_number))&&Number(m.chronological_number)>0);
    if(dbReady)return rows.sort((a,b)=>Number(a.chronological_number)-Number(b.chronological_number)||String(a?.id||'').localeCompare(String(b?.id||'')));
    const ranked=rows.sort((a,b)=>{
      const ad=parseDate(effective(a,'match_date'))?.getTime(),bd=parseDate(effective(b,'match_date'))?.getTime();
      const av=Number.isFinite(ad)?ad:Number.POSITIVE_INFINITY,bv=Number.isFinite(bd)?bd:Number.POSITIVE_INFINITY;
      if(av!==bv)return av-bv;
      return String(a?.id||'').localeCompare(String(b?.id||''));
    });
    ranked.forEach((m,i)=>{m.chronological_number=i+1;});
    return ranked;
  }
  function getMatchNumber(target){
    const m=typeof target==='object'&&target?target:matches.find(x=>String(x.id)===String(target));
    return Number(m?.chronological_number)||null;
  }

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
    if(!t)return `<span class="rel-tag-fallback">FRANCE</span>`;
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
        client.from('matches').select('*').eq('gender','M').eq('selection_category','A').order('match_date',{ascending:false}).limit(5000),
        client.from('selection_teams').select('id,code,name,gender,category,team_tag_id,provider_ids,sort_order').eq('code','FRA-A-M').order('sort_order'),
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

      const [oo,ccRes,llRes,ceRes,edRes]=await Promise.all([
        fetchIn('opponents','id,name,fifa_code,confederation,continent,federation_name,flag_url,federation_logo_url,active',oppIds),
        client.from('competitions').select('id,name,edition,tag_id,gender,selection_category,competition_type,status,logo_url,canonical_entity_id,canonical_edition_id').order('name').limit(5000),
        client.from('places').select('*').order('name').limit(5000),
        client.from('competition_entities').select('id,slug,name,aliases,gender,competition_type,competition_tag_id,icon_text').order('name').limit(2000),
        client.from('competition_editions').select('id,competition_entity_id,edition_year,edition_label,edition_tag_id').order('edition_year',{ascending:false}).limit(5000)
      ]);
      if(ccRes.error)throw ccRes.error;
      if(llRes.error)throw llRes.error;
      if(ceRes.error)console.warn('Entités compétition',ceRes.error);
      if(edRes.error)console.warn('Éditions compétition',edRes.error);

      opponentRows=oo||[];
      competitionRows=ccRes.data||[];
      competitionEntities=ceRes.data||[];
      competitionEditions=edRes.data||[];
      const allPlaces=llRes.data||[];
      stadiumRows=allPlaces.filter(x=>String(x.place_type||'')==='stadium');
      const om=new Map(opponentRows.map(x=>[x.id,x]));
      const cm=new Map(competitionRows.map(x=>[x.id,x]));
      const cem=new Map(competitionEntities.map(x=>[String(x.id),x]));
      const edm=new Map(competitionEditions.map(x=>[String(x.id),x]));
      const lm=new Map(allPlaces.map(x=>[x.id,x]));
      const pm=new Map(people.map(x=>[x.id,x]));
      matches=rows.map(x=>{
        const competition=cm.get(x.competition_id)||null;
        const competitionEdition=edm.get(String(x.competition_edition_id||competition?.canonical_edition_id||''))||null;
        const competitionEntity=cem.get(String(competitionEdition?.competition_entity_id||competition?.canonical_entity_id||''))||null;
        return {...x,selection:selections.get(x.selection_team_id)||null,opponent:om.get(x.opponent_id)||null,competition,competitionEdition,competitionEntity,place:lm.get(x.place_id)||null,coach:pm.get(x.coach_id)||null};
      });
      // Le bloc Stades est un référentiel des stades réellement utilisés par les Bleus.
      // On masque donc les lieux orphelins créés par une ancienne saisie mais reliés à aucun match.
      const linkedPlaceIds=new Set(matches.map(m=>String(m.place_id||'')).filter(Boolean));
      stadiumRows=stadiumRows.filter(v=>linkedPlaceIds.has(String(v.id)));
      assignChronologicalMatchNumbers(matches);
      staffRows=buildStaffRows();
      refereeRows=buildRefereeRows();

      const d=window.BLEUS3000_DATA;
      if(d?.references){
        const counts={matchs:String(matches.length),competitions:String(competitionRows.length),adversaires:String(opponentRows.length),staff:String(staffRows.length),arbitres:String(refereeRows.length),lieux:String(stadiumRows.length)};
        for(const [key,value] of Object.entries(counts)){const r=d.references.find(x=>x.key===key);if(r)r.count=value;}
      }

      const competitionEntityById=new Map(competitionEntities.map(x=>[String(x.id),x]));
      searchRegistry=[
        ...matches.map(m=>({kind:'matchs',id:m.id,title:`${selectionLabel(m)} - ${effective(m,'opponent_name')||'Adversaire'}`,meta:`Match n°${getMatchNumber(m)||'—'} · ${fmtDate(effective(m,'match_date'))} · ${effective(m,'competition_name')||selectionLabel(m)}`,image:m.opponent?.flag_url||m.opponent?.federation_logo_url||'',values:[[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),`match ${getMatchNumber(m)||''}`].filter(Boolean).join(' '),selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),String(getMatchNumber(m)||''),m.provider]})),
        ...competitionRows.map(c=>({kind:'competitions',id:c.id,title:c.name,meta:[c.edition,c.selection_category,c.gender==='F'?'Féminin':c.gender==='M'?'Masculin':''].filter(Boolean).join(' · '),image:c.logo_url||'',values:[[c.name,c.edition,c.competition_type].filter(Boolean).join(' '),c.name,c.edition,c.selection_category,c.competition_type,c.status,tagsById.get(c.tag_id)?.label_text]})),
        ...competitionEntities.map(e=>({kind:'competitions',id:`entity:${e.id}`,title:e.name,meta:'Entité compétition',image:'',values:[e.name,...(Array.isArray(e.aliases)?e.aliases:[]),e.competition_type,'entité compétition']})),
        ...competitionEditions.map(ed=>{const ent=competitionEntityById.get(String(ed.competition_entity_id));const label=[ent?.name,ed.edition_label||ed.edition_year].filter(Boolean).join(' · ');return {kind:'competitions',id:`edition:${ed.id}`,title:label||String(ed.edition_year||'Édition'),meta:`Édition ${ed.edition_label||ed.edition_year||''}`.trim(),image:'',values:[[ent?.name,ed.edition_label||ed.edition_year].filter(Boolean).join(' '),ent?.name,ed.edition_label,String(ed.edition_year||''),'édition compétition',...(Array.isArray(ent?.aliases)?ent.aliases:[])]};}),
        ...opponentRows.map(o=>({kind:'adversaires',id:o.id,title:o.name,meta:[o.confederation,o.continent].filter(Boolean).join(' · ')||'Adversaire',image:o.flag_url||o.federation_logo_url||'',values:[o.name,o.fifa_code,o.confederation,o.continent,o.federation_name]})),
        ...staffRows.map(p=>({kind:'staff',id:p.id,title:p.display_name,meta:'Sélectionneur',image:referencePhotoUrl(p),values:[p.display_name,p.person_type,p.nationality,...p.linked_matches.map(selectionLabel),'sélectionneur','staff']})),
        ...refereeRows.map(p=>({kind:'arbitres',id:p.id,title:p.display_name,meta:[p.nationality,'Arbitre principal'].filter(Boolean).join(' · '),image:referencePhotoUrl(p),values:[p.display_name,p.nationality,'arbitre principal',...p.linked_matches.map(selectionLabel),...p.linked_matches.map(m=>effective(m,'opponent_name'))]})),
        ...stadiumRows.map(v=>({kind:'lieux',id:v.id,title:v.name,meta:[v.city,v.country].filter(Boolean).join(' · ')||'Stade',image:referencePhotoUrl(v),values:[v.name,v.city,v.country,'stade','stadium',String(v.capacity||''),String(v.opened_year||''),...stadiumMatches(v.id).map(selectionLabel),...stadiumMatches(v.id).map(m=>effective(m,'opponent_name'))]}))
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
      bar.addEventListener('change',e=>{if(e.target.matches('[data-match-include-upcoming]')){matchFilters.includeUpcoming=!!e.target.checked;matchPage=1;render('matchs',$('#referenceSearch')?.value||'');return;}const k=e.target.dataset.matchFilter;if(!k)return;matchFilters[k]=e.target.value;matchPage=1;render('matchs',$('#referenceSearch')?.value||'');});
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
    bar.innerHTML=`<span class="tag-badge">Équipe de France</span><select data-match-filter="competition">${option('all','Toutes les compétitions',matchFilters.competition)}${comps.map(v=>option(v,v,matchFilters.competition)).join('')}</select><select data-match-filter="year">${option('all','Toutes les années',matchFilters.year)}${years.map(v=>option(String(v),String(v),matchFilters.year)).join('')}</select><select data-match-filter="result">${option('all','Tous les résultats',matchFilters.result)}${option('V','Victoires',matchFilters.result)}${option('N','Nuls',matchFilters.result)}${option('D','Défaites',matchFilters.result)}${option('—','Sans score',matchFilters.result)}</select><select data-match-filter="stadium">${option('all','Tous les stades',matchFilters.stadium)}${stadiums.map(([v,l])=>option(v,l,matchFilters.stadium)).join('')}</select><select data-match-filter="coach">${option('all','Tous les sélectionneurs',matchFilters.coach)}${coaches.map(([v,l])=>option(v,l,matchFilters.coach)).join('')}</select><select data-match-filter="sheet">${option('all','Toutes les feuilles',matchFilters.sheet)}${option('yes','Feuille renseignée',matchFilters.sheet)}${option('no','Feuille à compléter',matchFilters.sheet)}</select><select data-match-filter="teamTypeSort" aria-label="Trier par indice Équipe type">${option('default','Tri : date récente',matchFilters.teamTypeSort)}${option('team_type_desc','Équipe type : décroissant',matchFilters.teamTypeSort)}${option('team_type_asc','Équipe type : croissant',matchFilters.teamTypeSort)}</select><label class="match-finished-only-filter"><input type="checkbox" data-match-include-upcoming ${matchFilters.includeUpcoming?'checked':''}><span>Afficher les prochains matchs</span></label><button type="button" class="reference-filter-reset" data-match-filter-reset>Réinitialiser</button>`;
    bar.querySelector('[data-match-filter-reset]')?.addEventListener('click',()=>{Object.assign(matchFilters,{team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all',teamTypeSort:'default',includeUpcoming:false});matchPage=1;render('matchs',$('#referenceSearch')?.value||'');});
  }
  function hideMatchFilters(){const bar=$('#matchReferenceFilters');if(bar)bar.hidden=true;}
  function isFinishedReferenceMatch(m){const status=String(m?.status||'').toUpperCase();if(['FT','AET','PEN'].includes(status))return true;const d=parseDate(effective(m,'match_date'))?.getTime()||0,a=effective(m,'france_score'),b=effective(m,'opponent_score'),hasScore=a!==null&&a!==undefined&&a!==''&&b!==null&&b!==undefined&&b!=='';return d>0&&d<Date.now()&&hasScore;}
  function applyMatchFilters(list){
    const filtered=list.filter(m=>{
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
      if(!matchFilters.includeUpcoming&&!isFinishedReferenceMatch(m))return false;
      return true;
    });
    return sortMatchesByTeamType(filtered);
  }

  const teamOptionsFromMatches=list=>[...new Map(list.filter(m=>m.selection_team_id).map(m=>[String(m.selection_team_id),selectionLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
  function renderRelFilters(kind){
    hideMatchFilters();
    if(kind==='competitions'){
      const f=relFilters.competitions;
      const cats=uniqueSorted(competitionRows.map(x=>x.selection_category));
      const types=uniqueSorted(competitionRows.map(x=>x.competition_type));
      const statuses=uniqueSorted(competitionRows.map(x=>x.status));
      renderFacetBar(kind,`<span class="tag-badge">Équipe de France</span><label>Type<select data-rel-filter="type">${option('all','Tous les types',f.type)}${types.map(v=>option(v,v,f.type)).join('')}</select></label><label>Statut<select data-rel-filter="status">${option('all','Tous les statuts',f.status)}${statuses.map(v=>option(v,v,f.status)).join('')}</select></label>`);
    }else if(kind==='adversaires'){
      const f=relFilters.adversaires;
      const confs=uniqueSorted(opponentRows.map(o=>o.confederation));
      const continents=uniqueSorted(opponentRows.map(o=>o.continent));
      const teams=teamOptionsFromMatches(matches);
      renderFacetBar(kind,`<label class="reference-filter-search">Pays<input type="search" data-rel-country-search value="${esc(f.countryQuery||'')}" placeholder="Rechercher un pays…" autocomplete="off"></label><label>Confédération<select data-rel-filter="confederation">${option('all','Toutes les confédérations',f.confederation)}${confs.map(v=>option(v,v,f.confederation)).join('')}</select></label><label>Continent<select data-rel-filter="continent">${option('all','Tous les continents',f.continent)}${continents.map(v=>option(v,v,f.continent)).join('')}</select></label><label>Périmètre<select data-rel-filter="team">${option('all','Équipe de France',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label>`);
    }else if(kind==='staff'){
      const f=relFilters.staff;
      const linked=staffRows.flatMap(p=>p.linked_matches||[]),teams=teamOptionsFromMatches(linked),nations=uniqueSorted(staffRows.map(p=>p.nationality));
      renderFacetBar(kind,`<span class="tag-badge">Équipe de France</span><label>Nationalité<select data-rel-filter="nationality">${option('all','Toutes les nationalités',f.nationality)}${nations.map(v=>option(v,v,f.nationality)).join('')}</select></label>`);
    }else if(kind==='arbitres'){
      const f=relFilters.arbitres;
      const linked=refereeRows.flatMap(p=>p.linked_matches||[]),teams=teamOptionsFromMatches(linked),nations=uniqueSorted(refereeRows.map(p=>p.nationality));
      const years=[...new Set(linked.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
      renderFacetBar(kind,`<label>Nationalité<select data-rel-filter="nationality">${option('all','Toutes les nationalités',f.nationality)}${nations.map(v=>option(v,v,f.nationality)).join('')}</select></label><label>Périmètre<select data-rel-filter="team">${option('all','Équipe de France',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Année<select data-rel-filter="year">${option('all','Toutes les années',f.year)}${years.map(v=>option(String(v),String(v),f.year)).join('')}</select></label>`);
    }else if(kind==='lieux'){
      const f=relFilters.lieux;
      const stadiumIds=new Set(stadiumRows.map(v=>String(v.id)));
      const linked=matches.filter(m=>stadiumIds.has(String(m.place_id))),teams=teamOptionsFromMatches(linked);
      const countries=uniqueSorted(stadiumRows.map(v=>v.country)),cities=uniqueSorted(stadiumRows.map(v=>v.city));
      const years=[...new Set(linked.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
      renderFacetBar(kind,`<label class="reference-filter-search">Recherche pays<input type="search" data-rel-stadium-country-search value="${esc(f.countryQuery||'')}" placeholder="Rechercher un pays…" autocomplete="off"></label><label>Pays<select data-rel-filter="country">${option('all','🌍 Tous les pays',f.country)}${countries.map(v=>option(v,countryOptionLabel(v),f.country)).join('')}</select></label><label>Ville<select data-rel-filter="city">${option('all','Toutes les villes',f.city)}${cities.map(v=>option(v,v,f.city)).join('')}</select></label><label>Périmètre<select data-rel-filter="team">${option('all','Équipe de France',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Année<select data-rel-filter="year">${option('all','Toutes les années',f.year)}${years.map(v=>option(String(v),String(v),f.year)).join('')}</select></label>`);
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
    return `<div class="${cls}" style="${referenceFrameStyle(row)}"><div class="rel-entity-photo-inner">${url?`<img src="${esc(url)}" alt="${esc(row?.display_name||row?.name||'Photo')}" loading="lazy">${row?.photo_copyright_source?`<span class="photo-copyright-capsule">© ${esc(row.photo_copyright_source)}</span>`:''}`:`<span>${esc(fallback)}</span>`}</div></div>`;
  }
  function referenceEditButton(kind,row){return canEdit()?`<button type="button" class="rel-tile-edit" data-rel-edit-kind="${esc(kind)}" data-rel-edit-id="${esc(row.id)}" title="Modifier la tuile" aria-label="Modifier la tuile">⚙</button>`:'';}

  function renderMatchCard(m){
    const opp=countryName(effective(m,'opponent_name')||'Adversaire');
    const home=m.home_away==='home';const sel='France';const left=home?sel:opp,right=home?opp:sel;
    const a=effective(m,'france_score'),b=effective(m,'opponent_score');
    const has=a!==null&&a!==undefined&&a!==''&&b!==null&&b!==undefined&&b!==''&&Number.isFinite(Number(a))&&Number.isFinite(Number(b));
    const future=(parseDate(effective(m,'match_date'))?.getTime()||0)>=Date.now();
    const score=has?(home?`${a} – ${b}`:`${b} – ${a}`):(future?'VS':'—');
    const place=[effective(m,'venue_name'),effective(m,'city')].filter(Boolean).join(' · '),comp=effective(m,'competition_name')||sel;
    const placeSearch=effective(m,'venue_name')||m.place?.name||effective(m,'city')||'',referee=getMainRefereeForMatch(m.id);
    return `<article class="rel-ref-tile rel-match-tile" data-match-id="${esc(m.id)}"><div class="rel-ref-head rel-ref-head-match">${getMatchNumber(m)?`<span class="rel-match-corner-number" aria-label="Match numéro ${esc(getMatchNumber(m))}">${esc(getMatchNumber(m))}</span>`:''}<div><div class="rel-match-kicker"><small>${esc(fmtDateLong(effective(m,'match_date')))}</small></div><div class="rel-match-board-wrap">${matchScoreline(left,right,score,score==='VS',m.id)}<div class="rel-match-team-names"><span>${esc(left)}</span><span>${esc(right)}</span></div></div><div class="subtitle">${esc(comp)}${m.phase?` · ${esc(m.phase)}`:''}</div></div><span class="rel-result ${scoreClass(m)}">${resultLetter(m)}</span></div><div class="rel-facts">${place?`<button type="button" class="rel-fact-link" data-match-place-search="${esc(placeSearch)}">🏟 ${esc(place)}</button>`:''}${m.coach?.display_name?`<span>👔 ${esc(m.coach.display_name)}</span>`:''}${referee?.display_name?`<span class="rel-match-referee">🧑‍⚖️ Arbitre : ${esc(referee.display_name)}</span>`:''}${m.spectators?`<span>👥 ${Number(m.spectators).toLocaleString('fr-FR')}</span>`:''}${effective(m,'broadcast_text')?(window.BLEUS3000_BROADCASTS?.renderText?.(effective(m,'broadcast_text'))||`<span>📺 ${esc(effective(m,'broadcast_text'))}</span>`):''}</div><div class="rel-match-bottom"><div class="rel-tags">${chipForMatch(m)}${competitionChipForMatch(m)}</div><div class="rel-match-actions"><button class="rel-export-match" type="button" data-match-export="${esc(m.id)}" title="Exporter cette tuile en PNG">⇩ PNG</button>${canEdit()?`<button class="rel-quick-event-btn" type="button" data-match-quick-event="${esc(m.id)}" title="Ajouter rapidement un fait de jeu">＋ Fait de jeu</button><button class="rel-edit-match" type="button" data-calendar-edit="${esc(m.id)}">✎ Modifier</button>`:''}</div></div><div class="rel-match-sheet-panel is-always-open" data-match-sheet-panel="${esc(m.id)}"><div class="match-sheet-loading">Chargement de la feuille de match…</div></div></article>`;
  }

  function buildMatchExportSurface(card,m){
    const root=document.createElement('article');root.className='b3k-match-export-layout';
    const header=document.createElement('section');header.className='b3k-match-export-header';
    const head=$('.rel-ref-head-match',card)?.cloneNode(true),facts=$('.rel-facts',card)?.cloneNode(true),tags=$('.rel-tags',card)?.cloneNode(true);
    if(head)header.appendChild(head);if(facts)header.appendChild(facts);if(tags)header.appendChild(tags);root.appendChild(header);
    const sheet=$('[data-match-sheet-panel]',card);
    const stats=sheet?$('.match-sheet-lineup-stats',sheet)?.cloneNode(true):null;
    const columns=sheet?$('.match-sheet-columns',sheet)?.cloneNode(true):null;
    const provider=sheet?$('.match-sheet-provider-unmatched',sheet)?.cloneNode(true):null;
    const factsBlock=sheet?$('.match-sheet-facts-inline',sheet)?.cloneNode(true):null;
    const composition=document.createElement('section');composition.className='b3k-match-export-section is-composition';composition.innerHTML='<h3>Composition</h3>';
    if(stats)composition.appendChild(stats);
    if(columns)composition.appendChild(columns);else{const empty=$('.match-sheet-empty',sheet)?.cloneNode(true);if(empty)composition.appendChild(empty);}
    if(provider)composition.appendChild(provider);root.appendChild(composition);
    const gameFacts=document.createElement('section');gameFacts.className='b3k-match-export-section is-facts';
    if(factsBlock){const title=$('h3',factsBlock)?.textContent||'Faits de match';gameFacts.innerHTML=`<h3>${esc(title)}</h3>`;const body=$('.match-events-summary,.match-sheet-empty.is-events',factsBlock)?.cloneNode(true);if(body)gameFacts.appendChild(body);}else gameFacts.innerHTML='<h3>Faits de match</h3><p class="match-event-side-empty">Aucun fait de match renseigné.</p>';
    root.appendChild(gameFacts);
    return root;
  }
  async function exportMatchTilePng(matchId,button){
    let card=$(`[data-match-id="${CSS.escape(String(matchId))}"]`);if(!card)return;
    const panel=$('[data-match-sheet-panel]',card);if(panel&&panel.dataset.loaded!=='1')await refreshMatchSheetPanel(matchId);
    // Le chargement de la feuille peut rafraîchir le DOM : on reprend toujours la tuile courante.
    card=$(`[data-match-id="${CSS.escape(String(matchId))}"]`)||card;
    window.BLEUS3000_TEAM_TYPE?.decorateAll?.();await new Promise(r=>requestAnimationFrame(r));
    const engine=window.BLEUS3000_EXPORT;if(!engine?.exportElement)return alert('Moteur d’export indisponible. Recharge la page puis réessaie.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='PNG…';}
    let surface=null;
    try{
      const m=getMatch(matchId)||{},opp=countryName(effective(m,'opponent_name')||'adversaire'),date=fmtDate(effective(m,'match_date')).replace(/\//g,'-');
      const filename=`3615_Bleus_match_${getMatchNumber(m)||''}_France_${opp}_${date}`;
      surface=buildMatchExportSurface(card,m);surface.style.cssText='position:fixed;left:-100000px;top:0;width:1040px;z-index:-2147483000;pointer-events:none;content-visibility:visible;contain:none';document.body.appendChild(surface);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      await engine.exportElement(surface,{
        filename,
        width:1040,
        scale:2.25,
        format:'png',
        background:'#ffffff',
        padding:24,
        prepareClone:async clone=>{
          // Export éditorial complet : score + contexte + indice + composition + faits.
          $$('.rel-match-actions,.match-sheet-edit-btn,.match-sheet-player-link,[data-match-media-edit],.rel-tile-edit,.match-sheet-hover-zoom,.match-sheet-validation-badge',clone).forEach(n=>n.remove());
          $$('.rel-fact-link',clone).forEach(btn=>{const span=document.createElement('span');span.textContent=btn.textContent||'';span.style.cssText=btn.style.cssText;btn.replaceWith(span);});
          $$('button',clone).forEach(btn=>{const span=document.createElement('span');span.className=btn.className;span.innerHTML=btn.innerHTML;span.style.cssText=btn.style.cssText;btn.replaceWith(span);});
          clone.style.height='auto';clone.style.maxHeight='none';clone.style.overflow='visible';
          $$('*',clone).forEach(n=>{if(n?.style){n.style.contentVisibility='visible';n.style.contain='none';if(n.classList?.contains('b3k-match-export-layout')||n.classList?.contains('b3k-match-export-section')||n.classList?.contains('match-sheet-columns')||n.classList?.contains('match-events-teams')){n.style.height='auto';n.style.maxHeight='none';n.style.overflow='visible';}}});
        }
      });
    }catch(err){console.error('Export PNG match',err);alert(`Export PNG impossible : ${String(err?.message||err)}`);}finally{surface?.remove();if(button){button.disabled=false;button.textContent=old||'⇩ PNG';}}
  }

  const registryPlayers=()=>window.BLEUS3000_PLAYER_REGISTRY_ALL||window.BLEUS3000_PLAYER_REGISTRY||[];
  const minuteRank=v=>{const s=String(v||'').trim();const m=s.match(/(\d+)(?:\s*\+\s*(\d+))?/);return m?Number(m[1])*100+Number(m[2]||0):999999;};
  const playerCardIcon=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="10" r="2"></circle><path d="M6.5 16c.7-2 4.3-2 5 0M14 9h3M14 13h3"></path></svg>`;
  const openPlayerIcon=id=>id?`<button class="match-sheet-player-link" type="button" data-open-match-player="${esc(id)}" title="Ouvrir la tuile joueur" aria-label="Ouvrir la tuile joueur">${playerCardIcon()}</button>`:'';
  function openMatchPlayer(id){if(!id)return;window.BLEUS3000_PLAYERS_DB?.openPlayer?.(id);}

  const lineupDecimal=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
  const lineupAgeAt=(birth,when)=>{const b=parseDate(birth),d=parseDate(when);if(!b||!d||d<b)return null;return (d-b)/(365.2425*24*3600*1000);};
  async function fetchAppearanceHistoryForPlayers(ids){
    const clean=[...new Set((ids||[]).filter(Boolean).map(String))];if(!clean.length)return[];
    const out=[],pageSize=1000;
    for(let from=0;;from+=pageSize){
      const {data,error}=await client.from('match_appearances')
        .select('match_id,player_id,starter,appeared')
        .in('player_id',clean)
        .order('match_id',{ascending:true})
        .order('player_id',{ascending:true})
        .range(from,from+pageSize-1);
      if(error)throw error;
      const rows=data||[];out.push(...rows);
      if(rows.length<pageSize)break;
    }
    return out;
  }
  async function buildLineupSummary(matchId,appearances,playerMap){
    const starterMap=new Map();
    for(const a of appearances||[]){
      if(a?.starter!==true||!a.player_id)continue;
      starterMap.set(String(a.player_id),a);
    }
    const starters=[...starterMap.values()];
    const currentMatch=matches.find(x=>String(x.id)===String(matchId))||null;
    const when=currentMatch?effective(currentMatch,'match_date'):null;
    const ages=starters.map(a=>lineupAgeAt(playerMap.get(String(a.player_id))?.birth_date,when));
    const ageKnown=ages.filter(Number.isFinite);
    let avgAge=null,avgCaps=null,capKnown=0;
    if(starters.length===11&&ageKnown.length===11)avgAge=ageKnown.reduce((s,v)=>s+v,0)/11;

    if(starters.length===11&&when){
      const ids=starters.map(a=>String(a.player_id));
      const history=await fetchAppearanceHistoryForPlayers(ids);
      const matchMap=new Map(matches.map(m=>[String(m.id),m]));
      const target=+parseDate(when),capSets=new Map(ids.map(id=>[id,new Set()]));
      for(const h of history){
        const id=String(h.player_id||'');if(!capSets.has(id)||!(h.starter===true||h.appeared===true))continue;
        const hm=matchMap.get(String(h.match_id));if(!hm)continue;
        const hd=parseDate(effective(hm,'match_date'));if(!hd||+hd>target)continue;
        const hf=effective(hm,'france_score'),ho=effective(hm,'opponent_score');
        if(hf===null||hf===undefined||hf===''||ho===null||ho===undefined||ho==='')continue;
        capSets.get(id).add(String(h.match_id));
      }
      const caps=ids.map(id=>capSets.get(id)?.size??null);
      capKnown=caps.filter(Number.isFinite).length;
      if(capKnown===11)avgCaps=caps.reduce((s,v)=>s+v,0)/11;
    }
    return {starterCount:starters.length,ageKnown:ageKnown.length,capKnown,avgAge,avgCaps};
  }
  function renderLineupSummary(summary={}){
    const ageOk=Number.isFinite(summary.avgAge),capsOk=Number.isFinite(summary.avgCaps);
    const ageSub=ageOk?'moyenne exacte des 11 titulaires':`${summary.ageKnown||0}/11 dates de naissance disponibles`;
    const capSub=capsOk?'historique des apparitions à cette date':`${summary.capKnown||0}/11 joueurs reliés historiquement`;
    return `<div class="match-sheet-lineup-stats" aria-label="Statistiques du onze titulaire"><article><span>Âge moyen du XI</span><strong>${ageOk?`${lineupDecimal(summary.avgAge)} ans`:'—'}</strong><small>${esc(ageSub)}</small></article><article><span>Sélections moyennes</span><strong>${capsOk?lineupDecimal(summary.avgCaps):'—'}</strong><small>${esc(capSub)}</small></article></div>`;
  }

  async function loadMatchSheet(matchId){
    if(matchSheetCache.has(String(matchId)))return matchSheetCache.get(String(matchId));
    const promise=(async()=>{
      const [appearanceRes,goalRes,cardRes,mediaRes]=await Promise.all([
        client.from('match_appearances').select('*').eq('match_id',matchId).order('starter',{ascending:false}).order('lineup_slot',{ascending:true,nullsFirst:false}).order('shirt_number',{ascending:true}),
        client.from('match_goal_events').select('id,source_goal_id,match_id,player_id,scorer_name,team_name,minute_text,score_after,source_url,assist_player_id,assist_name,goal_type,body_part,is_penalty,is_own_goal,created_at,updated_at').eq('match_id',matchId),
        client.from('match_card_events').select('*').eq('match_id',matchId),
        client.from('match_media_assets').select('*').eq('match_id',matchId).order('sort_order').order('created_at')
      ]);
      if(appearanceRes.error)throw appearanceRes.error;
      if(goalRes.error)throw goalRes.error;
      if(cardRes.error&&String(cardRes.error.code||'')!=='42P01')throw cardRes.error;
      if(mediaRes.error&&String(mediaRes.error.code||'')!=='42P01')throw mediaRes.error;
      const appearances=appearanceRes.data||[],goals=goalRes.data||[],cards=cardRes.data||[],media=mediaRes.data||[];
      const ids=[...new Set([
        ...appearances.flatMap(x=>[x.player_id,x.replaced_by_player_id]),
        ...goals.flatMap(x=>[x.player_id,x.assist_player_id]),
        ...cards.flatMap(x=>[x.player_id])
      ].filter(Boolean))];
      const players=ids.length?await fetchIn('players','id,display_name,primary_position,photo_path,birth_date',ids):[];const pm=new Map(players.map(x=>[String(x.id),x]));
      let jersey=null;try{jersey=await window.BLEUS3000_JERSEYS?.getMatchJersey?.(matchId)||null;}catch(err){console.warn('Feuille de match · maillot',err);}
      let ball=null;try{ball=await window.BLEUS3000_BALLS?.getForMatch?.(matchId)||null;}catch(err){console.warn('Feuille de match · ballon',err);}
      const hydratedAppearances=appearances.map(x=>({...x,player:pm.get(String(x.player_id))||null,replaced_by_player:pm.get(String(x.replaced_by_player_id))||null}));
      let lineupSummary={starterCount:hydratedAppearances.filter(x=>x.starter===true).length,ageKnown:0,capKnown:0,avgAge:null,avgCaps:null};
      try{lineupSummary=await buildLineupSummary(matchId,hydratedAppearances,pm);}catch(err){console.warn('Feuille de match · stats du XI',err);}
      return {
        appearances:hydratedAppearances,
        goals:goals.map(x=>({...x,player:pm.get(String(x.player_id))||null,assist_player:pm.get(String(x.assist_player_id))||null})).sort((a,b)=>minuteRank(a.minute_text)-minuteRank(b.minute_text)),
        cards:cards.map(x=>({...x,player:pm.get(String(x.player_id))||null})).sort((a,b)=>minuteRank(a.minute_text)-minuteRank(b.minute_text)),
        jersey,
        ball,
        media,
        lineupSummary
      };
    })();
    matchSheetCache.set(String(matchId),promise);
    try{const sheet=await promise;matchSheetCache.set(String(matchId),sheet);return sheet;}catch(e){matchSheetCache.delete(String(matchId));throw e;}
  }
  function matchSheetPlayerRow(r,jersey=null){
    const p=r.player||{},name=p.display_name||r.player_name||'Joueur',shirt=Number.isInteger(Number(r.shirt_number))?String(Number(r.shirt_number)):'—';
    const markers=[Number(r.goals)>0?`⚽×${Number(r.goals)}`:'',Number(r.assists)>0?`➜×${Number(r.assists)}`:'',Number(r.yellow_cards)>0?'🟨':'',Number(r.red_cards)>0?'🟥':''].filter(Boolean).join(' ');
    const captain=r.captain?`<img class="match-sheet-captain-icon" src="achievement-capitanat.png" alt="Capitaine" title="Capitaine">`:'';
    const replacedBy=r.replaced_by_player?.display_name||r.replaced_by_name||'';
    return `<div class="match-sheet-player"><b class="match-sheet-shirt-dot" style="${formationMarkerInlineStyle(jersey)}">${esc(shirt)}</b><span><strong>${esc(name)}</strong>${replacedBy?`<small>↪ remplacé par ${esc(replacedBy)}</small>`:''}</span><div class="match-sheet-player-actions">${captain}${markers?`<em>${esc(markers)}</em>`:''}${openPlayerIcon(r.player_id)}</div></div>`;
  }
  function matchMediaAssetUrl(x){if(x?.image_url)return x.image_url;if(x?.image_path&&client)try{return client.storage.from('reference-photos').getPublicUrl(x.image_path).data.publicUrl||'';}catch{}return '';}
  function matchSheetMediaStrip(media=[],ball=null,matchId='',goalCount=0,jersey=null,match=null){
    const opponent=effective(match||{},'opponent_name')||match?.opponent?.name||'Adversaire';
    const order=[['newspaper_front','🗞','Une de journal'],['team_photo','👥','Photo d’équipe'],['ball','⚽','Ballon du match'],['ticket','🎟','Billet du match']];
    const assets=order.map(([type,icon,label])=>{let x=media.find(a=>a.asset_type===type);if(type==='ball'&&ball){const u=window.BLEUS3000_BALLS?.publicPhoto?.(ball)||'';x={asset_type:'ball',title:ball.model_name||label,image_url:u,image_copyright_source:ball.photo_copyright_source||'',url:u,_canonicalBall:true};}
      const img=x&&type!=='youtube'?(matchMediaAssetUrl(x)||x.url||''):'',href=x?(x.url||img||''):'';const zoomable=type==='newspaper_front'||type==='team_photo'||type==='ball'||type==='ticket',staticVisual=zoomable;const copyright=String(x?.image_copyright_source||'').trim();const credit=copyright?`<span class="photo-copyright-capsule">© ${esc(copyright)}</span>`:'';const inner=img?`<img src="${esc(img)}" alt="${esc(x?.title||label)}" loading="lazy">${credit}`:`<span class="match-sheet-media-icon is-${type}">${icon}</span>`;if(!x)return `<span class="match-sheet-media-slot is-empty is-${type}${zoomable?' is-zoomable':''}" data-match-sheet-zoom="${zoomable?esc(type):''}" title="${esc(label)} non renseigné">${inner}</span>`;if(staticVisual)return `<span class="match-sheet-media-slot is-active is-${type}${zoomable?' is-zoomable':''}" data-match-sheet-zoom="${zoomable?esc(type):''}" title="${esc(x.title||label)}">${inner}</span>`;return href?`<a class="match-sheet-media-slot is-active is-${type}" href="${esc(href)}" rel="noopener noreferrer" title="${esc(x.title||label)}">${inner}</a>`:`<span class="match-sheet-media-slot is-active is-${type}" title="${esc(x.title||label)}">${inner}</span>`;}).join('');
    const goals=Number(goalCount||0),goalShortcut=goals>0?`<button type="button" class="match-sheet-media-slot is-active is-goals" data-open-match-goals="${esc(matchId)}" title="Voir ${goals} but${goals>1?'s':''} de ce match dans le référentiel Buts"><span class="match-sheet-media-icon is-goals">🥅</span><b class="match-media-goal-count">${goals}</b></button>`:`<span class="match-sheet-media-slot is-empty is-goals" title="Aucun but français renseigné"><span class="match-sheet-media-icon is-goals">🥅</span></span>`;
    return `<div class="match-sheet-media-strip" aria-label="Médias du match">${assets}${goalShortcut}</div>`;
  }

  function matchEventPlayerName(player,name){return player?.display_name||name||'Joueur non renseigné';}
  function matchEventGoalRow(g){
    const scorer=matchEventPlayerName(g.player,g.scorer_name),assist=matchEventPlayerName(g.assist_player,g.assist_name),hasAssist=!!String(g.assist_player?.display_name||g.assist_name||'').trim();
    const typeLabel=g.goal_type==='header'?' · tête':g.goal_type==='free_kick'?' · coup franc':g.goal_type==='penalty'||g.is_penalty?' · penalty':'';
    return `<div class="match-event-row is-goal" data-match-goal-id="${esc(g.id||'')}"><div class="match-event-minute">${g.minute_text?esc(g.minute_text)+"'":'—'}</div><span class="match-event-kind-icon is-goal" title="But"><span class="match-event-icon-ball" aria-hidden="true"></span></span><div class="match-event-main"><strong>${esc(scorer)}</strong>${hasAssist?`<small class="match-event-assist"><span class="match-event-kind-icon is-assist-inline" aria-hidden="true"><span class="match-event-arrow"></span></span><em>Passe décisive : ${esc(assist)}</em>${openPlayerIcon(g.assist_player_id)}</small>`:''}<small>${esc(g.team_name||'')}${g.score_after?` · score ${esc(g.score_after)}`:''}${typeLabel}</small></div>${openPlayerIcon(g.player_id)}</div>`;
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
    const opponentLabel=countryName(effective(m,'opponent_name')||m?.opponent?.name||'Adversaire');
    const opponentKey=norm(opponentLabel),francePlayers=new Set(apps.flatMap(r=>[r.player?.display_name,r.player_name]).filter(Boolean).map(norm));
    const sideFor=(teamName,playerId,playerName)=>{
      const team=norm(teamName),name=norm(playerName);
      if(team==='france'||team.includes('france'))return'france';
      if(opponentKey&&team&&(team===opponentKey||team.includes(opponentKey)||opponentKey.includes(team)))return'opponent';
      if(playerId||francePlayers.has(name))return'france';
      return team?'opponent':'france';
    };
    const buckets={france:[],opponent:[]};
    goals.forEach(g=>{const scorer=matchEventPlayerName(g.player,g.scorer_name),side=sideFor(g.team_name,g.player_id,scorer);buckets[side].push({rank:minuteRank(g.minute_text),order:1,html:matchEventGoalRow(g)});});
    cards.forEach(c=>{const name=matchEventPlayerName(c.player,c.player_name),side=sideFor(c.team_name,c.player_id,name);buckets[side].push({rank:minuteRank(c.minute_text),order:2,html:matchEventCardRow(c)});});
    aggregateCards.forEach(r=>{
      if(Number(r.yellow_cards)>0)buckets.france.push({rank:999990,order:2,html:`<div class="match-event-row is-card"><div class="match-event-minute">—</div><span class="match-event-card-icon is-yellow"></span><div class="match-event-main"><strong>${esc(r.player?.display_name||'Joueur')}</strong><small>${Number(r.yellow_cards)} carton${Number(r.yellow_cards)>1?'s':''} jaune${Number(r.yellow_cards)>1?'s':''} · minute non renseignée</small></div>${openPlayerIcon(r.player_id)}</div>`});
      if(Number(r.red_cards)>0)buckets.france.push({rank:999991,order:2,html:`<div class="match-event-row is-card"><div class="match-event-minute">—</div><span class="match-event-card-icon is-red"></span><div class="match-event-main"><strong>${esc(r.player?.display_name||'Joueur')}</strong><small>${Number(r.red_cards)} carton${Number(r.red_cards)>1?'s':''} rouge${Number(r.red_cards)>1?'s':''} · minute non renseignée</small></div>${openPlayerIcon(r.player_id)}</div>`});
    });
    aggregateAssists.forEach(r=>buckets.france.push({rank:999992,order:3,html:`<div class="match-event-row is-assist"><div class="match-event-minute">—</div><span class="match-event-kind-icon">➜</span><div class="match-event-main"><strong>${esc(r.player?.display_name||'Joueur')}</strong><small><em>${Number(r.assists)} passe${Number(r.assists)>1?'s':''} décisive${Number(r.assists)>1?'s':''} · but associé non renseigné</em></small></div>${openPlayerIcon(r.player_id)}</div>`}));
    const total=buckets.france.length+buckets.opponent.length;
    if(!total)return `<div class="match-sheet-empty is-events"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Aucun fait de jeu détaillé</strong><small>Les buts, cartons et passes décisives pourront être renseignés depuis l’éditeur de la feuille de match.</small></div></div>`;
    const teamColumn=(key,label,extra='')=>{
      const rows=buckets[key].sort((a,b)=>a.rank-b.rank||a.order-b.order);
      return `<section class="match-events-team is-${key} ${extra}"><h4><span>${esc(label)}</span><b>${rows.length}</b></h4><div class="match-event-list">${rows.map(x=>x.html).join('')||'<div class="match-event-side-empty">Aucun fait renseigné</div>'}</div></section>`;
    };
    return `<div class="match-events-summary match-events-teams" aria-label="Faits de match séparés par équipe">${teamColumn('france','France')}${teamColumn('opponent',opponentLabel)}</div>`;
  }
  const validFormationHex=v=>/^#[0-9a-f]{6}$/i.test(String(v||'').trim())?String(v).trim().toUpperCase():'';
  function formationMarkerColors(source){
    if(Array.isArray(source))return [...new Set(source.map(validFormationHex).filter(Boolean))].slice(0,5);
    const direct=Array.isArray(source?.formation_colors)?source.formation_colors:[];
    const fallback=[source?.primary_color,source?.secondary_color,...(Array.isArray(source?.accent_colors)?source.accent_colors:[])];
    return [...new Set((direct.length?direct:fallback).map(validFormationHex).filter(Boolean))].slice(0,5);
  }
  function formationMarkerBackground(source){
    const colors=formationMarkerColors(source);
    if(window.BLEUS3000_JERSEYS?.formationMarkerBackground)return window.BLEUS3000_JERSEYS.formationMarkerBackground(colors);
    const fill=colors.slice(0,2);if(!fill.length)return '#123B8F';if(fill.length===1)return fill[0];return `linear-gradient(135deg,${fill[0]} 0 50%,${fill[1]} 50% 100%)`;
  }
  function formationMarkerHalo(source){
    if(window.BLEUS3000_JERSEYS?.formationHaloColor)return window.BLEUS3000_JERSEYS.formationHaloColor(source);
    return formationMarkerColors(source)[2]||'';
  }
  function formationMarkerInlineStyle(source){
    const halo=formationMarkerHalo(source);
    return `background:${formationMarkerBackground(source)};border-color:${halo||'rgba(255,255,255,.96)'};box-shadow:${halo?`0 0 0 2px ${halo},0 0 12px ${halo},0 2px 7px rgba(0,0,0,.32)`:'0 2px 7px rgba(0,0,0,.32),0 0 0 1px rgba(6,27,57,.22)'}`;
  }
  function providerUnmatchedPlayers(m){const rows=m?.api_payload?._bleus_live_sheet?.unmatched_players;return Array.isArray(rows)?rows:[];}
  function providerUnmatchedRow(r){const num=Number.isInteger(Number(r?.number))?`<b>${Number(r.number)}</b>`:'<b>—</b>';return `<div class="match-sheet-player is-provider-unmatched">${num}<span><strong>${esc(r?.name||'Joueur non relié')}</strong></span><em title="Nom reçu du fournisseur mais non relié avec certitude à une fiche joueur">API</em></div>`;}
  function renderMatchSheet(sheet,m){
    const rows=sheet.appearances||[],starters=rows.filter(r=>r.starter===true||norm(r.squad_status)==='starter'||norm(r.squad_status)==='titulaire'),others=rows.filter(r=>!starters.includes(r)),unmatched=providerUnmatchedPlayers(m),jersey=sheet.jersey||null;
    const providerExtra=unmatched.length?`<section class="match-sheet-provider-unmatched"><h4>Non reliés à la base · ${unmatched.length}</h4><div class="match-sheet-list">${unmatched.map(providerUnmatchedRow).join('')}</div><small>Ces noms proviennent du fournisseur live. Ils seront reliés automatiquement lorsqu’une correspondance fiable existe dans la base joueurs.</small></section>`:'';
    const composition=(rows.length||unmatched.length)?`${renderLineupSummary(sheet.lineupSummary||{})}<div class="match-sheet-columns"><section><h4>Titulaires · ${starters.length}</h4><div class="match-sheet-list">${starters.map(r=>matchSheetPlayerRow(r,jersey)).join('')||'<span class="match-sheet-none">Non renseignés</span>'}</div></section><section><h4>Remplaçants / groupe · ${others.length}</h4><div class="match-sheet-list">${others.map(r=>matchSheetPlayerRow(r,jersey)).join('')||'<span class="match-sheet-none">Non renseignés</span>'}</div></section></div>${providerExtra}`:`<div class="match-sheet-empty"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Composition non renseignée</strong><small>Aucune apparition n’est encore enregistrée dans match_appearances pour cette rencontre.</small></div></div>`;
    const jerseyHtml=jersey?`<div class="match-sheet-current-jersey is-zoomable" data-match-sheet-zoom="jersey" title="Maillot utilisé">${jersey.photo?`<img src="${esc(jersey.photo)}" alt="Maillot utilisé" loading="lazy">`:'<span class="match-sheet-current-jersey-placeholder">👕</span>'}</div>`:'';
    return `<div class="match-sheet-head"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Feuille de match</strong><small>${esc(m.lineup_status||`${rows.length} joueur${rows.length>1?'s':''} renseigné${rows.length>1?'s':''}`)}</small></div>${canEdit()?`<button type="button" class="match-sheet-edit-btn" data-match-sheet-edit="${esc(m.id)}">⚙ Modifier la feuille</button>`:''}</div><div class="match-sheet-single-pane"><section class="match-sheet-visible-section is-composition"><h3>Composition</h3>${composition}</section><section class="match-sheet-facts-inline match-sheet-visible-section"><h3>Faits de match</h3>${renderMatchFacts(sheet,m)}</section><section class="match-sheet-visible-section is-media"><h3>Médias</h3><div class="match-sheet-kit-media-row">${jerseyHtml}${matchSheetMediaStrip(sheet.media||[],sheet.ball||null,m.id,(sheet.goals||[]).filter(g=>norm(g.team_name)==='france'||g.player_id).length,sheet.jersey||null,m)}</div></section></div>`;
  }
  function ensureMatchSheetHoverZoom(){let z=$('#matchSheetHoverZoom');if(z)return z;z=document.createElement('div');z.id='matchSheetHoverZoom';z.className='match-sheet-hover-zoom';z.hidden=true;z.innerHTML='<img alt="Aperçu agrandi">';document.body.appendChild(z);return z;}
  function positionMatchSheetHoverZoom(e,z){const pad=18,w=z.offsetWidth||280,h=z.offsetHeight||280;let x=e.clientX+pad,y=e.clientY+pad;if(x+w>window.innerWidth-8)x=Math.max(8,e.clientX-w-pad);if(y+h>window.innerHeight-8)y=Math.max(8,e.clientY-h-pad);z.style.left=`${x}px`;z.style.top=`${y}px`;}
  document.addEventListener('pointerover',e=>{const host=e.target.closest?.('[data-match-sheet-zoom]');const img=host?.querySelector?.('img');if(!host||!img)return;const z=ensureMatchSheetHoverZoom(),zi=$('img',z);zi.src=img.currentSrc||img.src;zi.alt=img.alt||'Aperçu agrandi';z.className=`match-sheet-hover-zoom is-${host.dataset.matchSheetZoom||'visual'}`;z.hidden=false;positionMatchSheetHoverZoom(e,z);});
  document.addEventListener('pointermove',e=>{const z=$('#matchSheetHoverZoom');if(z&&!z.hidden){z.dataset.previewMode='hover';positionMatchSheetHoverZoom(e,z);}});
  document.addEventListener('pointerout',e=>{const host=e.target.closest?.('[data-match-sheet-zoom]');if(!host)return;const next=e.relatedTarget;if(next&&host.contains(next))return;const z=$('#matchSheetHoverZoom');if(z&&z.dataset.previewMode!=='touch')z.hidden=true;});
  document.addEventListener('click',e=>{const host=e.target.closest?.('[data-match-sheet-zoom]');const z=$('#matchSheetHoverZoom');if(!host){if(z&&z.dataset.previewMode==='touch')z.hidden=true;return;}const img=host?.querySelector?.('img');if(!img)return;e.preventDefault();e.stopPropagation();const box=host.getBoundingClientRect(),fakeEvent={clientX:box.left+box.width/2,clientY:box.top+box.height/2};const zoom=ensureMatchSheetHoverZoom(),zi=$('img',zoom),sameOpen=zoom.dataset.previewMode==='touch'&&!zoom.hidden&&zi.src===(img.currentSrc||img.src);zi.src=img.currentSrc||img.src;zi.alt=img.alt||'Aperçu agrandi';zoom.className=`match-sheet-hover-zoom is-${host.dataset.matchSheetZoom||'visual'} is-touch-open`;zoom.dataset.previewMode='touch';zoom.hidden=sameOpen;if(!sameOpen)positionMatchSheetHoverZoom(fakeEvent,zoom);});
  function focusPreciseGoal(panel,matchId){
    if(!pendingGoalFocus||String(pendingGoalFocus.matchId)!==String(matchId))return;
    const goalId=String(pendingGoalFocus.goalId||''),row=goalId?$(`[data-match-goal-id="${CSS.escape(goalId)}"]`,panel):null;if(!row)return;
    pendingGoalFocus=null;row.classList.add('is-target-goal');requestAnimationFrame(()=>row.scrollIntoView({behavior:'smooth',block:'center'}));setTimeout(()=>row.classList.remove('is-target-goal'),3600);
  }
  function bindMatchSheetPanel(panel,matchId,sheet,m){
    $$('[data-open-match-player]',panel).forEach(btn=>{if(btn.dataset.playerOpenBound==='1')return;btn.dataset.playerOpenBound='1';btn.addEventListener('click',e=>{e.stopPropagation();openMatchPlayer(btn.dataset.openMatchPlayer);});});
    $$('[data-open-match-goals]',panel).forEach(btn=>{if(btn.dataset.goalsOpenBound==='1')return;btn.dataset.goalsOpenBound='1';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.BLEUS3000_COLLECTIONS?.openGoalsForMatch?.(btn.dataset.openMatchGoals);});});
    const edit=$('[data-match-sheet-edit]',panel);if(edit&&edit.dataset.directSheetEditBound!=='1'){edit.dataset.directSheetEditBound='1';edit.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handleMatchSheetEditClick(edit);});}
    focusPreciseGoal(panel,matchId);
  }
  async function handleMatchSheetEditClick(btn){
    const matchId=String(btn?.dataset?.matchSheetEdit||'');if(!matchId||btn.dataset.sheetEditorBusy==='1')return;
    btn.dataset.sheetEditorBusy='1';btn.disabled=true;
    try{
      const currentMatch=matches.find(x=>String(x.id)===matchId)||getMatch(matchId)||{};
      const currentSheet=await loadMatchSheet(matchId);
      await openMatchSheetEditor(matchId,currentSheet,currentMatch);
    }catch(err){console.error('Ouverture éditeur feuille de match',err);alert(`Impossible d’ouvrir la feuille de match : ${String(err?.message||err)}`);}
    finally{delete btn.dataset.sheetEditorBusy;btn.disabled=false;}
  }
  document.addEventListener('click',e=>{const btn=e.target.closest?.('[data-match-sheet-edit]');if(!btn)return;e.preventDefault();e.stopPropagation();handleMatchSheetEditClick(btn);},true);
  async function refreshMatchSheetPanel(matchId){
    matchSheetCache.delete(String(matchId));const card=$(`[data-match-id="${CSS.escape(String(matchId))}"]`),panel=card?$('[data-match-sheet-panel]',card):null;if(!panel)return;
    panel.innerHTML='<div class="match-sheet-loading">Actualisation de la feuille de match…</div>';
    try{const m=matches.find(x=>String(x.id)===String(matchId))||{};const sheet=await loadMatchSheet(matchId);panel.innerHTML=renderMatchSheet(sheet,m);panel.dataset.loaded='1';bindMatchSheetPanel(panel,matchId,sheet,m);}catch(e){panel.innerHTML=`<div class="match-sheet-empty"><strong>Feuille de match indisponible</strong><small>${esc(e?.message||e)}</small></div>`;}
  }
  function bindMatchCards(host){
    $$('[data-match-sheet-panel]',host).forEach(async panel=>{
      const card=panel.closest('.rel-match-tile'),matchId=String(card?.dataset.matchId||'');if(!card||!matchId||panel.dataset.loading==='1'||panel.dataset.loaded==='1')return;
      panel.hidden=false;panel.dataset.loading='1';panel.innerHTML='<div class="match-sheet-loading">Chargement de la feuille de match…</div>';
      try{const m=matches.find(x=>String(x.id)===matchId)||{};const sheet=await loadMatchSheet(matchId);panel.innerHTML=renderMatchSheet(sheet,m);panel.dataset.loaded='1';bindMatchSheetPanel(panel,matchId,sheet,m);}
      catch(e){panel.innerHTML=`<div class="match-sheet-empty"><strong>Feuille de match indisponible</strong><small>${esc(e?.message||e)}</small></div>`;}
      finally{delete panel.dataset.loading;}
    });
    $$('[data-match-quick-event]',host).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openQuickMatchEvent(btn.dataset.matchQuickEvent);}));
    $$('[data-match-export]',host).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();exportMatchTilePng(btn.dataset.matchExport,btn);}));
  }

  let matchSheetEditorState=null;
  function editorPlayerListHtml(){return registryPlayers().slice().sort((a,b)=>String(a.name||a.display_name||'').localeCompare(String(b.name||b.display_name||''),'fr')).map(p=>`<option value="${esc(p.name||p.display_name||'')}"></option>`).join('');}
  function editorResolvePlayer(name,currentId=''){
    const n=norm(name).trim();if(!n)return null;const reg=registryPlayers();const exact=reg.filter(p=>norm(p.name||p.display_name).trim()===n);if(currentId&&exact.some(p=>String(p.id)===String(currentId)))return String(currentId);return exact.length===1?String(exact[0].id):null;
  }
  const safeUuid=v=>{const s=String(v??'').trim();return (!s||s==='null'||s==='undefined'||s==='0')?null:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:null;};
  function positionOptionsHtml(currentId,currentText){
    const items=footballPositions.slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    const opts=['<option value="">Poste…</option>'];
    for(const pos of items)opts.push(`<option value="${esc(pos.id)}" data-label="${esc(pos.label_text)}" ${String(currentId||'')===String(pos.id)?'selected':''}>${esc(pos.label_text)}</option>`);
    if(!currentId&&currentText&&!items.some(x=>norm(x.label_text)===norm(currentText)))opts.push(`<option value="" selected>${esc(currentText)}</option>`);
    return opts.join('');
  }
  function blankLineupRow(starter,slot){
    return {starter:Boolean(starter),lineup_slot:Number(slot)||1,squad_status:starter?'Titulaire':'Remplaçant(e)',position_id:null,position:null,_blank:true};
  }
  function structuredLineup(existing=[]){
    const rows=Array.isArray(existing)?existing.slice():[];
    const isStarter=row=>row?.starter===true||['titulaire','starter'].includes(norm(row?.squad_status));
    const starters=rows.filter(isStarter).sort((a,b)=>(Number(a.lineup_slot)||999)-(Number(b.lineup_slot)||999));
    const subs=rows.filter(row=>!isStarter(row)).sort((a,b)=>(Number(a.lineup_slot)||999)-(Number(b.lineup_slot)||999));
    const starterRows=[];
    for(let i=1;i<=11;i++){
      const row=starters[i-1]||blankLineupRow(true,i);
      starterRows.push({...row,starter:true,lineup_slot:i,squad_status:'Titulaire'});
    }
    const subCount=Math.max(12,subs.length);
    const subRows=[];
    for(let i=1;i<=subCount;i++){
      const row=subs[i-1]||blankLineupRow(false,i);
      subRows.push({...row,starter:false,lineup_slot:i,squad_status:'Remplaçant(e)'});
    }
    return {starters:starterRows,subs:subRows};
  }
  function appearanceEditorRow(r={},opts={}){
    const p=r.player||{},name=p.display_name||r.player_name||'',replName=r.replaced_by_player?.display_name||r.replaced_by_name||'',starter=opts.starter??!!r.starter,slot=Number(opts.slot||r.lineup_slot||1),locked=opts.locked!==false;
    const hasReplacement=!!String(replName||r.replaced_by_player_id||'').trim();
    return `<div class="match-sheet-editor-lineup-row is-${starter?'starter':'substitute'}" data-editor-appearance data-lineup-kind="${starter?'starter':'substitute'}" data-lineup-slot="${slot}" data-appearance-id="${esc(r.id||'')}" data-original-player-id="${esc(r.player_id||'')}" data-original-replacement-id="${esc(r.replaced_by_player_id||'')}" >
      <span class="match-sheet-lineup-slot">${slot}</span>
      <input class="match-sheet-editor-player" data-appearance-name list="matchSheetPlayerList" placeholder="${starter?'Titulaire':'Remplaçant'} ${slot}" value="${esc(name)}">
      <input data-appearance-number type="number" min="0" max="99" placeholder="N°" value="${r.shirt_number??''}">
      <select data-appearance-position>${positionOptionsHtml(r.position_id,r.position||p.primary_position||'')}</select>
      <input data-appearance-minutes type="number" min="0" max="180" placeholder="Min" value="${r.minutes??''}">
      <label class="match-sheet-editor-check is-captain" title="Capitaine"><input data-appearance-captain type="checkbox" ${r.captain?'checked':''}><img src="achievement-capitanat.png" alt="Capitaine"></label>
      <label class="match-sheet-editor-check is-replacement"><input data-appearance-replaced type="checkbox" ${hasReplacement?'checked':''}> ↪</label>
      <input class="match-sheet-editor-replacement ${hasReplacement?'':'is-hidden'}" data-appearance-replacement list="matchSheetPlayerList" placeholder="Remplacé par…" value="${esc(replName)}">
      ${locked?'<span class="match-sheet-editor-slot-lock" title="Emplacement de base">•</span>':'<button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button>'}
    </div>`;
  }
  function goalEditorRow(g={},m={}){const team=!g.id&&!g.team_name&&!g.player_id?'france':(g.player_id||norm(g.team_name)==='france'?'france':'opponent'),scorer=g.player?.display_name||g.scorer_name||'',assist=g.assist_player?.display_name||g.assist_name||'',goalType=g.goal_type||(g.is_penalty?'penalty':'open_play');return `<div class="match-sheet-editor-event-row" data-editor-goal data-event-id="${esc(g.id||'')}" data-original-player-id="${esc(g.player_id||'')}" data-original-assist-id="${esc(g.assist_player_id||'')}"><select data-goal-team><option value="france" ${team==='france'?'selected':''}>France</option><option value="opponent" ${team==='opponent'?'selected':''}>Adversaire</option></select><input data-goal-scorer list="matchSheetPlayerList" placeholder="Buteur" value="${esc(scorer)}"><input data-goal-minute placeholder="Minute" value="${esc(g.minute_text||'')}"><input data-goal-score placeholder="Score après" value="${esc(g.score_after||'')}"><select data-goal-type><option value="open_play" ${goalType==='open_play'?'selected':''}>Jeu</option><option value="header" ${goalType==='header'?'selected':''}>Tête</option><option value="free_kick" ${goalType==='free_kick'?'selected':''}>Coup franc</option><option value="penalty" ${goalType==='penalty'?'selected':''}>Penalty</option><option value="other" ${goalType==='other'?'selected':''}>Autre</option></select><input data-goal-assist list="matchSheetPlayerList" placeholder="Passeur décisif (facultatif)" value="${esc(assist)}"><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function cardEditorRow(c={}){const team=!c.id&&!c.team_name&&!c.player_id?'france':(c.player_id||norm(c.team_name)==='france'?'france':'opponent'),name=c.player?.display_name||c.player_name||'';return `<div class="match-sheet-editor-event-row is-card" data-editor-card data-event-id="${esc(c.id||'')}" data-original-player-id="${esc(c.player_id||'')}"><select data-card-team><option value="france" ${team==='france'?'selected':''}>France</option><option value="opponent" ${team==='opponent'?'selected':''}>Adversaire</option></select><input data-card-player list="matchSheetPlayerList" placeholder="Joueur" value="${esc(name)}"><select data-card-type><option value="yellow" ${c.card_type!=='red'&&c.card_type!=='second_yellow'?'selected':''}>Jaune</option><option value="second_yellow" ${c.card_type==='second_yellow'?'selected':''}>2e jaune</option><option value="red" ${c.card_type==='red'?'selected':''}>Rouge</option></select><input data-card-minute placeholder="Minute" value="${esc(c.minute_text||'')}"><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function ensureMatchSheetEditor(){
    let modal=$('#matchSheetEditorModal');if(modal)return modal;
    modal=document.createElement('div');modal.className='modal-backdrop match-sheet-editor-modal';modal.id='matchSheetEditorModal';modal.hidden=true;
    modal.innerHTML=`<section class="modal-dialog match-sheet-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="matchSheetEditorTitle"><header class="modal-head"><div><h2 id="matchSheetEditorTitle">Modifier la feuille de match</h2><p id="matchSheetEditorMeta">Composition et faits de match</p></div><button class="modal-close" data-match-sheet-editor-close type="button">×</button></header><div class="modal-body">
      <datalist id="matchSheetPlayerList"></datalist><datalist id="matchSheetStadiumList"></datalist><datalist id="matchSheetPersonnelList"></datalist><datalist id="matchSheetCompetitionList"></datalist>
      <section class="match-sheet-editor-context"><div class="match-sheet-editor-context-grid"><label>Stade<input id="matchSheetStadium" list="matchSheetStadiumList" placeholder="Nom libre accepté"></label><label>Ville<input id="matchSheetCity" placeholder="Ville du stade"></label><label>Arbitre principal<input id="matchSheetReferee" list="matchSheetPersonnelList" placeholder="Nom libre accepté"></label><label>Sélectionneur<input id="matchSheetCoach" list="matchSheetPersonnelList" placeholder="Nom libre accepté"></label><label>Compétition<input id="matchSheetCompetition" list="matchSheetCompetitionList" placeholder="Ex. Ligue des Nations de l’UEFA"></label><label>Édition canonique<select id="matchSheetCompetitionEdition"><option value="">— édition non définie —</option></select><small>L’édition détermine automatiquement son entité parent pour les liens, filtres et statistiques.</small></label></div></section>
      <section data-match-sheet-editor-pane="composition"><div class="match-sheet-editor-help">La feuille enregistrée est directement la source de vérité. Chaque information ne compte qu’une seule fois, même après plusieurs modifications.</div>
      <div class="match-sheet-gathering-import" id="matchSheetGatheringImport" hidden><div><strong>📋 Rassemblement lié</strong><small>Les champs Joueur et Remplacé par deviennent des menus limités aux joueurs convoqués.</small></div><select id="matchSheetGatheringSelect"></select><button type="button" class="secondary-btn" data-import-gathering-roster>Importer toute la liste</button><label class="match-sheet-gathering-auto"><input id="matchSheetAutoGatheringSubs" type="checkbox"> <span><strong>Ajouter automatiquement les remplaçants restants</strong><small>Le banc se recalcule à partir des convoqués qui ne figurent pas parmi les 11 titulaires.</small></span></label><span id="matchSheetGatheringStatus"></span></div>
      <div class="match-sheet-jersey-picker"><label><span>Maillot utilisé par la France</span><select id="matchSheetEditorJersey"><option value="">Chargement des maillots…</option></select></label><div class="match-sheet-jersey-preview" id="matchSheetEditorJerseyPreview"><span>👕</span><small>Aucun maillot associé</small></div></div>
      <div class="match-sheet-ball-picker"><label><span>Ballon du match</span><select id="matchSheetEditorBall"><option value="">Chargement des ballons…</option></select><small>Suggestions prioritaires selon compétition, édition et année.</small></label><div class="match-sheet-ball-preview" id="matchSheetEditorBallPreview"><span>⚽</span><div><strong>Aucun ballon associé</strong><small>Référentiel Ballons</small></div></div></div>
      <div class="match-sheet-editor-roster-section"><div class="match-sheet-roster-title"><strong>Titulaires</strong><span>11</span></div><div class="match-sheet-editor-lineup-head"><span>#</span><span>Joueur</span><span>N°</span><span>Poste</span><span>Min.</span><span>C</span><span>Rempl.</span><span>Remplacé par</span><span></span></div><div id="matchSheetEditorStarters"></div></div>
      <div class="match-sheet-editor-roster-section"><div class="match-sheet-roster-title"><strong>Remplaçants</strong><span id="matchSheetSubCount">12</span></div><div class="match-sheet-editor-lineup-head"><span>#</span><span>Joueur</span><span>N°</span><span>Poste</span><span>Min.</span><span>C</span><span>Rempl.</span><span>Remplacé par</span><span></span></div><div id="matchSheetEditorSubstitutes"></div><button type="button" class="secondary-btn match-sheet-editor-add" data-add-substitute>＋ Ajouter un remplaçant</button></div>
      <section class="match-sheet-editor-events-inline" data-match-sheet-events-editor><div class="match-sheet-editor-help">Faits de match : toute modification remplace l’état précédent et met les statistiques à jour sans double comptage.</div><div class="match-sheet-editor-event-head"><h3>⚽ Buts</h3><button type="button" class="secondary-btn" data-add-goal>＋ Ajouter un but</button></div><div class="match-sheet-editor-event-labels goal"><span>Équipe</span><span>Buteur</span><span>Minute</span><span>Score</span><span>Type</span><span>Passeur décisif</span><span></span></div><div id="matchSheetEditorGoals"></div><div class="match-sheet-editor-event-head"><h3>Cartons</h3><button type="button" class="secondary-btn" data-add-card>＋ Ajouter un carton</button></div><div class="match-sheet-editor-event-labels card"><span>Équipe</span><span>Joueur</span><span>Carton</span><span>Minute</span><span></span></div><div id="matchSheetEditorCards"></div></section></section>
      <div class="match-sheet-editor-status" id="matchSheetEditorStatus" hidden></div><div class="match-sheet-editor-actions"><button class="secondary-btn" type="button" data-match-sheet-editor-close>Annuler</button><button class="primary-btn" type="button" data-match-sheet-editor-save>Enregistrer la feuille</button></div>
      </div></section>`;document.body.appendChild(modal);
    $$('[data-match-sheet-editor-close]',modal).forEach(b=>b.addEventListener('click',()=>{modal.hidden=true;matchSheetEditorState=null;}));
    $('[data-add-substitute]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorSubstitutes',modal);if(!h)return;const slot=$$('[data-editor-appearance][data-lineup-kind="substitute"]',h).length+1;h.insertAdjacentHTML('beforeend',appearanceEditorRow(blankLineupRow(false,slot),{starter:false,slot,locked:false}));const c=$('#matchSheetSubCount',modal);if(c)c.textContent=String(slot);if(matchSheetEditorState?.activeGatheringPlayers?.length)applyLinkedGatheringPlayerMenus(modal,matchSheetEditorState,matchSheetEditorState.activeGatheringPlayers);if(matchSheetEditorState)matchSheetEditorState.compositionDirty=true;});
    $('[data-add-goal]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorGoals',modal);h?.insertAdjacentHTML('beforeend',goalEditorRow({},matchSheetEditorState?.match||{}));if(matchSheetEditorState)matchSheetEditorState.eventsDirty=true;});
    $('[data-add-card]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorCards',modal);h?.insertAdjacentHTML('beforeend',cardEditorRow({}));if(matchSheetEditorState)matchSheetEditorState.eventsDirty=true;});
    modal.addEventListener('click',e=>{const b=e.target.closest('[data-remove-editor-row]');if(b){const row=b.closest('[data-editor-appearance],[data-editor-goal],[data-editor-card]');if(row?.hasAttribute('data-editor-appearance')){matchSheetEditorState.compositionDirty=true;row?.remove();const subs=$$('[data-editor-appearance][data-lineup-kind="substitute"]',$('#matchSheetEditorSubstitutes',modal));subs.forEach((x,i)=>{x.dataset.lineupSlot=String(i+1);const badge=$('.match-sheet-lineup-slot',x);if(badge)badge.textContent=String(i+1);});const c=$('#matchSheetSubCount',modal);if(c)c.textContent=String(subs.length);}else{matchSheetEditorState.eventsDirty=true;row?.remove();}return;}const repl=e.target.closest('[data-appearance-replaced]');if(repl){const row=repl.closest('[data-editor-appearance]'),input=$('[data-appearance-replacement]',row);if(input){input.classList.toggle('is-hidden',!repl.checked);if(!repl.checked)input.value='';}matchSheetEditorState.compositionDirty=true;}});
    const markDirty=e=>{if(!matchSheetEditorState)return;if(e.target.closest('[data-match-sheet-events-editor]'))matchSheetEditorState.eventsDirty=true;else matchSheetEditorState.compositionDirty=true;};modal.addEventListener('input',markDirty);modal.addEventListener('change',e=>{if(!matchSheetEditorState)return;if(e.target.id==='matchSheetGatheringSelect')return;if(e.target.id==='matchSheetAutoGatheringSubs'){matchSheetEditorState.autoGatheringSubs=!!e.target.checked;if(e.target.checked)syncAutomaticGatheringSubstitutes(modal,matchSheetEditorState,{announce:true});return;}if(e.target.id==='matchSheetCompetitionEdition'){const ed=competitionEditions.find(x=>String(x.id)===String(e.target.value||'')),entity=ed?competitionEntities.find(x=>String(x.id)===String(ed.competition_entity_id)):null,compInput=$('#matchSheetCompetition',modal);if(entity&&compInput)compInput.value=entity.name;}markDirty(e);if(e.target.matches?.('[data-appearance-name]')&&e.target.closest?.('[data-editor-appearance][data-lineup-kind="starter"]')&&$('#matchSheetAutoGatheringSubs',modal)?.checked)syncAutomaticGatheringSubstitutes(modal,matchSheetEditorState,{announce:false});});
    $('[data-import-gathering-roster]',modal)?.addEventListener('click',()=>importLinkedGatheringRoster(modal,matchSheetEditorState));
    $('[data-match-sheet-editor-save]',modal)?.addEventListener('click',()=>saveMatchSheetEditor(false));return modal;
  }
  async function loadGatheringPlayers(callupId,state){
    const key=String(callupId||'');if(!key||!client)return [];
    state.gatheringRosterCache=state.gatheringRosterCache||new Map();if(state.gatheringRosterCache.has(key))return state.gatheringRosterCache.get(key);
    const {data:roster,error}=await client.from('callup_players').select('*').eq('callup_id',key).order('sort_order',{ascending:true});if(error)throw error;
    const active=(roster||[]).filter(x=>String(x.status||'called')!=='withdrawn'&&x.player_id);const ids=[...new Set(active.map(x=>String(x.player_id)))];
    if(!ids.length){state.gatheringRosterCache.set(key,[]);return [];}
    const {data:players,error:pe}=await client.from('players').select('id,display_name,primary_position').in('id',ids);if(pe)throw pe;const pm=new Map((players||[]).map(p=>[String(p.id),p]));
    const result=active.map((item,index)=>{const p=pm.get(String(item.player_id));return p?{...p,callup_status:item.status||'called',callup_sort:Number(item.sort_order??index)}:null;}).filter(Boolean);
    state.gatheringRosterCache.set(key,result);return result;
  }
  function gatheringPlayerOptions(players,currentName='',currentId='',placeholder='— choisir un joueur —'){
    const current=String(currentName||'').trim(),currentKey=norm(current),opts=[`<option value="">${esc(placeholder)}</option>`];let found=false;
    for(const p of players||[]){const name=String(p.display_name||'').trim();if(!name)continue;const selected=(currentId&&String(currentId)===String(p.id))||(!currentId&&currentKey&&norm(name)===currentKey);if(selected)found=true;opts.push(`<option value="${esc(name)}" data-player-id="${esc(p.id)}" ${selected?'selected':''}>${esc(name)}</option>`);}
    if(current&&!found)opts.push(`<option value="${esc(current)}" data-player-id="${esc(currentId||'')}" selected>${esc(current)} · déjà enregistré</option>`);
    return opts.join('');
  }
  function applyLinkedGatheringPlayerMenus(modal,state,players){
    if(!modal||!state||!Array.isArray(players))return;state.activeGatheringPlayers=players;
    $$('[data-editor-appearance]',modal).forEach(row=>{
      const convert=(control,isReplacement)=>{if(!control)return;const current=String(control.value||'').trim(),id=isReplacement?String(row.dataset.originalReplacementId||''):String(row.dataset.originalPlayerId||''),hidden=control.classList.contains('is-hidden');let select=control;
        if(control.tagName!=='SELECT'){select=document.createElement('select');select.className=control.className;select.dataset[isReplacement?'appearanceReplacement':'appearanceName']='';if(hidden)select.classList.add('is-hidden');control.replaceWith(select);}
        select.innerHTML=gatheringPlayerOptions(players,current,id,isReplacement?'— remplacé par… —':'— joueur convoqué —');select.value=current||'';
        if(current&&!Array.from(select.options).some(o=>o.value===current))select.value='';
        select.onchange=()=>{const opt=select.options[select.selectedIndex],pid=String(opt?.dataset?.playerId||'');if(isReplacement)row.dataset.originalReplacementId=pid;else row.dataset.originalPlayerId=pid;};
      };
      convert($('[data-appearance-name]',row),false);convert($('[data-appearance-replacement]',row),true);
    });
  }
  function gatheringAppearanceSnapshot(row){
    const playerControl=$('[data-appearance-name]',row),replacementControl=$('[data-appearance-replacement]',row),playerOption=playerControl?.tagName==='SELECT'?playerControl.options[playerControl.selectedIndex]:null,replacementOption=replacementControl?.tagName==='SELECT'?replacementControl.options[replacementControl.selectedIndex]:null,pos=$('[data-appearance-position]',row),posOpt=pos?.options?.[pos.selectedIndex];
    return {id:safeUuid(row.dataset.appearanceId),player_id:safeUuid(playerOption?.dataset?.playerId||row.dataset.originalPlayerId),player_name:String(playerControl?.value||'').trim(),shirt_number:$('[data-appearance-number]',row)?.value===''?null:Number($('[data-appearance-number]',row)?.value),position_id:safeUuid(pos?.value),position:pos?.value?String(posOpt?.dataset?.label||posOpt?.textContent||'').trim():null,minutes:$('[data-appearance-minutes]',row)?.value===''?null:Number($('[data-appearance-minutes]',row)?.value),captain:!!$('[data-appearance-captain]',row)?.checked,replaced_by_player_id:safeUuid(replacementOption?.dataset?.playerId||row.dataset.originalReplacementId),replaced_by_name:String(replacementControl?.value||'').trim()||null,_autoGatheringSub:row.dataset.autoGatheringSub==='true'};
  }
  function syncAutomaticGatheringSubstitutes(modal,state,{announce=false}={}){
    const checkbox=$('#matchSheetAutoGatheringSubs',modal),players=Array.isArray(state?.activeGatheringPlayers)?state.activeGatheringPlayers:[];if(!checkbox?.checked||!players.length)return;
    const starterIds=new Set(),starterNames=new Set();
    $$('[data-editor-appearance][data-lineup-kind="starter"]',modal).forEach(row=>{const c=$('[data-appearance-name]',row),opt=c?.tagName==='SELECT'?c.options[c.selectedIndex]:null,id=String(opt?.dataset?.playerId||row.dataset.originalPlayerId||'').trim(),name=String(c?.value||'').trim();if(id)starterIds.add(id);if(name)starterNames.add(norm(name));});
    const remaining=players.filter(p=>!starterIds.has(String(p.id))&&!starterNames.has(norm(p.display_name||'')));
    const subsHost=$('#matchSheetEditorSubstitutes',modal);if(!subsHost)return;
    const current=$$('[data-editor-appearance][data-lineup-kind="substitute"]',subsHost).map(row=>({row,snap:gatheringAppearanceSnapshot(row)}));
    const byId=new Map(),byName=new Map();for(const entry of current){if(entry.snap.player_id)byId.set(String(entry.snap.player_id),entry);if(entry.snap.player_name)byName.set(norm(entry.snap.player_name),entry);}
    const used=new Set(),prepared=[];
    for(const p of remaining){const existing=byId.get(String(p.id))||byName.get(norm(p.display_name||''));if(existing)used.add(existing);const snap=existing?.snap||{};prepared.push({auto:true,data:{...snap,player:p,player_id:p.id,player_name:p.display_name,position:snap.position||p.primary_position||null,squad_status:'Remplaçant(e)'}});}
    const activeIds=new Set(players.map(p=>String(p.id))),activeNames=new Set(players.map(p=>norm(p.display_name||'')));
    for(const entry of current){if(used.has(entry)||!entry.snap.player_name)continue;const id=String(entry.snap.player_id||''),name=norm(entry.snap.player_name);if(starterIds.has(id)||starterNames.has(name))continue;if(entry.snap._autoGatheringSub||activeIds.has(id)||activeNames.has(name))continue;prepared.push({auto:false,data:{...entry.snap,squad_status:'Remplaçant(e)'}});}
    subsHost.innerHTML=prepared.map((entry,i)=>appearanceEditorRow(entry.data,{starter:false,slot:i+1,locked:i<12})).join('');
    const rendered=$$('[data-editor-appearance][data-lineup-kind="substitute"]',subsHost);rendered.forEach((row,i)=>{row.dataset.autoGatheringSub=prepared[i]?.auto?'true':'false';});
    applyLinkedGatheringPlayerMenus(modal,state,players);const count=$('#matchSheetSubCount',modal);if(count)count.textContent=String(rendered.length);state.autoGatheringSubs=true;state.compositionDirty=true;
    if(announce){const status=$('#matchSheetGatheringStatus',modal);if(status)status.textContent=`${remaining.length} remplaçant${remaining.length>1?'s':''} ajouté${remaining.length>1?'s':''} automatiquement à partir des convoqués restants.`;}
  }
  async function activateGatheringMenus(modal,state,callupId){
    const status=$('#matchSheetGatheringStatus',modal);if(status)status.textContent='Chargement de la liste…';
    try{const players=await loadGatheringPlayers(callupId,state);applyLinkedGatheringPlayerMenus(modal,state,players);if($('#matchSheetAutoGatheringSubs',modal)?.checked)syncAutomaticGatheringSubstitutes(modal,state,{announce:false});if(status)status.textContent=players.length?`${players.length} joueur${players.length>1?'s':''} convoqué${players.length>1?'s':''} disponible${players.length>1?'s':''} dans les menus${$('#matchSheetAutoGatheringSubs',modal)?.checked?' · banc automatique actif':''}.`:'Aucun joueur actif dans ce rassemblement.';}
    catch(err){console.warn('Menus rassemblement lié',err);if(status)status.textContent='Liste des convoqués indisponible.';}
  }
  async function populateGatheringImporter(modal,state){
    const host=$('#matchSheetGatheringImport',modal),select=$('#matchSheetGatheringSelect',modal),status=$('#matchSheetGatheringStatus',modal);if(!host||!select||!client||!state?.matchId)return;
    host.hidden=true;select.innerHTML='';state.activeGatheringPlayers=[];state.autoGatheringSubs=false;const autoBox=$('#matchSheetAutoGatheringSubs',modal);if(autoBox)autoBox.checked=false;if(status)status.textContent='';
    try{
      const {data:links,error}=await client.from('callup_matches').select('callup_id').eq('match_id',state.matchId);if(error)throw error;
      const ids=[...new Set((links||[]).map(x=>String(x.callup_id||'')).filter(Boolean))];if(!ids.length)return;
      const {data:callups,error:ce}=await client.from('callups').select('id,title,announcement_date,start_date,end_date').in('id',ids).order('announcement_date',{ascending:false});if(ce)throw ce;
      const rows=callups||[];if(!rows.length)return;state.linkedGatherings=rows;select.innerHTML=rows.map(r=>`<option value="${esc(r.id)}">${esc(r.title||'Rassemblement')}${r.announcement_date?` · ${esc(fmtDate(r.announcement_date))}`:''}</option>`).join('');host.hidden=false;
      select.onchange=()=>activateGatheringMenus(modal,state,String(select.value||''));await activateGatheringMenus(modal,state,String(select.value||''));
    }catch(err){console.warn('Rassemblement lié',err);if(status)status.textContent='Rassemblement indisponible.';}
  }
  async function importLinkedGatheringRoster(modal,state){
    if(!state?.matchId||!client)return;const select=$('#matchSheetGatheringSelect',modal),status=$('#matchSheetGatheringStatus',modal),callupId=String(select?.value||'');if(!callupId)return;
    const button=$('[data-import-gathering-roster]',modal);if(button)button.disabled=true;if(status)status.textContent='Import…';
    try{
      const active=await loadGatheringPlayers(callupId,state);if(!active.length){if(status)status.textContent='Aucun joueur actif dans ce rassemblement.';return;}
      const existing=new Set($$('[data-editor-appearance] [data-appearance-name]',modal).map(i=>norm(i.value)).filter(Boolean));let added=0,skipped=0;
      const subsHost=$('#matchSheetEditorSubstitutes',modal);if(!subsHost)return;
      for(const p of active){const key=norm(p.display_name);if(existing.has(key)){skipped++;continue;}let empty=$$('[data-editor-appearance][data-lineup-kind="substitute"]',subsHost).find(r=>!String($('[data-appearance-name]',r)?.value||'').trim());if(!empty){const slot=$$('[data-editor-appearance][data-lineup-kind="substitute"]',subsHost).length+1;subsHost.insertAdjacentHTML('beforeend',appearanceEditorRow({player_id:p.id,player:p,player_name:p.display_name,position:p.primary_position,squad_status:'Remplaçant(e)'},{starter:false,slot,locked:false}));empty=$$('[data-editor-appearance][data-lineup-kind="substitute"]',subsHost).at(-1);}else{const control=$('[data-appearance-name]',empty);if(control)control.value=p.display_name;empty.dataset.originalPlayerId=String(p.id);const pos=$('[data-appearance-position]',empty);if(pos&&p.primary_position&&!pos.value){const opt=[...pos.options].find(o=>norm(o.textContent)===norm(p.primary_position)||norm(o.value)===norm(p.primary_position));if(opt)pos.value=opt.value;}}
        existing.add(key);added++;
      }
      applyLinkedGatheringPlayerMenus(modal,state,active);if($('#matchSheetAutoGatheringSubs',modal)?.checked)syncAutomaticGatheringSubstitutes(modal,state,{announce:false});const count=$('#matchSheetSubCount',modal);if(count)count.textContent=String($$('[data-editor-appearance][data-lineup-kind="substitute"]',subsHost).length);state.compositionDirty=true;if(status)status.textContent=`${added} joueur${added>1?'s':''} importé${added>1?'s':''}${skipped?` · ${skipped} déjà présent${skipped>1?'s':''}`:''}${$('#matchSheetAutoGatheringSubs',modal)?.checked?' · banc automatique recalculé':''}.`;
    }catch(err){console.error('Import liste rassemblement',err);if(status)status.textContent=String(err?.message||err);}finally{if(button)button.disabled=false;}
  }
  async function populateMatchSheetJerseyPicker(modal,state){
    const select=$('#matchSheetEditorJersey',modal),preview=$('#matchSheetEditorJerseyPreview',modal);if(!select)return;
    select.disabled=true;select.innerHTML='<option value="">Chargement…</option>';
    const renderPreview=(data,opt)=>{if(!preview)return;const row=data?.options?.find(x=>String(x.id)===String(opt||''));preview.innerHTML=row?`${row.photo?`<img src="${esc(row.photo)}" alt="Maillot ${esc(row.year||'')}">`:'<span>👕</span>'}<i class="match-sheet-jersey-palette" style="${formationMarkerInlineStyle(row)}" aria-hidden="true"></i><div><strong>${esc(row.label)}</strong><small>${esc(row.link||'')}</small></div>`:'<span>👕</span><small>Aucun maillot associé</small>';};
    try{const api=window.BLEUS3000_JERSEYS;if(!api?.getMatchPickerData){select.innerHTML='<option value="">Module Maillots indisponible</option>';return;}const data=await api.getMatchPickerData(state.matchId,state.match||{});state.jerseyOptions=data.options||[];select.innerHTML=`<option value="">Aucun maillot associé</option>${data.options.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}`;select.value=String(data.selectedId||'');select.disabled=false;renderPreview(data,select.value);select.onchange=()=>{state.jerseyDirty=true;renderPreview(data,select.value);};}
    catch(err){console.warn('Sélecteur maillot',err);select.innerHTML='<option value="">Migration Maillots ↔ Matchs requise</option>';select.disabled=true;if(preview)preview.innerHTML='<span>⚠</span><small>Relation maillot/match non disponible</small>';}
  }
  async function populateMatchSheetBallPicker(modal,state){
    const select=$('#matchSheetEditorBall',modal),preview=$('#matchSheetEditorBallPreview',modal);if(!select)return;
    select.disabled=true;select.innerHTML='<option value="">Chargement…</option>';
    const draw=(data,id)=>{if(!preview)return;const row=data?.options?.find(x=>String(x.id)===String(id||''));preview.innerHTML=row?`${row.photo?`<img src="${esc(row.photo)}" alt="${esc(row.label)}">`:'<span>⚽</span>'}<div><strong>${esc(row.label)}</strong><small>${esc([row.manufacturer,row.competition].filter(Boolean).join(' · ')||'Ballon du match')}</small></div>${row.copyright?`<span class="photo-copyright-capsule">© ${esc(row.copyright)}</span>`:''}`:'<span>⚽</span><div><strong>Aucun ballon associé</strong><small>Référentiel Ballons</small></div>';};
    try{const api=window.BLEUS3000_BALLS;if(!api?.getMatchPickerData){select.innerHTML='<option value="">Module Ballons indisponible</option>';return;}const data=await api.getMatchPickerData(state.matchId,state.match||{});state.ballOptions=data.options||[];select.innerHTML=`<option value="">Aucun ballon associé</option>${data.options.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}`;select.value=String(data.selectedId||'');select.disabled=false;draw(data,select.value);select.onchange=()=>{state.ballDirty=true;draw(data,select.value);};}
    catch(err){console.warn('Sélecteur ballon',err);select.innerHTML='<option value="">Schéma Ballons Supabase requis</option>';select.disabled=true;if(preview)preview.innerHTML='<span>⚠</span><div><strong>Référentiel indisponible</strong><small>Vérifier le schéma Supabase du projet.</small></div>';}
  }

  async function openMatchSheetEditor(matchId,sheet,m){
    if(!canEdit())return alert('Modification réservée aux ADMIN et SUPERADMIN.');const modal=ensureMatchSheetEditor();await ensureEditorLookups();
    const safeSheet=sheet||{appearances:[],goals:[],cards:[],media:[]},safeMatch=m||{};matchSheetEditorState={matchId:String(matchId),sheet:safeSheet,match:safeMatch,compositionDirty:false,eventsDirty:false,jerseyDirty:false,ballDirty:false};window.__BLEUS_MATCH_SHEET_CURRENT_ID=String(matchId);
    const playerList=$('#matchSheetPlayerList',modal),meta=$('#matchSheetEditorMeta',modal),startersHost=$('#matchSheetEditorStarters',modal),subsHost=$('#matchSheetEditorSubstitutes',modal),goals=$('#matchSheetEditorGoals',modal),cards=$('#matchSheetEditorCards',modal);if(playerList)playerList.innerHTML=editorPlayerListHtml();
    const stadiumList=$('#matchSheetStadiumList',modal),personnelList=$('#matchSheetPersonnelList',modal),competitionList=$('#matchSheetCompetitionList',modal);if(stadiumList)stadiumList.innerHTML=stadiumRows.map(x=>`<option value="${esc(x.name)}"></option>`).join('');if(personnelList)personnelList.innerHTML=people.map(x=>`<option value="${esc(x.display_name)}"></option>`).join('');if(competitionList)competitionList.innerHTML=competitionRows.map(x=>`<option value="${esc(x.name)}"></option>`).join('');
    $('#matchSheetStadium',modal).value=safeMatch.sheet_stadium_name||safeMatch.place?.name||'';$('#matchSheetCity',modal).value=safeMatch.sheet_city_name||effective(safeMatch,'city')||safeMatch.place?.city||'';$('#matchSheetCoach',modal).value=safeMatch.sheet_coach_name||safeMatch.coach?.display_name||'';$('#matchSheetCompetition',modal).value=safeMatch.sheet_competition_name||safeMatch.competitionEntity?.name||safeMatch.competition?.name||'';
    const editionSel=$('#matchSheetCompetitionEdition',modal);if(editionSel){const entityById=new Map(competitionEntities.map(x=>[String(x.id),x]));const gender=safeMatch.selection?.gender||safeMatch.gender||null;const options=competitionEditions.filter(ed=>{const ent=entityById.get(String(ed.competition_entity_id));return !gender||!ent?.gender||ent.gender===gender;}).slice().sort((a,b)=>{const ea=entityById.get(String(a.competition_entity_id))?.name||'',eb=entityById.get(String(b.competition_entity_id))?.name||'';return ea.localeCompare(eb,'fr')||Number(b.edition_year||0)-Number(a.edition_year||0);});editionSel.innerHTML='<option value="">— édition non définie —</option>'+options.map(ed=>{const ent=entityById.get(String(ed.competition_entity_id));const label=[ent?.name,ed.edition_label||ed.edition_year].filter(Boolean).join(' · ');return `<option value="${esc(ed.id)}">${esc(label)}</option>`;}).join('');editionSel.value=String(safeMatch.competition_edition_id||safeMatch.competitionEdition?.id||safeMatch.competition?.canonical_edition_id||'');}
    const mainRef=officialRows.find(x=>String(x.match_id)===String(matchId)&&isMainRefereeRole(x.role));$('#matchSheetReferee',modal).value=safeMatch.sheet_referee_name||(mainRef?people.find(p=>String(p.id)===String(mainRef.person_id))?.display_name:'')||'';
    const opp=countryName(effective(safeMatch,'opponent_name')||'Adversaire');if(meta)meta.textContent=`${fmtDateLong(effective(safeMatch,'match_date'))} · France – ${opp}`;const structured=structuredLineup(safeSheet.appearances||[]);if(startersHost)startersHost.innerHTML=structured.starters.map((r,i)=>appearanceEditorRow(r,{starter:true,slot:i+1,locked:true})).join('');if(subsHost)subsHost.innerHTML=structured.subs.map((r,i)=>appearanceEditorRow(r,{starter:false,slot:i+1,locked:i<12})).join('');const subCount=$('#matchSheetSubCount',modal);if(subCount)subCount.textContent=String(structured.subs.length);if(goals)goals.innerHTML=(safeSheet.goals||[]).map(g=>goalEditorRow(g,safeMatch)).join('');if(cards)cards.innerHTML=(safeSheet.cards||[]).map(cardEditorRow).join('');const st=$('#matchSheetEditorStatus',modal);if(st){st.hidden=true;st.textContent='';st.className='match-sheet-editor-status';}modal.hidden=false;requestAnimationFrame(()=>{populateGatheringImporter(modal,matchSheetEditorState).catch(err=>console.warn('Import rassemblement différé',err));populateMatchSheetJerseyPicker(modal,matchSheetEditorState).catch(err=>console.warn('Sélecteur maillot différé',err));populateMatchSheetBallPicker(modal,matchSheetEditorState).catch(err=>console.warn('Sélecteur ballon différé',err));});
  }
  function collectEditorAppearances(modal,state){
    const out=[],seenNames=new Set();for(const row of $$('[data-editor-appearance]',modal)){const input=$('[data-appearance-name]',row),name=String(input?.value||'').trim();if(!name)continue;const key=norm(name);if(seenNames.has(key))throw new Error(`Le joueur ${name} est présent deux fois dans la composition.`);seenNames.add(key);const current=safeUuid(row.dataset.originalPlayerId),playerId=safeUuid(editorResolvePlayer(name,current||'')),starter=row.dataset.lineupKind==='starter',slot=Number(row.dataset.lineupSlot||0)||null;const posSel=$('[data-appearance-position]',row),positionId=safeUuid(posSel?.value),positionText=positionId?footballPositions.find(x=>String(x.id)===String(positionId))?.label_text||null:null;const replChecked=!!$('[data-appearance-replaced]',row)?.checked,replName=replChecked?String($('[data-appearance-replacement]',row)?.value||'').trim():'',replId=replName?safeUuid(editorResolvePlayer(replName,safeUuid(row.dataset.originalReplacementId)||'')):null;out.push({id:safeUuid(row.dataset.appearanceId),match_id:safeUuid(state.matchId),player_id:playerId,player_name:name,starter,appeared:false,lineup_slot:slot,minutes:$('[data-appearance-minutes]',row)?.value===''?null:Number($('[data-appearance-minutes]',row)?.value),squad_status:starter?'Titulaire':'Remplaçant(e)',shirt_number:$('[data-appearance-number]',row)?.value===''?null:Number($('[data-appearance-number]',row)?.value),position_id:positionId,position:positionText,captain:!!$('[data-appearance-captain]',row)?.checked,replaced_by_player_id:replId,replaced_by_name:replName||null});}return out;
  }
  function collectEditorGoals(modal,state){
    const opp=countryName(effective(state.match,'opponent_name')||'Adversaire');return $$('[data-editor-goal]',modal).map(row=>{const scorer=String($('[data-goal-scorer]',row)?.value||'').trim();if(!scorer)return null;const team=$('[data-goal-team]',row)?.value||'france',current=safeUuid(row.dataset.originalPlayerId),assistName=String($('[data-goal-assist]',row)?.value||'').trim(),currentAssist=safeUuid(row.dataset.originalAssistId),goalType=$('[data-goal-type]',row)?.value||'open_play';const playerId=team==='france'?safeUuid(editorResolvePlayer(scorer,current||'')):null;const assistId=team==='france'&&assistName?safeUuid(editorResolvePlayer(assistName,currentAssist||'')):null;return {id:safeUuid(row.dataset.eventId),match_id:safeUuid(state.matchId),player_id:playerId,scorer_name:scorer,team_name:team==='france'?'France':opp,minute_text:String($('[data-goal-minute]',row)?.value||'').trim()||null,score_after:String($('[data-goal-score]',row)?.value||'').trim()||null,assist_player_id:assistId,assist_name:assistName||null,goal_type:goalType,body_part:goalType==='header'?'head':null,is_penalty:goalType==='penalty',is_own_goal:false,updated_at:new Date().toISOString()};}).filter(Boolean);}
  function collectEditorCards(modal,state){
    const opp=countryName(effective(state.match,'opponent_name')||'Adversaire');return $$('[data-editor-card]',modal).map(row=>{const name=String($('[data-card-player]',row)?.value||'').trim();if(!name)return null;const team=$('[data-card-team]',row)?.value||'france',current=safeUuid(row.dataset.originalPlayerId),playerId=team==='france'?safeUuid(editorResolvePlayer(name,current||'')):null;return {id:safeUuid(row.dataset.eventId),match_id:safeUuid(state.matchId),player_id:playerId,player_name:name,team_name:team==='france'?'France':opp,card_type:$('[data-card-type]',row)?.value||'yellow',minute_text:String($('[data-card-minute]',row)?.value||'').trim()||null,updated_at:new Date().toISOString()};}).filter(Boolean);}
  async function saveEditorAppearances(state,rows){
    const oldIds=new Set((state.sheet.appearances||[]).map(x=>String(x.id||'')).filter(Boolean)),keep=new Set(rows.map(x=>String(x.id||'')).filter(Boolean)),removed=[...oldIds].filter(id=>!keep.has(id));if(removed.length){const {error}=await client.from('match_appearances').delete().in('id',removed);if(error)throw error;}for(const row of rows){const payload={...row};delete payload.id;if(row.id){const {error}=await client.from('match_appearances').update(payload).eq('id',row.id);if(error)throw error;}else{const {error}=await client.from('match_appearances').insert(payload);if(error)throw error;}}
  }
  async function saveEditorGoals(state,rows){
    const cleanRows=rows.map(r=>({...r,id:safeUuid(r.id),match_id:safeUuid(r.match_id),player_id:safeUuid(r.player_id),assist_player_id:safeUuid(r.assist_player_id)}));
    const oldIds=new Set((state.sheet.goals||[]).map(x=>safeUuid(x.id)).filter(Boolean)),keep=new Set(cleanRows.map(x=>x.id).filter(Boolean)),removed=[...oldIds].filter(id=>!keep.has(id));if(removed.length){const {error}=await client.from('match_goal_events').delete().in('id',removed);if(error)throw error;}const saved=[];for(const row of cleanRows){const payload={...row};delete payload.id;if(row.id){const {data,error}=await client.from('match_goal_events').update(payload).eq('id',row.id).select('*').single();if(error)throw error;saved.push(data);}else{const {data,error}=await client.from('match_goal_events').insert(payload).select('*').single();if(error)throw error;saved.push(data);}}state.sheet.goals=saved;return saved;
  }
  async function saveEditorCards(state,rows){
    const cleanRows=rows.map(r=>({...r,id:safeUuid(r.id),match_id:safeUuid(r.match_id),player_id:safeUuid(r.player_id)}));
    const oldIds=new Set((state.sheet.cards||[]).map(x=>safeUuid(x.id)).filter(Boolean)),keep=new Set(cleanRows.map(x=>x.id).filter(Boolean)),removed=[...oldIds].filter(id=>!keep.has(id));if(removed.length){const {error}=await client.from('match_card_events').delete().in('id',removed);if(error)throw error;}const saved=[];for(const row of cleanRows){const payload={...row};delete payload.id;if(row.id){const {data,error}=await client.from('match_card_events').update(payload).eq('id',row.id).select('*').single();if(error)throw error;saved.push(data);}else{const {data,error}=await client.from('match_card_events').insert(payload).select('*').single();if(error)throw error;saved.push(data);}}state.sheet.cards=saved;return saved;
  }
  async function syncAppearanceEventCounters(matchId,goals,cards){
    const safeMatchId=safeUuid(matchId);if(!safeMatchId)throw new Error('Identifiant de match invalide.');
    const {data:apps,error}=await client.from('match_appearances').select('player_id').eq('match_id',safeMatchId);if(error)throw error;
    const counts=new Map((apps||[]).map(x=>safeUuid(x.player_id)).filter(Boolean).map(id=>[id,{goals:0,assists:0,yellow_cards:0,red_cards:0}]));
    for(const g of goals){const pid=safeUuid(g.player_id),aid=safeUuid(g.assist_player_id);if(pid&&counts.has(pid))counts.get(pid).goals++;if(aid&&counts.has(aid))counts.get(aid).assists++;}
    for(const c of cards){const pid=safeUuid(c.player_id);if(!pid||!counts.has(pid))continue;if(c.card_type==='red')counts.get(pid).red_cards++;else counts.get(pid).yellow_cards++;}
    await Promise.all([...counts.entries()].map(([player_id,payload])=>client.from('match_appearances').update(payload).eq('match_id',safeMatchId).eq('player_id',player_id).then(({error})=>{if(error)throw error;})));
  }
  async function ensureEditorLookups(){
    if(!footballPositions.length){const {data,error}=await client.from('football_positions').select('id,slug,label_text,aliases,sort_order').order('sort_order');if(error)throw error;footballPositions=data||[];}
    if(!competitionFamilies.length){const {data,error}=await client.from('competition_families').select('id,slug,name,competition_type,sort_order').order('sort_order');if(error)throw error;competitionFamilies=data||[];}
  }
  async function resolveOrCreatePlayer(name,state){
    const clean=String(name||'').trim();if(!clean)return null;let id=editorResolvePlayer(clean,'');if(id)return id;
    const {data:found}=await client.from('players').select('id,display_name,gender').ilike('display_name',clean).eq('gender',state.match.selection?.gender||state.match.gender||'M').limit(5);const exact=(found||[]).find(x=>norm(x.display_name)===norm(clean));if(exact)return exact.id;
    const gender=state.match.selection?.gender||state.match.gender||'M',slug=clean.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now();
    const {data:p,error}=await client.from('players').insert({display_name:clean,last_name:clean,gender,france_eligibility:true,senior_a_called:false,active:true,active_source:true,name_normalized:clean.toLocaleLowerCase('fr'),profile_slug:slug,data_status:'validated_match_sheet'}).select('id,display_name').single();if(error)throw error;
    const selectionId=state.match.selection_team_id||state.match.selection?.id;if(selectionId){await client.from('player_selection_stats').upsert({player_id:p.id,selection_id:selectionId,selections:0,goals:0,wins:0,draws:0,losses:0,starts:0,minutes:0,appearance_status:'called_only',data_status:'sheet_rebuild_pending'},{onConflict:'player_id,selection_id'});const tagId=state.match.selection?.team_tag_id;if(tagId)await client.from('entity_tags').upsert({entity_type:'player',entity_id:p.id,tag_id:tagId},{onConflict:'entity_type,entity_id,tag_id'});}return p.id;
  }
  async function materializeSheetContext(modal,state){
    const stadium=String($('#matchSheetStadium',modal)?.value||'').trim(),city=String($('#matchSheetCity',modal)?.value||'').trim(),coach=String($('#matchSheetCoach',modal)?.value||'').trim(),referee=String($('#matchSheetReferee',modal)?.value||'').trim(),comp=String($('#matchSheetCompetition',modal)?.value||'').trim(),selectedEditionId=$('#matchSheetCompetitionEdition',modal)?.value||null;
    const patch={sheet_stadium_name:stadium||null,sheet_city_name:city||null,sheet_coach_name:coach||null,sheet_referee_name:referee||null,sheet_competition_name:comp||null};
    if(stadium){let place=stadiumRows.find(x=>norm(x.name)===norm(stadium));if(!place){const {data,error}=await client.from('places').insert({place_type:'stadium',name:stadium,city:city||null}).select('*').single();if(error)throw error;place=data;}else if(city&&String(place.city||'')!==city){const {data,error}=await client.from('places').update({city,updated_at:new Date().toISOString()}).eq('id',place.id).select('*').single();if(error)throw error;Object.assign(place,data||{city});}patch.place_id=place.id;}
    if(coach){let p=people.find(x=>x.person_type==='selectionneur'&&norm(x.display_name)===norm(coach));if(!p){const {data,error}=await client.from('personnel').insert({display_name:coach,person_type:'selectionneur',active:true}).select('*').single();if(error)throw error;p=data;}patch.coach_id=p.id;}
    if(referee){let p=people.find(x=>x.person_type==='arbitre'&&norm(x.display_name)===norm(referee));if(!p){const {data,error}=await client.from('personnel').insert({display_name:referee,person_type:'arbitre',active:true}).select('*').single();if(error)throw error;p=data;}const {error:de}=await client.from('match_officials').delete().eq('match_id',state.matchId).eq('role','Arbitre principal');if(de)throw de;const {error:ie}=await client.from('match_officials').insert({match_id:state.matchId,person_id:p.id,role:'Arbitre principal'});if(ie)throw ie;}
    if(selectedEditionId){const ed=competitionEditions.find(x=>String(x.id)===String(selectedEditionId));if(!ed)throw new Error('Édition de compétition inconnue. Recharge la page puis réessaie.');const entity=competitionEntities.find(x=>String(x.id)===String(ed.competition_entity_id));const legacy=competitionRows.find(x=>String(x.canonical_edition_id||'')===String(selectedEditionId)&&(!x.gender||x.gender===state.match.selection?.gender)&&(!x.selection_category||x.selection_category===state.match.selection?.category))||competitionRows.find(x=>String(x.canonical_edition_id||'')===String(selectedEditionId));patch.competition_edition_id=ed.id;if(legacy)patch.competition_id=legacy.id;if(entity){patch.sheet_competition_name=entity.name;}
    }else if(comp){
      const c=competitionRows.find(x=>norm(x.name)===norm(comp)&&(!x.gender||x.gender===state.match.selection?.gender)&&(!x.selection_category||x.selection_category===state.match.selection?.category))||competitionRows.find(x=>norm(x.name)===norm(comp));
      if(c){patch.competition_id=c.id;if(c.canonical_edition_id)patch.competition_edition_id=c.canonical_edition_id;}
    }
    const {error}=await client.from('matches').update(patch).eq('id',state.matchId);if(error)throw error;Object.assign(state.match,patch);
  }
  async function saveMatchSheetEditor(stayOpen=false){
    const modal=ensureMatchSheetEditor(),state=matchSheetEditorState,st=$('#matchSheetEditorStatus',modal);
    if(!state||!client)return false;
    if(st){st.hidden=false;st.className='match-sheet-editor-status';st.textContent='Enregistrement de la feuille…';}
    try{
      await ensureEditorLookups();
      const appearances=collectEditorAppearances(modal,state),goals=collectEditorGoals(modal,state),cards=collectEditorCards(modal,state);
      const jerseySelect=$('#matchSheetEditorJersey',modal),ballSelect=$('#matchSheetEditorBall',modal);
      const jerseyId=jerseySelect&&!jerseySelect.disabled?safeUuid(jerseySelect.value):null;
      const ballId=ballSelect&&!ballSelect.disabled?safeUuid(ballSelect.value):null;
      const context={
        stadium:String($('#matchSheetStadium',modal)?.value||'').trim()||null,
        city:String($('#matchSheetCity',modal)?.value||'').trim()||null,
        referee:String($('#matchSheetReferee',modal)?.value||'').trim()||null,
        coach:String($('#matchSheetCoach',modal)?.value||'').trim()||null,
        competition_name:String($('#matchSheetCompetition',modal)?.value||'').trim()||null,
        competition_edition_id:safeUuid($('#matchSheetCompetitionEdition',modal)?.value)||null
      };
      const {data,error}=await client.rpc('save_match_sheet',{
        p_match_id:safeUuid(state.matchId),p_appearances:appearances,p_goals:goals,p_cards:cards,
        p_context:context,p_jersey_id:jerseyId,p_ball_id:ballId
      });
      if(error){
        if(/save_match_sheet|PGRST202|schema cache/i.test(String(error?.message||'')))throw new Error('Migration Supabase V1.3.12 requise.');
        throw error;
      }
      const result=Array.isArray(data)?data[0]:data||{};
      matchSheetCache.delete(state.matchId);
      window.BLEUS3000_JERSEYS?.invalidate?.();window.BLEUS3000_BALLS?.invalidate?.();
      window.BLEUS3000_SEARCH_INDEX?.invalidate?.();window.BLEUS3000_STATISTICS?.invalidate?.();
      window.dispatchEvent(new CustomEvent('bleus:match-sheet-updated',{detail:{matchId:state.matchId,lineupStatus:`Feuille de match · ${appearances.length} joueurs`,source:'manual'}}));
      if(st){st.className='match-sheet-editor-status is-ok';st.textContent=`Feuille enregistrée ✓ · ${Number(result.player_count||0)} joueur${Number(result.player_count||0)>1?'s':''} synchronisé${Number(result.player_count||0)>1?'s':''}`;}
      invalidate();
      if(stayOpen)await refreshMatchSheetPanel(state.matchId).catch(()=>{});
      if(!stayOpen)setTimeout(()=>{modal.hidden=true;matchSheetEditorState=null;},650);
      return true;
    }catch(err){
      console.error('Enregistrement feuille de match',err);
      if(st){st.hidden=false;st.className='match-sheet-editor-status is-error';st.textContent=String(err?.message||err);}
      if(stayOpen)throw err;
      return false;
    }
  }

  function ensureQuickEventModal(){let modal=$('#quickMatchEventModal');if(modal)return modal;modal=document.createElement('div');modal.className='modal-backdrop quick-match-event-modal';modal.id='quickMatchEventModal';modal.hidden=true;modal.innerHTML=`<section class="modal-dialog quick-match-event-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Ajouter un fait de jeu</h2><p id="quickMatchEventMeta">Ajout rapide sans ouvrir la feuille</p></div><button class="modal-close" data-quick-event-close type="button">×</button></header><div class="modal-body"><datalist id="quickEventPlayerList"></datalist><form id="quickMatchEventForm" class="quick-match-event-form"><label>Type<select id="quickEventType"><option value="goal">⚽ But</option><option value="yellow">🟨 Carton jaune</option><option value="second_yellow">🟨🟥 Second jaune</option><option value="red">🟥 Carton rouge</option></select></label><label>Équipe<select id="quickEventTeam"><option value="france">France</option><option value="opponent">Adversaire</option></select></label><label>Joueur<input id="quickEventPlayer" list="quickEventPlayerList" required placeholder="Nom libre accepté"></label><label>Minute<input id="quickEventMinute" placeholder="Ex. 64 ou 90+2"></label><label class="quick-goal-only">Score après le but<input id="quickEventScore" placeholder="Ex. 2-1"></label><label class="quick-goal-only">Type de but<select id="quickEventGoalType"><option value="open_play">Jeu</option><option value="header">Tête</option><option value="free_kick">Coup franc</option><option value="penalty">Penalty</option><option value="other">Autre</option></select></label><label class="quick-goal-only">Passeur décisif<input id="quickEventAssist" list="quickEventPlayerList" placeholder="Facultatif"></label><div class="match-sheet-editor-status" id="quickEventStatus" hidden></div><div class="match-sheet-editor-actions"><button type="button" class="secondary-btn" data-quick-event-close>Annuler</button><button class="primary-btn" type="submit">Ajouter</button></div></form></div></section>`;document.body.appendChild(modal);$$('[data-quick-event-close]',modal).forEach(b=>b.addEventListener('click',()=>modal.hidden=true));$('#quickEventType',modal)?.addEventListener('change',()=>{$$('.quick-goal-only',modal).forEach(x=>x.hidden=$('#quickEventType',modal).value!=='goal');});$('#quickMatchEventForm',modal)?.addEventListener('submit',saveQuickMatchEvent);return modal;}
  let quickEventMatchId=null;
  async function openQuickMatchEvent(matchId){if(!canEdit())return alert('Ajout réservé aux ADMIN et SUPERADMIN.');await load();const m=getMatch(matchId);if(!m)return;quickEventMatchId=String(matchId);const modal=ensureQuickEventModal(),list=$('#quickEventPlayerList',modal);if(list)list.innerHTML=editorPlayerListHtml();$('#quickMatchEventForm',modal)?.reset();$$('.quick-goal-only',modal).forEach(x=>x.hidden=false);const opp=countryName(effective(m,'opponent_name')||'Adversaire');$('#quickMatchEventMeta',modal).textContent=`${fmtDateLong(effective(m,'match_date'))} · France – ${opp}`;const st=$('#quickEventStatus',modal);if(st){st.hidden=true;st.textContent='';st.className='match-sheet-editor-status';}modal.hidden=false;setTimeout(()=>$('#quickEventPlayer',modal)?.focus(),40);}
  async function saveQuickMatchEvent(e){e.preventDefault();if(!canEdit()||!client||!quickEventMatchId)return;const modal=ensureQuickEventModal(),m=getMatch(quickEventMatchId)||{},type=$('#quickEventType',modal).value,team=$('#quickEventTeam',modal).value,name=String($('#quickEventPlayer',modal).value||'').trim(),minute=String($('#quickEventMinute',modal).value||'').trim()||null,st=$('#quickEventStatus',modal);if(!name)return;st.hidden=false;st.className='match-sheet-editor-status';st.textContent='Ajout…';try{const playerId=team==='france'?safeUuid(editorResolvePlayer(name)):null,opp=countryName(effective(m,'opponent_name')||'Adversaire');if(type==='goal'){const assistName=String($('#quickEventAssist',modal).value||'').trim(),assistId=team==='france'&&assistName?editorResolvePlayer(assistName):null;const goalType=$('#quickEventGoalType',modal)?.value||'open_play';const {error}=await client.from('match_goal_events').insert({match_id:quickEventMatchId,player_id:playerId,scorer_name:name,team_name:team==='france'?'France':opp,minute_text:minute,score_after:String($('#quickEventScore',modal).value||'').trim()||null,assist_player_id:assistId,assist_name:assistName||null,goal_type:goalType,body_part:goalType==='header'?'head':null,is_penalty:goalType==='penalty',is_own_goal:false});if(error)throw error;}else{const {error}=await client.from('match_card_events').insert({match_id:quickEventMatchId,player_id:playerId,player_name:name,team_name:team==='france'?'France':opp,card_type:type,minute_text:minute});if(error)throw error;}matchSheetCache.delete(quickEventMatchId);st.className='match-sheet-editor-status is-ok';st.textContent='Fait de jeu ajouté ✓ · statistiques synchronisées sans double comptage.';window.dispatchEvent(new CustomEvent('bleus:match-sheet-updated',{detail:{matchId:quickEventMatchId,lineupStatus:m.lineup_status||null,source:'quick-event'}}));const panel=$(`[data-match-sheet-panel="${CSS.escape(String(quickEventMatchId))}"]`);if(panel&&!panel.hidden)refreshMatchSheetPanel(quickEventMatchId).catch(()=>{});setTimeout(()=>modal.hidden=true,850);}catch(err){st.className='match-sheet-editor-status is-error';st.textContent=String(err?.message||err);}}
  function competitionIconFallback(entity,c,tag){const explicit=String(entity?.icon_text||tag?.icon_text||'').trim();if(explicit)return explicit;const key=norm([entity?.name,c?.name,c?.competition_type,entity?.competition_type].filter(Boolean).join(' '));if(/olymp|jeux olymp/.test(key))return '🥇';if(/coupe du monde|world cup|mondial/.test(key))return '🌍';if(/euro|europe/.test(key))return '🇪🇺';if(/ligue des nations|nations league/.test(key))return '🏆';if(/amical|friendly/.test(key))return '🤝';if(/tournoi/.test(key))return '🏅';return '🏆';}
  function renderCompetitionCard(c){
    const entity=competitionEntities.find(x=>String(x.id)===String(c.canonical_entity_id||'')),tag=(entity?.competition_tag_id||c.tag_id)?tagsById.get(entity?.competition_tag_id||c.tag_id):null,icon=competitionIconFallback(entity,c,tag);
    const matchCount=matches.filter(m=>String(m.competition_id)===String(c.id)).length;
    return `<article class="rel-ref-tile rel-competition-tile" data-competition-id="${esc(c.id)}"><div class="rel-ref-head rel-competition-head"><div class="rel-competition-head-main"><span class="rel-competition-icon" aria-hidden="true">${esc(icon)}</span><div><h3>${esc(c.name)}</h3><div class="subtitle">${esc([c.edition,c.selection_category,c.gender==='F'?'Féminin':c.gender==='M'?'Masculin':''].filter(Boolean).join(' · ')||'Compétition')}</div></div></div><div class="rel-competition-head-actions">${canEdit()?`<button type="button" class="rel-competition-edit" data-competition-edit="${esc(c.id)}" title="Modifier la compétition">⚙</button>`:''}<span class="rel-result">${matchCount}</span></div></div><div class="rel-facts"><span>⚽ ${matchCount} match${matchCount>1?'s':''} relié${matchCount>1?'s':''}</span>${c.status?`<span>État : ${esc(c.status)}</span>`:''}${c.competition_type?`<span>Type : ${esc(c.competition_type)}</span>`:''}</div><div class="rel-tags">${tag?tagChip(tag,'relational-competition-chip'):''}</div></article>`;
  }
  function ensureCompetitionEditorModal(){let modal=$('#competitionEditorModal');if(modal)return modal;modal=document.createElement('div');modal.id='competitionEditorModal';modal.className='modal-backdrop competition-editor-modal';modal.hidden=true;modal.innerHTML=`<section class="modal-dialog competition-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="competitionEditorTitle"><header class="modal-head"><div><h2 id="competitionEditorTitle">Modifier la compétition</h2><p>Modifie la tuile et son icône d’entité principale.</p></div><button class="modal-close" type="button" data-competition-edit-close>×</button></header><div class="modal-body"><form id="competitionEditorForm" class="competition-editor-form"><div class="competition-editor-grid"><label>Nom<input name="name" required maxlength="160"></label><label>Édition<input name="edition" maxlength="80" placeholder="2026"></label><label>Type<input name="competition_type" maxlength="80" placeholder="nations_league"></label><label>Statut<select name="status"><option value="active">Actif</option><option value="archived">Archivé</option><option value="planned">Planifié</option></select></label><label>Genre<select name="gender"><option value="M">Masculin</option><option value="F">Féminin</option><option value="">—</option></select></label><label>Catégorie<input name="selection_category" maxlength="80" placeholder="A"></label></div><div class="competition-editor-icon-block"><strong>Icône</strong><div class="competition-icon-presets">${['🏆','🌍','🇪🇺','🥇','🏅','🤝','⚽','⭐'].map(x=>`<button type="button" data-competition-edit-icon="${x}">${x}</button>`).join('')}</div><label>Icône personnalisée<input name="icon_text" maxlength="8" placeholder="🏆"></label></div><div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-competition-edit-close>Annuler</button><button class="primary-btn" type="submit">Enregistrer</button></div><div class="c3k-v8-status" data-competition-editor-status hidden></div></form></div></section>`;document.body.appendChild(modal);$$('[data-competition-edit-close]',modal).forEach(b=>b.addEventListener('click',()=>{modal.hidden=true;modal.dataset.competitionId='';}));$$('[data-competition-edit-icon]',modal).forEach(b=>b.addEventListener('click',()=>{modal.querySelector('[name="icon_text"]').value=b.dataset.competitionEditIcon||'';}));$('#competitionEditorForm',modal)?.addEventListener('submit',saveCompetitionEditor);return modal;}
  function openCompetitionEditor(id){if(!canEdit())return;const c=competitionRows.find(x=>String(x.id)===String(id));if(!c)return;const entity=competitionEntities.find(x=>String(x.id)===String(c.canonical_entity_id||''));const modal=ensureCompetitionEditorModal(),form=$('#competitionEditorForm',modal);modal.dataset.competitionId=String(c.id);form.elements.name.value=c.name||'';form.elements.edition.value=c.edition||'';form.elements.competition_type.value=c.competition_type||entity?.competition_type||'';form.elements.status.value=c.status||'active';form.elements.gender.value=c.gender||entity?.gender||'';form.elements.selection_category.value=c.selection_category||'';form.elements.icon_text.value=entity?.icon_text||'';$('#competitionEditorTitle',modal).textContent=`Modifier · ${c.name}`;const st=$('[data-competition-editor-status]',form);if(st){st.hidden=true;st.textContent='';st.className='c3k-v8-status';}modal.hidden=false;}
  async function saveCompetitionEditor(e){e.preventDefault();if(!canEdit()||!client)return;const form=e.currentTarget,modal=ensureCompetitionEditorModal(),id=modal.dataset.competitionId||'',c=competitionRows.find(x=>String(x.id)===String(id)),st=$('[data-competition-editor-status]',form);if(!c)return;const fd=new FormData(form),payload={name:String(fd.get('name')||'').trim(),edition:String(fd.get('edition')||'').trim()||null,competition_type:String(fd.get('competition_type')||'').trim()||null,status:String(fd.get('status')||'active').trim()||'active',gender:String(fd.get('gender')||'').trim()||null,selection_category:String(fd.get('selection_category')||'').trim()||null};if(!payload.name)return;if(st){st.hidden=false;st.className='c3k-v8-status';st.textContent='Enregistrement…';}try{const {error}=await client.from('competitions').update(payload).eq('id',id);if(error)throw error;const entityId=c.canonical_entity_id||null;if(entityId){const entityPatch={competition_type:payload.competition_type,gender:payload.gender,icon_text:String(fd.get('icon_text')||'').trim()||null,updated_at:new Date().toISOString()};const {error:ee}=await client.from('competition_entities').update(entityPatch).eq('id',entityId);if(ee)throw ee;}if(c.canonical_edition_id&&payload.edition){const year=Number((payload.edition.match(/(?:19|20)\d{2}/)||[])[0]);const edPatch={edition_label:payload.edition,updated_at:new Date().toISOString()};if(year)edPatch.edition_year=year;const {error:edErr}=await client.from('competition_editions').update(edPatch).eq('id',c.canonical_edition_id);if(edErr)throw edErr;}if(st){st.className='c3k-v8-status is-ok';st.textContent='Compétition mise à jour ✓';}invalidate();await load();setTimeout(()=>{modal.hidden=true;render('competitions',$('#referenceSearch')?.value||'');},300);}catch(err){if(st){st.hidden=false;st.className='c3k-v8-status is-error';st.textContent=String(err?.message||err);}}}
  function bindCompetitionEditors(host){$$('[data-competition-edit]',host).forEach(b=>b.addEventListener('click',()=>openCompetitionEditor(b.dataset.competitionEdit)));}


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
    return `<button type="button" class="rel-linked-match-tile" data-linked-match="${esc(m.id)}"><span class="rel-linked-match-date"><b class="rel-linked-match-number">#${esc(getMatchNumber(m)||'—')}</b>${esc(fmtDate(effective(m,'match_date')))}</span><span class="rel-linked-match-main"><strong>France <b class="rel-linked-score ${scoreClass(m)}">${esc(score)}</b> ${flagImg(opp)}${esc(opp)}</strong><small>${esc(effective(m,'competition_name')||'Match international')}${m.phase?` · ${esc(m.phase)}`:''}</small></span><span class="rel-linked-match-result ${scoreClass(m)}">${resultLetter(m)}</span><span class="rel-linked-match-open">↗</span></button>`;
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
    return `<article class="rel-ref-tile rel-opponent-tile" data-opponent-id="${esc(o.id)}" data-country-search="${esc(norm(countrySearch))}">${referenceEditButton('adversaires',o)}<div class="rel-ref-head"><div><h3><span class="rel-opponent-title">${flagImg(o.name)}${esc(countryName(o.name))}</span></h3><div class="subtitle">${esc(meta)}</div></div><span class="rel-result">${bal.matches}</span></div>${relationSummaryHtml(bal)}${o.federation_name?`<div class="rel-facts"><span>🏛 ${esc(o.federation_name)}</span></div>`:''}<div class="rel-opponent-section-title">Matchs par sélection française</div><div class="rel-opponent-sections">${sectionButtons||'<span class="rel-opponent-empty">Aucune section reliée</span>'}</div><div class="rel-opponent-details" hidden></div></article>`;
  }
  function renderOpponentDetails(card,opponentId,teamId,page=1){
    const list=opponentMatches(opponentId,teamId),bal=balance(list);
    const team=list[0]?.selection||selectionRows.find(x=>String(x.id)===String(teamId));
    const label='France';
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
    return `<article class="selection-player-tile rel-ref-tile rel-person-tile rel-staff-tile" data-staff-id="${esc(p.id)}">${referencePhotoHtml(p)}${referenceEditButton('staff',p)}<div class="rel-ref-head"><div><h3>${esc(p.display_name)}</h3><div class="subtitle">Sélectionneur${p.organization?` · ${esc(p.organization)}`:''}</div></div><span class="rel-result">${linked.length}</span></div>${(p.nationality||p.birth_date||p.death_date)?`<div class="rel-facts">${p.nationality?`<span>${flagImg(p.nationality)} ${esc(p.nationality)}</span>`:''}${p.birth_date?`<span>🎂 ${esc(fmtDate(p.birth_date))}</span>`:''}${p.death_date?`<span>🕯️ ${esc(fmtDate(p.death_date))}</span>`:''}</div>`:''}${relationSummaryHtml(bal,'Bilan comme sélectionneur')}<div class="rel-opponent-section-title">Sélections dirigées</div><div class="rel-opponent-sections">${teamTags||'<span class="rel-opponent-empty">Aucun match relié</span>'}</div><section class="staff-bestxi-shell"><button type="button" class="staff-bestxi-toggle" data-staff-bestxi-toggle="${esc(p.id)}"><span>⚽ ONZE TYPE</span><small>Reconstruction statistique des titularisations</small><b>＋</b></button><div class="staff-bestxi-host" data-staff-bestxi-host="${esc(p.id)}" hidden></div></section></article>`;
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
    const label='France';
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
    const label='France';
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
  function photoEditorHtml(row){const has=!!String(row?.photo_copyright_source||'').trim();return `<div class="rel-editor-photo-row"><div class="rel-editor-photo-preview" style="${referenceFrameStyle(row)}" data-rel-editor-photo-preview><div class="rel-entity-photo-inner">${referencePhotoUrl(row)?`<img src="${esc(referencePhotoUrl(row))}" alt="">${has?`<span class="photo-copyright-capsule">© ${esc(row.photo_copyright_source)}</span>`:''}`:`<span>${esc(initials(row.display_name||row.name||'?'))}</span>`}</div></div><div><label class="rel-editor-file">Photo<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label><label class="rel-editor-remove"><input type="checkbox" name="remove_photo" value="1"> Retirer la photo actuelle</label><label class="photo-copyright-toggle"><input type="checkbox" name="copyright_enabled" ${has?'checked':''}> Copyright</label><label class="photo-copyright-field" data-reference-copyright-field ${has?'':'hidden'}><span>©</span><input name="photo_copyright_source" maxlength="180" value="${esc(row.photo_copyright_source||'')}" placeholder="Source / photographe / agence"></label><small>PNG, JPG ou WebP · 5 Mo maximum.</small></div></div>`;}
  function openReferenceEditor(kind,id=null){
    if(!canEdit())return alert('Modification réservée aux ADMIN et SUPERADMIN.');
    const isNew=!id;
    let row=null;
    if(kind==='lieux')row=stadiumRows.find(x=>String(x.id)===String(id));
    else if(kind==='adversaires')row=opponentRows.find(x=>String(x.id)===String(id));
    else row=people.find(x=>String(x.id)===String(id));
    if(!row&&isNew)row={};
    if(!row)return;
    referenceEditorState={kind,id:id||null,row,isNew};
    const modal=ensureReferenceEditor(),form=$('#relReferenceEditorForm');
    const noun=kind==='lieux'?'stade':kind==='adversaires'?'adversaire':kind==='arbitres'?'arbitre':'sélectionneur';
    $('#relReferenceEditorTitle').textContent=`${isNew?'Ajouter':'Modifier'} un ${noun}`;
    if(kind==='lieux')form.innerHTML=`${photoEditorHtml(row)}<div class="rel-editor-grid"><label>Nom<input name="name" required maxlength="160" value="${esc(row.name||'')}"></label><label>Ville<input name="city" maxlength="120" value="${esc(row.city||'')}"></label><label>Capacité<input name="capacity" type="number" min="0" max="250000" value="${row.capacity??''}"></label><label>Année d’ouverture<input name="opened_year" type="number" min="1800" max="2100" value="${row.opened_year??''}"></label></div>${countryPickerHtml(row.country||'')}<label>Description courte<textarea name="description_short" rows="3" maxlength="500">${esc(row.description_short||'')}</textarea></label>${borderEditorHtml(row)}<div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-rel-editor-cancel>Annuler</button><button class="primary-btn" type="submit">${isNew?'Ajouter':'Enregistrer'}</button></div><div class="c3k-v8-status" data-rel-editor-status hidden></div>`;
    else if(kind==='adversaires')form.innerHTML=`<div class="rel-editor-grid"><label>Nom du pays / sélection<input name="name" required maxlength="160" value="${esc(row.name||'')}"></label><label>Code FIFA<input name="fifa_code" maxlength="3" value="${esc(row.fifa_code||'')}"></label><label>Confédération<input name="confederation" maxlength="40" value="${esc(row.confederation||'')}"></label><label>Continent<input name="continent" maxlength="80" value="${esc(row.continent||'')}"></label></div><label>Fédération<input name="federation_name" maxlength="180" value="${esc(row.federation_name||'')}"></label><div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-rel-editor-cancel>Annuler</button><button class="primary-btn" type="submit">${isNew?'Ajouter':'Enregistrer'}</button></div><div class="c3k-v8-status" data-rel-editor-status hidden></div>`;
    else form.innerHTML=`${photoEditorHtml(row)}<div class="rel-editor-grid"><label>Nom<input name="display_name" required maxlength="160" value="${esc(row.display_name||'')}"></label><label>Nationalité<input name="nationality" maxlength="100" value="${esc(row.nationality||'')}"></label><label>Date de naissance<input name="birth_date" type="date" value="${esc(row.birth_date||'')}"></label>${kind==='staff'?`<label>Date de décès<input name="death_date" type="date" value="${esc(row.death_date||'')}"><small>Laisser vide si la personne est vivante ou si la date est inconnue.</small></label>`:''}<label>Organisation<input name="organization" maxlength="160" value="${esc(row.organization||'')}"></label></div>${borderEditorHtml(row)}<div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-rel-editor-cancel>Annuler</button><button class="primary-btn" type="submit">${isNew?'Ajouter':'Enregistrer'}</button></div><div class="c3k-v8-status" data-rel-editor-status hidden></div>`;
    $('[data-rel-editor-cancel]',form)?.addEventListener('click',()=>{modal.hidden=true;referenceEditorState=null;});
    if(kind==='lieux')bindCountryPicker(form);
    const file=form.elements.photo,preview=$('[data-rel-editor-photo-preview]',form);file?.addEventListener('change',()=>{const f=file.files?.[0];if(!f||!preview)return;const url=URL.createObjectURL(f);preview.querySelector('.rel-entity-photo-inner').innerHTML=`<img src="${url}" alt="Aperçu">`;});form.elements.copyright_enabled?.addEventListener('change',e=>{const x=$('[data-reference-copyright-field]',form);if(x)x.hidden=!e.target.checked;});
    modal.hidden=false;
  }
  async function uploadReferencePhoto(kind,id,file){
    if(!file)return null;if(file.size>5*1024*1024)throw new Error('La photo dépasse 5 Mo.');const ext=(String(file.name||'').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const safe=['png','jpg','jpeg','webp'].includes(ext)?ext:'jpg';const path=`${kind}/${id}/${Date.now()}.${safe}`;const {error}=await client.storage.from('reference-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});if(error)throw error;return path;
  }
  async function saveReferenceEditor(e){
    e.preventDefault();if(!referenceEditorState||!client)return;const form=e.currentTarget,fd=new FormData(form),status=$('[data-rel-editor-status]',form);if(status){status.hidden=false;status.className='c3k-v8-status';status.textContent='Enregistrement…';}
    try{
      const {kind,id,isNew}=referenceEditorState,entityId=id||crypto.randomUUID();const birthDate=String(fd.get('birth_date')||'').trim(),deathDate=String(fd.get('death_date')||'').trim();if(kind!=='lieux'&&kind!=='adversaires'&&birthDate&&deathDate&&deathDate<birthDate)throw new Error('La date de décès ne peut pas être antérieure à la date de naissance.');
      const base={tile_border_appearance:String(fd.get('tile_border_appearance')||'gradient'),tile_border_color_start:String(fd.get('tile_border_color_start')||'#123B8F'),tile_border_color_end:String(fd.get('tile_border_color_end')||'#2F6DFF'),tile_border_width:Number(fd.get('tile_border_width')||3),tile_border_radius:Number(fd.get('tile_border_radius')||14),tile_border_gradient_angle:Number(fd.get('tile_border_gradient_angle')||135),photo_copyright_source:fd.get('copyright_enabled')==='on'?String(fd.get('photo_copyright_source')||'').trim()||null:null};
      const file=form.elements.photo?.files?.[0]||null;if(file)base.photo_path=await uploadReferencePhoto(kind,entityId,file);else if(fd.get('remove_photo')){base.photo_path=null;base.photo_copyright_source=null;if(kind!=='lieux')base.photo_url=null;}
      let table,payload;
      if(kind==='lieux'){
        table='places';payload={...base,place_type:'stadium',name:String(fd.get('name')||'').trim(),city:String(fd.get('city')||'').trim()||null,country:String(fd.get('country')||'').trim()||null,capacity:fd.get('capacity')===''?null:Number(fd.get('capacity')),opened_year:fd.get('opened_year')===''?null:Number(fd.get('opened_year')),description_short:String(fd.get('description_short')||'').trim()||null};
      }else if(kind==='adversaires'){
        table='opponents';payload={name:String(fd.get('name')||'').trim(),fifa_code:String(fd.get('fifa_code')||'').trim().toUpperCase()||null,confederation:String(fd.get('confederation')||'').trim()||null,continent:String(fd.get('continent')||'').trim()||null,federation_name:String(fd.get('federation_name')||'').trim()||null,active:true};
      }else{
        table='personnel';payload={...base,display_name:String(fd.get('display_name')||'').trim(),nationality:String(fd.get('nationality')||'').trim()||null,birth_date:String(fd.get('birth_date')||'').trim()||null,organization:String(fd.get('organization')||'').trim()||null,person_type:kind==='arbitres'?'arbitre':'selectionneur',active:true};if(kind==='staff')payload.death_date=String(fd.get('death_date')||'').trim()||null;
      }
      if(!payload.name&&!payload.display_name)throw new Error('Le nom est obligatoire.');
      const query=isNew?client.from(table).insert({id:entityId,...payload}):client.from(table).update(payload).eq('id',id);const {error}=await query;if(error)throw error;
      ensureReferenceEditor().hidden=true;referenceEditorState=null;invalidate();await load();window.BLEUS3000_EPHEMERIDE?.refresh?.().catch?.(()=>{});await render(kind,$('#referenceSearch')?.value||'');
    }catch(err){console.error('Édition référentiel',err);if(status){status.hidden=false;status.className='c3k-v8-status is-error';status.textContent=String(err?.message||err);}}
  }
  function bindReferenceEditors(host){$$('[data-rel-edit-kind]',host).forEach(b=>b.addEventListener('click',()=>openReferenceEditor(b.dataset.relEditKind,b.dataset.relEditId)));}

  function renderMainMatchPagination(total){const pages=Math.max(1,Math.ceil(total/MATCH_PAGE_SIZE));matchPage=Math.max(1,Math.min(matchPage,pages));if(total<=1)return '';return `<nav class="rel-match-main-pagination" aria-label="Pagination des matchs"><button type="button" data-match-main-page="${matchPage-1}" ${matchPage<=1?'disabled':''}>‹</button><span>Page ${matchPage} / ${pages}</span><button type="button" data-match-main-page="${matchPage+1}" ${matchPage>=pages?'disabled':''}>›</button></nav>`;}
  function bindMainMatchPagination(host){$$('[data-match-main-page]',host).forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;matchPage=Number(b.dataset.matchMainPage)||1;render('matchs',$('#referenceSearch')?.value||'');}));}

  async function render(kind,q=''){
    resetForeignUi();
    const host=$('#referenceEntries'),title=$('#referenceModalTitle'),sub=$('#referenceModalSub'),count=$('#referenceCount');
    if(!host)return;
    if(!loaded)host.innerHTML='<div class="selection-loading">Chargement du référentiel relationnel…</div>';
    try{
      await load();
      if(kind==='matchs'){
        renderMatchFilters();
        let list=matches.filter(m=>matchQuery(q,[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),String(getMatchNumber(m)||''),`match ${getMatchNumber(m)||''}`,m.provider]));
        list=applyMatchFilters(list);
        if(title)title.textContent='Matchs';if(sub)sub.textContent='Équipe de France · matchs terminés par défaut · une tuile par page';if(count)count.textContent=`${list.length} match${list.length>1?'s':''}`;
        const pages=Math.max(1,Math.ceil(list.length/MATCH_PAGE_SIZE));matchPage=Math.max(1,Math.min(matchPage,pages));const shown=list.slice((matchPage-1)*MATCH_PAGE_SIZE,matchPage*MATCH_PAGE_SIZE),pagination=renderMainMatchPagination(list.length);
        host.innerHTML=list.length?`${pagination}<div class="rel-ref-grid rel-match-grid">${shown.map(renderMatchCard).join('')}</div>${pagination}`:'<div class="universal-search-empty">Aucun match ne correspond aux filtres.</div>';
        bindMatchCards(host);bindMainMatchPagination(host);
        if(pendingMatchFocus){
          const targetId=pendingMatchFocus,openSheet=String(pendingMatchSheetFocus||'')===String(targetId);pendingMatchFocus=null;pendingMatchSheetFocus=null;
          requestAnimationFrame(()=>{const tile=$(`[data-match-id="${CSS.escape(String(targetId))}"]`,host);if(tile){tile.classList.add('is-target-match');tile.scrollIntoView({behavior:'smooth',block:'center'});if(openSheet){setTimeout(()=>{$('[data-match-sheet-panel]',tile)?.scrollIntoView({behavior:'smooth',block:'nearest'});},180);}setTimeout(()=>tile.classList.remove('is-target-match'),2600);}});
        }
      }else if(kind==='competitions'){
        renderRelFilters(kind);
        let list=competitionRows.filter(c=>matchQuery(q,[c.name,c.edition,c.selection_category,c.competition_type,c.status,tagsById.get(c.tag_id)?.label_text]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Compétitions';if(sub)sub.textContent='Entrées de compétition relationnelles · tags de familles partagés entre les éditions';if(count)count.textContent=`${list.length} compétition${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderCompetitionCard).join('')}</div>`:'<div class="universal-search-empty">Aucune compétition ne correspond aux filtres.</div>';bindCompetitionEditors(host);
      }else if(kind==='adversaires'){
        renderRelFilters(kind);
        let list=opponentRows.filter(o=>matchQuery(q,[o.name,o.fifa_code,o.confederation,o.continent,o.federation_name]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Adversaires';if(sub)sub.textContent='Sélections rencontrées · bilan calculé depuis les matchs · tags ouvrant les confrontations';if(count)count.textContent=`${list.length} adversaire${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderOpponentCard).join('')}</div>`:'<div class="universal-search-empty">Aucun adversaire ne correspond aux filtres.</div>';
        bindOpponentCards(host);bindReferenceEditors(host);applyOpponentCountrySearch(host);
      }else if(kind==='staff'){
        renderRelFilters(kind);
        let list=staffRows.filter(p=>matchQuery(q,[p.display_name,p.person_type,p.nationality,'sélectionneur','staff',...(p.linked_matches||[]).flatMap(m=>[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name')]) ]));list=applyRelFilters(kind,list);
        if(title)title.textContent='Sélectionneurs';if(sub)sub.textContent='Sélectionneurs de l’Équipe de France reliés aux matchs';if(count)count.textContent=`${list.length} sélectionneur${list.length>1?'s':''}`;
        host.innerHTML=list.length?`<div class="rel-ref-grid rel-staff-grid">${list.map(renderStaffCard).join('')}</div>`:'<div class="universal-search-empty">Aucun sélectionneur ne correspond aux filtres.</div>';
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
    const labels={matchs:'Matchs',competitions:'Compétitions',adversaires:'Adversaires',staff:'Sélectionneurs',arbitres:'Arbitres',lieux:'Stades'};
    const icons={matchs:'⚽',competitions:'🏆',adversaires:'🌍',staff:'👔',arbitres:'🟨',lieux:'🏟️'};
    return searchRegistry.filter(x=>matchQuery(q,[x.title,x.meta,...x.values])).slice(0,24).map(x=>({
      type:labels[x.kind]||'Référentiels',icon:icons[x.kind]||'▦',image:x.image||'',title:x.title,meta:x.meta,score:0.18,
      action:()=>{window.BLEUS3000_APP?.openReferences?.(x.kind);setTimeout(()=>{const i=$('#referenceSearch');if(i){i.value=x.title;i.dispatchEvent(new Event('input',{bubbles:true}));}},80);}
    }));
  }

  function getMatch(id){return matches.find(m=>String(m.id)===String(id))||null;}
  function getMainRefereeForMatch(id){
    const rel=officialRows.find(x=>String(x.match_id)===String(id)&&isMainRefereeRole(x.role));
    if(!rel)return null;
    return people.find(p=>String(p.id)===String(rel.person_id))||null;
  }
  function applyLocalOverride(id,manual_overrides){const m=getMatch(id);if(m){m.manual_overrides=manual_overrides||{};assignChronologicalMatchNumbers(matches,true);}}
  function invalidate(){loaded=false;matches=[];people=[];staffRows=[];refereeRows=[];officialRows=[];opponentRows=[];stadiumRows=[];competitionRows=[];competitionEntities=[];competitionEditions=[];searchRegistry=[];matchSheetCache.clear();}
  function openMatch(id,openSheet=false){
    Object.assign(matchFilters,{team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all',includeUpcoming:false});
    const target=getMatch(id);if(target&&!isFinishedReferenceMatch(target))matchFilters.includeUpcoming=true;const visible=applyMatchFilters(matches);const idx=visible.findIndex(m=>String(m.id)===String(id));matchPage=idx>=0?Math.floor(idx/MATCH_PAGE_SIZE)+1:1;
    pendingMatchFocus=id;pendingMatchSheetFocus=openSheet?id:null;
    window.BLEUS3000_APP?.openReferences?.('matchs');
  }
  function openMatchSheet(id){openMatch(id,true);}
  function openMatchGoal(matchId,goalId){pendingGoalFocus={matchId:String(matchId||''),goalId:String(goalId||'')};openMatch(matchId,true);}

  window.addEventListener('bleus:match-media-updated',e=>{const id=String(e.detail?.matchId||'');if(!id)return;matchSheetCache.delete(id);const panel=$(`[data-match-sheet-panel="${CSS.escape(id)}"]`);if(panel&&!panel.hidden)refreshMatchSheetPanel(id).catch(()=>{});});
  window.addEventListener('bleus:match-sheet-synced',e=>{const ids=Array.isArray(e.detail?.matchIds)?e.detail.matchIds:[];ids.forEach(id=>{matchSheetCache.delete(String(id));const panel=$(`[data-match-sheet-panel="${CSS.escape(String(id))}"]`);if(panel&&!panel.hidden)refreshMatchSheetPanel(id).catch(err=>console.warn('Actualisation feuille live',err));});const modal=$('#referenceModal');if(modal&&!modal.hidden&&norm($('#referenceModalTitle')?.textContent)==='matchs')render('matchs',$('#referenceSearch')?.value||'').catch(err=>console.warn('Actualisation tuiles matchs live',err));});

  window.BLEUS3000_RELATIONAL_REFS={
    render,load,search,getMatch,getMatchNumber,recalculateMatchNumbers:()=>assignChronologicalMatchNumbers(matches,true),getMainRefereeForMatch,openMatch,openMatchSheet,openMatchGoal,openMatchSheetEditor,openQuickMatchEvent,effective,baseValue,applyLocalOverride,invalidate,openNew:kind=>openReferenceEditor(kind,null),
    getTag:id=>tagsById.get(id)||null,
    getTags:()=>[...tagsById.values()],
    getSelections:()=>selectionRows.map(x=>({...x})),
    getCompetitions:()=>competitionRows.map(x=>({...x})),
    getCompetitionEntities:()=>competitionEntities.map(x=>({...x})),
    getCompetitionEditions:()=>competitionEditions.map(x=>({...x})),
    getOpponents:()=>opponentRows.map(x=>({...x})),
    getStadiums:()=>stadiumRows.map(x=>({...x})),
    getSectionTags:()=>{const ids=new Set(selectionRows.map(x=>x.team_tag_id).filter(Boolean));return [...tagsById.values()].filter(t=>t.is_active!==false&&(ids.has(t.id)||t.reference_scope==='selection'));},
    getCompetitionTags:()=>{const ids=new Set(competitionEntities.map(x=>x.competition_tag_id).filter(Boolean).map(String));return [...tagsById.values()].filter(t=>t.is_active!==false&&t.competition_tag_level!=='edition'&&(ids.has(String(t.id))||t.competition_tag_level==='entity'||(t.reference_scope==='competition'&&!t.parent_tag_id&&!String(t.slug||'').startsWith('competition-edition-'))));},
    getCompetitionEditionTags:()=>{const ids=new Set(competitionEditions.map(x=>x.edition_tag_id).filter(Boolean).map(String));return [...tagsById.values()].filter(t=>t.is_active!==false&&(ids.has(String(t.id))||t.competition_tag_level==='edition'));},
    get matches(){return matches;},get people(){return people;},get opponents(){return opponentRows;},get staff(){return staffRows;},get referees(){return refereeRows;},get stadiums(){return stadiumRows;}
  };
  window.addEventListener('bleus:supabase-ready',()=>{if(loaded||loading)return;load().catch(e=>console.warn('Référentiels · reprise Supabase',e));});
  load().catch(()=>{});
})();
