/* 3615 Bleus V1.2.5 — centre qualité des feuilles de match */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const refs=()=>window.BLEUS3000_RELATIONAL_REFS;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const parseDate=v=>{const d=new Date(v);return Number.isNaN(+d)?null:d;};
  const fmtDate=v=>{const d=parseDate(v);return d?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Paris'}).format(d):'Date ?';};
  const eff=(m,k)=>refs()?.effective?.(m,k)??m?.[k];
  const isAdmin=()=>['admin','superadmin'].includes(String(window.C3K_ACCOUNT_STATE?.profile?.role||window.C3K_ACCOUNT_STATE?.role||'').toLowerCase());
  const isPast=m=>{const d=parseDate(eff(m,'match_date'));return d&&d.getTime()<Date.now();};
  const scoreKnown=m=>{const a=eff(m,'france_score'),b=eff(m,'opponent_score');return a!==null&&a!==undefined&&a!==''&&b!==null&&b!==undefined&&b!=='';};
  const opponent=m=>String(eff(m,'opponent_name')||m?.opponent?.name||'Adversaire');
  const ISSUE_LABELS={composition:'composition',stade:'stade',ville:'ville',arbitre:'arbitre',selectionneur:'sélectionneur',edition:'édition compétition',maillot:'maillot',score:'score'};
  const ISSUE_ORDER=['composition','stade','ville','arbitre','selectionneur','edition','maillot','score'];
  let qualityContext={starterCounts:new Map()};

  async function fetchAllAppearances(){
    const db=window.BLEUS3000_SUPABASE;if(!db)return[];
    const out=[],size=1000;let from=0;
    for(let page=0;page<60;page++){
      const {data,error}=await db.from('match_appearances').select('match_id,starter,player_id,player_name').range(from,from+size-1);
      if(error)throw error;out.push(...(data||[]));if(!data||data.length<size)break;from+=size;
    }
    return out;
  }
  function buildStarterCounts(rows){
    const map=new Map();for(const r of rows||[]){if(!r?.match_id||r.starter!==true||(!r.player_id&&!String(r.player_name||'').trim()))continue;const id=String(r.match_id);map.set(id,(map.get(id)||0)+1);}return map;
  }
  function fallbackLineupCount(m){
    const live=Number(m?.api_payload?._bleus_live_sheet?.lineup_count||0);if(live>0)return live;
    const hit=String(m?.lineup_status||'').match(/(\d+)\s*joueur/i);return hit?Number(hit[1]):0;
  }
  function starterCount(m){const id=String(m?.id||'');return qualityContext.starterCounts.has(id)?qualityContext.starterCounts.get(id):fallbackLineupCount(m);}
  function hasSheetInput(m){
    return Boolean(
      String(m?.lineup_status||'').trim()||starterCount(m)>0||
      String(m?.sheet_stadium_name||'').trim()||String(m?.sheet_city_name||'').trim()||String(m?.sheet_referee_name||'').trim()||
      String(m?.sheet_coach_name||'').trim()||String(m?.sheet_competition_name||'').trim()||
      m?.competition_edition_id||m?.api_payload?._bleus_live_sheet?.lineup_count||
      String(m?.sheet_validation_status||'')==='needs_validation'||String(m?.sheet_validation_status||'')==='validated'
    );
  }
  function missingFor(m){
    const missing=[];const starters=starterCount(m);
    if(starters<11)missing.push({key:'composition',label:starters>0?`composition (${starters}/11 titulaires)`:'composition'});
    if(!(String(m?.sheet_stadium_name||'').trim()||String(eff(m,'venue_name')||m?.place?.name||'').trim()))missing.push({key:'stade',label:'stade'});
    if(!(String(m?.sheet_city_name||'').trim()||String(eff(m,'city')||m?.place?.city||'').trim()))missing.push({key:'ville',label:'ville'});
    const referee=m?.sheet_referee_name||refs()?.getMainRefereeForMatch?.(m.id)?.display_name||'';
    if(!String(referee).trim())missing.push({key:'arbitre',label:'arbitre'});
    if(!(String(m?.sheet_coach_name||'').trim()||String(m?.coach?.display_name||'').trim()))missing.push({key:'selectionneur',label:'sélectionneur'});
    if(!(m?.competition_edition_id||m?.competitionEdition?.id||m?.competition?.canonical_edition_id))missing.push({key:'edition',label:'édition compétition'});
    if(window.BLEUS3000_JERSEYS?.hasMatchJersey&&!window.BLEUS3000_JERSEYS.hasMatchJersey(m.id))missing.push({key:'maillot',label:'maillot'});
    if(!scoreKnown(m))missing.push({key:'score',label:'score'});
    return missing;
  }
  function statusFor(m,missing){
    const db=String(m?.sheet_validation_status||'draft');
    if(db==='validated'&&missing.length===0)return {key:'yes',label:'OUI',detail:'Feuille validée et complète'};
    if(db==='validated'&&missing.length)return {key:'partial',label:'VALIDÉE · À CORRIGER',detail:'Feuille validée mais données obligatoires manquantes'};
    if(db==='needs_validation')return {key:'partial',label:'À REVALIDER',detail:'Une donnée liée a changé depuis la dernière validation'};
    if(hasSheetInput(m))return {key:'partial',label:'NON · PARTIELLE',detail:'Informations présentes'};
    return {key:'no',label:'NON',detail:'Feuille non renseignée'};
  }
  function decadeFor(m){const y=parseDate(eff(m,'match_date'))?.getFullYear();return Number.isFinite(y)?Math.floor(y/10)*10:null;}
  function summaryForMatch(m){const missing=missingFor(m),status=statusFor(m,missing);return {match:m,number:refs()?.getMatchNumber?.(m)||m?.chronological_number||null,status,missing,missingKeys:missing.map(x=>x.key),decade:decadeFor(m),completion:Math.max(0,Math.round(((ISSUE_ORDER.length-missing.length)/ISSUE_ORDER.length)*100))};}
  function rowHtml(x){
    const m=x.match,comp=eff(m,'competition_name')||m?.competition?.name||'',missing=x.missing.length?`<span class="b3k-sheet-admin-missing"><b>Manque :</b> ${x.missing.map(v=>esc(v.label)).join(' · ')}</span>`:`<span class="b3k-sheet-admin-complete">Données obligatoires complètes</span>`;
    return `<article class="b3k-sheet-admin-row is-${x.status.key}" data-sheet-admin-row data-status="${x.status.key}" data-decade="${x.decade||''}" data-missing="${esc(x.missingKeys.join(','))}" data-search="${esc(norm([x.number,opponent(m),fmtDate(eff(m,'match_date')),comp].join(' ')))}"><span class="b3k-sheet-admin-number">#${esc(x.number||'—')}</span><div class="b3k-sheet-admin-main"><strong>France – ${esc(opponent(m))}</strong><small>${esc(fmtDate(eff(m,'match_date')))}${comp?` · ${esc(comp)}`:''}</small>${missing}</div><div class="b3k-sheet-admin-quality"><b>${x.completion}%</b><span class="b3k-sheet-admin-quality-bar"><i style="width:${x.completion}%"></i></span></div><span class="b3k-sheet-admin-status is-${x.status.key}" title="${esc(x.status.detail)}">${esc(x.status.label)}</span><button type="button" class="b3k-sheet-admin-open" data-sheet-admin-open="${esc(m.id)}">Ouvrir</button></article>`;
  }
  function decadesHtml(rows){
    const groups=new Map();for(const x of rows){if(!x.decade)continue;if(!groups.has(x.decade))groups.set(x.decade,[]);groups.get(x.decade).push(x);}
    return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([d,list])=>{const complete=list.filter(x=>x.status.key==='yes').length,pct=list.length?Math.round(complete/list.length*100):0;return `<button type="button" class="b3k-sheet-decade" data-quality-decade="${d}"><span>${d}–${d+9}</span><b>${complete}/${list.length}</b><i><em style="width:${pct}%"></em></i><small>${pct}%</small></button>`;}).join('');
  }
  function issueButtonsHtml(rows){
    return ISSUE_ORDER.map(key=>{const n=rows.filter(x=>x.missingKeys.includes(key)).length;return `<button type="button" class="b3k-sheet-issue ${n?'':'is-zero'}" data-quality-missing="${key}"><span>${esc(ISSUE_LABELS[key])}</span><b>${n}</b></button>`;}).join('');
  }
  function applyFilters(host){
    const q=norm($('#matchSheetAdminSearch',host)?.value||''),f=$('#matchSheetAdminFilter',host)?.value||'all',missing=$('#matchSheetAdminMissing',host)?.value||'all',decade=$('#matchSheetAdminDecade',host)?.value||'all';let shown=0;
    $$('[data-sheet-admin-row]',host).forEach(r=>{const issues=String(r.dataset.missing||'').split(',').filter(Boolean);const ok=(f==='all'||r.dataset.status===f)&&(missing==='all'||issues.includes(missing))&&(decade==='all'||r.dataset.decade===decade)&&(!q||String(r.dataset.search||'').includes(q));r.hidden=!ok;if(ok)shown++;});
    const count=$('#matchSheetAdminVisibleCount',host);if(count)count.textContent=`${shown} match${shown>1?'s':''}`;
  }
  function bindPresetButtons(host){
    $$('[data-quality-status]',host).forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.qualityStatus||'all';const el=$('#matchSheetAdminFilter',host);if(el)el.value=v;applyFilters(host);}));
    $$('[data-quality-missing]',host).forEach(b=>b.addEventListener('click',()=>{const el=$('#matchSheetAdminMissing',host);if(el)el.value=b.dataset.qualityMissing||'all';applyFilters(host);}));
    $$('[data-quality-decade]',host).forEach(b=>b.addEventListener('click',()=>{const el=$('#matchSheetAdminDecade',host);if(el)el.value=b.dataset.qualityDecade||'all';applyFilters(host);}));
  }
  async function render(host){
    if(!host)return;if(!isAdmin()){host.innerHTML='<div class="c3k-v8-status is-error">Accès réservé aux ADMIN et SUPERADMIN.</div>';return;}
    host.innerHTML='<div class="c3k-v8-muted">Analyse complète de la qualité des feuilles…</div>';
    try{
      await refs()?.load?.();try{await window.BLEUS3000_JERSEYS?.load?.();}catch(err){console.warn('Centre qualité · maillots',err);}
      try{qualityContext={starterCounts:buildStarterCounts(await fetchAllAppearances())};}catch(err){console.warn('Centre qualité · compositions',err);qualityContext={starterCounts:new Map()};}
      const rows=(refs()?.matches||[]).filter(isPast).map(summaryForMatch).sort((a,b)=>(b.number||0)-(a.number||0));
      const counts={yes:rows.filter(x=>x.status.key==='yes').length,partial:rows.filter(x=>x.status.key==='partial').length,no:rows.filter(x=>x.status.key==='no').length};
      const pct=rows.length?Math.round(counts.yes/rows.length*1000)/10:0;
      const needsRevalidation=rows.filter(x=>String(x.match?.sheet_validation_status||'')==='needs_validation'||(String(x.match?.sheet_validation_status||'')==='validated'&&x.missing.length)).length;
      const decades=[...new Set(rows.map(x=>x.decade).filter(Boolean))].sort((a,b)=>a-b);
      host.innerHTML=`<section class="b3k-sheet-admin"><header class="b3k-sheet-admin-head"><div><strong>Qualité des feuilles de match</strong><span>Contrôle des archives France A · données réelles, même après validation</span></div><div class="b3k-sheet-admin-global"><b>${pct}%</b><small>validées complètes</small></div></header>
        <div class="b3k-sheet-quality-kpis"><button type="button" class="is-yes" data-quality-status="yes"><b>${counts.yes}</b><span>Validées complètes</span><small>sur ${rows.length}</small></button><button type="button" class="is-partial" data-quality-status="partial"><b>${counts.partial}</b><span>Partielles / à corriger</span><small>${needsRevalidation} à revalider</small></button><button type="button" class="is-no" data-quality-status="no"><b>${counts.no}</b><span>Non renseignées</span><small>aucune base exploitable</small></button><button type="button" class="is-all" data-quality-status="all"><b>${rows.length}</b><span>Total historique</span><small>matchs joués</small></button></div>
        <section class="b3k-sheet-quality-block"><div class="b3k-sheet-quality-title"><strong>Informations manquantes</strong><span>Clique sur un compteur pour filtrer</span></div><div class="b3k-sheet-issues">${issueButtonsHtml(rows)}</div></section>
        <section class="b3k-sheet-quality-block"><div class="b3k-sheet-quality-title"><strong>Progression par décennie</strong><span>Validées complètes / matchs joués</span></div><div class="b3k-sheet-decades">${decadesHtml(rows)}</div></section>
        <div class="b3k-sheet-admin-tools"><input id="matchSheetAdminSearch" type="search" placeholder="N° match, adversaire, année…" autocomplete="off"><select id="matchSheetAdminFilter"><option value="all">Tous les états</option><option value="no">Non renseignées</option><option value="partial">Partielles / à revalider</option><option value="yes">Validées complètes</option></select><select id="matchSheetAdminMissing"><option value="all">Toutes les informations</option>${ISSUE_ORDER.map(k=>`<option value="${k}">Manque : ${esc(ISSUE_LABELS[k])}</option>`).join('')}</select><select id="matchSheetAdminDecade"><option value="all">Toutes les décennies</option>${decades.map(d=>`<option value="${d}">${d}–${d+9}</option>`).join('')}</select><span id="matchSheetAdminVisibleCount">${rows.length} matchs</span></div>
        <div class="b3k-sheet-admin-legend"><span><i class="is-yes"></i> Validée complète</span><span><i class="is-partial"></i> Partielle / à revalider</span><span><i class="is-no"></i> Non renseignée</span></div><div class="b3k-sheet-admin-list">${rows.map(rowHtml).join('')||'<div class="c3k-v8-muted">Aucun match joué.</div>'}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="matchSheetAdminBack" type="button">Retour</button></div></section>`;
      ['matchSheetAdminSearch'].forEach(id=>$('#'+id,host)?.addEventListener('input',()=>applyFilters(host)));['matchSheetAdminFilter','matchSheetAdminMissing','matchSheetAdminDecade'].forEach(id=>$('#'+id,host)?.addEventListener('change',()=>applyFilters(host)));bindPresetButtons(host);
      $$('[data-sheet-admin-open]',host).forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.sheetAdminOpen,backdrop=$('#c3kV8AccountBackdrop');if(backdrop)backdrop.hidden=true;document.body.style.overflow='';refs()?.openMatchSheet?.(id);}));
    }catch(err){console.error('Administration feuilles de match',err);host.innerHTML=`<div class="c3k-v8-status is-error">${esc(err?.message||err)}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="matchSheetAdminBack" type="button">Retour</button></div>`;}
  }
  window.BLEUS3000_MATCH_SHEET_ADMIN={render,summaryForMatch};
})();
