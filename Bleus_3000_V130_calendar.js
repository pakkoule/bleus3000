/* 3615 Bleus V1.1.40 — Calendrier relationnel + familles de compétitions + TheSportsDB */
(()=>{
  'use strict';
  const state={matches:[],mode:'upcoming',team:'all',canEdit:false,live:new Map(),liveTimer:null,selections:[],competitions:[]};
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=()=>window.BLEUS3000_RELATIONAL_REFS;
  const eff=(m,k)=>store()?.effective?store().effective(m,k):m?.[k];
  const base=(m,k)=>store()?.baseValue?store().baseValue(m,k):m?.[k];
  const parseDate=v=>{const d=new Date(v);return Number.isNaN(+d)?null:d;};
  const flagImg=name=>window.BLEUS3000_FLAGS?.img?.(name,'calendar-svg-flag')||'<span class="calendar-svg-flag is-missing">◌</span>';
  const frDate=iso=>{const d=parseDate(iso);if(!d)return String(iso||'Date à confirmer');return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Paris'}).format(d).replace(' à ',' - ').replace(':','H').replace(/^./,c=>c.toUpperCase());};
  const selectionLabel=m=>m.selection?.name?.replace(/ Masculin$/,'').replace(/ Féminine$/,' F')||m.selection_category||'France';
  const opponent=m=>eff(m,'opponent_name')||'Adversaire à confirmer';
  const teams=m=>m.home_away==='away'?[opponent(m),selectionLabel(m)]:[selectionLabel(m),opponent(m)];
  const liveFor=m=>m.provider==='thesportsdb'&&m.provider_fixture_id?state.live.get(String(m.provider_fixture_id)):null;
  const score=m=>{const l=liveFor(m);if(l){const home=Number(l.intHomeScore),away=Number(l.intAwayScore);if(Number.isFinite(home)&&Number.isFinite(away))return `${home} - ${away}`;}const a=eff(m,'france_score'),b=eff(m,'opponent_score');if(a==null||b==null||a===''||b==='')return '';return m.home_away==='away'?`${b} - ${a}`:`${a} - ${b}`;};
  const place=m=>[eff(m,'venue_name'),eff(m,'city')].filter(Boolean).join(', ');
  const isLive=m=>!!liveFor(m)||['1H','2H','HT','ET','P','LIVE','IN PLAY','IN_PLAY'].includes(String(eff(m,'status')||'').toUpperCase());
  const manual=m=>Object.keys(m.manual_overrides||{}).length>0;
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
  function sectionChip(m){const t=sectionTag(m);return t?tagChip(t,'section'):fallbackTag(selectionLabel(m),'section');}
  function competitionChip(m){const t=competitionTag(m);if(t)return tagChip(t,'competition');const n=eff(m,'competition_name');return n?fallbackTag(n,'competition'):'';}
  function statusLabel(m){const l=liveFor(m);if(l){const p=String(l.strProgress||'').trim();const s=String(l.strStatus||'LIVE').toUpperCase();return `<span class="calendar-live"><i></i> LIVE${p?` · ${esc(p)}${/^\d+$/.test(p)?"'":''}`:s==='HT'?' · MI-TEMPS':''}</span>`;}const s=String(eff(m,'status')||'').toUpperCase();if(['FT','MATCH FINISHED','FINISHED'].includes(s))return '<span class="calendar-finished">✓ TERMINÉ</span>';if(/POSTP/.test(s))return '<span class="calendar-postponed">● REPORTÉ</span>';if(/CANC/.test(s))return '<span class="calendar-cancelled">● ANNULÉ</span>';return ''}
  function row(m){const [a,b]=teams(m),s=score(m),past=parseDate(eff(m,'match_date'))?.getTime()<Date.now();const tv=eff(m,'broadcast_text')||'Diffusion à confirmer',url=eff(m,'broadcast_url');return `<article class="calendar-row ${isLive(m)?'is-live':''}" data-calendar-id="${esc(m.id)}"><div class="calendar-date">${esc(frDate(eff(m,'match_date')))}</div><div class="calendar-fixture"><span class="calendar-team"><span class="calendar-flag">${flagImg(a)}</span><span>${esc(a)}</span></span><span class="calendar-separator">${s?`<strong class="calendar-score">${esc(s)}</strong>`:'–'}</span><span class="calendar-team"><span>${esc(b)}</span><span class="calendar-flag">${flagImg(b)}</span></span>${statusLabel(m)}</div>${place(m)?`<div class="calendar-place">${esc(place(m))}</div>`:''}<div class="calendar-meta"><span class="calendar-tv">📺 ${esc(tv)}</span>${url?`<a class="calendar-stream" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Voir la diffusion internet" aria-label="Voir la diffusion internet">↗</a>`:''}${sectionChip(m)}${competitionChip(m)}${manual(m)?'<span class="calendar-manual">✎ manuel</span>':''}${state.canEdit?`<button class="calendar-edit-btn" type="button" data-calendar-edit="${esc(m.id)}">Modifier</button>`:''}<span class="calendar-state">${m.provider==='thesportsdb'?'TheSportsDB':m.data_state==='locked'?'Verrouillé':past?'Historique vérifié':'3615 Bleus'}</span></div></article>`}
  function filtered(){const now=Date.now();return state.matches.filter(m=>{const d=parseDate(eff(m,'match_date'))?.getTime()||0;const live=isLive(m);const temporal=state.mode==='past'?(!live&&d<now):(live||d>=now);return temporal&&(state.team==='all'||String(m.selection_team_id)===state.team)}).sort((a,b)=>state.mode==='past'?(parseDate(eff(b,'match_date'))-parseDate(eff(a,'match_date'))):(parseDate(eff(a,'match_date'))-parseDate(eff(b,'match_date'))));}
  function render(){const all=filtered();const home=$('#calendarHomeList');if(home){const up=state.matches.filter(m=>isLive(m)||(parseDate(eff(m,'match_date'))?.getTime()||0)>=Date.now()).sort((a,b)=>{if(isLive(a)!==isLive(b))return isLive(a)?-1:1;return parseDate(eff(a,'match_date'))-parseDate(eff(b,'match_date'));}).slice(0,5);home.innerHTML=up.map(row).join('')||'<div class="calendar-empty">Aucun prochain match enregistré.</div>';}const full=$('#calendarFullList');if(full)full.innerHTML=all.map(row).join('')||'<div class="calendar-empty">Aucun match pour ce filtre.</div>';const add=$('#calendarAddBtn');if(add)add.hidden=!state.canEdit;}
  async function load(){try{state.matches=await store()?.load?.()||[];state.selections=store()?.getSelections?.()||[];populateTeams();render();}catch(error){console.warn('Calendrier 3615 Bleus',error);['#calendarHomeList','#calendarFullList'].forEach(s=>{const e=$(s);if(e)e.innerHTML='<div class="calendar-empty">Calendrier indisponible.</div>'});}}
  function setPermissions(role){state.canEdit=['editor','admin','superadmin'].includes(String(role||'').toLowerCase());render();}
  async function permissions(){setPermissions(window.C3K_ACCOUNT_STATE?.role);}
  function populateTeams(){const sel=$('#calendarTeamFilter');if(!sel)return;const opts=[...new Map(state.matches.filter(m=>m.selection_team_id).map(m=>[m.selection_team_id,selectionLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr'));const prev=state.team;sel.innerHTML='<option value="all">Toutes les sélections</option>'+opts.map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('');if([...sel.options].some(o=>o.value===prev))sel.value=prev;}
  function openModal(){const m=$('#calendarModal');if(m){m.hidden=false;document.body.classList.add('modal-open');render();pollLive();}}
  function closeModal(){const m=$('#calendarModal');if(m){m.hidden=true;document.body.classList.remove('modal-open')}}
  const toInputDate=iso=>{const d=parseDate(iso);if(!d)return '';const p=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Paris'}).format(d);return p.replace(' ','T');};
  const tagOption=(t,selected)=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${esc(t.label_text)}</option>`;
  function fillTagSelects(m){
    const sec=$('#calendarEditSelectionTag'),comp=$('#calendarEditCompetitionTag');
    if(sec){const baseId=base(m,'selection_tag_id')||'';const current=eff(m,'selection_tag_id')||'';const rows=(store()?.getSectionTags?.()||[]).sort((a,b)=>String(a.label_text).localeCompare(String(b.label_text),'fr'));sec.innerHTML=`<option value="">Automatique${baseId&&tagById(baseId)?` · ${esc(tagById(baseId).label_text)}`:''}</option>`+rows.map(t=>tagOption(t,current)).join('');if(current&&[...sec.options].some(o=>o.value===String(current)))sec.value=String(current);else sec.value='';}
    if(comp){const baseId=base(m,'competition_tag_id')||'';const current=eff(m,'competition_tag_id')||'';const rows=(store()?.getCompetitionTags?.()||[]).sort((a,b)=>String(a.label_text).localeCompare(String(b.label_text),'fr'));comp.innerHTML=`<option value="">Automatique${baseId&&tagById(baseId)?` · ${esc(tagById(baseId).label_text)}`:''}</option>`+rows.map(t=>tagOption(t,current)).join('');if(current&&[...comp.options].some(o=>o.value===String(current)))comp.value=String(current);else comp.value='';}
  }
  function openEdit(id){const m=store()?.getMatch?.(id)||state.matches.find(x=>x.id===id);if(!m)return;if(!state.canEdit){alert('Modification réservée aux éditeurs et administrateurs.');return;}$('#calendarEditMatchId').value=id;$('#calendarEditDate').value=toInputDate(eff(m,'match_date'));$('#calendarEditOpponent').value=eff(m,'opponent_name')||'';$('#calendarEditVenue').value=eff(m,'venue_name')||'';$('#calendarEditCity').value=eff(m,'city')||'';$('#calendarEditCompetition').value=eff(m,'competition_name')||'';$('#calendarEditBroadcast').value=eff(m,'broadcast_text')||'';$('#calendarEditUrl').value=eff(m,'broadcast_url')||'';$('#calendarEditFranceScore').value=eff(m,'france_score')??'';$('#calendarEditOpponentScore').value=eff(m,'opponent_score')??'';fillTagSelects(m);$('#calendarEditModal').hidden=false;}
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
  }
  async function openCreate(){
    if(!state.canEdit){alert('Création réservée aux éditeurs et administrateurs.');return;}
    await store()?.load?.();state.selections=store()?.getSelections?.()||state.selections;
    const db=window.BLEUS3000_SUPABASE;if(!db)return alert('Supabase indisponible.');
    const {data,error}=await db.from('competitions').select('id,name,edition,gender,selection_category,tag_id').order('name').limit(2000);
    if(error)console.warn('Calendrier compétitions',error);state.competitions=data||store()?.getCompetitions?.()||[];
    const form=$('#calendarCreateForm');form?.reset();
    const teamSelect=$('#calendarCreateSelection');
    if(teamSelect){const rows=[...state.selections].sort((a,b)=>(Number(a.sort_order)||100)-(Number(b.sort_order)||100)||String(a.name).localeCompare(String(b.name),'fr'));teamSelect.innerHTML=rows.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');const preferred=state.team!=='all'&&rows.some(t=>String(t.id)===state.team)?state.team:(rows.find(t=>t.code==='FRA-A-M')?.id||rows[0]?.id||'');teamSelect.value=preferred;}
    const dl=$('#calendarCompetitionList');if(dl){const names=[...new Set(state.competitions.map(c=>c.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));dl.innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');}
    $('#calendarCreateHomeAway').value='home';$('#calendarCreateFranceScore').value='';$('#calendarCreateOpponentScore').value='';
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
    if(x.includes('fifa womens u17 world cup')||x.includes('fifa women u17 world cup'))return 'coupe-du-monde-u17-f';
    if(x.includes('fifa u 17 world cup')||x.includes('fifa u17 world cup'))return 'coupe-du-monde-u17';
    if((x.includes('u21')||x.includes('under 21'))){
      if(x.includes('qualif')||x.includes('qualification')||x.includes('qualifying')||x==='uefa european under 21 championship')return 'qualif-euro-u21';
      if(/^euro u21\b/.test(x)||x.includes('european under 21 championship'))return 'euro-u21';
    }
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
  async function findOrCreateCompetition(db,name,team,tagId){
    if(!name)return null;
    let q=db.from('competitions').select('id,name,edition,gender,selection_category,tag_id').ilike('name',name).limit(20);const {data,error}=await q;if(error)throw error;
    let row=(data||[]).find(c=>(!c.gender||c.gender===team.gender)&&(!c.selection_category||c.selection_category===team.category))||(data||[])[0];
    const familyTag=tagId||automaticCompetitionTagId(name,team)||null;
    if(row){if(familyTag&&String(row.tag_id||'')!==String(familyTag)){const {data:patched,error:pe}=await db.from('competitions').update({tag_id:familyTag,updated_at:new Date().toISOString()}).eq('id',row.id).select('id,name,edition,gender,selection_category,tag_id').single();if(pe)throw pe;if(patched)row=patched;}if(familyTag)await ensureCompetitionTagLink(db,row,familyTag);return row;}
    const {data:created,error:ce}=await db.from('competitions').insert({name,edition:null,competition_type:'Sélection nationale',gender:team.gender,selection_category:team.category,status:'active',tag_id:familyTag,external_ids:{manual_calendar_entry:true}}).select('id,name,edition,gender,selection_category,tag_id').single();if(ce)throw ce;if(familyTag)await ensureCompetitionTagLink(db,created,familyTag);return created;
  }
  async function findOrCreatePlace(db,name,city){
    if(!name)return null;let q=db.from('places').select('id,name,city,country').ilike('name',name).limit(20);const {data,error}=await q;if(error)throw error;let row=(data||[]).find(p=>!city||String(p.city||'').toLocaleLowerCase('fr')===String(city).toLocaleLowerCase('fr'))||(data||[])[0];if(row)return row;
    const {data:created,error:ce}=await db.from('places').insert({place_type:'stadium',name,city:city||null,country:null}).select('id,name,city,country').single();if(ce)throw ce;return created;
  }
  async function saveCreate(e){
    e.preventDefault();const db=window.BLEUS3000_SUPABASE,st=$('#calendarCreateStatus');if(!db)return;
    const localDate=$('#calendarCreateDate').value,team=selectedCreateTeam(),oppName=$('#calendarCreateOpponent').value.trim();
    if(!localDate||!team||!oppName){if(st){st.hidden=false;st.textContent='Date, sélection et adversaire sont obligatoires.';st.className='calendar-create-status is-error';}return;}
    const dateIso=new Date(localDate).toISOString();if(!dateIso||dateIso==='Invalid Date')return;
    if(st){st.hidden=false;st.textContent='Création du match…';st.className='calendar-create-status';}
    try{
      const compName=$('#calendarCreateCompetition').value.trim(),venue=$('#calendarCreateVenue').value.trim(),city=$('#calendarCreateCity').value.trim(),selectedCompTag=$('#calendarCreateCompetitionTag').value||'',selectedSectionTag=$('#calendarCreateSelectionTag').value||'';
      const [opp,comp,plc]=await Promise.all([findOrCreateOpponent(db,oppName),findOrCreateCompetition(db,compName,team,selectedCompTag),findOrCreatePlace(db,venue,city)]);
      const day=localDate.slice(0,10),day0=new Date(`${day}T00:00:00`),day1=new Date(day0);day1.setDate(day1.getDate()+1);
      const {data:dupes}=await db.from('matches').select('id,match_date').eq('selection_team_id',team.id).eq('opponent_id',opp.id).gte('match_date',day0.toISOString()).lt('match_date',day1.toISOString()).limit(5);
      if(dupes?.length&&!confirm('Un match contre cet adversaire existe déjà ce jour-là. Créer quand même une nouvelle entrée ?')){if(st){st.hidden=true;}return;}
      const broadcast=$('#calendarCreateBroadcast').value.trim(),broadcastUrl=$('#calendarCreateUrl').value.trim(),fs=$('#calendarCreateFranceScore').value,os=$('#calendarCreateOpponentScore').value;
      const overrides={match_date:dateIso,opponent_name:oppName};if(compName)overrides.competition_name=compName;if(venue)overrides.venue_name=venue;if(city)overrides.city=city;if(broadcast)overrides.broadcast_text=broadcast;if(broadcastUrl)overrides.broadcast_url=broadcastUrl;if(selectedSectionTag&&String(selectedSectionTag)!==String(team.team_tag_id||''))overrides.selection_tag_id=selectedSectionTag;if(selectedCompTag&&String(selectedCompTag)!==String(comp?.tag_id||''))overrides.competition_tag_id=selectedCompTag;if(fs!=='')overrides.france_score=Number(fs);if(os!=='')overrides.opponent_score=Number(os);
      const body={match_date:dateIso,gender:team.gender,selection_category:team.category,selection_team_id:team.id,opponent_id:opp.id,competition_id:comp?.id||null,place_id:plc?.id||null,home_away:$('#calendarCreateHomeAway').value==='away'?'away':'home',france_score:fs===''?null:Number(fs),opponent_score:os===''?null:Number(os),status:Date.parse(dateIso)<Date.now()?'FT':'scheduled',notes_short:'Entrée manuelle 3615 Bleus',broadcast_text:broadcast||null,broadcast_url:broadcastUrl||null,external_ids:{manual_calendar_entry:true},provider:null,provider_fixture_id:null,data_state:'verified',api_payload:{},manual_overrides:overrides};
      const {error}=await db.from('matches').insert(body);if(error)throw error;
      store()?.invalidate?.();await load();state.mode=Date.parse(dateIso)<Date.now()?'past':'upcoming';document.querySelectorAll('[data-calendar-mode]').forEach(x=>x.classList.toggle('is-active',x.dataset.calendarMode===state.mode));render();$('#calendarCreateModal').hidden=true;
    }catch(err){console.error('Création match',err);if(st){st.hidden=false;st.textContent='Création impossible : '+(err?.message||err);st.className='calendar-create-status is-error';}}
  }

  async function pollLive(){try{const r=await fetch('/api/sportsdb-live',{headers:{accept:'application/json'}});if(!r.ok)return;const data=await r.json();state.live=new Map((data.livescore||[]).map(x=>[String(x.idEvent),x]));render();}catch{} }
  function setupLive(){pollLive();state.liveTimer=setInterval(()=>{if(document.visibilityState==='visible')pollLive();},120000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pollLive();});}
  document.addEventListener('click',e=>{const open=e.target.closest('#calendarToolbarBtn,#calendarOpenAll');if(open){openModal();return}if(e.target.closest('#calendarAddBtn')){openCreate();return}const tab=e.target.closest('[data-calendar-mode]');if(tab){state.mode=tab.dataset.calendarMode;document.querySelectorAll('[data-calendar-mode]').forEach(x=>x.classList.toggle('is-active',x===tab));render();return}const edit=e.target.closest('[data-calendar-edit]');if(edit){openEdit(edit.dataset.calendarEdit);return}if(e.target.closest('[data-calendar-close]'))closeModal();if(e.target.closest('[data-calendar-create-close]'))$('#calendarCreateModal').hidden=true;});
  $('#calendarTeamFilter')?.addEventListener('change',e=>{state.team=e.target.value;render()});
  $('#calendarCreateSelection')?.addEventListener('change',fillCreateTagSelects);
  $('#calendarCreateCompetition')?.addEventListener('input',fillCreateTagSelects);
  $('#calendarCreateForm')?.addEventListener('submit',saveCreate);
  $('#calendarEditReset')?.addEventListener('click',async()=>{const id=$('#calendarEditMatchId').value;if(!id)return;const db=window.BLEUS3000_SUPABASE;if(!db)return;const {error}=await db.from('matches').update({manual_overrides:{},updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Réinitialisation impossible : '+error.message);return;}store()?.applyLocalOverride?.(id,{});$('#calendarEditModal').hidden=true;render();window.BLEUS3000_RELATIONAL_REFS?.render?.('matchs',$('#referenceSearch')?.value||'');});
  $('#calendarEditForm')?.addEventListener('submit',async e=>{e.preventDefault();const id=$('#calendarEditMatchId').value,m=store()?.getMatch?.(id);const db=window.BLEUS3000_SUPABASE;if(!m||!db)return;const localDate=$('#calendarEditDate').value;const dateValue=localDate?new Date(localDate).toISOString():'';const values={match_date:dateValue,opponent_name:$('#calendarEditOpponent').value.trim(),venue_name:$('#calendarEditVenue').value.trim(),city:$('#calendarEditCity').value.trim(),competition_name:$('#calendarEditCompetition').value.trim(),selection_tag_id:$('#calendarEditSelectionTag').value,competition_tag_id:$('#calendarEditCompetitionTag').value,broadcast_text:$('#calendarEditBroadcast').value.trim(),broadcast_url:$('#calendarEditUrl').value.trim(),france_score:$('#calendarEditFranceScore').value,opponent_score:$('#calendarEditOpponentScore').value};const manual_overrides=buildOverrides(m,values);const {error}=await db.from('matches').update({manual_overrides,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert('Modification impossible : '+error.message);return;}m.manual_overrides=manual_overrides;$('#calendarEditModal').hidden=true;render();window.BLEUS3000_RELATIONAL_REFS?.render?.('matchs',$('#referenceSearch')?.value||'');});
  window.addEventListener('c3k:account-state',e=>setPermissions(e.detail?.role));
  window.addEventListener('bleus:matches-ready',e=>{state.matches=e.detail?.matches||[];state.selections=store()?.getSelections?.()||state.selections;populateTeams();render();});
  window.BLEUS3000_CALENDAR={open:openModal,openEdit,openCreate,refresh:load,pollLive};
  load();permissions();setupLive();
})();
