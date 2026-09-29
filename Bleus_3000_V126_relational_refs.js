/* 3615 Bleus V1.1.81 — Référentiels relationnels · édition compétitions */
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

  const matchFilters={team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all',includeUpcoming:false};
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
    competition_tag_id:m.competitionEntity?.competition_tag_id||m.competition?.tag_id||'',
    competition_edition_tag_id:m.competitionEdition?.edition_tag_id||''
  })[key];
  const effective=(m,key)=>Object.prototype.hasOwnProperty.call(overrides(m),key)?overrides(m)[key]:baseValue(m,key);
  const selectionLabel=()=> 'France A';
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
    if(!t)return `<span class="rel-tag-fallback">FRANCE A</span>`;
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
        client.from('matches').select('id,match_date,gender,selection_category,selection_team_id,home_away,france_score,opponent_score,status,notes_short,phase,spectators,lineup_status,source_calendar_url,source_detail_url,opponent_id,competition_id,competition_edition_id,place_id,coach_id,external_ids,broadcast_text,broadcast_url,provider,provider_fixture_id,provider_updated_at,data_state,api_payload,manual_overrides,feature_frame_mode,homepage_pinned,homepage_pinned_at,homepage_pinned_by,sheet_validation_status,sheet_validated_at,sheet_validation_revision,sheet_stadium_name,sheet_referee_name,sheet_coach_name,sheet_competition_name,sheet_competition_family_id').eq('gender','M').eq('selection_category','A').order('match_date',{ascending:false}).limit(5000),
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
      try{const [fpRes,cfRes]=await Promise.all([client.from('football_positions').select('id,slug,label_text,aliases,sort_order').order('sort_order'),client.from('competition_families').select('id,slug,name,competition_type,sort_order').order('sort_order')]);footballPositions=fpRes.data||[];competitionFamilies=cfRes.data||[];}catch(err){console.warn('Postes / familles compétitions',err);}
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
      staffRows=buildStaffRows();
      refereeRows=buildRefereeRows();

      const d=window.BLEUS3000_DATA;
      if(d?.references){
        const counts={matchs:String(matches.length),competitions:String(competitionRows.length),adversaires:String(opponentRows.length),staff:String(staffRows.length),arbitres:String(refereeRows.length),lieux:String(stadiumRows.length)};
        for(const [key,value] of Object.entries(counts)){const r=d.references.find(x=>x.key===key);if(r)r.count=value;}
      }

      searchRegistry=[
        ...matches.map(m=>({kind:'matchs',id:m.id,title:`${selectionLabel(m)} - ${effective(m,'opponent_name')||'Adversaire'}`,meta:`${fmtDate(effective(m,'match_date'))} · ${effective(m,'competition_name')||selectionLabel(m)}`,image:m.opponent?.flag_url||m.opponent?.federation_logo_url||'',values:[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),m.provider]})),
        ...competitionRows.map(c=>({kind:'competitions',id:c.id,title:c.name,meta:[c.edition,c.selection_category,c.gender==='F'?'Féminin':c.gender==='M'?'Masculin':''].filter(Boolean).join(' · '),image:c.logo_url||'',values:[c.name,c.edition,c.selection_category,c.competition_type,c.status,tagsById.get(c.tag_id)?.label_text]})),
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
    bar.innerHTML=`<span class="tag-badge">France A masculine</span><select data-match-filter="competition">${option('all','Toutes les compétitions',matchFilters.competition)}${comps.map(v=>option(v,v,matchFilters.competition)).join('')}</select><select data-match-filter="year">${option('all','Toutes les années',matchFilters.year)}${years.map(v=>option(String(v),String(v),matchFilters.year)).join('')}</select><select data-match-filter="result">${option('all','Tous les résultats',matchFilters.result)}${option('V','Victoires',matchFilters.result)}${option('N','Nuls',matchFilters.result)}${option('D','Défaites',matchFilters.result)}${option('—','Sans score',matchFilters.result)}</select><select data-match-filter="stadium">${option('all','Tous les stades',matchFilters.stadium)}${stadiums.map(([v,l])=>option(v,l,matchFilters.stadium)).join('')}</select><select data-match-filter="coach">${option('all','Tous les sélectionneurs',matchFilters.coach)}${coaches.map(([v,l])=>option(v,l,matchFilters.coach)).join('')}</select><select data-match-filter="sheet">${option('all','Toutes les feuilles',matchFilters.sheet)}${option('yes','Feuille renseignée',matchFilters.sheet)}${option('no','Feuille à compléter',matchFilters.sheet)}</select><label class="match-finished-only-filter"><input type="checkbox" data-match-include-upcoming ${matchFilters.includeUpcoming?'checked':''}><span>Afficher les prochains matchs</span></label><button type="button" class="reference-filter-reset" data-match-filter-reset>Réinitialiser</button>`;
    bar.querySelector('[data-match-filter-reset]')?.addEventListener('click',()=>{Object.assign(matchFilters,{team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all',includeUpcoming:false});matchPage=1;render('matchs',$('#referenceSearch')?.value||'');});
  }
  function hideMatchFilters(){const bar=$('#matchReferenceFilters');if(bar)bar.hidden=true;}
  function isFinishedReferenceMatch(m){const status=String(m?.status||'').toUpperCase();if(['FT','AET','PEN'].includes(status))return true;const d=parseDate(effective(m,'match_date'))?.getTime()||0,a=effective(m,'france_score'),b=effective(m,'opponent_score'),hasScore=a!==null&&a!==undefined&&a!==''&&b!==null&&b!==undefined&&b!=='';return d>0&&d<Date.now()&&hasScore;}
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
      if(!matchFilters.includeUpcoming&&!isFinishedReferenceMatch(m))return false;
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
      renderFacetBar(kind,`<span class="tag-badge">France A masculine</span><label>Type<select data-rel-filter="type">${option('all','Tous les types',f.type)}${types.map(v=>option(v,v,f.type)).join('')}</select></label><label>Statut<select data-rel-filter="status">${option('all','Tous les statuts',f.status)}${statuses.map(v=>option(v,v,f.status)).join('')}</select></label>`);
    }else if(kind==='adversaires'){
      const f=relFilters.adversaires;
      const confs=uniqueSorted(opponentRows.map(o=>o.confederation));
      const continents=uniqueSorted(opponentRows.map(o=>o.continent));
      const teams=teamOptionsFromMatches(matches);
      renderFacetBar(kind,`<label class="reference-filter-search">Pays<input type="search" data-rel-country-search value="${esc(f.countryQuery||'')}" placeholder="Rechercher un pays…" autocomplete="off"></label><label>Confédération<select data-rel-filter="confederation">${option('all','Toutes les confédérations',f.confederation)}${confs.map(v=>option(v,v,f.confederation)).join('')}</select></label><label>Continent<select data-rel-filter="continent">${option('all','Tous les continents',f.continent)}${continents.map(v=>option(v,v,f.continent)).join('')}</select></label><label>Périmètre<select data-rel-filter="team">${option('all','France A masculine',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label>`);
    }else if(kind==='staff'){
      const f=relFilters.staff;
      const linked=staffRows.flatMap(p=>p.linked_matches||[]),teams=teamOptionsFromMatches(linked),nations=uniqueSorted(staffRows.map(p=>p.nationality));
      renderFacetBar(kind,`<span class="tag-badge">France A masculine</span><label>Nationalité<select data-rel-filter="nationality">${option('all','Toutes les nationalités',f.nationality)}${nations.map(v=>option(v,v,f.nationality)).join('')}</select></label>`);
    }else if(kind==='arbitres'){
      const f=relFilters.arbitres;
      const linked=refereeRows.flatMap(p=>p.linked_matches||[]),teams=teamOptionsFromMatches(linked),nations=uniqueSorted(refereeRows.map(p=>p.nationality));
      const years=[...new Set(linked.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
      renderFacetBar(kind,`<label>Nationalité<select data-rel-filter="nationality">${option('all','Toutes les nationalités',f.nationality)}${nations.map(v=>option(v,v,f.nationality)).join('')}</select></label><label>Périmètre<select data-rel-filter="team">${option('all','France A masculine',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Année<select data-rel-filter="year">${option('all','Toutes les années',f.year)}${years.map(v=>option(String(v),String(v),f.year)).join('')}</select></label>`);
    }else if(kind==='lieux'){
      const f=relFilters.lieux;
      const stadiumIds=new Set(stadiumRows.map(v=>String(v.id)));
      const linked=matches.filter(m=>stadiumIds.has(String(m.place_id))),teams=teamOptionsFromMatches(linked);
      const countries=uniqueSorted(stadiumRows.map(v=>v.country)),cities=uniqueSorted(stadiumRows.map(v=>v.city));
      const years=[...new Set(linked.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
      renderFacetBar(kind,`<label class="reference-filter-search">Recherche pays<input type="search" data-rel-stadium-country-search value="${esc(f.countryQuery||'')}" placeholder="Rechercher un pays…" autocomplete="off"></label><label>Pays<select data-rel-filter="country">${option('all','🌍 Tous les pays',f.country)}${countries.map(v=>option(v,countryOptionLabel(v),f.country)).join('')}</select></label><label>Ville<select data-rel-filter="city">${option('all','Toutes les villes',f.city)}${cities.map(v=>option(v,v,f.city)).join('')}</select></label><label>Périmètre<select data-rel-filter="team">${option('all','France A masculine',f.team)}${teams.map(([v,l])=>option(v,l,f.team)).join('')}</select></label><label>Année<select data-rel-filter="year">${option('all','Toutes les années',f.year)}${years.map(v=>option(String(v),String(v),f.year)).join('')}</select></label>`);
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
    const placeSearch=effective(m,'venue_name')||m.place?.name||effective(m,'city')||'';
    return `<article class="rel-ref-tile rel-match-tile" data-match-id="${esc(m.id)}"><div class="rel-ref-head rel-ref-head-match"><div><small>${esc(fmtDateLong(effective(m,'match_date')))}</small><div class="rel-match-board-wrap">${matchScoreline(left,right,score,score==='VS',m.id)}<div class="rel-match-team-names"><span>${esc(left)}</span><span>${esc(right)}</span></div></div><div class="subtitle">${esc(comp)}${m.phase?` · ${esc(m.phase)}`:''}</div></div><span class="rel-result ${scoreClass(m)}">${resultLetter(m)}</span></div><div class="rel-facts">${place?`<button type="button" class="rel-fact-link" data-match-place-search="${esc(placeSearch)}">🏟 ${esc(place)}</button>`:''}${m.coach?.display_name?`<span>👔 ${esc(m.coach.display_name)}</span>`:''}${m.spectators?`<span>👥 ${Number(m.spectators).toLocaleString('fr-FR')}</span>`:''}${effective(m,'broadcast_text')?(window.BLEUS3000_BROADCASTS?.renderText?.(effective(m,'broadcast_text'))||`<span>📺 ${esc(effective(m,'broadcast_text'))}</span>`):''}</div><div class="rel-match-bottom"><div class="rel-tags">${chipForMatch(m)}${competitionChipForMatch(m)}</div><div class="rel-match-actions"><button class="rel-match-sheet-toggle" type="button" data-match-sheet-toggle="${esc(m.id)}" aria-expanded="false"><span class="match-sheet-pitch-icon" aria-hidden="true"><i></i></span><span>Feuille de match</span></button>${canEdit()?`<button class="rel-quick-event-btn" type="button" data-match-quick-event="${esc(m.id)}" title="Ajouter rapidement un fait de jeu">＋ Fait de jeu</button><button class="rel-edit-match" type="button" data-calendar-edit="${esc(m.id)}">✎ Modifier</button>`:''}</div></div><div class="rel-match-sheet-panel" data-match-sheet-panel="${esc(m.id)}" hidden></div></article>`;
  }

  const registryPlayers=()=>window.BLEUS3000_PLAYER_REGISTRY_ALL||window.BLEUS3000_PLAYER_REGISTRY||[];
  const minuteRank=v=>{const s=String(v||'').trim();const m=s.match(/(\d+)(?:\s*\+\s*(\d+))?/);return m?Number(m[1])*100+Number(m[2]||0):999999;};
  const playerCardIcon=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="10" r="2"></circle><path d="M6.5 16c.7-2 4.3-2 5 0M14 9h3M14 13h3"></path></svg>`;
  const openPlayerIcon=id=>id?`<button class="match-sheet-player-link" type="button" data-open-match-player="${esc(id)}" title="Ouvrir la tuile joueur" aria-label="Ouvrir la tuile joueur">${playerCardIcon()}</button>`:'';
  function openMatchPlayer(id){if(!id)return;window.BLEUS3000_PLAYERS_DB?.openPlayer?.(id);}

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
      const players=ids.length?await fetchIn('players','id,display_name,primary_position,photo_path',ids):[];const pm=new Map(players.map(x=>[String(x.id),x]));
      let jersey=null;try{jersey=await window.BLEUS3000_JERSEYS?.getMatchJersey?.(matchId)||null;}catch(err){console.warn('Feuille de match · maillot',err);}
      return {
        appearances:appearances.map(x=>({...x,player:pm.get(String(x.player_id))||null,replaced_by_player:pm.get(String(x.replaced_by_player_id))||null})),
        goals:goals.map(x=>({...x,player:pm.get(String(x.player_id))||null,assist_player:pm.get(String(x.assist_player_id))||null})).sort((a,b)=>minuteRank(a.minute_text)-minuteRank(b.minute_text)),
        cards:cards.map(x=>({...x,player:pm.get(String(x.player_id))||null})).sort((a,b)=>minuteRank(a.minute_text)-minuteRank(b.minute_text)),
        jersey,
        media
      };
    })();
    matchSheetCache.set(String(matchId),promise);
    try{const sheet=await promise;matchSheetCache.set(String(matchId),sheet);return sheet;}catch(e){matchSheetCache.delete(String(matchId));throw e;}
  }
  function matchSheetPlayerRow(r,jersey=null){
    const p=r.player||{},name=p.display_name||r.player_name||'Joueur',shirt=Number.isInteger(Number(r.shirt_number))?String(Number(r.shirt_number)):'—';
    const markers=[r.captain?'C':'',Number(r.goals)>0?`⚽×${Number(r.goals)}`:'',Number(r.assists)>0?`➜×${Number(r.assists)}`:'',Number(r.yellow_cards)>0?'🟨':'',Number(r.red_cards)>0?'🟥':''].filter(Boolean).join(' ');
    const replacedBy=r.replaced_by_player?.display_name||r.replaced_by_name||'';
    return `<div class="match-sheet-player"><b class="match-sheet-shirt-dot" style="${formationMarkerInlineStyle(jersey)}">${esc(shirt)}</b><span><strong>${esc(name)}</strong>${replacedBy?`<small>↪ remplacé par ${esc(replacedBy)}</small>`:''}</span><div class="match-sheet-player-actions">${markers?`<em>${esc(markers)}</em>`:''}${openPlayerIcon(r.player_id)}</div></div>`;
  }
  function matchMediaAssetUrl(x){if(x?.image_url)return x.image_url;if(x?.image_path&&client)try{return client.storage.from('reference-photos').getPublicUrl(x.image_path).data.publicUrl||'';}catch{}return '';}
  function matchSheetMediaStrip(media=[]){
    const order=[['newspaper_front','🗞','Une de journal'],['ball','⚽','Ballon du match'],['youtube','▶','YouTube'],['ticket','🎟','Billet du match']];
    return `<div class="match-sheet-media-strip" aria-label="Médias du match">${order.map(([type,icon,label])=>{const x=media.find(a=>a.asset_type===type),img=x&&type!=='youtube'?(matchMediaAssetUrl(x)||x.url||''):'',href=x?(x.url||img||''):'';const zoomable=type==='newspaper_front'||type==='ball',staticVisual=zoomable||type==='ticket';const inner=img?`<img src="${esc(img)}" alt="${esc(x?.title||label)}" loading="lazy">`:`<span class="match-sheet-media-icon is-${type}">${icon}</span>`;if(!x)return `<span class="match-sheet-media-slot is-empty is-${type}${zoomable?' is-zoomable':''}" data-match-sheet-zoom="${zoomable?esc(type):''}" title="${esc(label)} non renseigné">${inner}</span>`;if(staticVisual)return `<span class="match-sheet-media-slot is-active is-${type}${zoomable?' is-zoomable':''}" data-match-sheet-zoom="${zoomable?esc(type):''}" title="${esc(x.title||label)}">${inner}</span>`;return href?`<a class="match-sheet-media-slot is-active is-${type}" href="${esc(href)}" rel="noopener noreferrer" title="${esc(x.title||label)}">${inner}</a>`:`<span class="match-sheet-media-slot is-active is-${type}" title="${esc(x.title||label)}">${inner}</span>`;}).join('')}</div>`;
  }
  function matchEventPlayerName(player,name){return player?.display_name||name||'Joueur non renseigné';}
  function matchEventGoalRow(g){
    const scorer=matchEventPlayerName(g.player,g.scorer_name),assist=matchEventPlayerName(g.assist_player,g.assist_name),hasAssist=!!String(g.assist_player?.display_name||g.assist_name||'').trim();
    const typeLabel=g.goal_type==='header'?' · tête':g.goal_type==='free_kick'?' · coup franc':g.goal_type==='penalty'||g.is_penalty?' · penalty':'';
    return `<div class="match-event-row is-goal"><div class="match-event-minute">${g.minute_text?esc(g.minute_text)+"'":'—'}</div><span class="match-event-kind-icon is-goal" title="But"><span class="match-event-icon-ball" aria-hidden="true"></span></span><div class="match-event-main"><strong>${esc(scorer)}</strong>${hasAssist?`<small class="match-event-assist"><span class="match-event-kind-icon is-assist-inline" aria-hidden="true"><span class="match-event-arrow"></span></span><em>Passe décisive : ${esc(assist)}</em>${openPlayerIcon(g.assist_player_id)}</small>`:''}<small>${esc(g.team_name||'')}${g.score_after?` · score ${esc(g.score_after)}`:''}${typeLabel}</small></div>${openPlayerIcon(g.player_id)}</div>`;
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
    const composition=(rows.length||unmatched.length)?`<div class="match-sheet-columns"><section><h4>Titulaires · ${starters.length}</h4><div class="match-sheet-list">${starters.map(r=>matchSheetPlayerRow(r,jersey)).join('')||'<span class="match-sheet-none">Non renseignés</span>'}</div></section><section><h4>Remplaçants / groupe · ${others.length}</h4><div class="match-sheet-list">${others.map(r=>matchSheetPlayerRow(r,jersey)).join('')||'<span class="match-sheet-none">Non renseignés</span>'}</div></section></div>${providerExtra}`:`<div class="match-sheet-empty"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Composition non renseignée</strong><small>Aucune apparition n’est encore enregistrée dans match_appearances pour cette rencontre.</small></div></div>`;
    const jerseyHtml=jersey?`<div class="match-sheet-current-jersey is-zoomable" data-match-sheet-zoom="jersey" title="Maillot utilisé">${jersey.photo?`<img src="${esc(jersey.photo)}" alt="Maillot utilisé" loading="lazy">`:'<span class="match-sheet-current-jersey-placeholder">👕</span>'}</div>`:'';
    const validationStatus=String(m.sheet_validation_status||'draft'),validationLabel=validationStatus==='validated'?'✓ Validée':validationStatus==='needs_validation'?'À revalider':'Brouillon';
    return `<div class="match-sheet-head"><span class="match-sheet-pitch-icon is-large" aria-hidden="true"><i></i></span><div><strong>Feuille de match</strong><small>${esc(m.lineup_status||`${rows.length} joueur${rows.length>1?'s':''} renseigné${rows.length>1?'s':''}`)}</small></div><span class="match-sheet-validation-badge is-${esc(validationStatus)}">${esc(validationLabel)}</span>${canEdit()?`<button type="button" class="match-sheet-edit-btn" data-match-sheet-edit="${esc(m.id)}">⚙ Modifier la feuille</button>`:''}</div><div class="match-sheet-kit-media-row">${jerseyHtml}${matchSheetMediaStrip(sheet.media||[])}</div><div class="match-sheet-single-pane">${composition}<section class="match-sheet-facts-inline"><h3>Faits de match</h3>${renderMatchFacts(sheet,m)}</section></div>`;
  }
  function ensureMatchSheetHoverZoom(){let z=$('#matchSheetHoverZoom');if(z)return z;z=document.createElement('div');z.id='matchSheetHoverZoom';z.className='match-sheet-hover-zoom';z.hidden=true;z.innerHTML='<img alt="Aperçu agrandi">';document.body.appendChild(z);return z;}
  function positionMatchSheetHoverZoom(e,z){const pad=18,w=z.offsetWidth||280,h=z.offsetHeight||280;let x=e.clientX+pad,y=e.clientY+pad;if(x+w>window.innerWidth-8)x=Math.max(8,e.clientX-w-pad);if(y+h>window.innerHeight-8)y=Math.max(8,e.clientY-h-pad);z.style.left=`${x}px`;z.style.top=`${y}px`;}
  document.addEventListener('pointerover',e=>{const host=e.target.closest?.('[data-match-sheet-zoom]');const img=host?.querySelector?.('img');if(!host||!img)return;const z=ensureMatchSheetHoverZoom(),zi=$('img',z);zi.src=img.currentSrc||img.src;zi.alt=img.alt||'Aperçu agrandi';z.className=`match-sheet-hover-zoom is-${host.dataset.matchSheetZoom||'visual'}`;z.hidden=false;positionMatchSheetHoverZoom(e,z);});
  document.addEventListener('pointermove',e=>{const z=$('#matchSheetHoverZoom');if(z&&!z.hidden)positionMatchSheetHoverZoom(e,z);});
  document.addEventListener('pointerout',e=>{const host=e.target.closest?.('[data-match-sheet-zoom]');if(!host)return;const next=e.relatedTarget;if(next&&host.contains(next))return;const z=$('#matchSheetHoverZoom');if(z)z.hidden=true;});
  function bindMatchSheetPanel(panel,matchId,sheet,m){
    $$('[data-open-match-player]',panel).forEach(btn=>{if(btn.dataset.playerOpenBound==='1')return;btn.dataset.playerOpenBound='1';btn.addEventListener('click',e=>{e.stopPropagation();openMatchPlayer(btn.dataset.openMatchPlayer);});});
    const edit=$('[data-match-sheet-edit]',panel);if(edit&&edit.dataset.directSheetEditBound!=='1'){edit.dataset.directSheetEditBound='1';edit.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handleMatchSheetEditClick(edit);});}
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
    $$('[data-match-sheet-toggle]',host).forEach(btn=>btn.addEventListener('click',async()=>{
      const card=btn.closest('.rel-match-tile'),panel=$('[data-match-sheet-panel]',card);if(!card||!panel)return;
      const opening=panel.hidden;panel.hidden=!opening;btn.setAttribute('aria-expanded',opening?'true':'false');btn.classList.toggle('is-active',opening);if(!opening)return;
      if(panel.dataset.loaded==='1')return;panel.innerHTML='<div class="match-sheet-loading">Chargement de la feuille de match…</div>';
      try{const m=matches.find(x=>String(x.id)===String(btn.dataset.matchSheetToggle));const sheet=await loadMatchSheet(btn.dataset.matchSheetToggle);panel.innerHTML=renderMatchSheet(sheet,m||{});panel.dataset.loaded='1';bindMatchSheetPanel(panel,btn.dataset.matchSheetToggle,sheet,m||{});}
      catch(e){panel.innerHTML=`<div class="match-sheet-empty"><strong>Feuille de match indisponible</strong><small>${esc(e?.message||e)}</small></div>`;}
    }));
    $$('[data-match-quick-event]',host).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openQuickMatchEvent(btn.dataset.matchQuickEvent);}));
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
      <label class="match-sheet-editor-check"><input data-appearance-captain type="checkbox" ${r.captain?'checked':''}> C</label>
      <label class="match-sheet-editor-check is-replacement"><input data-appearance-replaced type="checkbox" ${hasReplacement?'checked':''}> ↪</label>
      <input class="match-sheet-editor-replacement ${hasReplacement?'':'is-hidden'}" data-appearance-replacement list="matchSheetPlayerList" placeholder="Remplacé par…" value="${esc(replName)}">
      ${locked?'<span class="match-sheet-editor-slot-lock" title="Emplacement de base">•</span>':'<button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button>'}
    </div>`;
  }
  function goalEditorRow(g={},m={}){const team=g.player_id||norm(g.team_name)==='france'?'france':'opponent',scorer=g.player?.display_name||g.scorer_name||'',assist=g.assist_player?.display_name||g.assist_name||'',goalType=g.goal_type||(g.is_penalty?'penalty':'open_play');return `<div class="match-sheet-editor-event-row" data-editor-goal data-event-id="${esc(g.id||'')}" data-original-player-id="${esc(g.player_id||'')}" data-original-assist-id="${esc(g.assist_player_id||'')}"><select data-goal-team><option value="france" ${team==='france'?'selected':''}>France</option><option value="opponent" ${team==='opponent'?'selected':''}>Adversaire</option></select><input data-goal-scorer list="matchSheetPlayerList" placeholder="Buteur" value="${esc(scorer)}"><input data-goal-minute placeholder="Minute" value="${esc(g.minute_text||'')}"><input data-goal-score placeholder="Score après" value="${esc(g.score_after||'')}"><select data-goal-type><option value="open_play" ${goalType==='open_play'?'selected':''}>Jeu</option><option value="header" ${goalType==='header'?'selected':''}>Tête</option><option value="free_kick" ${goalType==='free_kick'?'selected':''}>Coup franc</option><option value="penalty" ${goalType==='penalty'?'selected':''}>Penalty</option><option value="other" ${goalType==='other'?'selected':''}>Autre</option></select><input data-goal-assist list="matchSheetPlayerList" placeholder="Passeur décisif (facultatif)" value="${esc(assist)}"><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function cardEditorRow(c={}){const team=c.player_id||norm(c.team_name)==='france'?'france':'opponent',name=c.player?.display_name||c.player_name||'';return `<div class="match-sheet-editor-event-row is-card" data-editor-card data-event-id="${esc(c.id||'')}" data-original-player-id="${esc(c.player_id||'')}"><select data-card-team><option value="france" ${team==='france'?'selected':''}>France</option><option value="opponent" ${team==='opponent'?'selected':''}>Adversaire</option></select><input data-card-player list="matchSheetPlayerList" placeholder="Joueur" value="${esc(name)}"><select data-card-type><option value="yellow" ${c.card_type!=='red'&&c.card_type!=='second_yellow'?'selected':''}>Jaune</option><option value="second_yellow" ${c.card_type==='second_yellow'?'selected':''}>2e jaune</option><option value="red" ${c.card_type==='red'?'selected':''}>Rouge</option></select><input data-card-minute placeholder="Minute" value="${esc(c.minute_text||'')}"><button type="button" class="match-sheet-editor-remove" data-remove-editor-row title="Retirer">×</button></div>`;}
  function ensureMatchSheetEditor(){
    let modal=$('#matchSheetEditorModal');if(modal)return modal;
    modal=document.createElement('div');modal.className='modal-backdrop match-sheet-editor-modal';modal.id='matchSheetEditorModal';modal.hidden=true;
    modal.innerHTML=`<section class="modal-dialog match-sheet-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="matchSheetEditorTitle"><header class="modal-head"><div><h2 id="matchSheetEditorTitle">Modifier la feuille de match</h2><p id="matchSheetEditorMeta">Composition et faits de match</p></div><button class="modal-close" data-match-sheet-editor-close type="button">×</button></header><div class="modal-body">
      <datalist id="matchSheetPlayerList"></datalist><datalist id="matchSheetStadiumList"></datalist><datalist id="matchSheetPersonnelList"></datalist><datalist id="matchSheetCompetitionList"></datalist>
      <section class="match-sheet-editor-context"><div class="match-sheet-editor-context-grid"><label>Stade<input id="matchSheetStadium" list="matchSheetStadiumList" placeholder="Nom libre accepté"></label><label>Arbitre principal<input id="matchSheetReferee" list="matchSheetPersonnelList" placeholder="Nom libre accepté"></label><label>Sélectionneur<input id="matchSheetCoach" list="matchSheetPersonnelList" placeholder="Nom libre accepté"></label><label>Compétition<input id="matchSheetCompetition" list="matchSheetCompetitionList" placeholder="Ex. Ligue des Nations de l’UEFA"></label><label>Édition canonique<select id="matchSheetCompetitionEdition"><option value="">— édition non définie —</option></select><small>Le tag édition sert aux liens, filtres et statistiques.</small></label><label>Entité principale<select id="matchSheetCompetitionFamily"><option value="">— si nouvelle compétition —</option></select><small>Obligatoire uniquement pour créer une nouvelle compétition.</small></label></div></section>
      <section data-match-sheet-editor-pane="composition"><div class="match-sheet-editor-help">Enregistrer conserve un brouillon. Valider la feuille synchronise ensuite les statistiques.</div>
      <div class="match-sheet-jersey-picker"><label><span>Maillot utilisé par la France</span><select id="matchSheetEditorJersey"><option value="">Chargement des maillots…</option></select></label><div class="match-sheet-jersey-preview" id="matchSheetEditorJerseyPreview"><span>👕</span><small>Aucun maillot associé</small></div></div>
      <div class="match-sheet-editor-roster-section"><div class="match-sheet-roster-title"><strong>Titulaires</strong><span>11</span></div><div class="match-sheet-editor-lineup-head"><span>#</span><span>Joueur</span><span>N°</span><span>Poste</span><span>Min.</span><span>C</span><span>Rempl.</span><span>Remplacé par</span><span></span></div><div id="matchSheetEditorStarters"></div></div>
      <div class="match-sheet-editor-roster-section"><div class="match-sheet-roster-title"><strong>Remplaçants</strong><span id="matchSheetSubCount">12</span></div><div class="match-sheet-editor-lineup-head"><span>#</span><span>Joueur</span><span>N°</span><span>Poste</span><span>Min.</span><span>C</span><span>Rempl.</span><span>Remplacé par</span><span></span></div><div id="matchSheetEditorSubstitutes"></div><button type="button" class="secondary-btn match-sheet-editor-add" data-add-substitute>＋ Ajouter un remplaçant</button></div>
      <section class="match-sheet-editor-events-inline" data-match-sheet-events-editor><div class="match-sheet-editor-help">Faits de match : ils restent modifiables en brouillon et ne mettent les statistiques à jour qu’au clic sur « Valider la feuille ».</div><div class="match-sheet-editor-event-head"><h3>⚽ Buts</h3><button type="button" class="secondary-btn" data-add-goal>＋ Ajouter un but</button></div><div class="match-sheet-editor-event-labels goal"><span>Équipe</span><span>Buteur</span><span>Minute</span><span>Score</span><span>Type</span><span>Passeur décisif</span><span></span></div><div id="matchSheetEditorGoals"></div><div class="match-sheet-editor-event-head"><h3>Cartons</h3><button type="button" class="secondary-btn" data-add-card>＋ Ajouter un carton</button></div><div class="match-sheet-editor-event-labels card"><span>Équipe</span><span>Joueur</span><span>Carton</span><span>Minute</span><span></span></div><div id="matchSheetEditorCards"></div></section></section>
      <div class="match-sheet-editor-status" id="matchSheetEditorStatus" hidden></div><div class="match-sheet-editor-actions"><button class="secondary-btn" type="button" data-match-sheet-editor-close>Annuler</button><button class="secondary-btn" type="button" data-match-sheet-editor-save>Enregistrer la feuille</button><button class="primary-btn match-sheet-validate-btn" type="button" data-match-sheet-editor-validate>✓ Valider la feuille</button></div>
      </div></section>`;document.body.appendChild(modal);
    $$('[data-match-sheet-editor-close]',modal).forEach(b=>b.addEventListener('click',()=>{modal.hidden=true;matchSheetEditorState=null;}));
    $('[data-add-substitute]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorSubstitutes',modal);if(!h)return;const slot=$$('[data-editor-appearance][data-lineup-kind="substitute"]',h).length+1;h.insertAdjacentHTML('beforeend',appearanceEditorRow(blankLineupRow(false,slot),{starter:false,slot,locked:false}));const c=$('#matchSheetSubCount',modal);if(c)c.textContent=String(slot);if(matchSheetEditorState)matchSheetEditorState.compositionDirty=true;});
    $('[data-add-goal]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorGoals',modal);h?.insertAdjacentHTML('beforeend',goalEditorRow({},matchSheetEditorState?.match||{}));if(matchSheetEditorState)matchSheetEditorState.eventsDirty=true;});
    $('[data-add-card]',modal)?.addEventListener('click',()=>{const h=$('#matchSheetEditorCards',modal);h?.insertAdjacentHTML('beforeend',cardEditorRow({}));if(matchSheetEditorState)matchSheetEditorState.eventsDirty=true;});
    modal.addEventListener('click',e=>{const b=e.target.closest('[data-remove-editor-row]');if(b){const row=b.closest('[data-editor-appearance],[data-editor-goal],[data-editor-card]');if(row?.hasAttribute('data-editor-appearance')){matchSheetEditorState.compositionDirty=true;row?.remove();const subs=$$('[data-editor-appearance][data-lineup-kind="substitute"]',$('#matchSheetEditorSubstitutes',modal));subs.forEach((x,i)=>{x.dataset.lineupSlot=String(i+1);const badge=$('.match-sheet-lineup-slot',x);if(badge)badge.textContent=String(i+1);});const c=$('#matchSheetSubCount',modal);if(c)c.textContent=String(subs.length);}else{matchSheetEditorState.eventsDirty=true;row?.remove();}return;}const repl=e.target.closest('[data-appearance-replaced]');if(repl){const row=repl.closest('[data-editor-appearance]'),input=$('[data-appearance-replacement]',row);if(input){input.classList.toggle('is-hidden',!repl.checked);if(!repl.checked)input.value='';}matchSheetEditorState.compositionDirty=true;}});
    const markDirty=e=>{if(!matchSheetEditorState)return;if(e.target.closest('[data-match-sheet-events-editor]'))matchSheetEditorState.eventsDirty=true;else matchSheetEditorState.compositionDirty=true;};modal.addEventListener('input',markDirty);modal.addEventListener('change',e=>{if(!matchSheetEditorState)return;if(e.target.id==='matchSheetCompetitionEdition'){const ed=competitionEditions.find(x=>String(x.id)===String(e.target.value||'')),entity=ed?competitionEntities.find(x=>String(x.id)===String(ed.competition_entity_id)):null,compInput=$('#matchSheetCompetition',modal);if(entity&&compInput)compInput.value=entity.name;}markDirty(e);});
    $('[data-match-sheet-editor-save]',modal)?.addEventListener('click',()=>saveMatchSheetEditor(false));$('[data-match-sheet-editor-validate]',modal)?.addEventListener('click',validateMatchSheetEditor);return modal;
  }
  async function populateMatchSheetJerseyPicker(modal,state){
    const select=$('#matchSheetEditorJersey',modal),preview=$('#matchSheetEditorJerseyPreview',modal);if(!select)return;
    select.disabled=true;select.innerHTML='<option value="">Chargement…</option>';
    const renderPreview=(data,opt)=>{if(!preview)return;const row=data?.options?.find(x=>String(x.id)===String(opt||''));preview.innerHTML=row?`${row.photo?`<img src="${esc(row.photo)}" alt="Maillot ${esc(row.year||'')}">`:'<span>👕</span>'}<i class="match-sheet-jersey-palette" style="${formationMarkerInlineStyle(row)}" aria-hidden="true"></i><div><strong>${esc(row.label)}</strong><small>${esc(row.link||'')}</small></div>`:'<span>👕</span><small>Aucun maillot associé</small>';};
    try{const api=window.BLEUS3000_JERSEYS;if(!api?.getMatchPickerData){select.innerHTML='<option value="">Module Maillots indisponible</option>';return;}const data=await api.getMatchPickerData(state.matchId,state.match||{});state.jerseyOptions=data.options||[];select.innerHTML=`<option value="">Aucun maillot associé</option>${data.options.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}`;select.value=String(data.selectedId||'');select.disabled=false;renderPreview(data,select.value);select.onchange=()=>{state.jerseyDirty=true;renderPreview(data,select.value);};}
    catch(err){console.warn('Sélecteur maillot',err);select.innerHTML='<option value="">Migration Maillots ↔ Matchs requise</option>';select.disabled=true;if(preview)preview.innerHTML='<span>⚠</span><small>Relation maillot/match non disponible</small>';}
  }
  async function openMatchSheetEditor(matchId,sheet,m){
    if(!canEdit())return alert('Modification réservée aux ADMIN et SUPERADMIN.');const modal=ensureMatchSheetEditor();await ensureEditorLookups();
    const safeSheet=sheet||{appearances:[],goals:[],cards:[],media:[]},safeMatch=m||{};matchSheetEditorState={matchId:String(matchId),sheet:safeSheet,match:safeMatch,compositionDirty:false,eventsDirty:false,jerseyDirty:false};window.__BLEUS_MATCH_SHEET_CURRENT_ID=String(matchId);
    const playerList=$('#matchSheetPlayerList',modal),meta=$('#matchSheetEditorMeta',modal),startersHost=$('#matchSheetEditorStarters',modal),subsHost=$('#matchSheetEditorSubstitutes',modal),goals=$('#matchSheetEditorGoals',modal),cards=$('#matchSheetEditorCards',modal);if(playerList)playerList.innerHTML=editorPlayerListHtml();
    const stadiumList=$('#matchSheetStadiumList',modal),personnelList=$('#matchSheetPersonnelList',modal),competitionList=$('#matchSheetCompetitionList',modal);if(stadiumList)stadiumList.innerHTML=stadiumRows.map(x=>`<option value="${esc(x.name)}"></option>`).join('');if(personnelList)personnelList.innerHTML=people.map(x=>`<option value="${esc(x.display_name)}"></option>`).join('');if(competitionList)competitionList.innerHTML=competitionRows.map(x=>`<option value="${esc(x.name)}"></option>`).join('');
    $('#matchSheetStadium',modal).value=safeMatch.sheet_stadium_name||safeMatch.place?.name||'';$('#matchSheetCoach',modal).value=safeMatch.sheet_coach_name||safeMatch.coach?.display_name||'';$('#matchSheetCompetition',modal).value=safeMatch.sheet_competition_name||safeMatch.competitionEntity?.name||safeMatch.competition?.name||'';
    const editionSel=$('#matchSheetCompetitionEdition',modal);if(editionSel){const entityById=new Map(competitionEntities.map(x=>[String(x.id),x]));const gender=safeMatch.selection?.gender||safeMatch.gender||null;const options=competitionEditions.filter(ed=>{const ent=entityById.get(String(ed.competition_entity_id));return !gender||!ent?.gender||ent.gender===gender;}).slice().sort((a,b)=>{const ea=entityById.get(String(a.competition_entity_id))?.name||'',eb=entityById.get(String(b.competition_entity_id))?.name||'';return ea.localeCompare(eb,'fr')||Number(b.edition_year||0)-Number(a.edition_year||0);});editionSel.innerHTML='<option value="">— édition non définie —</option>'+options.map(ed=>{const ent=entityById.get(String(ed.competition_entity_id));const label=[ent?.name,ed.edition_label||ed.edition_year].filter(Boolean).join(' · ');return `<option value="${esc(ed.id)}">${esc(label)}</option>`;}).join('');editionSel.value=String(safeMatch.competition_edition_id||safeMatch.competitionEdition?.id||safeMatch.competition?.canonical_edition_id||'');}
    const mainRef=officialRows.find(x=>String(x.match_id)===String(matchId)&&isMainRefereeRole(x.role));$('#matchSheetReferee',modal).value=safeMatch.sheet_referee_name||(mainRef?people.find(p=>String(p.id)===String(mainRef.person_id))?.display_name:'')||'';const familySel=$('#matchSheetCompetitionFamily',modal);if(familySel){familySel.innerHTML='<option value="">— si compétition existante —</option>'+competitionFamilies.map(f=>`<option value="${esc(f.id)}" ${String(f.id)===String(safeMatch.sheet_competition_family_id||'')?'selected':''}>${esc(f.name)}</option>`).join('');}
    const opp=countryName(effective(safeMatch,'opponent_name')||'Adversaire');if(meta)meta.textContent=`${fmtDateLong(effective(safeMatch,'match_date'))} · France – ${opp}`;const structured=structuredLineup(safeSheet.appearances||[]);if(startersHost)startersHost.innerHTML=structured.starters.map((r,i)=>appearanceEditorRow(r,{starter:true,slot:i+1,locked:true})).join('');if(subsHost)subsHost.innerHTML=structured.subs.map((r,i)=>appearanceEditorRow(r,{starter:false,slot:i+1,locked:i<12})).join('');const subCount=$('#matchSheetSubCount',modal);if(subCount)subCount.textContent=String(structured.subs.length);if(goals)goals.innerHTML=(safeSheet.goals||[]).map(g=>goalEditorRow(g,safeMatch)).join('');if(cards)cards.innerHTML=(safeSheet.cards||[]).map(cardEditorRow).join('');const st=$('#matchSheetEditorStatus',modal);if(st){st.hidden=true;st.textContent='';st.className='match-sheet-editor-status';}modal.hidden=false;requestAnimationFrame(()=>populateMatchSheetJerseyPicker(modal,matchSheetEditorState).catch(err=>console.warn('Sélecteur maillot différé',err)));
  }
  function collectEditorAppearances(modal,state){
    const out=[],seenNames=new Set();for(const row of $$('[data-editor-appearance]',modal)){const input=$('[data-appearance-name]',row),name=String(input?.value||'').trim();if(!name)continue;const key=norm(name);if(seenNames.has(key))throw new Error(`Le joueur ${name} est présent deux fois dans la composition.`);seenNames.add(key);const current=safeUuid(row.dataset.originalPlayerId),playerId=safeUuid(editorResolvePlayer(name,current||'')),starter=row.dataset.lineupKind==='starter',slot=Number(row.dataset.lineupSlot||0)||null;const posSel=$('[data-appearance-position]',row),positionId=safeUuid(posSel?.value),positionText=positionId?footballPositions.find(x=>String(x.id)===String(positionId))?.label_text||null:null;const replChecked=!!$('[data-appearance-replaced]',row)?.checked,replName=replChecked?String($('[data-appearance-replacement]',row)?.value||'').trim():'',replId=replName?safeUuid(editorResolvePlayer(replName,safeUuid(row.dataset.originalReplacementId)||'')):null;out.push({id:safeUuid(row.dataset.appearanceId),match_id:safeUuid(state.matchId),player_id:playerId,player_name:name,starter,appeared:false,lineup_slot:slot,minutes:$('[data-appearance-minutes]',row)?.value===''?null:Number($('[data-appearance-minutes]',row)?.value),squad_status:starter?'Titulaire':'Remplaçant(e)',shirt_number:$('[data-appearance-number]',row)?.value===''?null:Number($('[data-appearance-number]',row)?.value),position_id:positionId,position:positionText,captain:!!$('[data-appearance-captain]',row)?.checked,replaced_by_player_id:replId,replaced_by_name:replName||null,verification:'manual'});}return out;
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
    const stadium=String($('#matchSheetStadium',modal)?.value||'').trim(),coach=String($('#matchSheetCoach',modal)?.value||'').trim(),referee=String($('#matchSheetReferee',modal)?.value||'').trim(),comp=String($('#matchSheetCompetition',modal)?.value||'').trim(),familyId=$('#matchSheetCompetitionFamily',modal)?.value||null,selectedEditionId=$('#matchSheetCompetitionEdition',modal)?.value||null;
    const patch={sheet_stadium_name:stadium||null,sheet_coach_name:coach||null,sheet_referee_name:referee||null,sheet_competition_name:comp||null,sheet_competition_family_id:familyId};
    if(stadium){let place=stadiumRows.find(x=>norm(x.name)===norm(stadium));if(!place){const {data,error}=await client.from('places').insert({place_type:'stadium',name:stadium}).select('*').single();if(error)throw error;place=data;}patch.place_id=place.id;}
    if(coach){let p=people.find(x=>x.person_type==='selectionneur'&&norm(x.display_name)===norm(coach));if(!p){const {data,error}=await client.from('personnel').insert({display_name:coach,person_type:'selectionneur',active:true}).select('*').single();if(error)throw error;p=data;}patch.coach_id=p.id;}
    if(referee){let p=people.find(x=>x.person_type==='arbitre'&&norm(x.display_name)===norm(referee));if(!p){const {data,error}=await client.from('personnel').insert({display_name:referee,person_type:'arbitre',active:true}).select('*').single();if(error)throw error;p=data;}const {error:de}=await client.from('match_officials').delete().eq('match_id',state.matchId).eq('role','Arbitre principal');if(de)throw de;const {error:ie}=await client.from('match_officials').insert({match_id:state.matchId,person_id:p.id,role:'Arbitre principal'});if(ie)throw ie;}
    if(selectedEditionId){const ed=competitionEditions.find(x=>String(x.id)===String(selectedEditionId));if(!ed)throw new Error('Édition de compétition inconnue. Recharge la page puis réessaie.');const entity=competitionEntities.find(x=>String(x.id)===String(ed.competition_entity_id));const legacy=competitionRows.find(x=>String(x.canonical_edition_id||'')===String(selectedEditionId)&&(!x.gender||x.gender===state.match.selection?.gender)&&(!x.selection_category||x.selection_category===state.match.selection?.category))||competitionRows.find(x=>String(x.canonical_edition_id||'')===String(selectedEditionId));patch.competition_edition_id=ed.id;if(legacy)patch.competition_id=legacy.id;if(entity){patch.sheet_competition_name=entity.name;}
    }else if(comp){let c=competitionRows.find(x=>norm(x.name)===norm(comp)&&(!x.gender||x.gender===state.match.selection?.gender)&&(!x.selection_category||x.selection_category===state.match.selection?.category));if(!c){if(!familyId)throw new Error('Nouvelle compétition : choisis son entité principale.');const family=competitionFamilies.find(x=>String(x.id)===String(familyId));const tagId=state.match.selection?.team_tag_id;const {data:links,error:le}=await client.from('competition_family_entities').select('competition_entity_id,sort_order').eq('family_id',familyId).order('sort_order');if(le)throw le;const entityIds=(links||[]).map(x=>x.competition_entity_id);let entityId=null,compTagId=null;if(entityIds.length&&tagId){const {data:ets}=await client.from('competition_entity_tags').select('competition_entity_id').in('competition_entity_id',entityIds).eq('tag_id',tagId);entityId=ets?.[0]?.competition_entity_id||null;}if(!entityId){const slugBase=`sheet-${String(family?.slug||'competition')}-${String(state.match.selection?.category||state.match.selection_category||'section')}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,64);const tagSlug=`competition-${slugBase}-${Date.now()}`.slice(0,96);const {data:newTag,error:tagErr}=await client.from('tags').insert({slug:tagSlug,kind:'tag',label_text:String(family?.name||comp).slice(0,40),icon_text:'🏆',aliases:[comp],appearance:'gradient',color_start:'#081f4d',color_end:'#315fc9',gradient_colors:['#081f4d','#315fc9'],text_color:'#ffffff',border_color:'#081f4d',gradient_angle:135,border_radius:16,border_width:1,is_active:true,reference_scope:'competition'}).select('id').single();if(tagErr)throw tagErr;compTagId=newTag.id;const {data:newEntity,error:entityErr}=await client.from('competition_entities').insert({slug:`${slugBase}-${Date.now()}`.slice(0,96),name:`${family?.name||comp} · ${state.match.selection?.category||state.match.selection_category||'Section'}`,aliases:[comp],gender:state.match.selection?.gender||state.match.gender,competition_type:family?.competition_type||null,competition_tag_id:compTagId,notes:'Sous-entité créée depuis une feuille de match validée.'}).select('id,competition_tag_id').single();if(entityErr)throw entityErr;entityId=newEntity.id;const nextOrder=Math.max(-1,...(links||[]).map(x=>Number(x.sort_order||0)))+1;const {error:familyLinkErr}=await client.from('competition_family_entities').insert({family_id:familyId,competition_entity_id:entityId,sort_order:nextOrder});if(familyLinkErr)throw familyLinkErr;if(tagId){const {error:tagLinkErr}=await client.from('competition_entity_tags').insert({competition_entity_id:entityId,tag_id:tagId});if(tagLinkErr)throw tagLinkErr;}}else{const {data:ent,error:ee}=await client.from('competition_entities').select('id,competition_tag_id').eq('id',entityId).single();if(ee)throw ee;compTagId=ent.competition_tag_id;}const year=Number((comp.match(/\b(?:19|20)\d{2}\b/)||[])[0])||new Date(effective(state.match,'match_date')).getFullYear();let {data:ed}=await client.from('competition_editions').select('id').eq('competition_entity_id',entityId).eq('edition_year',year).maybeSingle();if(!ed){const {data:newEd,error}=await client.from('competition_editions').insert({competition_entity_id:entityId,edition_year:year,edition_label:String(year)}).select('id').single();if(error)throw error;ed=newEd;}if(tagId)await client.from('competition_edition_tags').upsert({competition_edition_id:ed.id,tag_id:tagId},{onConflict:'competition_edition_id,tag_id'});const {data:newC,error}=await client.from('competitions').insert({name:comp,edition:String(year),competition_type:family?.competition_type||null,gender:state.match.selection?.gender||state.match.gender,selection_category:state.match.selection?.category||state.match.selection_category,status:'active',tag_id:compTagId,canonical_entity_id:entityId,canonical_edition_id:ed.id}).select('*').single();if(error)throw error;c=newC;patch.competition_edition_id=ed.id;}patch.competition_id=c.id;if(c.canonical_edition_id)patch.competition_edition_id=c.canonical_edition_id;}
    const {error}=await client.from('matches').update(patch).eq('id',state.matchId);if(error)throw error;Object.assign(state.match,patch);
  }
  async function validateMatchSheetEditor(){
    const modal=ensureMatchSheetEditor(),state=matchSheetEditorState,st=$('#matchSheetEditorStatus',modal);if(!state||!client)return;if(st){st.hidden=false;st.className='match-sheet-editor-status';st.textContent='Validation et recalcul des statistiques…';}
    try{await saveMatchSheetEditor(true);await ensureEditorLookups();await materializeSheetContext(modal,state);const {data:latestMatch,error:latestMatchError}=await client.from('matches').select('france_score,opponent_score,selection_team_id,gender,selection_category,manual_overrides,competition_id,competition_edition_id,place_id,coach_id,sheet_validation_revision').eq('id',state.matchId).single();if(latestMatchError)throw latestMatchError;Object.assign(state.match,latestMatch||{});matchSheetCache.delete(state.matchId);const sheet=await loadMatchSheet(state.matchId);const oldSnap=await client.from('validated_match_player_stats').select('player_id').eq('match_id',state.matchId);if(oldSnap.error)throw oldSnap.error;const affected=new Set((oldSnap.data||[]).map(x=>String(x.player_id)));
      const apps=[];for(const a of sheet.appearances){let pid=a.player_id;if(!pid&&a.player_name)pid=await resolveOrCreatePlayer(a.player_name,state);let rid=a.replaced_by_player_id;if(!rid&&a.replaced_by_name)rid=await resolveOrCreatePlayer(a.replaced_by_name,state);if(pid){affected.add(String(pid));const {error}=await client.from('match_appearances').update({player_id:pid,player_name:a.player_name||a.player?.display_name||null,replaced_by_player_id:rid||null}).eq('id',a.id);if(error)throw error;apps.push({...a,player_id:pid,replaced_by_player_id:rid||null});}if(rid)affected.add(String(rid));}
      const appeared=new Set(apps.filter(a=>a.starter&&a.player_id).map(a=>String(a.player_id)));for(const a of apps)if(a.replaced_by_player_id)appeared.add(String(a.replaced_by_player_id));
      const goals=sheet.goals||[];for(const g of goals){if(norm(g.team_name||'France')!=='france')continue;let pid=g.player_id;if(!pid&&g.scorer_name)pid=await resolveOrCreatePlayer(g.scorer_name,state);let aid=g.assist_player_id;if(!aid&&g.assist_name)aid=await resolveOrCreatePlayer(g.assist_name,state);if(pid){await client.from('match_goal_events').update({player_id:pid,assist_player_id:aid||null}).eq('id',g.id);appeared.add(String(pid));affected.add(String(pid));}if(aid){appeared.add(String(aid));affected.add(String(aid));}}
      for(const pid of appeared){let a=apps.find(x=>String(x.player_id)===pid);if(!a){const p=registryPlayers().find(x=>String(x.id)===pid);const {data,error}=await client.from('match_appearances').insert({match_id:state.matchId,player_id:pid,player_name:p?.name||p?.display_name||null,starter:false,appeared:true,squad_status:'Remplaçant(e)',verification:'validated-event'}).select('*').single();if(error)throw error;a=data;apps.push(a);}else{const {error}=await client.from('match_appearances').update({appeared:true}).eq('id',a.id);if(error)throw error;a.appeared=true;}}
      for(const a of apps.filter(x=>x.player_id&&!appeared.has(String(x.player_id)))){await client.from('match_appearances').update({appeared:false}).eq('id',a.id);}
      const scoreF=effective(state.match,'france_score'),scoreO=effective(state.match,'opponent_score');const result=(scoreF==null||scoreO==null||scoreF===''||scoreO==='')?null:(Number(scoreF)>Number(scoreO)?'V':Number(scoreF)<Number(scoreO)?'D':'N');const selectionId=state.match.selection_team_id||state.match.selection?.id;const {error:del}=await client.from('validated_match_player_stats').delete().eq('match_id',state.matchId);if(del)throw del;matchSheetCache.delete(state.matchId);const refreshed=await loadMatchSheet(state.matchId);const goalCount=new Map();for(const g of refreshed.goals||[])if(g.player_id)goalCount.set(String(g.player_id),(goalCount.get(String(g.player_id))||0)+1);const snaps=(refreshed.appearances||[]).filter(a=>a.appeared&&a.player_id).map(a=>({match_id:state.matchId,player_id:a.player_id,selection_id:selectionId,appeared:true,starter:!!a.starter,minutes:a.minutes,goals:goalCount.get(String(a.player_id))||0,shirt_number:a.shirt_number,position_id:a.position_id,position_text:a.position,captain:!!a.captain,result_code:result,validated_at:new Date().toISOString()}));if(snaps.length){const {error}=await client.from('validated_match_player_stats').insert(snaps);if(error)throw error;for(const x of snaps)affected.add(String(x.player_id));}
      for(const pid of affected){const {error}=await client.rpc('refresh_validated_player_stats',{p_player_id:pid});if(error)throw error;}
      const {error:me}=await client.from('matches').update({sheet_validation_status:'validated',sheet_validated_at:new Date().toISOString(),sheet_validated_by:window.C3K_ACCOUNT_STATE?.profile?.id||null,sheet_validation_revision:Number(state.match.sheet_validation_revision||0)+1,lineup_status:'Feuille validée · statistiques synchronisées'}).eq('id',state.matchId);if(me)throw me;matchSheetCache.delete(state.matchId);window.BLEUS3000_PLAYERS_DB?.reload?.();window.BLEUS3000_STATISTICS?.invalidate?.();window.BLEUS3000_SELECTIONS?.reload?.();if(st){st.className='match-sheet-editor-status is-ok';st.textContent=`Feuille validée ✓ · ${snaps.length} joueur${snaps.length>1?'s':''} comptabilisé${snaps.length>1?'s':''}`;}invalidate();setTimeout(()=>{modal.hidden=true;matchSheetEditorState=null;window.BLEUS3000_APP?.openReferences?.('matchs');},900);
    }catch(err){console.error('Validation feuille',err);if(st){st.hidden=false;st.className='match-sheet-editor-status is-error';st.textContent=String(err?.message||err);}}
  }
  async function saveMatchSheetEditor(stayOpen=false){
    const modal=ensureMatchSheetEditor(),state=matchSheetEditorState,st=$('#matchSheetEditorStatus',modal);if(!state||!client)return;if(st){st.hidden=false;st.className='match-sheet-editor-status';st.textContent='Enregistrement…';}
    try{await ensureEditorLookups();const appearances=collectEditorAppearances(modal,state);const goals=collectEditorGoals(modal,state),cards=collectEditorCards(modal,state);await saveEditorAppearances(state,appearances);const jerseySelect=$('#matchSheetEditorJersey',modal);if(jerseySelect&&!jerseySelect.disabled&&window.BLEUS3000_JERSEYS?.setMatchJersey)await window.BLEUS3000_JERSEYS.setMatchJersey(state.matchId,jerseySelect.value||'',state.match?.selection_team_id||state.match?.selection?.id||null);if(state.eventsDirty){const savedGoals=await saveEditorGoals(state,goals),savedCards=await saveEditorCards(state,cards);$$('[data-editor-goal]',modal).forEach((row,i)=>{row.dataset.eventId=String(savedGoals[i]?.id||'');row.dataset.originalPlayerId=String(savedGoals[i]?.player_id||'');row.dataset.originalAssistId=String(savedGoals[i]?.assist_player_id||'');});$$('[data-editor-card]',modal).forEach((row,i)=>{row.dataset.eventId=String(savedCards[i]?.id||'');row.dataset.originalPlayerId=String(savedCards[i]?.player_id||'');});await syncAppearanceEventCounters(state.matchId,savedGoals,savedCards);}const manualStatus=appearances.length?`Feuille éditoriale · ${appearances.length} joueur${appearances.length>1?'s':''}`:null;const selectedEditionId=$('#matchSheetCompetitionEdition',modal)?.value||null,selectedLegacyCompetition=selectedEditionId?competitionRows.find(x=>String(x.canonical_edition_id||'')===String(selectedEditionId)&&(!x.gender||x.gender===state.match.selection?.gender)&&(!x.selection_category||x.selection_category===state.match.selection?.category))||competitionRows.find(x=>String(x.canonical_edition_id||'')===String(selectedEditionId)):null;const draftPatch={lineup_status:manualStatus,competition_edition_id:selectedEditionId,competition_id:selectedLegacyCompetition?.id||state.match?.competition_id||null,sheet_stadium_name:String($('#matchSheetStadium',modal)?.value||'').trim()||null,sheet_referee_name:String($('#matchSheetReferee',modal)?.value||'').trim()||null,sheet_coach_name:String($('#matchSheetCoach',modal)?.value||'').trim()||null,sheet_competition_name:String($('#matchSheetCompetition',modal)?.value||'').trim()||null,sheet_competition_family_id:$('#matchSheetCompetitionFamily',modal)?.value||null,updated_at:new Date().toISOString()};const {error:matchStatusError}=await client.from('matches').update(draftPatch).eq('id',state.matchId);if(matchStatusError)throw matchStatusError;if(state.match)state.match.lineup_status=manualStatus;window.dispatchEvent(new CustomEvent('bleus:match-sheet-updated',{detail:{matchId:state.matchId,lineupStatus:manualStatus,source:'manual'}}));matchSheetCache.delete(state.matchId);if(st){st.className='match-sheet-editor-status is-ok';st.textContent='Feuille de match enregistrée ✓';}await refreshMatchSheetPanel(state.matchId);if(!stayOpen)setTimeout(()=>{modal.hidden=true;matchSheetEditorState=null;},650);return true;}catch(err){console.error('Édition feuille de match',err);if(st){st.hidden=false;st.className='match-sheet-editor-status is-error';st.textContent=String(err?.message||err);}if(stayOpen)throw err;return false;}
  }

  function ensureQuickEventModal(){let modal=$('#quickMatchEventModal');if(modal)return modal;modal=document.createElement('div');modal.className='modal-backdrop quick-match-event-modal';modal.id='quickMatchEventModal';modal.hidden=true;modal.innerHTML=`<section class="modal-dialog quick-match-event-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Ajouter un fait de jeu</h2><p id="quickMatchEventMeta">Ajout rapide sans ouvrir la feuille</p></div><button class="modal-close" data-quick-event-close type="button">×</button></header><div class="modal-body"><datalist id="quickEventPlayerList"></datalist><form id="quickMatchEventForm" class="quick-match-event-form"><label>Type<select id="quickEventType"><option value="goal">⚽ But</option><option value="yellow">🟨 Carton jaune</option><option value="second_yellow">🟨🟥 Second jaune</option><option value="red">🟥 Carton rouge</option></select></label><label>Équipe<select id="quickEventTeam"><option value="france">France</option><option value="opponent">Adversaire</option></select></label><label>Joueur<input id="quickEventPlayer" list="quickEventPlayerList" required placeholder="Nom libre accepté"></label><label>Minute<input id="quickEventMinute" placeholder="Ex. 64 ou 90+2"></label><label class="quick-goal-only">Score après le but<input id="quickEventScore" placeholder="Ex. 2-1"></label><label class="quick-goal-only">Type de but<select id="quickEventGoalType"><option value="open_play">Jeu</option><option value="header">Tête</option><option value="free_kick">Coup franc</option><option value="penalty">Penalty</option><option value="other">Autre</option></select></label><label class="quick-goal-only">Passeur décisif<input id="quickEventAssist" list="quickEventPlayerList" placeholder="Facultatif"></label><div class="match-sheet-editor-status" id="quickEventStatus" hidden></div><div class="match-sheet-editor-actions"><button type="button" class="secondary-btn" data-quick-event-close>Annuler</button><button class="primary-btn" type="submit">Ajouter</button></div></form></div></section>`;document.body.appendChild(modal);$$('[data-quick-event-close]',modal).forEach(b=>b.addEventListener('click',()=>modal.hidden=true));$('#quickEventType',modal)?.addEventListener('change',()=>{$$('.quick-goal-only',modal).forEach(x=>x.hidden=$('#quickEventType',modal).value!=='goal');});$('#quickMatchEventForm',modal)?.addEventListener('submit',saveQuickMatchEvent);return modal;}
  let quickEventMatchId=null;
  async function openQuickMatchEvent(matchId){if(!canEdit())return alert('Ajout réservé aux ADMIN et SUPERADMIN.');await load();const m=getMatch(matchId);if(!m)return;quickEventMatchId=String(matchId);const modal=ensureQuickEventModal(),list=$('#quickEventPlayerList',modal);if(list)list.innerHTML=editorPlayerListHtml();$('#quickMatchEventForm',modal)?.reset();$$('.quick-goal-only',modal).forEach(x=>x.hidden=false);const opp=countryName(effective(m,'opponent_name')||'Adversaire');$('#quickMatchEventMeta',modal).textContent=`${fmtDateLong(effective(m,'match_date'))} · France – ${opp}`;const st=$('#quickEventStatus',modal);if(st){st.hidden=true;st.textContent='';st.className='match-sheet-editor-status';}modal.hidden=false;setTimeout(()=>$('#quickEventPlayer',modal)?.focus(),40);}
  async function saveQuickMatchEvent(e){e.preventDefault();if(!canEdit()||!client||!quickEventMatchId)return;const modal=ensureQuickEventModal(),m=getMatch(quickEventMatchId)||{},type=$('#quickEventType',modal).value,team=$('#quickEventTeam',modal).value,name=String($('#quickEventPlayer',modal).value||'').trim(),minute=String($('#quickEventMinute',modal).value||'').trim()||null,st=$('#quickEventStatus',modal);if(!name)return;st.hidden=false;st.className='match-sheet-editor-status';st.textContent='Ajout…';try{const playerId=team==='france'?safeUuid(editorResolvePlayer(name)):null,opp=countryName(effective(m,'opponent_name')||'Adversaire');if(type==='goal'){const assistName=String($('#quickEventAssist',modal).value||'').trim(),assistId=team==='france'&&assistName?editorResolvePlayer(assistName):null;const goalType=$('#quickEventGoalType',modal)?.value||'open_play';const {error}=await client.from('match_goal_events').insert({match_id:quickEventMatchId,player_id:playerId,scorer_name:name,team_name:team==='france'?'France':opp,minute_text:minute,score_after:String($('#quickEventScore',modal).value||'').trim()||null,assist_player_id:assistId,assist_name:assistName||null,goal_type:goalType,body_part:goalType==='header'?'head':null,is_penalty:goalType==='penalty',is_own_goal:false});if(error)throw error;}else{const {error}=await client.from('match_card_events').insert({match_id:quickEventMatchId,player_id:playerId,player_name:name,team_name:team==='france'?'France':opp,card_type:type,minute_text:minute});if(error)throw error;}matchSheetCache.delete(quickEventMatchId);st.className='match-sheet-editor-status is-ok';st.textContent='Fait de jeu ajouté ✓ · la feuille devra être validée pour mettre les statistiques à jour.';window.dispatchEvent(new CustomEvent('bleus:match-sheet-updated',{detail:{matchId:quickEventMatchId,lineupStatus:m.lineup_status||null,source:'quick-event'}}));const panel=$(`[data-match-sheet-panel="${CSS.escape(String(quickEventMatchId))}"]`);if(panel&&!panel.hidden)refreshMatchSheetPanel(quickEventMatchId).catch(()=>{});setTimeout(()=>modal.hidden=true,850);}catch(err){st.className='match-sheet-editor-status is-error';st.textContent=String(err?.message||err);}}
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
    return `<article class="rel-ref-tile rel-opponent-tile" data-opponent-id="${esc(o.id)}" data-country-search="${esc(norm(countrySearch))}">${referenceEditButton('adversaires',o)}<div class="rel-ref-head"><div><h3><span class="rel-opponent-title">${flagImg(o.name)}${esc(countryName(o.name))}</span></h3><div class="subtitle">${esc(meta)}</div></div><span class="rel-result">${bal.matches}</span></div>${relationSummaryHtml(bal)}${o.federation_name?`<div class="rel-facts"><span>🏛 ${esc(o.federation_name)}</span></div>`:''}<div class="rel-opponent-section-title">Matchs par sélection française</div><div class="rel-opponent-sections">${sectionButtons||'<span class="rel-opponent-empty">Aucune section reliée</span>'}</div><div class="rel-opponent-details" hidden></div></article>`;
  }
  function renderOpponentDetails(card,opponentId,teamId,page=1){
    const list=opponentMatches(opponentId,teamId),bal=balance(list);
    const team=list[0]?.selection||selectionRows.find(x=>String(x.id)===String(teamId));
    const label='France A';
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
    const label='France A';
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
    const label='France A';
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
    else form.innerHTML=`${photoEditorHtml(row)}<div class="rel-editor-grid"><label>Nom<input name="display_name" required maxlength="160" value="${esc(row.display_name||'')}"></label><label>Nationalité<input name="nationality" maxlength="100" value="${esc(row.nationality||'')}"></label><label>Date de naissance<input name="birth_date" type="date" value="${esc(row.birth_date||'')}"></label><label>Organisation<input name="organization" maxlength="160" value="${esc(row.organization||'')}"></label></div>${borderEditorHtml(row)}<div class="c3k-v8-actions"><button class="secondary-btn" type="button" data-rel-editor-cancel>Annuler</button><button class="primary-btn" type="submit">${isNew?'Ajouter':'Enregistrer'}</button></div><div class="c3k-v8-status" data-rel-editor-status hidden></div>`;
    $('[data-rel-editor-cancel]',form)?.addEventListener('click',()=>{modal.hidden=true;referenceEditorState=null;});
    if(kind==='lieux')bindCountryPicker(form);
    const file=form.elements.photo,preview=$('[data-rel-editor-photo-preview]',form);file?.addEventListener('change',()=>{const f=file.files?.[0];if(!f||!preview)return;const url=URL.createObjectURL(f);preview.querySelector('.rel-entity-photo-inner').innerHTML=`<img src="${url}" alt="Aperçu">`;});
    modal.hidden=false;
  }
  async function uploadReferencePhoto(kind,id,file){
    if(!file)return null;if(file.size>5*1024*1024)throw new Error('La photo dépasse 5 Mo.');const ext=(String(file.name||'').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const safe=['png','jpg','jpeg','webp'].includes(ext)?ext:'jpg';const path=`${kind}/${id}/${Date.now()}.${safe}`;const {error}=await client.storage.from('reference-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});if(error)throw error;return path;
  }
  async function saveReferenceEditor(e){
    e.preventDefault();if(!referenceEditorState||!client)return;const form=e.currentTarget,fd=new FormData(form),status=$('[data-rel-editor-status]',form);if(status){status.hidden=false;status.className='c3k-v8-status';status.textContent='Enregistrement…';}
    try{
      const {kind,id,isNew}=referenceEditorState,entityId=id||crypto.randomUUID();
      const base={tile_border_appearance:String(fd.get('tile_border_appearance')||'gradient'),tile_border_color_start:String(fd.get('tile_border_color_start')||'#123B8F'),tile_border_color_end:String(fd.get('tile_border_color_end')||'#2F6DFF'),tile_border_width:Number(fd.get('tile_border_width')||3),tile_border_radius:Number(fd.get('tile_border_radius')||14),tile_border_gradient_angle:Number(fd.get('tile_border_gradient_angle')||135)};
      const file=form.elements.photo?.files?.[0]||null;if(file)base.photo_path=await uploadReferencePhoto(kind,entityId,file);else if(fd.get('remove_photo')){base.photo_path=null;if(kind!=='lieux')base.photo_url=null;}
      let table,payload;
      if(kind==='lieux'){
        table='places';payload={...base,place_type:'stadium',name:String(fd.get('name')||'').trim(),city:String(fd.get('city')||'').trim()||null,country:String(fd.get('country')||'').trim()||null,capacity:fd.get('capacity')===''?null:Number(fd.get('capacity')),opened_year:fd.get('opened_year')===''?null:Number(fd.get('opened_year')),description_short:String(fd.get('description_short')||'').trim()||null};
      }else if(kind==='adversaires'){
        table='opponents';payload={name:String(fd.get('name')||'').trim(),fifa_code:String(fd.get('fifa_code')||'').trim().toUpperCase()||null,confederation:String(fd.get('confederation')||'').trim()||null,continent:String(fd.get('continent')||'').trim()||null,federation_name:String(fd.get('federation_name')||'').trim()||null,active:true};
      }else{
        table='personnel';payload={...base,display_name:String(fd.get('display_name')||'').trim(),nationality:String(fd.get('nationality')||'').trim()||null,birth_date:String(fd.get('birth_date')||'').trim()||null,organization:String(fd.get('organization')||'').trim()||null,person_type:kind==='arbitres'?'arbitre':'selectionneur',active:true};
      }
      if(!payload.name&&!payload.display_name)throw new Error('Le nom est obligatoire.');
      const query=isNew?client.from(table).insert({id:entityId,...payload}):client.from(table).update(payload).eq('id',id);const {error}=await query;if(error)throw error;
      ensureReferenceEditor().hidden=true;referenceEditorState=null;invalidate();await load();await render(kind,$('#referenceSearch')?.value||'');
    }catch(err){console.error('Édition référentiel',err);if(status){status.hidden=false;status.className='c3k-v8-status is-error';status.textContent=String(err?.message||err);}}
  }
  function bindReferenceEditors(host){$$('[data-rel-edit-kind]',host).forEach(b=>b.addEventListener('click',()=>openReferenceEditor(b.dataset.relEditKind,b.dataset.relEditId)));}

  function renderMainMatchPagination(total){const pages=Math.max(1,Math.ceil(total/MATCH_PAGE_SIZE));matchPage=Math.max(1,Math.min(matchPage,pages));if(total<=1)return '';return `<nav class="rel-match-main-pagination" aria-label="Pagination des matchs"><button type="button" data-match-main-page="${matchPage-1}" ${matchPage<=1?'disabled':''}>‹</button><span>Match ${matchPage} / ${pages}</span><button type="button" data-match-main-page="${matchPage+1}" ${matchPage>=pages?'disabled':''}>›</button></nav>`;}
  function bindMainMatchPagination(host){$$('[data-match-main-page]',host).forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;matchPage=Number(b.dataset.matchMainPage)||1;render('matchs',$('#referenceSearch')?.value||'');}));}

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
        if(title)title.textContent='Matchs';if(sub)sub.textContent='Équipe de France masculine A · matchs terminés par défaut · une tuile par page';if(count)count.textContent=`${list.length} match${list.length>1?'s':''}`;
        const pages=Math.max(1,Math.ceil(list.length/MATCH_PAGE_SIZE));matchPage=Math.max(1,Math.min(matchPage,pages));const shown=list.slice((matchPage-1)*MATCH_PAGE_SIZE,matchPage*MATCH_PAGE_SIZE),pagination=renderMainMatchPagination(list.length);
        host.innerHTML=list.length?`${pagination}<div class="rel-ref-grid rel-match-grid">${shown.map(renderMatchCard).join('')}</div>${pagination}`:'<div class="universal-search-empty">Aucun match ne correspond aux filtres.</div>';
        bindMatchCards(host);bindMainMatchPagination(host);
        if(pendingMatchFocus){
          const targetId=pendingMatchFocus,openSheet=String(pendingMatchSheetFocus||'')===String(targetId);pendingMatchFocus=null;pendingMatchSheetFocus=null;
          requestAnimationFrame(()=>{const tile=$(`[data-match-id="${CSS.escape(String(targetId))}"]`,host);if(tile){tile.classList.add('is-target-match');tile.scrollIntoView({behavior:'smooth',block:'center'});if(openSheet){setTimeout(()=>{const btn=$('[data-match-sheet-toggle]',tile);if(btn&&btn.getAttribute('aria-expanded')!=='true')btn.click();},180);}setTimeout(()=>tile.classList.remove('is-target-match'),2600);}});
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
      type:labels[x.kind]||'Référentiels',icon:icons[x.kind]||'▦',image:x.image||'',title:x.title,meta:x.meta,score:0.18,
      action:()=>{window.BLEUS3000_APP?.openReferences?.(x.kind);setTimeout(()=>{const i=$('#referenceSearch');if(i){i.value=x.title;i.dispatchEvent(new Event('input',{bubbles:true}));}},80);}
    }));
  }

  function getMatch(id){return matches.find(m=>String(m.id)===String(id))||null;}
  function applyLocalOverride(id,manual_overrides){const m=getMatch(id);if(m)m.manual_overrides=manual_overrides||{};}
  function invalidate(){loaded=false;matches=[];people=[];staffRows=[];refereeRows=[];officialRows=[];opponentRows=[];stadiumRows=[];competitionRows=[];competitionEntities=[];competitionEditions=[];searchRegistry=[];matchSheetCache.clear();}
  function openMatch(id,openSheet=false){
    Object.assign(matchFilters,{team:'all',gender:'all',competition:'all',year:'all',result:'all',stadium:'all',coach:'all',sheet:'all',includeUpcoming:false});
    const target=getMatch(id);if(target&&!isFinishedReferenceMatch(target))matchFilters.includeUpcoming=true;const visible=applyMatchFilters(matches);const idx=visible.findIndex(m=>String(m.id)===String(id));matchPage=idx>=0?Math.floor(idx/MATCH_PAGE_SIZE)+1:1;
    pendingMatchFocus=id;pendingMatchSheetFocus=openSheet?id:null;
    window.BLEUS3000_APP?.openReferences?.('matchs');
  }
  function openMatchSheet(id){openMatch(id,true);}

  window.addEventListener('bleus:match-media-updated',e=>{const id=String(e.detail?.matchId||'');if(!id)return;matchSheetCache.delete(id);const panel=$(`[data-match-sheet-panel="${CSS.escape(id)}"]`);if(panel&&!panel.hidden)refreshMatchSheetPanel(id).catch(()=>{});});
  window.addEventListener('bleus:match-sheet-synced',e=>{const ids=Array.isArray(e.detail?.matchIds)?e.detail.matchIds:[];ids.forEach(id=>{matchSheetCache.delete(String(id));const panel=$(`[data-match-sheet-panel="${CSS.escape(String(id))}"]`);if(panel&&!panel.hidden)refreshMatchSheetPanel(id).catch(err=>console.warn('Actualisation feuille live',err));});const modal=$('#referenceModal');if(modal&&!modal.hidden&&norm($('#referenceModalTitle')?.textContent)==='matchs')render('matchs',$('#referenceSearch')?.value||'').catch(err=>console.warn('Actualisation tuiles matchs live',err));});

  window.BLEUS3000_RELATIONAL_REFS={
    render,load,search,getMatch,openMatch,openMatchSheet,openMatchSheetEditor,openQuickMatchEvent,effective,baseValue,applyLocalOverride,invalidate,openNew:kind=>openReferenceEditor(kind,null),
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
