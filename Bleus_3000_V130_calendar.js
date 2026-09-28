/* 3615 Bleus V1.1.61.33 — pays en toutes lettres · couleurs éditoriales · scoreboards affinés */
(()=>{
  'use strict';
  const state={matches:[],gatherings:[],mode:'upcoming',team:'all',search:'',canEdit:false,live:new Map(),liveTimer:null,selections:[],competitions:[],homePage:1,homePageSize:3,featureStyle:null,pinBusy:false,sheetSyncBusy:false,lastSheetSyncAt:0};
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=()=>window.BLEUS3000_RELATIONAL_REFS;
  const eff=(m,k)=>store()?.effective?store().effective(m,k):m?.[k];
  const base=(m,k)=>store()?.baseValue?store().baseValue(m,k):m?.[k];
  const parseDate=v=>{const d=new Date(v);return Number.isNaN(+d)?null:d;};
  const flagImg=name=>window.BLEUS3000_FLAGS?.img?.(name,'calendar-svg-flag')||'<span class="calendar-svg-flag is-missing">◌</span>';
  const frDate=iso=>{const d=parseDate(iso);if(!d)return String(iso||'Date à confirmer');return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Paris'}).format(d).replace(' à ',' - ').replace(':','H').replace(/^./,c=>c.toUpperCase());};
  const selectionLabel=()=> 'France A';
  const opponent=m=>eff(m,'opponent_name')||'Adversaire à confirmer';
  const countryName=v=>window.BLEUS3000_FLAGS?.countryName?.(v)||String(v||'');
  const teams=m=>{const fr='France',opp=countryName(opponent(m));return m.home_away==='away'?[opp,fr]:[fr,opp];};
  const teamCodeAliases={france:'FRA',turquie:'TUR',turkey:'TUR',belgique:'BEL',belgium:'BEL',angleterre:'ENG',england:'ENG',allemagne:'GER',germany:'GER',espagne:'ESP',spain:'ESP',italie:'ITA',italy:'ITA',portugal:'POR',paysbas:'NED','pays bas':'NED',netherlands:'NED',hollande:'NED',bresil:'BRA',brazil:'BRA',argentine:'ARG',argentina:'ARG',croatie:'CRO',croatia:'CRO',maroc:'MAR',morocco:'MAR',ukraine:'UKR',ecosse:'SCO',scotland:'SCO',islande:'ISL',iceland:'ISL',suisse:'SUI',switzerland:'SUI',danemark:'DEN',denmark:'DEN',autriche:'AUT',austria:'AUT',pologne:'POL',poland:'POL',serbie:'SRB',serbia:'SRB'};
  const normTeam=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function teamCode(name){const label=countryName(name);const key=normTeam(label);if(teamCodeAliases[key])return teamCodeAliases[key];const words=key.split(/\s+/).filter(Boolean);if(words.length>=2){return words.slice(0,3).map(w=>w[0]).join('').toUpperCase();}const raw=label.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z]/g,'').toUpperCase();return (raw.slice(0,3)||'---').padEnd(3,'-');}

  const flagColorFallback={fr:'#173f94',tr:'#d71920',be:'#1b1b1b','gb-eng':'#d51f36',de:'#161616',es:'#c8192e',it:'#148447',pt:'#b5122b',nl:'#e36b22',br:'#178447',ar:'#69b7e7',hr:'#d61f2c',ma:'#c1272d',ua:'#1e68b5','gb-sct':'#1b5aa6',is:'#1f5aa6',ch:'#d52b1e',dk:'#c8102e',at:'#d81e33',pl:'#dc143c',rs:'#c6363c',cz:'#174b8d',ro:'#154da3',hu:'#c8102e',se:'#1769aa',no:'#ba0c2f',ie:'#169b62',gr:'#0d5eaf',uy:'#5aa9df',py:'#d52b1e',mx:'#006847',cl:'#d52b1e',co:'#f2c300',pe:'#d91023',jp:'#bc002d',kr:'#1d4d9f',us:'#b22234',ca:'#d80621',au:'#163b8c',dz:'#0d8a53',tn:'#d71920',sn:'#178447',cm:'#178447',za:'#14794f',eg:'#ce2029'};
  const jerseyColorNames={
    'bleu':'#153f9e','bleu france':'#153f9e','bleu roi':'#1d4fa3','bleu marine':'#071b3a','marine':'#071b3a','navy':'#071b3a',
    'blanc':'#f5f4ef','white':'#f5f4ef','rouge':'#d51f36','red':'#d51f36','noir':'#111820','black':'#111820',
    'vert':'#168451','green':'#168451','jaune':'#f2c62a','yellow':'#f2c62a','or':'#d1a42b','gold':'#d1a42b',
    'gris':'#697586','gray':'#697586','grey':'#697586','violet':'#5f3c9d','purple':'#5f3c9d','orange':'#dc6b1d','rose':'#d85f91','pink':'#d85f91'
  };
  const jerseyColorCache=new Map();
  function cssColor(value,fallback='#153f9e'){const raw=String(value||'').trim();if(!raw)return fallback;if(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)||/^(?:rgb|hsl)a?\(/i.test(raw))return raw;const key=normTeam(raw);if(jerseyColorNames[key])return jerseyColorNames[key];for(const name of Object.keys(jerseyColorNames).sort((a,b)=>b.length-a.length)){if(key.includes(name))return jerseyColorNames[name];}return fallback;}
  function rgbFromCss(color){const c=String(color||'').trim();const h=c.match(/^#([0-9a-f]{6})$/i);if(h)return [parseInt(h[1].slice(0,2),16),parseInt(h[1].slice(2,4),16),parseInt(h[1].slice(4,6),16)];const s=c.match(/^#([0-9a-f]{3})$/i);if(s)return s[1].split('').map(x=>parseInt(x+x,16));return [21,63,158];}
  function textFor(color){const [r,g,b]=rgbFromCss(color),lum=(.2126*r+.7152*g+.0722*b);return lum>168?'#10233f':'#fff';}
  function panelGradient(primary,secondary='',mode='gradient',angle=180){const p=cssColor(primary),s=secondary?cssColor(secondary,p):p,a=Math.max(0,Math.min(360,Number(angle)||180));return {bg:mode==='solid'?p:`linear-gradient(${a}deg,${p},${s})`,fg:textFor(p)};}
  function fallbackFlagColor(team){const code=window.BLEUS3000_FLAGS?.codeFor?.(team)||'';return flagColorFallback[String(code).toLowerCase()]||'#315f9a';}
  function setPanelColors(side,primary,secondary='',textColor='',mode='gradient',angle=180){if(!side)return;const st=panelGradient(primary,secondary,mode,angle);side.style.setProperty('--minitel-team-bg',st.bg);side.style.setProperty('--minitel-team-fg',textColor||st.fg);}
  function dominantFlagColor(img){try{if(!img?.naturalWidth||!img?.naturalHeight)return null;const canvas=document.createElement('canvas');canvas.width=48;canvas.height=32;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,48,32);const data=ctx.getImageData(0,0,48,32).data,bins=new Map();for(let i=0;i<data.length;i+=4){const a=data[i+3];if(a<180)continue;let r=data[i],g=data[i+1],b=data[i+2];if(r>232&&g>232&&b>232)continue;const max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max-min;if(max>215&&sat<28)continue;r=Math.round(r/24)*24;g=Math.round(g/24)*24;b=Math.round(b/24)*24;const key=`${r},${g},${b}`,weight=1+sat/150;bins.set(key,(bins.get(key)||0)+weight);}let best=null,bestN=0;for(const [k,n] of bins){if(n>bestN){best=k;bestN=n;}}if(!best)return null;const [r,g,b]=best.split(',').map(Number);return `#${[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('')}`;}catch{return null;}}
  function countryColorOverride(team){return window.BLEUS3000_COUNTRY_COLORS?.get?.(team)||null;}
  function hydrateOpponentSide(side,team){const override=countryColorOverride(team);if(override){setPanelColors(side,override.primary_color,override.secondary_color||override.primary_color,override.text_color||'',override.display_mode||'gradient',override.gradient_angle??180);return;}const fallback=fallbackFlagColor(team);setPanelColors(side,fallback);const img=side.querySelector('img[data-flag-code]');if(!img)return;const apply=()=>{const c=dominantFlagColor(img);if(c)setPanelColors(side,c);};if(img.complete)requestAnimationFrame(apply);else img.addEventListener('load',apply,{once:true});}
  async function franceJerseyColors(matchId){const key=String(matchId||'');if(!key)return {primary:'#153f9e',secondary:'#0b2b72'};const api=window.BLEUS3000_JERSEYS;if(!api?.getMatchJersey)return {primary:'#153f9e',secondary:'#0b2b72'};if(jerseyColorCache.has(key))return jerseyColorCache.get(key);const p=(async()=>{try{const j=await api.getMatchJersey(key);if(j)return {primary:cssColor(j.primary_color,'#153f9e'),secondary:cssColor(j.secondary_color,cssColor(j.primary_color,'#0b2b72'))};}catch(err){console.warn('Couleur maillot scoreboard',err);}return {primary:'#153f9e',secondary:'#0b2b72'};})();jerseyColorCache.set(key,p);return p;}
  async function hydrateMinitelTeamColors(root=document){await window.BLEUS3000_COUNTRY_COLORS?.load?.();const boards=[...root.querySelectorAll('.minitel-scoreboard[data-match-id]')];for(const board of boards){const matchId=board.dataset.matchId;for(const side of board.querySelectorAll('.minitel-side[data-team-name]')){const team=side.dataset.teamName||'',override=countryColorOverride(team);if(override){setPanelColors(side,override.primary_color,override.secondary_color||override.primary_color,override.text_color||'',override.display_mode||'gradient',override.gradient_angle??180);}else if(normTeam(team)==='france'){const c=await franceJerseyColors(matchId);setPanelColors(side,c.primary,c.secondary);}else hydrateOpponentSide(side,team);}}}
  function scheduleMinitelTeamColors(){requestAnimationFrame(()=>hydrateMinitelTeamColors(document).catch(err=>console.warn('Couleurs scoreboard',err)));}
  function displayTeamName(name){return countryName(name)||String(name||'');}
  function minitelBoard(left,right,center,compact=false,matchId='',outcome=''){const label=String(center||'VS').trim(),leftName=displayTeamName(left),rightName=displayTeamName(right);const lFallback=normTeam(left)==='france'?'#153f9e':fallbackFlagColor(left),rFallback=normTeam(right)==='france'?'#153f9e':fallbackFlagColor(right),resultClass=outcome?`is-result-${outcome}`:'';return `<div class="minitel-scoreboard ${compact?'is-compact':''} ${/^VS$/i.test(label)?'is-vs':''} ${resultClass}" data-match-id="${esc(matchId)}" aria-label="${esc(leftName)} ${esc(label)} ${esc(rightName)}"><span class="minitel-side is-left" data-team-name="${esc(left)}" style="--minitel-team-bg:${esc(panelGradient(lFallback).bg)};--minitel-team-fg:${esc(textFor(lFallback))}"><span class="minitel-flag">${flagImg(left)}</span><strong class="minitel-code minitel-country-name">${esc(leftName)}</strong></span><span class="minitel-score">${esc(label)}</span><span class="minitel-side is-right" data-team-name="${esc(right)}" style="--minitel-team-bg:${esc(panelGradient(rFallback).bg)};--minitel-team-fg:${esc(textFor(rFallback))}"><strong class="minitel-code minitel-country-name">${esc(rightName)}</strong><span class="minitel-flag">${flagImg(right)}</span></span></div>`;}
  const liveFor=m=>m.provider==='thesportsdb'&&m.provider_fixture_id?state.live.get(String(m.provider_fixture_id)):null;
  const score=m=>{const l=liveFor(m);if(l){const home=Number(l.intHomeScore),away=Number(l.intAwayScore);if(Number.isFinite(home)&&Number.isFinite(away))return `${home} - ${away}`;}const a=eff(m,'france_score'),b=eff(m,'opponent_score');if(a==null||b==null||a===''||b==='')return '';return m.home_away==='away'?`${b} - ${a}`:`${a} - ${b}`;};
  function resultOutcome(m){const a=Number(eff(m,'france_score')),b=Number(eff(m,'opponent_score'));if(!Number.isFinite(a)||!Number.isFinite(b))return '';return a>b?'win':a<b?'loss':'draw';}
  function resultLabel(m){return ({win:'Victoire',draw:'Nul',loss:'Défaite'})[resultOutcome(m)]||'';}
  const place=m=>[eff(m,'venue_name'),eff(m,'city')].filter(Boolean).join(', ');
  const isLive=m=>!!liveFor(m)||['1H','2H','HT','ET','P','LIVE','IN PLAY','IN_PLAY'].includes(String(eff(m,'status')||'').toUpperCase());
  const finishedStatuses=new Set(['FT','MATCH FINISHED','FINISHED','COMPLETED','AET','PEN','AFTER PENALTIES']);
  const isFinished=m=>finishedStatuses.has(String(eff(m,'status')||'').toUpperCase());
  const isPinned=m=>m?.homepage_pinned===true&&!isFinished(m);
  const tagById=id=>id?store()?.getTag?.(id):null;
  const sectionTag=m=>tagById(eff(m,'selection_tag_id'));
  const competitionTag=m=>tagById(eff(m,'competition_tag_id'));
  const tagColors=t=>{const arr=Array.isArray(t?.gradient_colors)?t.gradient_colors.filter(Boolean).slice(0,5):[];if(arr.length)return arr;return [t?.color_start||'#082654',t?.color_end||t?.color_start||'#2563eb'];};
  function fallbackTag(label,cls=''){return `<span class="calendar-tag ${cls}">${esc(label)}</span>`;}
  function tagChip(t,cls=''){
    if(!t)return '';
    if(window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(t,`calendar-global-tag ${cls}`.trim());
    const colors=tagColors(t),bg=t.appearance==='solid'?colors[0]:`linear-gradient(${Number(t.gradient_angle||135)}deg,${colors.join(',')})`;
    return `<span class="calendar-tag ${cls}" style="background:${bg};color:${esc(t.text_color||'#fff')};border-color:${esc(t.border_color||'#082654')}">${esc(t.icon_text||'🏷️')} ${esc(t.label_text||'TAG')}</span>`;
  }
  function isOlympicMatch(m){const t=competitionTag(m);return String(t?.slug||'')==='jeux-olympiques'||String(t?.label_text||'').toLocaleLowerCase('fr')==='jeux olympiques'||String(eff(m,'competition_name')||'').toLocaleLowerCase('fr').includes('jeux olympiques');}
  function sectionChip(m){if(isOlympicMatch(m))return '';const t=sectionTag(m);return t?tagChip(t,'section'):fallbackTag(selectionLabel(m),'section');}
  function competitionChip(m){const t=competitionTag(m);if(t)return tagChip(t,'competition');const n=eff(m,'competition_name');return n?fallbackTag(n,'competition'):'';}
  function statusLabel(m){const l=liveFor(m);if(l){const p=String(l.strProgress||'').trim();const s=String(l.strStatus||'LIVE').toUpperCase();const time=p?`${esc(p)}${/^\d+$/.test(p)?"'":''}`:(s==='HT'?'MI-TEMPS':'LIVE');return `<span class="calendar-live minitel-status-badge"><i></i><span class="minitel-status-kicker">LIVE</span><b class="minitel-status-value">${time}</b></span>`;}const s=String(eff(m,'status')||'').toUpperCase();if(['FT','MATCH FINISHED','FINISHED'].includes(s))return '<span class="calendar-finished minitel-status-badge is-finished"><span class="minitel-status-kicker">FT</span><b class="minitel-status-value">TERMINÉ</b></span>';if(/POSTP/.test(s))return '<span class="calendar-postponed minitel-status-badge is-postponed"><span class="minitel-status-kicker">STATUT</span><b class="minitel-status-value">REPORTÉ</b></span>';if(/CANC/.test(s))return '<span class="calendar-cancelled minitel-status-badge is-cancelled"><span class="minitel-status-kicker">STATUT</span><b class="minitel-status-value">ANNULÉ</b></span>';return ''}
  function broadcastMarkup(tv){return window.BLEUS3000_BROADCASTS?.renderText?.(tv)||`<span class="calendar-tv">📺 ${esc(tv||'Diffusion à confirmer')}</span>`;}
  const broadcastNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function populateBroadcastPicker(mode,currentText=''){
    const cap=mode==='edit'?'Edit':'Create',select=$(`#calendar${cap}BroadcastSelect`),input=$(`#calendar${cap}Broadcast`);if(!select||!input)return;
    const channels=[...(window.BLEUS3000_BROADCASTS?.channels||[])].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));
    const current=String(currentText||'').trim(),n=broadcastNorm(current);
    const exact=channels.find(b=>broadcastNorm(b.name)===n||(b.aliases||[]).some(a=>broadcastNorm(a)===n));
    select.innerHTML='<option value="">Diffusion à confirmer</option>'+channels.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')+'<option value="__custom__">Autre / plusieurs chaînes…</option>';
    if(!current){select.value='';input.value='';input.hidden=true;}
    else if(exact){select.value=exact.name;input.value=exact.name;input.hidden=true;}
    else{select.value='__custom__';input.value=current;input.hidden=false;}
  }
  function onBroadcastPickerChange(mode){
    const cap=mode==='edit'?'Edit':'Create',select=$(`#calendar${cap}BroadcastSelect`),input=$(`#calendar${cap}Broadcast`);if(!select||!input)return;
    if(select.value==='__custom__'){input.hidden=false;if(!input.value)input.focus();}
    else{input.hidden=true;input.value=select.value||'';}
  }
  const featureMode=m=>String(m?.feature_frame_mode||'auto');
  function isAutoFeatured(m){return ['FRA-A-M','FRA-A-F'].includes(String(m?.selection?.code||''));}
  function isFeatured(m){const mode=featureMode(m);return mode==='on'||(mode==='auto'&&isAutoFeatured(m));}
  function featureStyleAttr(){const st=state.featureStyle||window.BLEUS3000_FEATURE_FRAMES?.getStyle?.();if(!st)return '';const cs=(st.gradient_colors||[]).filter(Boolean).slice(0,5);if(!cs.length)return '';return ` style="--feature-gradient:linear-gradient(${Number(st.gradient_angle||135)}deg,${cs.join(',')});--feature-width:${Number(st.border_width||2)}px;--feature-radius:${Number(st.border_radius||12)}px;--feature-glow:${esc(st.glow_color||'#2563eb')};--feature-glow-strength:${Number(st.glow_strength||12)}px"`;}
  function row(m){const [a,b]=teams(m),s=score(m),past=parseDate(eff(m,'match_date'))?.getTime()<Date.now();const tv=eff(m,'broadcast_text')||'Diffusion à confirmer',url=eff(m,'broadcast_url'),separator=s||(!past?'VS':'–');return `<article class="calendar-row ${isLive(m)?'is-live':''} ${isFeatured(m)?'is-featured':''}"${isFeatured(m)?featureStyleAttr():''} data-calendar-id="${esc(m.id)}"><div class="calendar-date">${esc(frDate(eff(m,'match_date')))}</div><div class="calendar-fixture is-minitel">${minitelBoard(a,b,separator,true,m.id,resultOutcome(m))}${statusLabel(m)}</div>${place(m)?`<div class="calendar-place">${esc(place(m))}</div>`:''}<div class="calendar-meta">${broadcastMarkup(tv)}${url?`<a class="calendar-stream" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Voir la diffusion internet" aria-label="Voir la diffusion internet">↗</a>`:''}${sectionChip(m)}${competitionChip(m)}${state.canEdit?`<button class="calendar-quick-event-btn" type="button" data-calendar-quick-event="${esc(m.id)}" title="Ajouter un fait de jeu" aria-label="Ajouter un fait de jeu">＋⚽</button><button class="calendar-edit-btn" type="button" data-calendar-edit="${esc(m.id)}" title="Modifier le match" aria-label="Modifier le match">⚙</button>`:''}</div></article>`}
  function homeRow(m){const [a,b]=teams(m),s=score(m),past=parseDate(eff(m,'match_date'))?.getTime()<Date.now();const tv=eff(m,'broadcast_text')||'Diffusion à confirmer',url=eff(m,'broadcast_url'),separator=s||(!past?'VS':'–'),pinned=isPinned(m);return `<article class="calendar-row calendar-home-match-tile ${isLive(m)?'is-live':''} ${isFeatured(m)?'is-featured':''} ${pinned?'is-pinned':''}"${isFeatured(m)?featureStyleAttr():''} data-calendar-id="${esc(m.id)}"><div class="calendar-home-match-date"><span>${pinned?'<span class="calendar-home-pinned-label">↑ ÉPINGLÉ</span>':''}${esc(frDate(eff(m,'match_date')))}</span>${place(m)?`<span class="calendar-home-date-place">🏟 ${esc(place(m))}</span>`:''}</div><div class="calendar-home-match-fixture is-minitel">${minitelBoard(a,b,separator,false,m.id)}</div><div class="calendar-home-match-meta">${statusLabel(m)}<span class="calendar-home-match-tags">${sectionChip(m)}${competitionChip(m)}</span></div><div class="calendar-home-match-footer"><div class="calendar-home-broadcast">${broadcastMarkup(tv)}${url?`<a class="calendar-stream" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Voir la diffusion internet" aria-label="Voir la diffusion internet">↗</a>`:''}</div><div class="calendar-home-match-actions">${state.canEdit?`<button class="calendar-home-quick-event-btn" type="button" data-calendar-quick-event="${esc(m.id)}" title="Ajouter rapidement un fait de jeu" aria-label="Ajouter rapidement un fait de jeu">＋⚽</button><button class="calendar-home-pin-btn ${pinned?'is-active':''}" type="button" data-calendar-pin="${esc(m.id)}" title="${pinned?'Retirer l’épinglage':'Épingler ce match en tête'}" aria-label="${pinned?'Retirer l’épinglage':'Épingler ce match en tête'}" aria-pressed="${pinned?'true':'false'}">↑</button>`:''}<button class="calendar-home-sheet-btn ${m.lineup_status||m.api_payload?._bleus_live_sheet?.lineup_count?'is-ready':''}" type="button" data-calendar-open-sheet="${esc(m.id)}" title="${m.lineup_status?'Feuille de match disponible':'Feuille de match'}" aria-label="Ouvrir la feuille de match"><span class="match-sheet-pitch-icon" aria-hidden="true"><i></i></span></button><button class="calendar-open-match-tile" type="button" data-calendar-open-match="${esc(m.id)}">Tuile ↗</button>${state.canEdit?`<button class="calendar-edit-btn" type="button" data-calendar-edit="${esc(m.id)}" title="Modifier le match" aria-label="Modifier le match">⚙</button>`:''}</div></div></article>`}

  function recentRow(m){const [a,b]=teams(m),s=score(m)||'–',tv=eff(m,'broadcast_text')||'',url=eff(m,'broadcast_url'),outcome=resultOutcome(m),label=resultLabel(m);return `<article class="calendar-row calendar-home-match-tile calendar-recent-match-tile ${isFeatured(m)?'is-featured':''}"${isFeatured(m)?featureStyleAttr():''} data-calendar-id="${esc(m.id)}"><div class="calendar-home-match-date"><span>${esc(frDate(eff(m,'match_date')))}</span>${place(m)?`<span class="calendar-home-date-place">🏟 ${esc(place(m))}</span>`:''}</div><div class="calendar-home-match-fixture is-minitel" title="${esc(label)}" aria-label="${esc(label)}">${minitelBoard(a,b,s,false,m.id,outcome)}</div><div class="calendar-home-match-meta"><span class="calendar-home-match-tags">${sectionChip(m)}${competitionChip(m)}</span></div><div class="calendar-home-match-footer"><div class="calendar-home-broadcast">${tv?broadcastMarkup(tv):''}${url?`<a class="calendar-stream" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Voir la diffusion internet" aria-label="Voir la diffusion internet">↗</a>`:''}</div><div class="calendar-home-match-actions"><button class="calendar-home-sheet-btn ${m.lineup_status||m.api_payload?._bleus_live_sheet?.lineup_count?'is-ready':''}" type="button" data-calendar-open-sheet="${esc(m.id)}" title="Feuille de match" aria-label="Ouvrir la feuille de match"><span class="match-sheet-pitch-icon" aria-hidden="true"><i></i></span></button><button class="calendar-open-match-tile" type="button" data-calendar-open-match="${esc(m.id)}">Tuile ↗</button></div></div></article>`;}
  function recentResults(){return state.matches.filter(m=>{const d=parseDate(eff(m,'match_date'))?.getTime()||0;return d<Date.now()&&(isFinished(m)||resultOutcome(m));}).sort((a,b)=>(parseDate(eff(b,'match_date'))?.getTime()||0)-(parseDate(eff(a,'match_date'))?.getTime()||0)).slice(0,3);}


  function filtered(){const now=Date.now(),q=String(state.search||'').trim().toLocaleLowerCase('fr');return state.matches.filter(m=>{const d=parseDate(eff(m,'match_date'))?.getTime()||0,live=isLive(m),temporal=state.mode==='past'?(!live&&d<now):(live||d>=now);if(!temporal||(state.team!=='all'&&String(m.selection_team_id)!==state.team))return false;if(q){const hay=[selectionLabel(m),opponent(m),eff(m,'competition_name'),eff(m,'venue_name'),eff(m,'city'),eff(m,'broadcast_text'),frDate(eff(m,'match_date'))].filter(Boolean).join(' ').toLocaleLowerCase('fr');if(!hay.includes(q))return false;}return true;}).sort((a,b)=>state.mode==='past'?(parseDate(eff(b,'match_date'))-parseDate(eff(a,'match_date'))):(parseDate(eff(a,'match_date'))-parseDate(eff(b,'match_date'))));}
  function renderHomePagination(total){const host=$('#calendarHomePagination');if(!host)return;const pages=Math.max(1,Math.ceil(total/state.homePageSize));state.homePage=Math.min(Math.max(1,state.homePage),pages);if(pages<=1){host.innerHTML='';host.hidden=true;return;}host.hidden=false;host.innerHTML=`<button type="button" data-home-page="${Math.max(1,state.homePage-1)}" ${state.homePage===1?'disabled':''} aria-label="Match précédent">‹</button><span class="calendar-home-page-status">${state.homePage} / ${pages}</span><button type="button" data-home-page="${Math.min(pages,state.homePage+1)}" ${state.homePage===pages?'disabled':''} aria-label="Match suivant">›</button>`;host.querySelectorAll('[data-home-page]').forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;state.homePage=Number(b.dataset.homePage)||1;render();}));}
  async function toggleHomePin(id){
    if(!state.canEdit||state.pinBusy)return;
    const db=window.BLEUS3000_SUPABASE,m=state.matches.find(x=>String(x.id)===String(id));if(!db||!m)return;
    const next=!isPinned(m);state.pinBusy=true;
    try{
      const {error}=await db.from('matches').update({homepage_pinned:next,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
      state.matches.forEach(x=>{if(next)x.homepage_pinned=false;});m.homepage_pinned=next;m.homepage_pinned_at=next?new Date().toISOString():null;m.homepage_pinned_by=next?(window.C3K_ACCOUNT_STATE?.profile?.id||null):null;
      state.homePage=1;store()?.invalidate?.();render();
    }catch(err){console.error('Épinglage accueil',err);alert('Épinglage impossible : '+(err?.message||err));}
    finally{state.pinBusy=false;}
  }
  function gatheringDate(g){const d=parseDate(g?.date);return d?d.getTime():0;}
  function gatheringSearchMatch(g){const q=String(state.search||'').trim().toLocaleLowerCase('fr');if(!q)return true;const src=window.BLEUS3000_GATHERINGS?.rows?.find?.(x=>String(x.id)===String(g.id));const hay=[g.title,g.announcement_date,g.start_date,g.end_date,src?.notes_short].filter(Boolean).join(' ').toLocaleLowerCase('fr');return hay.includes(q);}
  function gatheringTile(g,home=false){return window.BLEUS3000_GATHERINGS?.calendarTile?.(g,home)||`<article class="calendar-row gathering-calendar-tile"><div class="calendar-date">📋 Rassemblement</div><div class="gathering-calendar-main"><strong>${esc(g.title||'Rassemblement France A')}</strong></div></article>`;}
  function render(){
    const all=filtered(),now=Date.now();
    const gatherings=(state.gatherings||[]).filter(g=>gatheringDate(g)>=now&&gatheringSearchMatch(g)).sort((a,b)=>gatheringDate(a)-gatheringDate(b));
    const home=$('#calendarHomeList');
    if(home){
      const upcoming=state.matches.filter(m=>isPinned(m)||isLive(m)||(parseDate(eff(m,'match_date'))?.getTime()||0)>=now).map(m=>({date:parseDate(eff(m,'match_date'))?.getTime()||0,data:m,pinned:isPinned(m),live:isLive(m)})).sort((a,b)=>{if(a.pinned!==b.pinned)return a.pinned?-1:1;if(a.live!==b.live)return a.live?-1:1;return a.date-b.date;});
      const pages=Math.max(1,Math.ceil(upcoming.length/state.homePageSize));state.homePage=Math.min(Math.max(1,state.homePage),pages);const start=(state.homePage-1)*state.homePageSize,up=upcoming.slice(start,start+state.homePageSize);
      home.innerHTML=up.map(x=>homeRow(x.data)).join('')||'<div class="calendar-empty">Aucun match à venir enregistré.</div>';renderHomePagination(upcoming.length);
    }
    const recentHost=$('#calendarRecentList');if(recentHost)recentHost.innerHTML=recentResults().map(recentRow).join('')||'<div class="calendar-empty">Aucun résultat enregistré.</div>';
    window.BLEUS3000_GATHERINGS?.renderHomeEvents?.();
    const full=$('#calendarFullList');
    if(full){
      const html=state.mode==='upcoming'?[...all.map(m=>({kind:'match',date:parseDate(eff(m,'match_date'))?.getTime()||0,data:m})),...gatherings.map(g=>({kind:'gathering',date:gatheringDate(g),data:g}))].sort((a,b)=>a.date-b.date).map(x=>x.kind==='gathering'?gatheringTile(x.data,false):row(x.data)).join(''):all.map(row).join('');
      full.innerHTML=html||'<div class="calendar-empty">Aucun événement pour ce filtre.</div>';
    }
    const add=$('#calendarAddBtn');if(add)add.hidden=!state.canEdit;const addGathering=$('#calendarAddGatheringBtn');if(addGathering)addGathering.hidden=!state.canEdit;
    scheduleMinitelTeamColors();
  }
  async function load(){try{state.matches=await store()?.load?.()||[];state.selections=store()?.getSelections?.()||[];await window.BLEUS3000_GATHERINGS?.load?.();state.gatherings=window.BLEUS3000_GATHERINGS?.getCalendarItems?.()||[];state.featureStyle=await window.BLEUS3000_FEATURE_FRAMES?.load?.()||window.BLEUS3000_FEATURE_FRAMES?.getStyle?.()||state.featureStyle;populateTeams();render();}catch(error){console.warn('Calendrier 3615 Bleus',error);['#calendarHomeList','#calendarRecentList','#calendarFullList'].forEach(s=>{const e=$(s);if(e)e.innerHTML='<div class="calendar-empty">Calendrier indisponible.</div>'});}}
  window.addEventListener('bleus:match-jersey-changed',e=>{const id=String(e.detail?.matchId||'');if(id)jerseyColorCache.delete(id);scheduleMinitelTeamColors();});
  window.BLEUS3000_MATCH_COLORS={hydrate:hydrateMinitelTeamColors,refresh:()=>{jerseyColorCache.clear();scheduleMinitelTeamColors();}};
  const matchColorObserver=new MutationObserver(mutations=>{
    const hasScoreboard=mutations.some(m=>[...m.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('.minitel-scoreboard[data-match-id]')||node.querySelector?.('.minitel-scoreboard[data-match-id]'))));
    if(hasScoreboard)scheduleMinitelTeamColors();
  });
  matchColorObserver.observe(document.body,{childList:true,subtree:true});
  function setPermissions(role){state.canEdit=['admin','superadmin'].includes(String(role||'').toLowerCase());render();}
  async function permissions(){setPermissions(window.C3K_ACCOUNT_STATE?.role);}
  function populateTeams(){const sel=$('#calendarTeamFilter');if(!sel)return;const opts=[...new Map(state.matches.filter(m=>m.selection_team_id).map(m=>[m.selection_team_id,selectionLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));const prev=state.team;sel.innerHTML='<option value="all">France A masculine</option>'+opts.map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('');if([...sel.options].some(o=>o.value===prev))sel.value=prev;}
  function openModal(){const m=$('#calendarModal');if(m){m.hidden=false;document.body.classList.add('modal-open');render();pollLive();}}
  function closeModal(){const m=$('#calendarModal');if(m){m.hidden=true;document.body.classList.remove('modal-open')}}
  const toInputDate=iso=>{const d=parseDate(iso);if(!d)return '';const p=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Paris'}).format(d);return p.replace(' ','T');};
  const tagOption=(t,selected)=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${esc(t.label_text)}</option>`;
  function competitionEditionRows(team=null){
    const entities=store()?.getCompetitionEntities?.()||[],editions=store()?.getCompetitionEditions?.()||[],byId=new Map(entities.map(x=>[String(x.id),x]));
    return editions.map(ed=>({ed,entity:byId.get(String(ed.competition_entity_id))})).filter(x=>x.entity&&(!team||!x.entity.gender||x.entity.gender===team.gender)).sort((a,b)=>String(a.entity.name||'').localeCompare(String(b.entity.name||''),'fr')||Number(b.ed.edition_year||0)-Number(a.ed.edition_year||0));
  }
  const competitionEditionLabel=x=>[x?.entity?.name,x?.ed?.edition_label||x?.ed?.edition_year].filter(Boolean).join(' · ');
  function fillCompetitionEditionSelect(select,m=null,team=null){if(!select)return;const rows=competitionEditionRows(team);const current=String(m?.competition_edition_id||m?.competitionEdition?.id||m?.competition?.canonical_edition_id||select.value||'');select.innerHTML='<option value="">— édition non définie —</option>'+rows.map(x=>`<option value="${esc(x.ed.id)}">${esc(competitionEditionLabel(x))}</option>`).join('');if(current&&[...select.options].some(o=>o.value===current))select.value=current;}
  function fillTagSelects(m){
    const sec=$('#calendarEditSelectionTag'),comp=$('#calendarEditCompetitionTag');
    if(sec){const baseId=base(m,'selection_tag_id')||'';const current=eff(m,'selection_tag_id')||'';const rows=(store()?.getSectionTags?.()||[]).sort((a,b)=>String(a.label_text).localeCompare(String(b.label_text),'fr'));sec.innerHTML=`<option value="">Automatique${baseId&&tagById(baseId)?` · ${esc(tagById(baseId).label_text)}`:''}</option>`+rows.map(t=>tagOption(t,current)).join('');if(current&&[...sec.options].some(o=>o.value===String(current)))sec.value=String(current);else sec.value='';}
    if(comp){const baseId=base(m,'competition_tag_id')||'';const current=eff(m,'competition_tag_id')||'';const rows=(store()?.getCompetitionTags?.()||[]).sort((a,b)=>String(a.label_text).localeCompare(String(b.label_text),'fr'));comp.innerHTML=`<option value="">Automatique${baseId&&tagById(baseId)?` · ${esc(tagById(baseId).label_text)}`:''}</option>`+rows.map(t=>tagOption(t,current)).join('');if(current&&[...comp.options].some(o=>o.value===String(current)))comp.value=String(current);else comp.value='';}
    fillCompetitionEditionSelect($('#calendarEditCompetitionEdition'),m,m.selection||null);
  }
  function openEdit(id){const m=store()?.getMatch?.(id)||state.matches.find(x=>x.id===id);if(!m)return;if(!state.canEdit){alert('Modification réservée aux ADMIN et SUPERADMIN.');return;}$('#calendarEditMatchId').value=id;$('#calendarEditDate').value=toInputDate(eff(m,'match_date'));$('#calendarEditOpponent').value=eff(m,'opponent_name')||'';$('#calendarEditVenue').value=eff(m,'venue_name')||'';$('#calendarEditCity').value=eff(m,'city')||'';$('#calendarEditCompetition').value=eff(m,'competition_name')||'';populateBroadcastPicker('edit',eff(m,'broadcast_text')||'');window.BLEUS3000_BROADCASTS?.refresh?.()?.then?.(()=>populateBroadcastPicker('edit',eff(m,'broadcast_text')||''));$('#calendarEditUrl').value=eff(m,'broadcast_url')||'';$('#calendarEditFranceScore').value=eff(m,'france_score')??'';$('#calendarEditOpponentScore').value=eff(m,'opponent_score')??'';fillTagSelects(m);const fm=$('#calendarEditFeatureMode');if(fm)fm.value=featureMode(m);$('#calendarEditModal').hidden=false;}
  const normText=v=>String(v??'').trim();
  const normNum=v=>v===''||v==null?null:Number(v);
  function buildOverrides(m,values){const next={...(m.manual_overrides||{})};for(const [key,value] of Object.entries(values)){const raw=base(m,key);let sameAsBase=false;if(key==='match_date'){const a=parseDate(value),b=parseDate(raw);sameAsBase=!!a&&!!b&&Math.abs(+a-+b)<60000;}else if(key==='france_score'||key==='opponent_score')sameAsBase=normNum(value)===normNum(raw);else if(key==='selection_tag_id'||key==='competition_tag_id'){if(!value){delete next[key];continue;}sameAsBase=String(value)===String(raw||'');}else sameAsBase=normText(value)===normText(raw);if(sameAsBase)delete next[key];else next[key]=(key==='france_score'||key==='opponent_score')?normNum(value):value;}return next;}

  function selectedCreateTeam(){const id=$('#calendarCreateSelection')?.value;return state.selections.find(x=>String(x.id)===String(id))||null;}
  function existingCompetitionByName(name,team){const n=normText(name).toLocaleLowerCase('fr');if(!n)return null;return state.competitions.find(c=>String(c.name||'').trim().toLocaleLowerCase('fr')===n&&(!team||((!c.gender||c.gender===team.gender)&&(!c.selection_category||c.selection_category===team.category))))||state.competitions.find(c=>String(c.name||'').trim().toLocaleLowerCase('fr')===n)||null;}
  function fillCreateTagSelects(){
    const team=selectedCreateTeam(),sec=$('#calendarCreateSelectionTag'),comp=$('#calendarCreateCompetitionTag');
    const secRows=(store()?.getSectionTags?.()||[]).sort((a,b)=>String(a.label_text).localeCompare(String(b.label_text),'fr'));
    if(sec){const baseId=team?.team_tag_id||'';const keep=sec.value;sec.innerHTML=`<option value="">Automatique${baseId&&tagById(baseId)?` · ${esc(tagById(baseId).label_text)}`:''}</option>`+secRows.map(t=>tagOption(t,keep)).join('');if(keep&&[...sec.options].some(o=>o.value===keep))sec.value=keep;}
    const cp=existingCompetitionByName($('#calendarCreateCompetition')?.value||'',team),baseCompId=cp?.tag_id||'';
    const compRows=(store()?.getCompetitionTags?.()||[]).sort((a,b)=>String(a.label_text).localeCompare(String(b.label_text),'fr'));
    if(comp){const keep=comp.value;comp.innerHTML=`<option value="">Automatique${baseCompId&&tagById(baseCompId)?` · ${esc(tagById(baseCompId).label_text)}`:''}</option>`+compRows.map(t=>tagOption(t,keep)).join('');if(keep&&[...comp.options].some(o=>o.value===keep))comp.value=keep;}
    fillCompetitionEditionSelect($('#calendarCreateCompetitionEdition'),null,team);
  }
  async function openCreate(){
    if(!state.canEdit){alert('Création réservée aux ADMIN et SUPERADMIN.');return;}
    await store()?.load?.();state.selections=store()?.getSelections?.()||state.selections;
    const db=window.BLEUS3000_SUPABASE;if(!db)return alert('Supabase indisponible.');
    const {data,error}=await db.from('competitions').select('id,name,edition,gender,selection_category,tag_id,canonical_entity_id,canonical_edition_id').order('name').limit(2000);
    if(error)console.warn('Calendrier compétitions',error);state.competitions=data||store()?.getCompetitions?.()||[];
    await window.BLEUS3000_BROADCASTS?.refresh?.();
    const form=$('#calendarCreateForm');form?.reset();
    const teamSelect=$('#calendarCreateSelection');
    if(teamSelect){const rows=[...state.selections].sort((a,b)=>(Number(a.sort_order)||100)-(Number(b.sort_order)||100)||String(a.name).localeCompare(String(b.name),'fr'));teamSelect.innerHTML=rows.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');const preferred=state.team!=='all'&&rows.some(t=>String(t.id)===state.team)?state.team:(rows.find(t=>t.code==='FRA-A-M')?.id||rows[0]?.id||'');teamSelect.value=preferred;}
    const dl=$('#calendarCompetitionList');if(dl){const names=[...new Set(state.competitions.map(c=>c.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));dl.innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');}
    $('#calendarCreateHomeAway').value='home';$('#calendarCreateFranceScore').value='';$('#calendarCreateOpponentScore').value='';if($('#calendarCreateFeatureMode'))$('#calendarCreateFeatureMode').value='auto';populateBroadcastPicker('create','');
    const st=$('#calendarCreateStatus');if(st){st.hidden=true;st.textContent='';st.className='calendar-create-status';}
    fillCreateTagSelects();$('#calendarCreateModal').hidden=false;
  }
  async function findOrCreateOpponent(db,name){
    const {data,error}=await db.from('opponents').select('id,name').ilike('name',name).limit(1);if(error)throw error;if(data?.[0])return data[0];
    const {data:created,error:ce}=await db.from('opponents').insert({name,active:true}).select('id,name').single();if(ce)throw ce;return created;
  }
  function competitionFamilySlug(name,team){
    const x=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(!x)return '';
    if(x.includes('friendly')||x.includes('friendlies')||x.includes('amic'))return 'match-amical';
    if(x.includes('uefa nations league')||x.includes('ligue des nations'))return 'ligue-des-nations';
    return '';
  }
  function automaticCompetitionTagId(name,team){const slug=competitionFamilySlug(name,team);return slug?(store()?.getTags?.()||[]).find(t=>t.slug===slug)?.id||null:null;}
  async function ensureCompetitionTagLink(db,row,tagId){
    if(!row?.id||!tagId)return row;
    await db.from('tag_reference_links').delete().eq('reference_type','competition').eq('reference_id',row.id).eq('relation_kind','membership').neq('tag_id',tagId);
    const {error}=await db.from('tag_reference_links').insert({tag_id:tagId,reference_type:'competition',reference_id:row.id,relation_kind:'membership',created_by:window.C3K_ACCOUNT_STATE?.profile?.id||null});
    if(error&&!/duplicate|23505/i.test(String(error.message||error)))console.warn('Association tag compétition',error);
    return row;
  }
  async function findOrCreateCompetition(db,name,team,tagId,editionId=''){
    const editionCtx=editionId?competitionEditionRows(team).find(x=>String(x.ed.id)===String(editionId)):null;
    const canonicalName=editionCtx?.entity?.name||name;if(!canonicalName)return null;
    let data=[],error=null;if(editionId){({data,error}=await db.from('competitions').select('id,name,edition,gender,selection_category,tag_id,canonical_entity_id,canonical_edition_id').eq('canonical_edition_id',editionId).limit(20));}else{({data,error}=await db.from('competitions').select('id,name,edition,gender,selection_category,tag_id,canonical_entity_id,canonical_edition_id').ilike('name',canonicalName).limit(20));}if(error)throw error;
    let row=(data||[]).find(c=>(!c.gender||c.gender===team.gender)&&(!c.selection_category||c.selection_category===team.category))||(data||[])[0];
    const familyTag=editionCtx?.entity?.competition_tag_id||tagId||automaticCompetitionTagId(canonicalName,team)||null;const canonicalEntityId=editionCtx?.entity?.id||null;
    const canonicalPatch={tag_id:familyTag||row?.tag_id||null,canonical_entity_id:canonicalEntityId||row?.canonical_entity_id||null,canonical_edition_id:editionId||row?.canonical_edition_id||null};
    if(row){const needsPatch=(familyTag&&String(row.tag_id||'')!==String(familyTag))||(canonicalEntityId&&String(row.canonical_entity_id||'')!==String(canonicalEntityId))||(editionId&&String(row.canonical_edition_id||'')!==String(editionId));if(needsPatch){const {data:patched,error:pe}=await db.from('competitions').update({...canonicalPatch,updated_at:new Date().toISOString()}).eq('id',row.id).select('id,name,edition,gender,selection_category,tag_id,canonical_entity_id,canonical_edition_id').single();if(pe)throw pe;if(patched)row=patched;}if(familyTag)await ensureCompetitionTagLink(db,row,familyTag);return row;}
    const editionLabel=editionCtx?.ed?.edition_label||editionCtx?.ed?.edition_year||null;const {data:created,error:ce}=await db.from('competitions').insert({name:canonicalName,edition:editionLabel?String(editionLabel):null,competition_type:editionCtx?.entity?.competition_type||'Sélection nationale',gender:team.gender,selection_category:team.category,status:'active',tag_id:familyTag,canonical_entity_id:canonicalEntityId,canonical_edition_id:editionId||null,external_ids:{manual_calendar_entry:true}}).select('id,name,edition,gender,selection_category,tag_id,canonical_entity_id,canonical_edition_id').single();if(ce)throw ce;if(familyTag)await ensureCompetitionTagLink(db,created,familyTag);return created;
  }
  async function findOrCreatePlace(db,name,city){
    if(!name)return null;let q=db.from('places').select('id,name,city,country').ilike('name',name).limit(20);const {data,error}=await q;if(error)throw error;let row=(data||[]).find(p=>!city||String(p.city||'').toLocaleLowerCase('fr')===String(city).toLocaleLowerCase('fr'))||(data||[])[0];if(row)return row;
    const {data:created,error:ce}=await db.from('places').insert({place_type:'stadium',name,city:city||null,country:null}).select('id,name,city,country').single();if(ce)throw ce;return created;
  }
  async function syncBroadcastLinks(db,matchId,text){
    if(!matchId)return;
    const all=window.BLEUS3000_BROADCASTS?.channels||[];
    const low=String(text||'').toLowerCase();
    const ids=all.filter(b=>low.includes(String(b.name||'').toLowerCase())||(b.aliases||[]).some(a=>low.includes(String(a).toLowerCase()))).map(b=>b.id);
    await db.from('match_broadcast_channels').delete().eq('match_id',matchId);
    if(ids.length){const {error}=await db.from('match_broadcast_channels').insert(ids.map(broadcast_channel_id=>({match_id:matchId,broadcast_channel_id,source:'manual'})));if(error)console.warn('Liens diffusion',error);}
  }
  async function saveCreate(e){
    e.preventDefault();const db=window.BLEUS3000_SUPABASE,st=$('#calendarCreateStatus');if(!db)return;
    const localDate=$('#calendarCreateDate').value,team=selectedCreateTeam(),oppName=$('#calendarCreateOpponent').value.trim();
    if(!localDate||!team||!oppName){if(st){st.hidden=false;st.textContent='Date, sélection et adversaire sont obligatoires.';st.className='calendar-create-status is-error';}return;}
    const dateIso=new Date(localDate).toISOString();if(!dateIso||dateIso==='Invalid Date')return;
    if(st){st.hidden=false;st.textContent='Création du match…';st.className='calendar-create-status';}
    try{
      const selectedEditionId=$('#calendarCreateCompetitionEdition')?.value||'',editionCtx=selectedEditionId?competitionEditionRows(team).find(x=>String(x.ed.id)===String(selectedEditionId)):null,compName=editionCtx?.entity?.name||$('#calendarCreateCompetition').value.trim(),venue=$('#calendarCreateVenue').value.trim(),city=$('#calendarCreateCity').value.trim(),selectedCompTag=editionCtx?.entity?.competition_tag_id||$('#calendarCreateCompetitionTag').value||'',selectedSectionTag=$('#calendarCreateSelectionTag').value||'';
      const [opp,comp,plc]=await Promise.all([findOrCreateOpponent(db,oppName),findOrCreateCompetition(db,compName,team,selectedCompTag,selectedEditionId),findOrCreatePlace(db,venue,city)]);
      const day=localDate.slice(0,10),day0=new Date(`${day}T00:00:00`),day1=new Date(day0);day1.setDate(day1.getDate()+1);
      const {data:dupes}=await db.from('matches').select('id,match_date').eq('selection_team_id',team.id).eq('opponent_id',opp.id).gte('match_date',day0.toISOString()).lt('match_date',day1.toISOString()).limit(5);
      if(dupes?.length&&!confirm('Un match contre cet adversaire existe déjà ce jour-là. Créer quand même une nouvelle entrée ?')){if(st){st.hidden=true;}return;}
      const broadcast=$('#calendarCreateBroadcast').value.trim(),broadcastUrl=$('#calendarCreateUrl').value.trim(),fs=$('#calendarCreateFranceScore').value,os=$('#calendarCreateOpponentScore').value;
      const overrides={match_date:dateIso,opponent_name:oppName};if(compName)overrides.competition_name=compName;if(venue)overrides.venue_name=venue;if(city)overrides.city=city;if(broadcast)overrides.broadcast_text=broadcast;if(broadcastUrl)overrides.broadcast_url=broadcastUrl;if(selectedSectionTag&&String(selectedSectionTag)!==String(team.team_tag_id||''))overrides.selection_tag_id=selectedSectionTag;if(selectedCompTag&&String(selectedCompTag)!==String(comp?.tag_id||''))overrides.competition_tag_id=selectedCompTag;if(fs!=='')overrides.france_score=Number(fs);if(os!=='')overrides.opponent_score=Number(os);
      const body={match_date:dateIso,gender:team.gender,selection_category:team.category,selection_team_id:team.id,opponent_id:opp.id,competition_id:comp?.id||null,competition_edition_id:selectedEditionId||comp?.canonical_edition_id||null,place_id:plc?.id||null,home_away:$('#calendarCreateHomeAway').value==='away'?'away':'home',france_score:fs===''?null:Number(fs),opponent_score:os===''?null:Number(os),status:Date.parse(dateIso)<Date.now()?'FT':'scheduled',feature_frame_mode:$('#calendarCreateFeatureMode')?.value||'auto',notes_short:null,broadcast_text:broadcast||null,broadcast_url:broadcastUrl||null,external_ids:{manual_calendar_entry:true},provider:null,provider_fixture_id:null,data_state:'verified',api_payload:{},manual_overrides:overrides};
      const {data:createdMatch,error}=await db.from('matches').insert(body).select('id').single();if(error)throw error;
      await syncBroadcastLinks(db,createdMatch?.id,broadcast);
      store()?.invalidate?.();await load();state.mode=Date.parse(dateIso)<Date.now()?'past':'upcoming';document.querySelectorAll('[data-calendar-mode]').forEach(x=>x.classList.toggle('is-active',x.dataset.calendarMode===state.mode));render();$('#calendarCreateModal').hidden=true;
    }catch(err){console.error('Création match',err);if(st){st.hidden=false;st.textContent='Création impossible : '+(err?.message||err);st.className='calendar-create-status is-error';}}
  }

  async function syncLiveSheets(force=false){
    if(state.sheetSyncBusy)return;
    const now=Date.now();if(!force&&now-state.lastSheetSyncAt<90000)return;
    state.sheetSyncBusy=true;state.lastSheetSyncAt=now;
    try{
      const r=await fetch(`/api/match-sheet-sync${force?'?force=1':''}`,{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)return;
      const data=await r.json();const ids=Array.isArray(data.changedMatchIds)?data.changedMatchIds:[];if(!ids.length)return;
      store()?.invalidate?.();state.matches=await store()?.load?.()||state.matches;render();
      window.dispatchEvent(new CustomEvent('bleus:match-sheet-synced',{detail:{matchIds:ids,summaries:data.summaries||[]}}));
    }catch(err){console.warn('Synchronisation live des feuilles',err);}finally{state.sheetSyncBusy=false;}
  }
  async function pollLive(){try{const r=await fetch('/api/sportsdb-live',{headers:{accept:'application/json'}});if(r.ok){const data=await r.json();state.live=new Map((data.livescore||[]).map(x=>[String(x.idEvent),x]));render();}syncLiveSheets(false).catch(()=>{});}catch{syncLiveSheets(false).catch(()=>{});} }
  function setupLive(){pollLive();state.liveTimer=setInterval(()=>{if(document.visibilityState==='visible')pollLive();},120000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pollLive();});}
  document.addEventListener('click',e=>{const recentAll=e.target.closest('#calendarRecentOpenAll');if(recentAll){state.mode='past';document.querySelectorAll('[data-calendar-mode]').forEach(x=>x.classList.toggle('is-active',x.dataset.calendarMode==='past'));openModal();return}const open=e.target.closest('#calendarToolbarBtn,#calendarOpenAll');if(open){state.mode='upcoming';document.querySelectorAll('[data-calendar-mode]').forEach(x=>x.classList.toggle('is-active',x.dataset.calendarMode==='upcoming'));openModal();return}const gathering=e.target.closest('[data-gathering-open]');if(gathering){closeModal();window.BLEUS3000_GATHERINGS?.open?.(gathering.dataset.gatheringOpen);return}const quick=e.target.closest('[data-calendar-quick-event]');if(quick){store()?.openQuickMatchEvent?.(quick.dataset.calendarQuickEvent);return}const pin=e.target.closest('[data-calendar-pin]');if(pin){toggleHomePin(pin.dataset.calendarPin);return}const openMatch=e.target.closest('[data-calendar-open-match]');if(openMatch){store()?.openMatch?.(openMatch.dataset.calendarOpenMatch);return}const openSheet=e.target.closest('[data-calendar-open-sheet]');if(openSheet){store()?.openMatchSheet?.(openSheet.dataset.calendarOpenSheet);syncLiveSheets(true).catch(()=>{});return}if(e.target.closest('#calendarAddGatheringBtn')){window.BLEUS3000_GATHERINGS?.openNew?.();return}if(e.target.closest('#calendarAddBtn')){openCreate();return}const tab=e.target.closest('[data-calendar-mode]');if(tab){state.mode=tab.dataset.calendarMode;document.querySelectorAll('[data-calendar-mode]').forEach(x=>x.classList.toggle('is-active',x===tab));render();return}const edit=e.target.closest('[data-calendar-edit]');if(edit){openEdit(edit.dataset.calendarEdit);return}if(e.target.closest('[data-calendar-close]'))closeModal();if(e.target.closest('[data-calendar-create-close]'))$('#calendarCreateModal').hidden=true;});
  $('#calendarTeamFilter')?.addEventListener('change',e=>{state.team=e.target.value;render()});
  $('#calendarSearch')?.addEventListener('input',e=>{state.search=e.target.value||'';render();});
  $('#calendarCreateSelection')?.addEventListener('change',fillCreateTagSelects);
  $('#calendarCreateCompetition')?.addEventListener('input',fillCreateTagSelects);
  $('#calendarCreateCompetitionEdition')?.addEventListener('change',()=>{const team=selectedCreateTeam(),ctx=competitionEditionRows(team).find(x=>String(x.ed.id)===String($('#calendarCreateCompetitionEdition').value||''));if(!ctx)return;const n=$('#calendarCreateCompetition'),t=$('#calendarCreateCompetitionTag');if(n)n.value=ctx.entity.name;if(t)t.value=String(ctx.entity.competition_tag_id||'');});
  $('#calendarEditCompetitionEdition')?.addEventListener('change',()=>{const ctx=competitionEditionRows().find(x=>String(x.ed.id)===String($('#calendarEditCompetitionEdition').value||''));if(!ctx)return;const n=$('#calendarEditCompetition'),t=$('#calendarEditCompetitionTag');if(n)n.value=ctx.entity.name;if(t)t.value=String(ctx.entity.competition_tag_id||'');});
  $('#calendarCreateBroadcastSelect')?.addEventListener('change',()=>onBroadcastPickerChange('create'));
  $('#calendarEditBroadcastSelect')?.addEventListener('change',()=>onBroadcastPickerChange('edit'));
  $('#calendarCreateForm')?.addEventListener('submit',saveCreate);
  $('#calendarEditReset')?.addEventListener('click',async()=>{const id=$('#calendarEditMatchId').value;if(!id)return;const db=window.BLEUS3000_SUPABASE;if(!db)return;const {error}=await db.from('matches').update({manual_overrides:{},feature_frame_mode:'auto',updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Réinitialisation impossible : '+error.message);return;}store()?.applyLocalOverride?.(id,{});$('#calendarEditModal').hidden=true;render();window.BLEUS3000_RELATIONAL_REFS?.render?.('matchs',$('#referenceSearch')?.value||'');});
  $('#calendarEditForm')?.addEventListener('submit',async e=>{e.preventDefault();const id=$('#calendarEditMatchId').value,m=store()?.getMatch?.(id);const db=window.BLEUS3000_SUPABASE;if(!m||!db)return;const localDate=$('#calendarEditDate').value;const dateValue=localDate?new Date(localDate).toISOString():'';const values={match_date:dateValue,opponent_name:$('#calendarEditOpponent').value.trim(),venue_name:$('#calendarEditVenue').value.trim(),city:$('#calendarEditCity').value.trim(),competition_name:$('#calendarEditCompetition').value.trim(),selection_tag_id:$('#calendarEditSelectionTag').value,competition_tag_id:$('#calendarEditCompetitionTag').value,broadcast_text:$('#calendarEditBroadcast').value.trim(),broadcast_url:$('#calendarEditUrl').value.trim(),france_score:$('#calendarEditFranceScore').value,opponent_score:$('#calendarEditOpponentScore').value};const manual_overrides=buildOverrides(m,values),selectedEditionId=$('#calendarEditCompetitionEdition')?.value||null,editionCtx=selectedEditionId?competitionEditionRows(m.selection||null).find(x=>String(x.ed.id)===String(selectedEditionId)):null,legacyComp=selectedEditionId?state.competitions.find(c=>String(c.canonical_edition_id||'')===String(selectedEditionId)&&(!c.gender||c.gender===m.selection?.gender)&&(!c.selection_category||c.selection_category===m.selection?.category))||state.competitions.find(c=>String(c.canonical_edition_id||'')===String(selectedEditionId)):null;if(selectedEditionId){delete manual_overrides.competition_tag_id;if(editionCtx?.entity?.name)manual_overrides.competition_name=editionCtx.entity.name;}const matchPatch={manual_overrides,competition_edition_id:selectedEditionId,feature_frame_mode:$('#calendarEditFeatureMode')?.value||'auto',updated_at:new Date().toISOString()};if(legacyComp)matchPatch.competition_id=legacyComp.id;const {error}=await db.from('matches').update(matchPatch).eq('id',id);if(error){alert('Modification impossible : '+error.message);return;}await syncBroadcastLinks(db,id,values.broadcast_text);m.manual_overrides=manual_overrides;m.feature_frame_mode=$('#calendarEditFeatureMode')?.value||'auto';render();window.BLEUS3000_RELATIONAL_REFS?.render?.('matchs',$('#referenceSearch')?.value||'');const btn=$('#calendarEditForm button[type=submit]');if(btn){const before=btn.textContent;btn.textContent='Enregistré ✓';setTimeout(()=>btn.textContent=before,1200);}});
  window.addEventListener('c3k:account-state',e=>setPermissions(e.detail?.role));
  window.addEventListener('bleus:matches-ready',e=>{state.matches=e.detail?.matches||[];state.selections=store()?.getSelections?.()||state.selections;populateTeams();render();});
  window.addEventListener('bleus:gatherings-ready',e=>{state.gatherings=e.detail?.gatherings||window.BLEUS3000_GATHERINGS?.getCalendarItems?.()||[];state.homePage=1;render();});
  window.addEventListener('bleus:match-sheet-updated',e=>{const id=String(e.detail?.matchId||''),m=state.matches.find(x=>String(x.id)===id);if(m){m.lineup_status=e.detail?.lineupStatus||null;render();}});
  window.addEventListener('bleus:broadcasts-ready',()=>{if(!$('#calendarCreateModal')?.hidden)populateBroadcastPicker('create',$('#calendarCreateBroadcast')?.value||'');if(!$('#calendarEditModal')?.hidden)populateBroadcastPicker('edit',$('#calendarEditBroadcast')?.value||'');});
  window.BLEUS3000_CALENDAR={open:openModal,openEdit,openCreate,refresh:load,pollLive,syncLiveSheets,setFeatureStyle:style=>{state.featureStyle=style;render();},refreshBroadcasts:()=>{window.BLEUS3000_BROADCASTS?.refresh?.();render();}};window.addEventListener('bleus:feature-style',e=>{state.featureStyle=e.detail?.style||state.featureStyle;render();});
  load();permissions();setupLive();
  window.addEventListener('bleus:country-colors-changed',()=>scheduleMinitelTeamColors());
})();
