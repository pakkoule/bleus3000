/* 3615 Bleus V1.3.9 — Le Bleu Moyen */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>window.BLEUS3000_SUPABASE||null;
  const CACHE_PREFIX='bleus3000:bleu-moyen:v1:';
  const CACHE_TTL=12*60*60*1000;
  const CURRENT_YEAR=new Date().getFullYear();
  const periods=[
    {key:'global',label:'GLOBAL',start:null,end:null},
    {key:'1904_1939',label:'1904–1939',start:1904,end:1939},
    {key:'1940_1969',label:'1940–1969',start:1940,end:1969},
    {key:'1970_1997',label:'1970–1997',start:1970,end:1997},
    {key:'1998_2011',label:'1998–2011',start:1998,end:2011},
    {key:'2012_now',label:`2012–${CURRENT_YEAR}`,start:2012,end:CURRENT_YEAR}
  ];
  const state={period:'global',graphMetric:'selections',data:null,loading:false};
  const metricLabels={selections:'Sélections',starts:'Titularisations',goals:'Buts',career_days:'Durée de carrière',age_first_days:'Âge première sélection',age_last_days:'Âge dernière sélection'};

  function readCache(key){try{const x=JSON.parse(localStorage.getItem(CACHE_PREFIX+key)||'null');if(!x||Date.now()-Number(x.at||0)>CACHE_TTL)return null;return x.data||null;}catch{return null;}}
  function writeCache(key,data){try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({at:Date.now(),data}));}catch{}}
  function clearCache(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(CACHE_PREFIX))localStorage.removeItem(k);}}catch{}}
  function periodDef(key=state.period){return periods.find(x=>x.key===key)||periods[0];}
  async function loadPeriod(key=state.period,{force=false}={}){
    const def=periodDef(key);if(!force){const cached=readCache(def.key);if(cached)return cached;}
    const c=client();if(!c)throw new Error('Supabase indisponible');
    const {data,error}=await c.rpc('get_bleu_moyen_stats',{p_start_year:def.start,p_end_year:def.end});
    if(error)throw error;writeCache(def.key,data);return data;
  }
  function num(v,d=1){const x=Number(v);return Number.isFinite(x)?x.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function natural(v){const x=Number(v);if(!Number.isFinite(x))return'—';return Math.abs(x-Math.round(x))<.05?Math.round(x).toLocaleString('fr-FR'):num(x,1);}
  function pct(v){const x=Number(v);return Number.isFinite(x)?`${num(x*100,1)} %`:'—';}
  function daysText(v){const d=Number(v);if(!Number.isFinite(d))return'—';const months=Math.round(d/30.436875),y=Math.floor(months/12),m=months%12;return y?`${y} an${y>1?'s':''}${m?` ${m} mois`:''}`:`${m} mois`;}
  function quality(m){return String(m?.quality||'none');}
  function metricValue(m,formatter=natural,{force=false}={}){if(!m)return'—';const q=quality(m);if(!force&&q==='low')return'—';return formatter(m.mean);}
  function qualityPill(m,{force=false}={}){if(!m)return'';const c=Number(m.coverage_pct||0),q=quality(m);if(force)return `<span class="bm-quality is-scoped">${esc(m.count||0)} joueur${Number(m.count)!==1?'s':''}</span>`;if(q==='good')return `<span class="bm-quality is-good">${num(c,0)} % couverts</span>`;if(q==='partial')return `<span class="bm-quality is-partial">Données partielles · ${num(c,0)} %</span>`;return `<span class="bm-quality is-low">Données insuffisantes · ${num(c,0)} %</span>`;}
  function statCard(icon,label,m,formatter=natural,opts={}){return `<article class="bm-stat ${quality(m)==='low'&&!opts.force?'is-muted':''}"><span>${icon}</span><div><small>${esc(label)}</small><strong>${esc(metricValue(m,formatter,opts))}</strong>${qualityPill(m,opts)}</div></article>`;}
  function eraLabel(){const p=periodDef();return p.key==='global'?`1904 — ${CURRENT_YEAR}`:p.label.replace('–',' — ');}
  function silhouette(){return `<div class="bm-silhouette" aria-hidden="true"><i class="bm-head"></i><i class="bm-body"></i><i class="bm-shirt"><b>FRA</b></i><i class="bm-leg bm-leg-a"></i><i class="bm-leg bm-leg-b"></i></div>`;}
  function evolutionSvg(data,metric){const rows=(data?.evolution||[]).filter(r=>r?.[metric]!==null&&r?.[metric]!==undefined&&Number.isFinite(Number(r[metric])));const vals=rows.map(r=>Number(r[metric]));if(!rows.length||!vals.length)return'<div class="bm-empty">Pas assez de données.</div>';const W=760,H=220,P=32,min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min);const x=i=>P+i*((W-P*2)/Math.max(1,rows.length-1)),y=v=>H-P-((Number(v)-min)/span)*(H-P*2);const pts=rows.map((r,i)=>`${x(i).toFixed(1)},${y(r[metric]).toFixed(1)}`).join(' ');return `<div class="bm-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du Bleu moyen"><line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" class="bm-axis"/><polyline points="${pts}" class="bm-line" fill="none"/>${rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r[metric])}" r="5" class="bm-dot"/><text x="${x(i)}" y="${H-8}" text-anchor="middle">${esc(r.label.replace('Aujourd’hui',String(CURRENT_YEAR)))}</text>`).join('')}</svg></div>`;}
  function evolutionTable(data){return `<div class="bm-era-table"><div class="bm-era-row is-head"><span>Époque</span><span>Sélections</span><span>Carrière</span><span>Buts</span><span>Titularisations</span></div>${(data?.evolution||[]).map(r=>`<div class="bm-era-row"><strong>${esc(r.label.replace('Aujourd’hui',String(CURRENT_YEAR)))}</strong><span>${natural(r.selections)}</span><span>${daysText(r.career_days)}</span><span>${natural(r.goals)}</span><span>${natural(r.starts)}</span></div>`).join('')}</div>`;}
  function detailMetric(label,m,formatter=natural){if(!m||quality(m)==='low')return'';return `<div class="bm-detail-metric"><strong>${esc(label)}</strong><span>Moy. ${esc(formatter(m.mean))}</span><span>Méd. ${esc(formatter(m.median))}</span><small>P25 ${esc(formatter(m.p25))} · P75 ${esc(formatter(m.p75))}</small>${qualityPill(m)}</div>`;}
  function renderHtml(data){const m=data?.metrics||{},q=data?.quality||{};const vr=m.victory_rate;const firstGoal=m.first_goal_selection;const assists=m.assists;return `<section class="bm-module">
    <header class="bm-top"><div><span class="bm-kicker">RÉFÉRENCE STATISTIQUE 3615</span><h3>👤 LE BLEU MOYEN</h3><p>International fictif construit à partir des joueurs ayant réellement disputé au moins un match avec l’Équipe de France masculine A.</p></div><label>Époque<select id="bleuMoyenPeriod">${periods.map(p=>`<option value="${p.key}" ${p.key===state.period?'selected':''}>${esc(p.label.replace(String(CURRENT_YEAR),'AUJOURD’HUI'))}</option>`).join('')}</select></label></header>
    <article class="bm-profile"><div class="bm-portrait">${silhouette()}<span>${esc(eraLabel())}</span></div><div class="bm-identity"><span>👤 PROFIL FICTIF</span><h4>LE BLEU MOYEN</h4><p>${data.population} internationaux dans cette population de référence.</p><button type="button" class="bm-info" data-bm-method>ⓘ Méthode</button></div><div class="bm-main-grid">
      ${statCard('🎂','Première sélection',m.age_first_days,daysText)}
      ${statCard('🎂','Dernière sélection',m.age_last_days,daysText)}
      ${statCard('⏳','Carrière internationale',m.career_days,daysText)}
      ${statCard('🇫🇷','Sélections',m.selections,natural)}
      ${statCard('👕','Titularisations',m.starts,natural)}
      ${statCard('⚽','Buts',m.goals,natural)}
      ${statCard('🏆','Taux de victoires',vr,pct)}
    </div></article>
    <section class="bm-section"><div class="bm-section-head"><div><strong>SA CARRIÈRE TYPE</strong><small>Moyennes individuelles · données historiques disponibles</small></div></div><div class="bm-career-grid">
      <article class="bm-stat bm-record-card"><span>🏅</span><div><small>Victoires · Nuls · Défaites</small><strong>${esc(`${natural(m.wins?.mean)} · ${natural(m.draws?.mean)} · ${natural(m.losses?.mean)}`)}</strong>${qualityPill(m.wins)}</div></article>
      ${statCard('⚽','Premier but',firstGoal,v=>`${natural(v)}e sélection`,{force:true})}
      ${statCard('🔢','Numéros différents',m.numbers,natural)}
      ${statCard('🌍','Adversaires différents',m.opponents,natural)}
      ${statCard('🏆','Compétitions',m.competitions,natural)}
      ${statCard('🧑‍🏫','Sélectionneurs connus',m.coaches,natural)}
      ${statCard('📅','Années avec sélection',m.calendar_years,natural)}
    </div>${firstGoal?`<p class="bm-footnote">Un Bleu buteur inscrit en moyenne son premier but lors de sa <strong>${esc(natural(firstGoal.mean))}e sélection</strong> · calcul sur ${esc(firstGoal.count)} joueurs ayant marqué au moins une fois.</p>`:''}${assists?.quality==='low'?`<p class="bm-footnote is-warning">🅰️ Passes décisives masquées : couverture actuelle ${esc(num(assists.coverage_pct,1))} %, insuffisante pour représenter toute l’histoire.</p>`:''}</section>
    <section class="bm-section"><div class="bm-section-head"><div><strong>ÉVOLUTION DU BLEU MOYEN</strong><small>Époque d’appartenance = année de la première sélection</small></div><label>Métrique<select id="bleuMoyenGraphMetric">${Object.entries(metricLabels).map(([k,l])=>`<option value="${k}" ${state.graphMetric===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div>${evolutionSvg(data,state.graphMetric)}${evolutionTable(data)}</section>
    <details class="bm-section bm-more"><summary>EN SAVOIR PLUS</summary><div class="bm-detail-grid">${[
      detailMetric('Sélections',m.selections),detailMetric('Titularisations',m.starts),detailMetric('Buts',m.goals),detailMetric('Carrière',m.career_days,daysText),detailMetric('Adversaires',m.opponents),detailMetric('Compétitions',m.competitions),detailMetric('Stades',m.stadiums),detailMetric('Pays',m.countries),detailMetric('Taux de victoire',m.victory_rate,pct),detailMetric('Part de titularisations',m.start_ratio,pct),detailMetric('Matchs Coupe du Monde',m.world_cup_matches),detailMetric('Matchs Euro',m.euro_matches)
    ].filter(Boolean).join('')}</div></details>
    <section class="bm-quality-panel"><strong>QUALITÉ DES DONNÉES</strong><div><span>Dates de naissance <b>${esc(num(q.birth_dates?.coverage_pct,1))} %</b></span><span>Apparitions exploitées <b>${esc(num(q.validated_appearances_pct,1))} %</b></span><span>Numéros renseignés <b>${esc(num(q.numbers_known_appearances_pct,1))} %</b></span><span>Lieux renseignés <b>${esc(num(q.place_known_appearances_pct,1))} %</b></span></div><p>Une valeur &lt; 50 % est masquée par défaut ; entre 50 et 80 %, elle est signalée comme donnée partielle.</p></section>
    <details class="bm-method" data-bm-method-box><summary>ⓘ Comment est calculé le Bleu Moyen ?</summary><p>Le Bleu Moyen est un joueur fictif calculé à partir des statistiques des internationaux de l’Équipe de France masculine A présents dans 3615 Bleus. Les valeurs évoluent lorsque la base historique est complétée ou corrigée.</p><p>Certaines statistiques historiques sont calculées sur un sous-ensemble de joueurs quand la donnée ancienne est incomplète. Une absence de donnée n’est jamais transformée en zéro par le module.</p><p><strong>Version statistique :</strong> ${esc(data.stats_version||'—')}</p></details>
  </section>`;}
  async function mount(host){host=host||$('#bleuMoyenMount');if(!host)return;const cached=readCache(state.period);if(cached){state.data=cached;host.innerHTML=renderHtml(cached);bind(host);return;}host.innerHTML='<div class="bm-loading">Calcul du Bleu Moyen…</div>';if(state.loading)return;state.loading=true;try{const data=await loadPeriod(state.period);state.data=data;host.innerHTML=renderHtml(data);bind(host);}catch(e){host.innerHTML=`<div class="bm-empty">Impossible de calculer le Bleu Moyen : ${esc(e?.message||e)}</div>`;}finally{state.loading=false;}}
  function bind(host){$('#bleuMoyenPeriod',host)?.addEventListener('change',e=>{state.period=e.target.value;state.data=null;mount(host);});$('#bleuMoyenGraphMetric',host)?.addEventListener('change',e=>{state.graphMetric=e.target.value;if(state.data){host.innerHTML=renderHtml(state.data);bind(host);}});$('[data-bm-method]',host)?.addEventListener('click',()=>{const d=$('[data-bm-method-box]',host);if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});}});}

  async function loadComparison(playerId){const key=`player:${playerId}`;const cached=readCache(key);if(cached)return cached;const c=client();if(!c)return null;const {data,error}=await c.rpc('get_bleu_moyen_player_comparison',{p_player_id:playerId});if(error)throw error;if(data)writeCache(key,data);return data;}
  function relPhrase(label,value,avg,kind='ratio') {const v=Number(value),a=Number(avg);if(!Number.isFinite(v)||!Number.isFinite(a)||a===0)return null;if(kind==='days'){const delta=v-a,abs=daysText(Math.abs(delta));return `${label} ${abs} ${delta<0?'plus tôt':'plus tard'} que la moyenne`;}if(kind==='career'){const delta=v-a,abs=daysText(Math.abs(delta));return `Carrière internationale ${abs} ${delta>=0?'plus longue':'plus courte'}`;}if(kind==='pct'){const diff=(v-a)*100;return `${label} ${Math.abs(diff).toLocaleString('fr-FR',{maximumFractionDigits:1})} point${Math.abs(diff)>=2?'s':''} ${diff>=0?'au-dessus':'en dessous'} de la moyenne`;}const ratio=v/a;if(ratio>=1.12)return `${ratio.toLocaleString('fr-FR',{maximumFractionDigits:1})} × plus de ${label.toLowerCase()} que le Bleu moyen`;if(ratio<=.88)return `${Math.round((1-ratio)*100)} % de ${label.toLowerCase()} en moins que le Bleu moyen`;return `${label} proche du Bleu moyen`;}
  function comparisonHtml(d){const p=d?.player||{},a=d?.average||{},pc=d?.percentiles||{};const phrases=[
    relPhrase('Sélections',p.selections,a.selections),relPhrase('Buts',p.goals,a.goals),relPhrase('Titularisations',p.starts,a.starts),relPhrase('Carrière',p.career_days,a.career_days,'career'),relPhrase('Adversaires',p.opponents,a.opponents),relPhrase('Compétitions',p.competitions,a.competitions),relPhrase('Taux de victoire',p.victory_rate,a.victory_rate,'pct')
  ].filter(Boolean).sort((x,y)=>y.length-x.length).slice(0,5);const percentileRows=[['Sélections',pc.selections,v=>`plus sélectionné que ${num(v,1)} % des Bleus`],['Buts',pc.goals,v=>`a marqué plus que ${num(v,1)} % des Bleus`],['Carrière',pc.career_days,v=>`plus longue que ${num(v,1)} % des Bleus`],['Titularisations',pc.starts,v=>`plus titulaire que ${num(v,1)} % des Bleus`],['Adversaires',pc.opponents,v=>`en a affronté plus que ${num(v,1)} % des Bleus`]].filter(([,v])=>Number.isFinite(Number(v))).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,3);return `<section class="bleu-moyen-player-comparison"><div class="bmp-head"><span>👤</span><div><small>COMPARAISON AU BLEU MOYEN</small><strong>ÊTES-VOUS UN BLEU ORDINAIRE ?</strong></div></div><div class="bmp-phrases">${phrases.map(x=>`<p>${esc(x)}</p>`).join('')}</div><div class="bmp-percentiles">${percentileRows.map(([l,v,f])=>`<span><b>${esc(l)}</b><em>${esc(f(v))}</em></span>`).join('')}</div><button type="button" data-open-bleu-moyen>Voir le Bleu Moyen ↗</button></section>`;}
  async function mountPlayerComparison(tile,playerId){if(!tile||!playerId||$('.bleu-moyen-player-comparison',tile))return;const content=$('.selection-row-detail-content',tile);if(!content)return;let placeholder=$('.bleu-moyen-player-comparison-loading',content);if(!placeholder){placeholder=document.createElement('div');placeholder.className='bleu-moyen-player-comparison-loading';placeholder.textContent='Comparaison au Bleu Moyen…';const matches=$('.selection-player-matches',content);matches?.insertAdjacentElement('beforebegin',placeholder);}try{const d=await loadComparison(playerId);if(!d){placeholder?.remove();return;}placeholder.outerHTML=comparisonHtml(d);$('[data-open-bleu-moyen]',content)?.addEventListener('click',open);}catch{placeholder?.remove();}}
  function open(){window.BLEUS3000_APP?.openReferences?.('statistiques');setTimeout(()=>window.BLEUS3000_STATISTICS?.setTab?.('bleu_moyen'),120);}
  function invalidate(){clearCache();state.data=null;}
  const relevant=new Set(['players','matches','match_appearances','match_goal_events','competitions','competition_entities','competition_editions','personnel','places','opponents']);
  window.addEventListener('bleus:data-mutated',e=>{const t=e.detail?.tables||[];if(t.includes('*')||t.some(x=>relevant.has(x)))invalidate();});
  window.addEventListener('bleus:force-refresh',invalidate);
  window.BLEUS3000_BLEU_MOYEN={mount,mountPlayerComparison,open,invalidate,loadPeriod,loadComparison};
})();
