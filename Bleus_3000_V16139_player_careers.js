/* 3615 Bleus V1.1.61.39 — Joueurs & carrières : timeline, maillots, comparateur, exports, pagination */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(+d)?String(v):d.toLocaleDateString('fr-FR');};
  const isoDay=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(+d)?'':d.toISOString().slice(0,10);};
  const client=()=>window.BLEUS3000_SUPABASE||null;
  const rows=()=>window.BLEUS3000_SELECTIONS?.rows||[];
  const rowFor=id=>rows().find(r=>String(r.player_id)===String(id));
  const playerFor=id=>rowFor(id)?.player||{};
  const role=()=>window.C3K_ACCOUNT_STATE?.profile?.role||'guest';
  const canEdit=()=>['admin','superadmin'].includes(role());
  const careerCache=new Map();
  const tagCache=new Map();
  const matchViewState=new Map();
  let observerTimer=0;

  function playerPhotoUrl(p){
    const path=String(p?.photo_path||'').trim(),c=client();if(!path||!c)return '';
    try{return c.storage.from('player-photos').getPublicUrl(path).data.publicUrl||'';}catch{return '';}
  }
  function playerName(id){return playerFor(id)?.display_name||rowFor(id)?.player?.last_name||'Joueur';}
  function positions(id){const p=playerFor(id),a=[p?.primary_position,...(p?.secondary_positions||[])].filter(Boolean);return [...new Set(a)].join(' · ')||'Poste non renseigné';}
  function resultLabel(m){const a=m?.france_score,b=m?.opponent_score;if(a==null||b==null)return '';return a>b?'Victoire':a<b?'Défaite':'Nul';}

  async function loadCareer(playerId,force=false){
    playerId=String(playerId||'');if(!playerId)return null;
    if(!force&&careerCache.has(playerId))return careerCache.get(playerId);
    const c=client();if(!c)return null;
    const [{data:apps,error:ae},{data:callups,error:ce}]=await Promise.all([
      c.from('match_appearances').select(`match_id,starter,minutes,shirt_number,position,goals,assists,captain,match:matches!match_appearances_match_id_fkey(id,match_date,france_score,opponent_score,status,home_away,competition_edition_id,opponent:opponents(name),competition:competitions(id,name,tag_id))`).eq('player_id',playerId).limit(1000),
      c.from('callup_players').select(`status,first_callup,replacement_for,callup:callups(id,title,announcement_date,start_date,end_date,status)`).eq('player_id',playerId).limit(500)
    ]);
    if(ae)console.warn('Carrière joueur · matchs',ae);
    if(ce)console.warn('Carrière joueur · rassemblements',ce);
    const appearances=(apps||[]).filter(x=>x.match).sort((a,b)=>new Date(a.match.match_date)-new Date(b.match.match_date));
    const matchIds=[...new Set(appearances.map(x=>x.match_id).filter(Boolean))];
    let matchJerseys=[];
    if(matchIds.length){
      const {data,error}=await c.from('match_jerseys').select(`match_id,jersey_id,role,jersey:jerseys(id,title,season_label,usage_type,main_photo_url,main_photo_path)`).in('match_id',matchIds).limit(2000);
      if(!error)matchJerseys=data||[];else console.warn('Carrière joueur · maillots',error);
    }
    const byMatch=new Map();matchJerseys.forEach(x=>{const a=byMatch.get(String(x.match_id))||[];a.push(x);byMatch.set(String(x.match_id),a);});
    appearances.forEach(a=>a._kits=byMatch.get(String(a.match_id))||[]);
    const competitionTagIds=[...new Set(appearances.map(a=>a.match?.competition?.tag_id).filter(Boolean))];
    let competitionTags=[];
    if(competitionTagIds.length){
      const missing=competitionTagIds.filter(id=>!tagCache.has(String(id)));
      if(missing.length){
        const {data,error}=await c.from('tags').select('*').in('id',missing).limit(500);
        if(!error)(data||[]).forEach(t=>tagCache.set(String(t.id),t));
      }
      competitionTags=competitionTagIds.map(id=>tagCache.get(String(id))).filter(Boolean);
    }
    const gatherings=(callups||[]).filter(x=>x.callup).sort((a,b)=>new Date(a.callup.announcement_date||a.callup.start_date||0)-new Date(b.callup.announcement_date||b.callup.start_date||0));
    const first=appearances[0]||null,last=appearances[appearances.length-1]||null;
    const data={playerId,appearances,gatherings,competitionTags,first,last,loadedAt:Date.now()};
    careerCache.set(playerId,data);return data;
  }

  function matchRowHtml(a){
    const m=a.match||{},opp=m.opponent?.name||'Adversaire',date=fmtDate(m.match_date),score=(m.france_score!=null&&m.opponent_score!=null)?`${m.france_score} – ${m.opponent_score}`:'VS';
    const kit=a._kits?.find(k=>k.role==='outfield')||a._kits?.[0];
    const meta=[m.competition?.name,a.position,a.shirt_number!=null?`N° ${a.shirt_number}`:'',a.starter?'Titulaire':'Entré en jeu',a.goals?`${a.goals} but${a.goals>1?'s':''}`:'',a.captain?'Capitaine':'',kit?.jersey?.title?`Maillot : ${kit.jersey.title}`:''].filter(Boolean).join(' · ');
    return `<button type="button" class="selection-player-match-row" data-player-open-match="${esc(m.id)}"><span><strong>France ${esc(score)} ${esc(opp)}</strong><small>${esc(date)}${meta?' · '+esc(meta):''}</small></span><em>${esc(resultLabel(m))}</em></button>`;
  }
  function matchControlsHtml(playerId,total,state){
    if(total<=5)return `<div class="player-match-order-only"><button type="button" data-player-match-order="${esc(playerId)}" title="Inverser l’ordre">${state.order==='desc'?'↓ Récent → ancien':'↑ Ancien → récent'}</button></div>`;
    const pages=Math.max(1,Math.ceil(total/5));return `<div class="player-match-pager"><button type="button" data-player-match-prev="${esc(playerId)}" ${state.page<=1?'disabled':''}>←</button><span>${state.page}/${pages}</span><button type="button" data-player-match-next="${esc(playerId)}" ${state.page>=pages?'disabled':''}>→</button><button type="button" data-player-match-order="${esc(playerId)}">${state.order==='desc'?'↓ Récent → ancien':'↑ Ancien → récent'}</button></div>`;
  }
  async function renderMatchHistory(playerId){
    const host=$(`[data-player-match-list="${CSS.escape(String(playerId))}"]`);if(!host)return;
    const data=await loadCareer(playerId);if(!data)return;
    const state=matchViewState.get(String(playerId))||{page:1,order:'desc'};matchViewState.set(String(playerId),state);
    let list=[...data.appearances];if(state.order==='desc')list.reverse();
    const pages=Math.max(1,Math.ceil(list.length/5));state.page=Math.max(1,Math.min(state.page,pages));
    const slice=list.slice((state.page-1)*5,state.page*5),renderKey=`${list.length}:${state.page}:${state.order}`;
    const section=host.closest('.selection-player-matches');const head=$('.selection-player-matches-head',section);
    if(head&&!$('.player-match-controls',head)){const c=document.createElement('div');c.className='player-match-controls';head.appendChild(c);}
    const ctrl=$('.player-match-controls',head);
    if(host.dataset.careerRenderKey===renderKey&&host.querySelector('[data-career-owned]'))return;
    if(ctrl)ctrl.innerHTML=matchControlsHtml(playerId,list.length,state);
    host.style.maxHeight='none';host.style.overflow='visible';host.dataset.careerRenderKey=renderKey;host.innerHTML=slice.length?`<div data-career-owned> ${slice.map(matchRowHtml).join('')}</div>`:'<div data-career-owned class="selection-player-match-empty">Aucun match lié à une feuille de match pour le moment.</div>';
    $$('[data-player-open-match]',host).forEach(b=>b.addEventListener('click',()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.playerOpenMatch)));
    ctrl?.querySelector('[data-player-match-prev]')?.addEventListener('click',()=>{state.page--;renderMatchHistory(playerId);});
    ctrl?.querySelector('[data-player-match-next]')?.addEventListener('click',()=>{state.page++;renderMatchHistory(playerId);});
    ctrl?.querySelector('[data-player-match-order]')?.addEventListener('click',()=>{state.order=state.order==='desc'?'asc':'desc';state.page=1;renderMatchHistory(playerId);});
  }

  function timelineEvents(data){
    const events=[];
    data.gatherings.forEach((g,i)=>{const c=g.callup,date=c.announcement_date||c.start_date;if(!date)return;events.push({date,label:i===0||g.first_callup?'Première convocation':'Rassemblement',detail:c.title||'Rassemblement France A',kind:g.first_callup?'first-callup':'callup'});});
    data.appearances.forEach((a,i)=>{const m=a.match,date=m.match_date;if(!date)return;events.push({date,label:i===0?'Première sélection':(i===data.appearances.length-1?'Dernière sélection':'Match'),detail:`${m.opponent?.name||'Adversaire'}${a.goals?` · ⚽ ${a.goals}`:''}${a.captain?' · © Capitaine':''}`,kind:i===0?'first-selection':(i===data.appearances.length-1?'last-selection':'match'),matchId:m.id});});
    return events.sort((a,b)=>new Date(a.date)-new Date(b.date));
  }
  function timelineHtml(data){
    const ev=timelineEvents(data);if(!ev.length)return '<div class="player-career-empty">Aucun événement de carrière lié pour le moment.</div>';
    return `<div class="player-career-timeline">${ev.map((e,i)=>`<button type="button" class="player-career-event is-${esc(e.kind)}" ${e.matchId?`data-career-open-match="${esc(e.matchId)}"`:''} title="${esc(e.detail)}"><span class="player-career-dot"></span><small>${esc(fmtDate(e.date))}</small><strong>${esc(e.label)}</strong><em>${esc(e.detail)}</em></button>`).join('')}</div>`;
  }
  async function enhanceCareer(playerId){
    const tile=$(`[data-player-tile="${CSS.escape(String(playerId))}"]`);if(!tile||!tile.classList.contains('is-open'))return;
    const content=$('.selection-row-detail-content',tile);if(!content)return;
    let range=$('.player-career-range',content);if(!range){range=document.createElement('div');range.className='player-career-range';const tags=$('.selection-tags',content);tags?.insertAdjacentElement('beforebegin',range);}
    let timeline=$('.player-career-timeline-wrap',content);if(!timeline){timeline=document.createElement('section');timeline.className='player-career-timeline-wrap';timeline.innerHTML='<div class="player-career-timeline-head"><strong>Timeline internationale</strong><small>Convocations · rassemblements · matchs · buts · capitanats</small></div><div class="player-career-timeline-loading">Chargement…</div>';const footer=$('footer',content);footer?footer.insertAdjacentElement('beforebegin',timeline):content.appendChild(timeline);}
    const data=await loadCareer(playerId);if(!data)return;
    if(!range.dataset.careerReady){range.innerHTML=`<span><small>Première sélection</small><strong>${data.first?fmtDate(data.first.match.match_date):'—'}</strong></span><i>→</i><span><small>Dernière sélection</small><strong>${data.last?fmtDate(data.last.match.match_date):'—'}</strong></span>`;range.dataset.careerReady='1';}
    const tagHost=$('.selection-tags',content);if(tagHost&&!tagHost.dataset.careerCompetitions){tagHost.dataset.careerCompetitions='1';if(data.competitionTags.length){const label=document.createElement('span');label.className='player-competition-label';label.textContent='Compétitions disputées';tagHost.appendChild(label);data.competitionTags.forEach(t=>{const wrap=document.createElement('span');wrap.className='player-competition-tag';wrap.innerHTML=window.BLEUS3000_TAGS?.chipHtml?window.BLEUS3000_TAGS.chipHtml(t,'selection-linked-tag-chip'):`<span class="selection-main-tag">${esc(t.icon_text||'🏆')} ${esc(t.label_text)}</span>`;tagHost.appendChild(wrap);});}}
    if(!timeline.dataset.careerReady){timeline.innerHTML=`<div class="player-career-timeline-head"><strong>Timeline internationale</strong><small>Convocations · rassemblements · matchs · buts · capitanats</small></div>${timelineHtml(data)}`;timeline.dataset.careerReady='1';$$('[data-career-open-match]',timeline).forEach(b=>b.addEventListener('click',()=>window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.careerOpenMatch)));}
    await renderMatchHistory(playerId);
  }

  function ensureKitMatchesModal(){
    let m=$('#playerKitMatchesModal');if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop player-kit-matches" id="playerKitMatchesModal" hidden><section class="modal-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2 id="playerKitMatchesTitle">Matchs par numéro</h2><p id="playerKitMatchesSub">Historique du joueur</p></div><button class="modal-close" type="button" data-player-kit-close>×</button></header><div class="modal-body"><div class="player-position-match-list" id="playerKitMatchesList"></div></div></section></div>`);m=$('#playerKitMatchesModal');m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-player-kit-close]')){m.hidden=true;document.body.style.overflow='';}});return m;
  }
  async function openNumberMatches(playerId,number){
    const modal=ensureKitMatchesModal(),host=$('#playerKitMatchesList'),title=$('#playerKitMatchesTitle'),sub=$('#playerKitMatchesSub');modal.hidden=false;document.body.style.overflow='hidden';host.innerHTML='<div class="selection-loading">Chargement…</div>';
    const data=await loadCareer(playerId);const list=(data?.appearances||[]).filter(a=>Number(a.shirt_number)===Number(number));title.textContent=`${playerName(playerId)} · n°${number}`;sub.textContent=`${list.length} match${list.length>1?'s':''} avec ce numéro`;
    host.innerHTML=list.length?list.slice().reverse().map(a=>{const kit=a._kits?.find(k=>k.role==='outfield')||a._kits?.[0],m=a.match;return `<button type="button" data-kit-open-match="${esc(m.id)}"><strong>${esc(fmtDate(m.match_date))} · France – ${esc(m.opponent?.name||'Adversaire')}</strong><small>${esc(m.competition?.name||'Match international')}${kit?.jersey?.title?` · ${esc(kit.jersey.title)}`:''}</small></button>`;}).join(''):'<div class="universal-search-empty">Aucun match trouvé avec ce numéro.</div>';
    $$('[data-kit-open-match]',host).forEach(b=>b.addEventListener('click',()=>{modal.hidden=true;document.body.style.overflow='';window.BLEUS3000_RELATIONAL_REFS?.openMatch?.(b.dataset.kitOpenMatch);}));
  }

  function ensureQuickCard(){let q=$('#playerQuickCard');if(q)return q;document.body.insertAdjacentHTML('beforeend','<div id="playerQuickCard" class="player-quick-card" hidden></div>');q=$('#playerQuickCard');return q;}
  function hideQuickCard(){const q=$('#playerQuickCard');if(q)q.hidden=true;}
  async function showQuickCard(anchor,playerId){
    const hadData=careerCache.has(String(playerId));
    const q=ensureQuickCard(),r=rowFor(playerId),p=playerFor(playerId),photo=playerPhotoUrl(p),data=careerCache.get(String(playerId));
    q.innerHTML=`<div class="player-quick-main">${photo?`<img src="${esc(photo)}" alt="">`:`<span class="player-quick-initials">${esc((p.display_name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2))}</span>`}<div><strong>${esc(p.display_name||'Joueur')}</strong><small>${esc(positions(playerId))}</small></div></div><div class="player-quick-stats"><span><b>${r?.selections??'—'}</b><small>Sélections</small></span><span><b>${r?.goals??'—'}</b><small>Buts</small></span><span><b>${r?.international_number?`N° ${r.international_number}`:'—'}</b><small>Ordre</small></span></div><div class="player-quick-range">${data?.first?`<span>${esc(fmtDate(data.first.match.match_date))}</span><i>→</i><span>${esc(fmtDate(data.last.match.match_date))}</span>`:'<span>Survolez à nouveau après chargement pour la carrière complète.</span>'}</div><button type="button" data-quick-open-player="${esc(playerId)}">Ouvrir la fiche complète</button>`;
    const rect=anchor.getBoundingClientRect(),cardWidth=Math.min(320,window.innerWidth-24);q.style.left=`${Math.min(window.innerWidth-cardWidth-12,Math.max(12,rect.left))}px`;q.style.top=`${Math.max(12,Math.min(window.innerHeight-220,rect.bottom+8))}px`;q.hidden=false;if(!hadData)loadCareer(playerId).then(()=>{if(!q.hidden&&q.querySelector(`[data-quick-open-player="${CSS.escape(String(playerId))}"]`))showQuickCard(anchor,playerId);});
    q.querySelector('[data-quick-open-player]')?.addEventListener('click',()=>{hideQuickCard();const tile=$(`[data-player-tile="${CSS.escape(String(playerId))}"]`);if(tile&&!tile.classList.contains('is-open'))$('[data-player-row-toggle]',tile)?.click();tile?.scrollIntoView({behavior:'smooth',block:'start'});});
  }

  function drawRoundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  async function exportPlayerPng(playerId){
    const r=rowFor(playerId),p=playerFor(playerId),data=await loadCareer(playerId),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=760;const c=canvas.getContext('2d');
    c.fillStyle='#eef4fb';c.fillRect(0,0,1200,760);c.fillStyle='#0b2244';drawRoundRect(c,40,40,1120,680,28);c.fill();c.fillStyle='#fff';c.font='800 46px Poppins,Arial';c.fillText(p.display_name||'Joueur',80,115);c.font='600 22px Poppins,Arial';c.fillStyle='#a9c2df';c.fillText(positions(playerId),80,153);
    c.fillStyle='#1f63d5';c.font='900 30px Poppins,Arial';c.fillText(r?.international_number?`N° ${r.international_number}`:'INTERNATIONAL',80,210);
    const stats=[['Sélections',r?.selections],['Buts',r?.goals],['Victoires',r?.wins],['Nuls',r?.draws],['Défaites',r?.losses]];stats.forEach(([lab,val],i)=>{const x=80+i*205;c.fillStyle='#142f55';drawRoundRect(c,x,260,180,115,18);c.fill();c.fillStyle='#9db6d3';c.font='700 16px Poppins,Arial';c.fillText(lab,x+18,292);c.fillStyle='#fff';c.font='900 34px Poppins,Arial';c.fillText(String(val??'—'),x+18,342);});
    c.fillStyle='#a9c2df';c.font='700 18px Poppins,Arial';c.fillText(`Première sélection : ${data?.first?fmtDate(data.first.match.match_date):'—'}`,80,430);c.fillText(`Dernière sélection : ${data?.last?fmtDate(data.last.match.match_date):'—'}`,80,466);
    c.fillText(`Numéros : ${(r?._jerseyNumbers||[]).join(', ')||'—'}`,80,502);c.fillText(`Compétitions : ${data?.competitionTags.map(t=>t.label_text).join(' · ')||'—'}`,80,538);
    c.fillStyle='#2f6dff';c.font='900 20px Poppins,Arial';c.fillText('3615 BLEUS',80,665);
    const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`3615_Bleus_${(p.display_name||'joueur').replace(/[^a-z0-9]+/gi,'_')}.png`;document.body.appendChild(a);a.click();a.remove();
  }

  const compareFields=[
    ['international_number','Ordre international'],['birth_date','Date de naissance'],['positions','Postes'],['selections','Sélections'],['goals','Buts'],['wins','Victoires'],['draws','Nuls'],['losses','Défaites'],['first','Première sélection'],['last','Dernière sélection'],['numbers','Numéros portés'],['competitions','Compétitions disputées']
  ];
  function ensureCompareModal(){
    let m=$('#playerCompareModal');if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop player-compare-modal" id="playerCompareModal" hidden><section class="modal-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Comparer des joueurs</h2><p>Maximum 3 internationaux · export PNG configurable</p></div><button class="modal-close" data-player-compare-close type="button">×</button></header><div class="modal-body"><div class="player-compare-pickers"><label>Joueur 1<select data-compare-slot="0"></select></label><label>Joueur 2<select data-compare-slot="1"></select></label><label>Joueur 3<select data-compare-slot="2"></select></label></div><div class="player-compare-fields">${compareFields.map(([k,l])=>`<label><input type="checkbox" data-compare-field="${k}" checked> ${esc(l)}</label>`).join('')}</div><div id="playerCompareView" class="player-compare-view"><div class="universal-search-empty">Choisis au moins deux joueurs.</div></div><div class="player-compare-actions"><button type="button" class="secondary-btn" data-player-compare-export>⬇ Export PNG</button></div></div></section></div>`);
    m=$('#playerCompareModal');m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-player-compare-close]')){m.hidden=true;document.body.style.overflow='';}});$$('[data-compare-slot]',m).forEach(s=>s.addEventListener('change',renderComparison));$$('[data-compare-field]',m).forEach(x=>x.addEventListener('change',renderComparison));$('[data-player-compare-export]',m)?.addEventListener('click',exportComparisonPng);return m;
  }
  function compareOptions(){const list=[...rows()].sort((a,b)=>String(a.player?.display_name||'').localeCompare(String(b.player?.display_name||''),'fr'));return `<option value="">— Choisir —</option>${list.map(r=>`<option value="${esc(r.player_id)}">${esc(r.player?.display_name||'Joueur')}${r.international_number?` · N° ${r.international_number}`:''}</option>`).join('')}`;}
  function openCompare(){const m=ensureCompareModal();$$('[data-compare-slot]',m).forEach(s=>{s.innerHTML=compareOptions();});m.hidden=false;document.body.style.overflow='hidden';renderComparison();}
  function fieldValue(row,data,key){const p=row?.player||{};switch(key){case'international_number':return row?.international_number?`N° ${row.international_number}`:'—';case'birth_date':return p.birth_date?fmtDate(p.birth_date+'T00:00:00'):'—';case'positions':return positions(row?.player_id);case'first':return data?.first?fmtDate(data.first.match.match_date):'—';case'last':return data?.last?fmtDate(data.last.match.match_date):'—';case'numbers':return (row?._jerseyNumbers||[]).join(', ')||'—';case'competitions':return data?.competitionTags.map(t=>t.label_text).join(' · ')||'—';default:return row?.[key]??'—';}}
  async function renderComparison(){
    const m=$('#playerCompareModal');if(!m)return;const ids=$$('[data-compare-slot]',m).map(s=>s.value).filter(Boolean);const unique=[...new Set(ids)].slice(0,3),host=$('#playerCompareView');if(unique.length<2){host.innerHTML='<div class="universal-search-empty">Choisis au moins deux joueurs différents.</div>';return;}
    host.innerHTML='<div class="selection-loading">Chargement de la comparaison…</div>';const datas=await Promise.all(unique.map(loadCareer));const fields=$$('[data-compare-field]:checked',m).map(x=>x.dataset.compareField);const labels=new Map(compareFields);
    host.innerHTML=`<div class="player-compare-grid" style="--compare-count:${unique.length}"><div class="player-compare-label"></div>${unique.map(id=>{const r=rowFor(id),p=playerFor(id),u=playerPhotoUrl(p);return `<div class="player-compare-head">${u?`<img src="${esc(u)}" alt="">`:`<span>${esc((p.display_name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2))}</span>`}<strong>${esc(p.display_name||'Joueur')}</strong><small>${esc(positions(id))}</small></div>`;}).join('')}${fields.map(k=>`<div class="player-compare-label">${esc(labels.get(k)||k)}</div>${unique.map((id,i)=>`<div class="player-compare-cell">${esc(fieldValue(rowFor(id),datas[i],k))}</div>`).join('')}`).join('')}</div>`;
  }
  async function exportComparisonPng(){
    const m=$('#playerCompareModal'),ids=[...new Set($$('[data-compare-slot]',m).map(s=>s.value).filter(Boolean))].slice(0,3);if(ids.length<2)return alert('Choisis au moins deux joueurs.');const datas=await Promise.all(ids.map(loadCareer));const fields=$$('[data-compare-field]:checked',m).map(x=>x.dataset.compareField),labels=new Map(compareFields),w=1600,h=230+fields.length*92;const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.fillStyle='#eef4fb';c.fillRect(0,0,w,h);c.fillStyle='#0b2244';c.fillRect(0,0,w,160);c.fillStyle='#fff';c.font='900 46px Poppins,Arial';c.fillText('Comparaison de joueurs',60,70);c.fillStyle='#8fb1da';c.font='700 22px Poppins,Arial';c.fillText('3615 BLEUS',60,110);const left=330,col=(w-left-60)/ids.length;c.font='800 26px Poppins,Arial';ids.forEach((id,i)=>{c.fillStyle='#133760';c.fillText(playerName(id),left+i*col+20,205);});fields.forEach((k,ri)=>{const y=250+ri*92;c.fillStyle=ri%2?'#f7faff':'#e3edf8';c.fillRect(40,y-38,w-80,78);c.fillStyle='#365a82';c.font='700 20px Poppins,Arial';c.fillText(labels.get(k)||k,60,y+8);ids.forEach((id,i)=>{c.fillStyle='#102f58';c.font='800 19px Poppins,Arial';const val=String(fieldValue(rowFor(id),datas[i],k));const short=val.length>42?val.slice(0,39)+'…':val;c.fillText(short,left+i*col+20,y+8);});});const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='3615_Bleus_comparaison_joueurs.png';document.body.appendChild(a);a.click();a.remove();
  }

  function ensureFilterButton(){const bar=$('#selectionFilterBar');if(!bar||$('#selectionCompareBtn',bar))return;const b=document.createElement('button');b.type='button';b.id='selectionCompareBtn';b.className='selection-filter-compare';b.textContent='⇄ Comparer des joueurs';b.addEventListener('click',openCompare);bar.appendChild(b);}
  function addExportButton(tile,id){const actions=$('.selection-tile-actions',tile);if(!actions||$('[data-player-export]',actions))return;const b=document.createElement('button');b.type='button';b.dataset.playerExport=id;b.title='Exporter la tuile joueur en PNG';b.textContent='⬇';b.addEventListener('click',e=>{e.stopPropagation();exportPlayerPng(id);});actions.appendChild(b);}
  function removeGeneralTags(root=document){$$('[data-context-code="GENERAL"]',root).forEach(x=>x.remove());}
  function bindJerseyClicks(tile,id){$$('[data-jersey-number]',tile).forEach(j=>{if(j.dataset.careerBound)return;j.dataset.careerBound='1';j.tabIndex=0;j.setAttribute('role','button');j.title=`Voir les matchs de ${playerName(id)} avec le n° ${j.dataset.jerseyNumber}`;j.addEventListener('click',e=>{e.stopPropagation();openNumberMatches(id,j.dataset.jerseyNumber);});j.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openNumberMatches(id,j.dataset.jerseyNumber);}});});}
  function bindQuickPreview(tile,id){const targets=[$('.selection-row-photo',tile),$('.selection-row-name',tile)].filter(Boolean);targets.forEach(t=>{if(t.dataset.quickBound)return;t.dataset.quickBound='1';t.addEventListener('pointerenter',()=>{if(matchMedia('(hover:hover)').matches)showQuickCard(t,id);});t.addEventListener('pointerleave',()=>setTimeout(()=>{const q=$('#playerQuickCard');if(q&&!q.matches(':hover'))hideQuickCard();},180));t.addEventListener('click',e=>{if(e.pointerType==='touch'||!matchMedia('(hover:hover)').matches){e.preventDefault();e.stopPropagation();showQuickCard(t,id);}});});}
  async function enhance(){
    ensureFilterButton();removeGeneralTags();
    for(const tile of $$('[data-player-tile]')){const id=tile.dataset.playerTile;bindQuickPreview(tile,id);if(tile.classList.contains('is-open')){addExportButton(tile,id);bindJerseyClicks(tile,id);enhanceCareer(id).catch(console.warn);}}
  }
  function scheduleEnhance(){clearTimeout(observerTimer);observerTimer=setTimeout(enhance,70);}
  const obs=new MutationObserver(scheduleEnhance);
  function init(){obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});document.addEventListener('pointerdown',e=>{const q=$('#playerQuickCard');if(q&&!q.hidden&&!e.target.closest('#playerQuickCard')&&!e.target.closest('.selection-row-photo')&&!e.target.closest('.selection-row-name'))hideQuickCard();});window.addEventListener('scroll',hideQuickCard,true);scheduleEnhance();}
  window.BLEUS3000_PLAYER_CAREERS={load:loadCareer,openCompare,exportPlayer:exportPlayerPng,openNumberMatches};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
