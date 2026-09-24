/* Bleus 3000 V1.1.35 — Référentiels relationnels globaux : Matchs + Personnel/Officiels */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=window.BLEUS3000_SEARCH;
  const norm=v=>S?.normalize?S.normalize(v):String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matchQuery=(q,vals)=>!String(q||'').trim()||(S?.matches?S.matches(q,vals,.5):vals.some(v=>norm(v).includes(norm(q))));
  const matchFilters={team:'all',gender:'all',competition:'all',year:'all',result:'all'};
  let client=null,loaded=false,loading=null,matches=[],people=[],tagsById=new Map(),searchRegistry=[];

  async function waitClient(){for(let i=0;i<70;i++){client=window.BLEUS3000_SUPABASE||null;if(client)return client;await new Promise(r=>setTimeout(r,100));}return null;}
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
    status:m.status||''
  })[key];
  const effective=(m,key)=>Object.prototype.hasOwnProperty.call(overrides(m),key)?overrides(m)[key]:baseValue(m,key);
  const selectionLabel=m=>m.selection?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||m.selection_category||'France';
  const resultLetter=m=>{const a=Number(effective(m,'france_score')),b=Number(effective(m,'opponent_score'));if(!Number.isFinite(a)||!Number.isFinite(b))return '—';return a>b?'V':a<b?'D':'N';};
  const scoreClass=m=>({V:'is-win',N:'is-draw',D:'is-loss'}[resultLetter(m)]||'');
  const isManual=m=>Object.keys(overrides(m)).length>0;

  function chipForMatch(m){
    const t=m.selection?.team_tag_id?tagsById.get(m.selection.team_tag_id):null;
    if(!t)return `<span class="rel-tag-fallback">${esc((m.selection?.category||m.selection_category||'FRANCE').replace('Espoirs/U21','ESPOIRS'))}</span>`;
    if(window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(t,'relational-team-chip');
    const bg=t.appearance==='solid'?(t.color_start||'#2563eb'):`linear-gradient(${Number(t.gradient_angle||135)}deg,${t.color_start||'#123B8F'},${t.color_end||'#4dc6ff'})`;
    return `<span class="rel-tag-fallback" style="background:${bg};color:${esc(t.text_color||'#fff')};border-color:${esc(t.border_color||'#123B8F')}">${esc(t.icon_text||'🇫🇷')} ${esc(t.label_text||m.selection?.category||'FRANCE')}</span>`;
  }

  async function fetchIn(table,columns,ids){if(!ids.length)return[];const {data,error}=await client.from(table).select(columns).in('id',ids);if(error)throw error;return data||[];}

  async function load(){
    if(loaded)return matches;if(loading)return loading;loading=(async()=>{
      if(!await waitClient())throw new Error('Supabase indisponible');
      const [{data:mm,error:me},{data:ss,error:se},{data:pp,error:pe},{data:tagRows,error:te}]=await Promise.all([
        client.from('matches').select('id,match_date,gender,selection_category,selection_team_id,home_away,france_score,opponent_score,status,notes_short,phase,spectators,lineup_status,source_calendar_url,source_detail_url,opponent_id,competition_id,place_id,coach_id,external_ids,broadcast_text,broadcast_url,provider,provider_fixture_id,provider_updated_at,data_state,api_payload,manual_overrides').order('match_date',{ascending:false}).limit(5000),
        client.from('selection_teams').select('id,code,name,gender,category,team_tag_id,provider_ids').order('sort_order'),
        client.from('espoirs_personnel_stats').select('*').order('display_name').limit(1000),
        client.from('tags').select('*').eq('kind','tag').limit(1000)
      ]);
      if(me)throw me;if(se)throw se;if(pe)console.warn('Personnel Espoirs',pe);if(te)console.warn('Tags',te);
      const selections=new Map((ss||[]).map(x=>[x.id,x]));tagsById=new Map((tagRows||[]).map(x=>[x.id,x]));
      const rows=mm||[];
      const oppIds=[...new Set(rows.map(x=>x.opponent_id).filter(Boolean))],compIds=[...new Set(rows.map(x=>x.competition_id).filter(Boolean))],placeIds=[...new Set(rows.map(x=>x.place_id).filter(Boolean))],coachIds=[...new Set(rows.map(x=>x.coach_id).filter(Boolean))];
      const [oo,cc,ll,hh]=await Promise.all([
        fetchIn('opponents','id,name,fifa_code',oppIds),fetchIn('competitions','id,name,edition',compIds),fetchIn('places','id,name,city,country',placeIds),fetchIn('personnel','id,display_name',coachIds)
      ]);
      const om=new Map(oo.map(x=>[x.id,x])),cm=new Map(cc.map(x=>[x.id,x])),lm=new Map(ll.map(x=>[x.id,x])),hm=new Map(hh.map(x=>[x.id,x]));
      matches=rows.map(x=>({...x,selection:selections.get(x.selection_team_id)||null,opponent:om.get(x.opponent_id)||null,competition:cm.get(x.competition_id)||null,place:lm.get(x.place_id)||null,coach:hm.get(x.coach_id)||null}));
      people=pp||[];
      const d=window.BLEUS3000_DATA;if(d?.references){const mr=d.references.find(x=>x.key==='matchs'),pr=d.references.find(x=>x.key==='personnel');if(mr)mr.count=String(matches.length);if(pr)pr.count=String(people.length);}
      searchRegistry=[...matches.map(m=>({kind:'matchs',id:m.id,title:`${selectionLabel(m)} - ${effective(m,'opponent_name')||'Adversaire'}`,meta:`${fmtDate(effective(m,'match_date'))} · ${effective(m,'competition_name')||selectionLabel(m)}`,values:[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),m.provider]})),...people.map(p=>({kind:'personnel',title:p.display_name,meta:p.coached_matches>0?'Sélectionneur France Espoirs':((p.official_roles||[]).join(' · ')||'Officiel'),values:[p.display_name,p.person_type,p.nationality,...(p.official_roles||[]),'Espoirs']}))];
      loaded=true;window.dispatchEvent(new CustomEvent('bleus:matches-ready',{detail:{matches}}));window.dispatchEvent(new CustomEvent('bleus:relational-registry',{detail:{count:searchRegistry.length}}));return matches;
    })().finally(()=>loading=null);return loading;
  }

  function resetForeignUi(){const cat=$('#selectionCategoryTabs');if(cat)cat.hidden=true;const sf=$('#selectionFilterBar');if(sf)sf.hidden=true;}
  function ensureMatchFilters(){
    const toolbar=$('#referenceSearch')?.closest('.modal-toolbar');if(!toolbar)return null;
    let bar=$('#matchReferenceFilters');if(!bar){bar=document.createElement('div');bar.id='matchReferenceFilters';bar.className='match-reference-filters';toolbar.insertAdjacentElement('afterend',bar);bar.addEventListener('change',e=>{const k=e.target.dataset.matchFilter;if(!k)return;matchFilters[k]=e.target.value;render('matchs',$('#referenceSearch')?.value||'');});}
    return bar;
  }
  const option=(v,l,sel)=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;
  function renderMatchFilters(){
    const bar=ensureMatchFilters();if(!bar)return;bar.hidden=false;
    const teams=[...new Map(matches.filter(m=>m.selection_team_id).map(m=>[m.selection_team_id,selectionLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));
    const comps=[...new Set(matches.map(m=>effective(m,'competition_name')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    const years=[...new Set(matches.map(m=>parseDate(effective(m,'match_date'))?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
    bar.innerHTML=`<select data-match-filter="team">${option('all','Toutes les sélections',matchFilters.team)}${teams.map(([v,l])=>option(v,l,matchFilters.team)).join('')}</select><select data-match-filter="gender">${option('all','Masculin + Féminin',matchFilters.gender)}${option('M','Masculin',matchFilters.gender)}${option('F','Féminin',matchFilters.gender)}</select><select data-match-filter="competition">${option('all','Toutes les compétitions',matchFilters.competition)}${comps.map(v=>option(v,v,matchFilters.competition)).join('')}</select><select data-match-filter="year">${option('all','Toutes les années',matchFilters.year)}${years.map(v=>option(String(v),String(v),matchFilters.year)).join('')}</select><select data-match-filter="result">${option('all','Tous les résultats',matchFilters.result)}${option('V','Victoires',matchFilters.result)}${option('N','Nuls',matchFilters.result)}${option('D','Défaites',matchFilters.result)}${option('—','Sans score',matchFilters.result)}</select>`;
  }
  function hideMatchFilters(){const bar=$('#matchReferenceFilters');if(bar)bar.hidden=true;}
  function applyMatchFilters(list){return list.filter(m=>{
    if(matchFilters.team!=='all'&&String(m.selection_team_id)!==matchFilters.team)return false;
    if(matchFilters.gender!=='all'&&String(m.gender)!==matchFilters.gender)return false;
    if(matchFilters.competition!=='all'&&String(effective(m,'competition_name'))!==matchFilters.competition)return false;
    const y=parseDate(effective(m,'match_date'))?.getFullYear();if(matchFilters.year!=='all'&&String(y)!==matchFilters.year)return false;
    if(matchFilters.result!=='all'&&resultLetter(m)!==matchFilters.result)return false;
    return true;
  });}

  function renderMatchCard(m){
    const opp=effective(m,'opponent_name')||'Adversaire';const home=m.home_away==='home';const sel=selectionLabel(m);const left=home?sel:opp,right=home?opp:sel;const a=effective(m,'france_score'),b=effective(m,'opponent_score');const has=Number.isFinite(Number(a))&&Number.isFinite(Number(b));const score=has?(home?`${a} – ${b}`:`${b} – ${a}`):'—';const place=[effective(m,'venue_name'),effective(m,'city')].filter(Boolean).join(' · ');const comp=effective(m,'competition_name')||sel;const provider=m.provider==='thesportsdb'?'TheSportsDB':m.provider||'';
    return `<article class="rel-ref-tile rel-match-tile" data-match-id="${esc(m.id)}"><div class="rel-ref-head"><div><small>${esc(fmtDateLong(effective(m,'match_date')))}</small><h3>${esc(left)} <span class="rel-score ${scoreClass(m)}">${esc(score)}</span> ${esc(right)}</h3><div class="subtitle">${esc(comp)}${m.phase?` · ${esc(m.phase)}`:''}</div></div><span class="rel-result ${scoreClass(m)}">${resultLetter(m)}</span></div><div class="rel-facts">${place?`<span>🏟 ${esc(place)}</span>`:''}${m.coach?.display_name?`<span>👔 ${esc(m.coach.display_name)}</span>`:''}${m.spectators?`<span>👥 ${Number(m.spectators).toLocaleString('fr-FR')}</span>`:''}${effective(m,'broadcast_text')?`<span>📺 ${esc(effective(m,'broadcast_text'))}</span>`:''}<span>${esc(m.lineup_status||m.notes_short||m.status||'Match')}</span></div><div class="rel-match-bottom"><div class="rel-tags">${chipForMatch(m)}${provider?`<span class="rel-provider">${esc(provider)}</span>`:''}${isManual(m)?'<span class="rel-manual">✎ Correction manuelle</span>':''}</div><button class="rel-edit-match" type="button" data-calendar-edit="${esc(m.id)}">✎ Modifier</button></div></article>`;
  }
  function renderPersonCard(p){const coach=Number(p.coached_matches||0)>0;const roles=(p.official_roles||[]).filter(Boolean);return `<article class="selection-player-tile rel-ref-tile rel-person-tile"><div class="rel-person-avatar">${esc((p.display_name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div class="rel-ref-head"><div><h3>${esc(p.display_name)}</h3><div class="subtitle">${coach?'Sélectionneur France Espoirs':esc(roles.join(' · ')||p.person_type||'Officiel')}</div></div></div>${coach?`<div class="rel-stat-grid"><span><small>Matchs</small><strong>${Number(p.coached_matches||0)}</strong></span><span><small>V</small><strong>${Number(p.coached_wins||0)}</strong></span><span><small>N</small><strong>${Number(p.coached_draws||0)}</strong></span><span><small>D</small><strong>${Number(p.coached_losses||0)}</strong></span></div>`:`<div class="rel-stat-grid one"><span><small>Matchs documentés</small><strong>${Number(p.official_matches||0)}</strong></span></div>`}</article>`;}

  async function render(kind,q=''){
    resetForeignUi();const host=$('#referenceEntries'),title=$('#referenceModalTitle'),sub=$('#referenceModalSub'),count=$('#referenceCount');if(!host)return;host.innerHTML='<div class="selection-loading">Chargement du référentiel relationnel…</div>';
    try{await load();if(kind==='matchs'){renderMatchFilters();let list=matches.filter(m=>matchQuery(q,[selectionLabel(m),effective(m,'opponent_name'),effective(m,'competition_name'),m.phase,effective(m,'venue_name'),effective(m,'city'),m.coach?.display_name,fmtDate(effective(m,'match_date')),m.provider]));list=applyMatchFilters(list);if(title)title.textContent='Matchs';if(sub)sub.textContent='Toutes les sélections françaises · historique + matchs API · données modifiables';if(count)count.textContent=`${list.length} match${list.length>1?'s':''}`;host.innerHTML=list.length?`<div class="rel-ref-grid rel-match-grid">${list.map(renderMatchCard).join('')}</div>`:'<div class="universal-search-empty">Aucun match ne correspond aux filtres.</div>';
      }else{hideMatchFilters();const list=people.filter(p=>matchQuery(q,[p.display_name,p.person_type,p.nationality,...(p.official_roles||[]),'sélectionneur','arbitre','officiel','espoirs']));if(title)title.textContent='Personnel & Officiels';if(sub)sub.textContent='France Espoirs · sélectionneurs, arbitres et officiels reliés aux matchs';if(count)count.textContent=`${list.length} personne${list.length>1?'s':''}`;host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderPersonCard).join('')}</div>`:'<div class="universal-search-empty">Aucune personne ne correspond à la recherche.</div>';}
    }catch(e){console.error('Référentiels relationnels',e);host.innerHTML=`<div class="selection-empty"><strong>Chargement impossible.</strong><span>${esc(e?.message||e)}</span></div>`;}
  }
  function search(q){if(!loaded||!String(q||'').trim())return [];return searchRegistry.filter(x=>matchQuery(q,[x.title,x.meta,...x.values])).slice(0,20).map(x=>({type:x.kind==='matchs'?'Matchs':'Personnel & Officiels',icon:x.kind==='matchs'?'⚽':'👔',title:x.title,meta:x.meta,score:0.18,action:()=>{window.BLEUS3000_APP?.openReferences?.(x.kind);setTimeout(()=>{const i=$('#referenceSearch');if(i){i.value=x.title;i.dispatchEvent(new Event('input',{bubbles:true}));}},80);}}));}
  function getMatch(id){return matches.find(m=>String(m.id)===String(id))||null;}
  function applyLocalOverride(id,manual_overrides){const m=getMatch(id);if(m)m.manual_overrides=manual_overrides||{};}
  function invalidate(){loaded=false;matches=[];searchRegistry=[];}
  window.BLEUS3000_RELATIONAL_REFS={render,load,search,getMatch,effective,baseValue,applyLocalOverride,invalidate,get matches(){return matches;},get people(){return people;}};
  load().catch(()=>{});
})();
