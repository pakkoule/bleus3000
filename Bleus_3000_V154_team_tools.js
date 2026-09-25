/* 3615 Bleus V1.1.61.14 — Outils Onze / Five · exports canvas origin-clean */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const client=()=>window.BLEUS3000_SUPABASE||null;
  const account=()=>window.C3K_ACCOUNT_STATE||{};
  const localKey='bleus3000.team-compositions.v2';
  const maxByKind=10;
  const defaultFormation='4-3-3';
  const defaultNumberStyle='france-2024';
  const state={kind:'xi',formation:defaultFormation,displayMode:'photo',numberStyle:defaultNumberStyle,matchId:'',matchLabel:'',matchDate:'',captainPlayerId:null,currentSavedId:null,saved:[],upcoming:[],busy:false};

  const formations={
    '4-3-3':[4,3,3],
    '4-4-2':[4,4,2],
    '4-2-3-1':[4,2,3,1],
    '3-5-2':[3,5,2],
    '3-4-3':[3,4,3],
    '5-3-2':[5,3,2],
    '4-1-4-1':[4,1,4,1]
  };
  const rowXs=n=>({1:[50],2:[32,68],3:[19,50,81],4:[10,36,64,90],5:[9,29.5,50,70.5,91]}[n]||Array.from({length:n},(_,i)=>10+(80*i/Math.max(1,n-1))));
  function slotLayout(kind=state.kind,formation=state.formation){
    if(kind==='five')return [
      {role:'GB',x:50,y:90},{role:'DEF',x:29,y:64},{role:'DEF',x:71,y:64},{role:'ATT',x:31,y:29},{role:'ATT',x:69,y:29}
    ];
    const rows=formations[formation]||formations[defaultFormation];
    const ys=rows.length===3?[73,49,24]:rows.length===4?[76,59,41,21]:Array.from({length:rows.length},(_,i)=>76-(55*i/Math.max(1,rows.length-1)));
    const out=[{role:'GB',x:50,y:92}];
    rows.forEach((n,ri)=>{
      const role=ri===0?'DEF':ri===rows.length-1?'ATT':'MIL';
      rowXs(n).forEach(x=>out.push({role,x,y:ys[ri]}));
    });
    return out.slice(0,11);
  }

  function players(){
    const reg=window.BLEUS3000_PLAYER_REGISTRY_ALL||window.BLEUS3000_PLAYER_REGISTRY||[];
    if(reg.length)return reg;
    return (window.BLEUS3000_DATA?.players||[]).map(p=>({id:p.id,name:p.name,display_name:p.name,position:p.position||'',positions:[p.position||''].filter(Boolean),international_number:null,jersey_numbers:[],photo_path:p.photo_path||null}));
  }
  const playerById=id=>players().find(p=>String(p.id)===String(id))||null;
  const exactPlayer=name=>{const q=norm(name);if(!q)return null;const hits=players().filter(p=>norm(p.name||p.display_name)===q||(p.name_variants||[]).some(n=>norm(n)===q));return hits.length===1?hits[0]:null;};
  function playerSearch(q){
    const n=norm(q);if(n.length<2)return [];
    return players().map(p=>{
      const name=p.name||p.display_name||'';
      const nn=norm(name),last=norm(name.split(/\s+/).slice(-1)[0]);
      let score=99;if(nn===n)score=0;else if(nn.startsWith(n)||last.startsWith(n))score=.1;else if(nn.includes(n)||last.includes(n))score=.25;else if((p.name_variants||[]).some(v=>norm(v).includes(n)))score=.35;
      return {p,score};
    }).filter(x=>x.score<1).sort((a,b)=>a.score-b.score||String(a.p.name||'').localeCompare(String(b.p.name||''),'fr')).slice(0,7).map(x=>x.p);
  }
  function initials(name){return String(name||'?').trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?';}
  function jerseyNumber(p){const n=Number(p?.international_number);if(Number.isInteger(n)&&n>=0)return n;const js=(p?.jersey_numbers||[]).map(Number).filter(Number.isInteger);return js.length?js[0]:null;}
  function photoUrl(p){
    const raw=String(p?.photo_path||'').trim();if(!raw)return '';
    if(/^https?:\/\//i.test(raw)||/^data:/i.test(raw)||raw.startsWith('/'))return raw;
    try{return client()?.storage?.from('player-photos')?.getPublicUrl(raw)?.data?.publicUrl||'';}catch{return '';}
  }
  function styleCatalog(){return window.BLEUS3000_FLOCKING?.styles||window.BLEUS3000_FLOCKAGE_STYLES||[];}
  const styleByKey=key=>{const list=styleCatalog(),normalized=window.BLEUS3000_FLOCKING?.normalizeStyle?.(key)||key;return list.find(x=>(x.key||x.id)===normalized)||list.find(x=>(x.key||x.id)===defaultNumberStyle)||list[0]||{key:defaultNumberStyle,id:defaultNumberStyle,label:'France 2024'};};
  function loadLocalPrefs(){try{return JSON.parse(localStorage.getItem('bleus3000.preferences.local.v1')||'{}');}catch{return {};}}
  async function loadPreferredNumberStyle(){try{const prefs=await (window.C3K_ACCOUNT_PREFS?.get?.()||Promise.resolve(loadLocalPrefs()));state.numberStyle=(styleByKey(prefs?.jersey_number_style||window.BLEUS3000_FLOCKING?.getStyle?.()||defaultNumberStyle).key||styleByKey(prefs?.jersey_number_style||defaultNumberStyle).id);}catch{state.numberStyle=window.BLEUS3000_FLOCKING?.getStyle?.()||defaultNumberStyle;}window.BLEUS3000_FLOCKING?.setStyle?.(state.numberStyle,{silent:true});}
  function flockDigitsHtml(number,styleKey=state.numberStyle){return window.BLEUS3000_FLOCKING?.digitsHtml?.(number,styleKey,'team-flock-digit')||String(number).split('').map(d=>`<img class="team-flock-digit" src="flocages_assets/${styleKey}/${d}.png" alt="">`).join('');}
  function syncNumberStyleUi(){state.numberStyle=window.BLEUS3000_FLOCKING?.getStyle?.()||state.numberStyle||defaultNumberStyle;}
  function highlightName(name,q){
    const raw=String(name||''),needle=String(q||'').trim();if(!needle)return esc(raw);
    const idx=norm(raw).indexOf(norm(needle));
    if(idx<0)return esc(raw);
    // Le surlignage exact sur les accents est volontairement simple : le nom complet reste sûr et lisible.
    const rx=new RegExp('('+needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
    return esc(raw).replace(rx,'<mark>$1</mark>');
  }
  function showStatus(message,type='ok',timeout=2600){
    const el=$('#teamToolStatus');if(!el)return;el.hidden=false;el.className=`team-tool-status is-${type}`;el.textContent=message;if(timeout)setTimeout(()=>{if(el.textContent===message)el.hidden=true;},timeout);
  }
  function setBusy(v){state.busy=!!v;['#teamSaveBtn','#teamExportPng','#teamExportJpg'].forEach(s=>{const b=$(s);if(b)b.disabled=!!v;});}

  function currentSlotsSnapshot(){return $$('[data-team-slot]').map(slot=>({
    playerId:slot.dataset.playerId||'',name:$('[data-player-input]',slot)?.value||'',role:slot.dataset.role||'',customNumber:$('[data-custom-number]',slot)?.value||''
  }));}
  function setCaptain(playerId){
    if(!playerId){showStatus('Choisis d’abord un joueur pour lui donner le brassard.','error');return;}
    state.captainPlayerId=String(state.captainPlayerId)===String(playerId)?null:String(playerId);
    updateCaptainButtons();
  }
  function updateCaptainButtons(){
    $$('[data-team-slot]').forEach(slot=>{
      const active=!!slot.dataset.playerId&&String(slot.dataset.playerId)===String(state.captainPlayerId||'');
      const b=$('[data-captain-toggle]',slot);if(b){b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));b.title=active?'Retirer le brassard':'Choisir comme capitaine';}
    });
  }
  function renderPlayerVisual(slot){
    const host=$('[data-player-visual]',slot);if(!host)return;const p=playerById(slot.dataset.playerId);host.className='team-player-visual';
    if(!p){host.classList.add('is-empty');host.innerHTML='<span class="team-empty-player">+</span>';return;}
    const mode=state.displayMode;const customInput=$('[data-custom-number]',slot);if(customInput)customInput.hidden=mode!=='custom-number';
    if(mode==='photo'){
      const url=photoUrl(p);if(url){host.classList.add('is-photo');host.innerHTML=`<img src="${esc(url)}" alt="${esc(p.name||p.display_name)}" loading="lazy"><span class="team-visual-initials-fallback">${esc(initials(p.name||p.display_name))}</span>`;const img=$('img',host);img?.addEventListener('error',()=>{host.className='team-player-visual is-initials';host.innerHTML=`<span>${esc(initials(p.name||p.display_name))}</span>`;},{once:true});return;}
    }else if(mode==='custom-number'){
      const input=$('[data-custom-number]',slot),raw=String(input?.value||jerseyNumber(p)||'').trim(),num=/^\d{1,2}$/.test(raw)?Number(raw):null;
      if(input){input.hidden=false;if(!input.value&&num!==null)input.value=String(num);}
      if(num!==null){host.classList.add('is-custom-number');host.innerHTML=`<strong class="team-custom-number-badge" data-number="${esc(num)}">${flockDigitsHtml(num)}</strong>`;return;}
    }else{
      const num=jerseyNumber(p);if(num!==null){host.classList.add('is-jersey');host.innerHTML=`<img src="assets/jersey-back-france-1998.webp" alt="Maillot"><strong class="team-jersey-num" data-number="${esc(num)}">${flockDigitsHtml(num)}</strong>`;return;}
    }
    host.classList.add('is-initials');host.innerHTML=`<span>${esc(initials(p.name||p.display_name))}</span>`;
  }
  function renderAllVisuals(){$$('[data-team-slot]').forEach(renderPlayerVisual);syncNumberStyleUi();updateCaptainButtons();}

  function buildSlots(preserve=true){
    const host=$('#pitchSlots');if(!host)return;const previous=preserve?currentSlotsSnapshot():[];const layout=slotLayout();
    host.innerHTML=layout.map((pos,i)=>{
      const prev=previous[i]||{};
      return `<div class="team-player-slot" data-team-slot="${i}" data-role="${esc(pos.role)}" data-player-id="${esc(prev.playerId||'')}" style="--slot-x:${pos.x}%;--slot-y:${pos.y}%">
        <button class="team-captain-toggle" data-captain-toggle type="button" aria-pressed="false" title="Choisir comme capitaine"><img src="assets/achievement-capitanat.png" alt="Capitaine"></button>
        <div class="team-player-visual is-empty" data-player-visual><span class="team-empty-player">+</span></div>
        <span class="team-player-role">${esc(pos.role)}</span>
        <div class="team-player-search">
          <input data-player-input type="text" autocomplete="off" spellcheck="false" placeholder="Taper un nom…" value="${esc(prev.name||'')}" aria-label="${esc(pos.role)} · rechercher un joueur">
          <div class="team-player-suggestions" data-player-suggestions hidden></div>
        </div>
        <input class="team-custom-number-input" data-custom-number type="number" min="0" max="99" inputmode="numeric" aria-label="Numéro personnalisé" value="${esc(prev.customNumber||'')}" ${state.displayMode==='custom-number'?'':'hidden'}>
      </div>`;
    }).join('');
    // Restaure les joueurs par identifiant, ou résout les anciens noms sauvegardés.
    $$('[data-team-slot]').forEach((slot,i)=>{
      const prev=previous[i]||{};let p=prev.playerId?playerById(prev.playerId):exactPlayer(prev.name);if(p)choosePlayer(slot,p,{silent:true});
    });
    renderAllVisuals();
  }
  function choosePlayer(slot,p,{silent=false}={}){
    if(!slot||!p)return false;
    const duplicate=$$('[data-team-slot]').find(s=>s!==slot&&String(s.dataset.playerId||'')===String(p.id));
    if(duplicate){if(!silent)showStatus(`${p.name||p.display_name} est déjà placé dans cette composition.`,'error');return false;}
    const input=$('[data-player-input]',slot);slot.dataset.playerId=String(p.id);if(input){input.value=p.name||p.display_name||'';input.classList.add('is-resolved');input.setAttribute('aria-invalid','false');}
    const sug=$('[data-player-suggestions]',slot);if(sug)sug.hidden=true;renderPlayerVisual(slot);updateCaptainButtons();return true;
  }
  function clearResolved(slot){
    const old=slot.dataset.playerId||'';slot.dataset.playerId='';const input=$('[data-player-input]',slot);input?.classList.remove('is-resolved');if(old&&String(state.captainPlayerId)===String(old))state.captainPlayerId=null;renderPlayerVisual(slot);updateCaptainButtons();
  }
  function showSuggestions(input){
    const slot=input.closest('[data-team-slot]'),box=$('[data-player-suggestions]',slot);if(!box)return;const q=input.value.trim(),hits=playerSearch(q);
    if(!hits.length){box.hidden=true;box.innerHTML='';return;}
    box.innerHTML=hits.map(p=>`<button type="button" data-suggest-player="${esc(p.id)}"><strong>${highlightName(p.name||p.display_name,q)}</strong><small>${esc((p.positions||[]).join(' / ')||p.position||'Joueur')}${jerseyNumber(p)!==null?` · n°${esc(jerseyNumber(p))}`:''}</small></button>`).join('');box.hidden=false;
  }
  function resolveInput(input){
    const slot=input.closest('[data-team-slot]');if(!slot)return;const p=exactPlayer(input.value);if(p)choosePlayer(slot,p);else if(input.value.trim()){input.classList.remove('is-resolved');input.setAttribute('aria-invalid','true');}else{clearResolved(slot);input.removeAttribute('aria-invalid');}
  }

  const store=()=>window.BLEUS3000_RELATIONAL_REFS;
  const eff=(m,k)=>store()?.effective?store().effective(m,k):m?.[k];
  function cleanSelectionName(m){return String(m?.selection?.name||m?.selection_category||'France').replace(/ Masculin$/,'').replace(/ Féminine$/,' F').trim()||'France';}
  function fixtureLabel(m){const opp=String(eff(m,'opponent_name')||'Adversaire').trim(),fr=cleanSelectionName(m);return m?.home_away==='away'?`${opp} – ${fr}`:`${fr} – ${opp}`;}
  function flagEmoji(name){const c=String(window.BLEUS3000_FLAGS?.codeFor?.(name)||'').toUpperCase();return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt(0))):'⚽';}
  function fixtureOptionLabel(m){const opp=String(eff(m,'opponent_name')||'Adversaire').trim(),fr=cleanSelectionName(m),left=m?.home_away==='away'?opp:'France',right=m?.home_away==='away'?'France':opp;return `${flagEmoji(left)} ${m?.home_away==='away'?opp:fr} – ${flagEmoji(right)} ${m?.home_away==='away'?fr:opp}`;}
  function renderMatchFlags(m){
    const host=$('#teamMatchFlags');if(!host)return;if(!m){host.innerHTML='';host.hidden=true;return;}
    const opp=String(eff(m,'opponent_name')||m?.opponent?.name||'').trim(),fr='France',flag=n=>window.BLEUS3000_FLAGS?.img?.(n,'team-match-flag')||'';
    host.hidden=false;host.innerHTML=`<span>${flag(m?.home_away==='away'?opp:fr)}</span><span class="team-match-flags-vs">VS</span><span>${flag(m?.home_away==='away'?fr:opp)}</span>`;
  }
  function matchDateLabel(m){const d=new Date(eff(m,'match_date'));if(Number.isNaN(+d))return '';return new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(d).replace(' à ',' · ');}
  async function loadUpcomingMatches(){
    try{
      const rows=await store()?.load?.()||[];const now=Date.now();state.upcoming=rows.filter(m=>{const d=new Date(eff(m,'match_date'));return !Number.isNaN(+d)&&+d>=now;}).sort((a,b)=>new Date(eff(a,'match_date'))-new Date(eff(b,'match_date'))).slice(0,80);
    }catch{state.upcoming=[];}
    const sel=$('#teamMatchSelect');if(!sel)return;const previous=state.matchId;
    sel.innerHTML='<option value="">Aucun match associé</option>'+state.upcoming.map(m=>`<option value="${esc(m.id)}">${esc(matchDateLabel(m))} · ${esc(fixtureOptionLabel(m))}</option>`).join('');
    if(previous&&state.upcoming.some(m=>String(m.id)===String(previous)))sel.value=String(previous);else if(previous&&state.matchLabel){const o=document.createElement('option');o.value=String(previous);o.textContent=`${state.matchDate?state.matchDate+' · ':''}${state.matchLabel} · archivé`;sel.appendChild(o);sel.value=String(previous);}else{state.matchId='';sel.value='';}
  }
  function updateMatchFromSelect(){
    const id=$('#teamMatchSelect')?.value||'';state.matchId=id;const m=state.upcoming.find(x=>String(x.id)===String(id));state.matchLabel=m?fixtureLabel(m):'';state.matchDate=m?matchDateLabel(m):'';renderMatchFlags(m);updatePreviewHeader();
  }
  function updatePreviewHeader(){
    const title=String($('#toolTitleInput')?.value||'').trim()||(state.kind==='xi'?'Mon Onze France':'Mon Five France');const h=$('#teamPreviewTitle'),sub=$('#teamPreviewMatch');if(h)h.textContent=title;
    if(sub){sub.textContent=state.matchLabel?`${state.kind==='xi'?'Mon Onze':'Mon Five'} pour le match ${state.matchLabel}${state.matchDate?` · ${state.matchDate}`:''}`:'Composition libre · aucun impact sur les données officielles';}
  }
  function setKind(kind){
    state.kind=kind==='five'?'five':'xi';state.formation=state.kind==='xi'?(state.formation||defaultFormation):'five';
    const modal=$('#teamToolModal');if(modal)modal.dataset.kind=state.kind;
    const title=$('#teamToolTitle'),sub=$('#teamToolSub'),formation=$('#teamFormationField'),name=$('#toolTitleInput');
    if(title)title.textContent=state.kind==='xi'?'Créateur de Onze':'Créateur de Five';if(sub)sub.textContent=state.kind==='xi'?'11 joueurs · formation au choix · outil de fiction':'5 joueurs · terrain vertical · outil de fiction';if(formation)formation.hidden=state.kind!=='xi';
    if(name&&!name.dataset.userEdited)name.value=state.kind==='xi'?'Mon Onze France':'Mon Five France';
    syncNumberStyleUi();
    updatePreviewHeader();
  }

  function localRows(){try{return JSON.parse(localStorage.getItem(localKey)||'[]');}catch{return [];}}
  function setLocalRows(rows){localStorage.setItem(localKey,JSON.stringify(rows.slice(0,40)));}
  async function fetchSaved(){
    const st=account(),db=client();let rows=[];
    if(db&&st.session?.user){const {data,error}=await db.from('user_compositions').select('*').in('composition_type',['xi','five']).order('updated_at',{ascending:false});if(error)throw error;rows=data||[];}
    else rows=localRows();
    state.saved=rows;updateSavedCount();return rows;
  }
  function updateSavedCount(){const n=state.saved.filter(x=>x.composition_type===state.kind).length;const e=$('#teamSavedCount');if(e)e.textContent=`${n} / ${maxByKind}`;}
  function compositionPayload(){
    const unresolved=[];const layout=slotLayout();const selected=[];
    $$('[data-team-slot]').forEach((slot,i)=>{const input=$('[data-player-input]',slot),name=String(input?.value||'').trim(),id=slot.dataset.playerId||'';if(name&&!id)unresolved.push(name);if(id){const p=playerById(id);const rawCustom=String($('[data-custom-number]',slot)?.value||'').trim(),customNumber=/^\d{1,2}$/.test(rawCustom)?Number(rawCustom):null;selected.push({slot_index:i,player_id:id,name:p?.name||p?.display_name||name,role:layout[i]?.role||slot.dataset.role||'',x:layout[i]?.x||50,y:layout[i]?.y||50,jersey_number:jerseyNumber(p),custom_number:customNumber,photo_path:p?.photo_path||null});}});
    if(unresolved.length)throw new Error(`Nom non reconnu dans la base joueurs : ${unresolved.slice(0,2).join(', ')}${unresolved.length>2?'…':''}`);
    return {version:3,fiction:true,kind:state.kind,display_mode:state.displayMode,number_style:state.numberStyle,match_id:state.matchId||null,match_label:state.matchLabel||null,match_date_label:state.matchDate||null,captain_player_id:state.captainPlayerId||null,players:selected};
  }
  async function saveCurrent(){
    if(state.busy)return;setBusy(true);
    try{
      const title=String($('#toolTitleInput')?.value||'').trim()||(state.kind==='xi'?'Mon Onze France':'Mon Five France');const payload=compositionPayload(),formation=state.kind==='xi'?state.formation:null,st=account(),db=client();
      await fetchSaved();const same=state.saved.filter(x=>x.composition_type===state.kind);if(!state.currentSavedId&&same.length>=maxByKind)throw new Error(`Tu as déjà ${maxByKind} ${state.kind==='xi'?'Onze':'Five'} enregistrés. Supprime-en un pour en créer un nouveau.`);
      if(db&&st.session?.user){
        const row={user_id:st.session.user.id,composition_type:state.kind,title,formation,payload,updated_at:new Date().toISOString()};
        let res;if(state.currentSavedId)res=await db.from('user_compositions').update(row).eq('id',state.currentSavedId).eq('user_id',st.session.user.id).select().single();else res=await db.from('user_compositions').insert(row).select().single();if(res.error)throw res.error;state.currentSavedId=res.data?.id||state.currentSavedId;
      }else{
        let rows=localRows();const now=new Date().toISOString();if(state.currentSavedId){const i=rows.findIndex(x=>String(x.id)===String(state.currentSavedId));if(i>=0)rows[i]={...rows[i],title,formation,payload,updated_at:now};else state.currentSavedId=null;}if(!state.currentSavedId){state.currentSavedId=`local-${crypto.randomUUID?.()||Date.now()}`;rows.unshift({id:state.currentSavedId,user_id:'local',composition_type:state.kind,title,formation,payload,created_at:now,updated_at:now});}setLocalRows(rows);
      }
      await fetchSaved();showStatus(account().session?.user?'Composition enregistrée dans ton profil.':'Composition enregistrée localement sur cet appareil.','ok');
    }catch(e){showStatus(e?.message||'Enregistrement impossible.','error',5000);}finally{setBusy(false);}
  }
  async function deleteSaved(id){
    if(!confirm('Supprimer cette composition enregistrée ?'))return;const st=account(),db=client();
    try{if(db&&st.session?.user){const {error}=await db.from('user_compositions').delete().eq('id',id).eq('user_id',st.session.user.id);if(error)throw error;}else setLocalRows(localRows().filter(x=>String(x.id)!==String(id)));if(String(state.currentSavedId)===String(id))state.currentSavedId=null;await fetchSaved();await renderLibrary();}
    catch(e){alert(e?.message||'Suppression impossible.');}
  }
  async function applySaved(row){
    if(!row)return;const p=row.payload||{};state.kind=row.composition_type==='five'?'five':'xi';state.formation=row.formation||p.formation||defaultFormation;state.displayMode=p.display_mode||'photo';state.numberStyle=window.BLEUS3000_FLOCKING?.getStyle?.()||state.numberStyle||defaultNumberStyle;state.matchId=p.match_id||'';state.matchLabel=p.match_label||'';state.matchDate=p.match_date_label||'';state.captainPlayerId=p.captain_player_id||null;state.currentSavedId=row.id||null;
    setKind(state.kind);const name=$('#toolTitleInput');if(name){name.value=row.title||'';name.dataset.userEdited='1';}const fs=$('#teamFormationSelect');if(fs&&formations[state.formation])fs.value=state.formation;$$('input[name="teamDisplayMode"]').forEach(r=>r.checked=r.value===state.displayMode);syncNumberStyleUi();
    await loadUpcomingMatches();renderMatchFlags(state.upcoming.find(x=>String(x.id)===String(state.matchId)));buildSlots(false);
    for(const item of (p.players||[])){const slot=$(`[data-team-slot="${Number(item.slot_index)}"]`);if(!slot)continue;const player=playerById(item.player_id)||exactPlayer(item.name);if(player)choosePlayer(slot,player,{silent:true});else{const inp=$('[data-player-input]',slot);if(inp)inp.value=item.name||'';}const cn=$('[data-custom-number]',slot);if(cn&&item.custom_number!=null)cn.value=String(item.custom_number);}
    renderAllVisuals();updatePreviewHeader();updateSavedCount();$('#teamToolModal').hidden=false;document.body.style.overflow='hidden';
  }

  function ensureLibraryModal(){
    let m=$('#teamLibraryModal');if(m)return m;m=document.createElement('div');m.className='modal-backdrop';m.id='teamLibraryModal';m.hidden=true;m.innerHTML=`<section class="modal-dialog team-library-dialog" role="dialog" aria-modal="true" aria-labelledby="teamLibraryTitle"><header class="modal-head"><div><h2 id="teamLibraryTitle">Mes Onze & Five</h2><p>Compositions personnelles · espace fiction</p></div><button class="modal-close" data-team-library-close type="button">×</button></header><div class="modal-body"><div class="team-library-tabs"><button type="button" data-library-kind="xi" class="is-active">Onze</button><button type="button" data-library-kind="five">Five</button></div><div class="team-library-summary" id="teamLibrarySummary"></div><div class="team-library-list" id="teamLibraryList"></div><div class="team-library-actions"><button type="button" class="primary-btn" data-library-new>＋ Nouvelle composition</button></div></div></section>`;document.body.appendChild(m);
    m.addEventListener('pointerdown',e=>{if(e.target===m){m.hidden=true;if($('#teamToolModal')?.hidden)document.body.style.overflow='';}});m.addEventListener('click',e=>{if(e.target.closest('[data-team-library-close]')){m.hidden=true;if($('#teamToolModal')?.hidden)document.body.style.overflow='';}});return m;
  }
  async function renderLibrary(kind){
    const m=ensureLibraryModal(),active=kind||m.dataset.kind||state.kind||'xi';m.dataset.kind=active;await fetchSaved();$$('[data-library-kind]',m).forEach(b=>b.classList.toggle('is-active',b.dataset.libraryKind===active));const rows=state.saved.filter(x=>x.composition_type===active);const summary=$('#teamLibrarySummary',m);if(summary)summary.innerHTML=`<strong>${rows.length} / ${maxByKind}</strong> ${active==='xi'?'Onze':'Five'} enregistré${rows.length>1?'s':''}${account().session?.user?' · synchronisés au profil':' · sauvegarde locale'}`;const list=$('#teamLibraryList',m);if(list)list.innerHTML=rows.length?rows.map(r=>{const p=r.payload||{};return `<article class="team-saved-card"><div><strong>${esc(r.title||'Composition')}</strong><small>${active==='xi'?esc(r.formation||defaultFormation):'Five'}${p.match_label?` · ${esc(p.match_label)}`:''}</small><span>${new Date(r.updated_at||r.created_at||Date.now()).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</span></div><div><button type="button" class="secondary-btn" data-load-team="${esc(r.id)}">Charger</button><button type="button" class="team-saved-delete" data-delete-team="${esc(r.id)}" title="Supprimer">×</button></div></article>`;}).join(''):'<div class="team-library-empty">Aucune composition enregistrée pour le moment.</div>';
    m.hidden=false;document.body.style.overflow='hidden';
  }
  async function openLibrary(kind){const m=ensureLibraryModal();await renderLibrary(kind||m.dataset.kind||state.kind);}

  async function waitPlayers(timeout=3500){if(players().length>20)return;await new Promise(resolve=>{let done=false,t=setTimeout(()=>{if(!done){done=true;resolve();}},timeout);const f=()=>{if(done)return;done=true;clearTimeout(t);window.removeEventListener('bleus:player-registry',f);resolve();};window.addEventListener('bleus:player-registry',f,{once:true});});}
  async function open(kind='xi'){
    const modal=$('#teamToolModal');if(!modal)return;state.currentSavedId=null;state.matchId='';state.matchLabel='';state.matchDate='';state.captainPlayerId=null;renderMatchFlags(null);state.displayMode='photo';state.formation=defaultFormation;const name=$('#toolTitleInput');if(name){delete name.dataset.userEdited;}
    await loadPreferredNumberStyle();setKind(kind);if(name)name.value=state.kind==='xi'?'Mon Onze France':'Mon Five France';const fs=$('#teamFormationSelect');if(fs)fs.value=defaultFormation;$$('input[name="teamDisplayMode"]').forEach(r=>r.checked=r.value==='photo');
    buildSlots(false);modal.hidden=false;document.body.style.overflow='hidden';showStatus('Chargement de la base joueurs…','ok',0);await Promise.allSettled([waitPlayers(),loadUpcomingMatches(),fetchSaved()]);buildSlots(true);renderAllVisuals();updatePreviewHeader();const st=$('#teamToolStatus');if(st)st.hidden=true;
  }

  function absoluteAssetUrl(src){try{return new URL(String(src||''),document.baseURI).href;}catch{return String(src||'');}}
  function loadImageDirect(src){return new Promise((resolve,reject)=>{if(!src)return reject(new Error('image vide'));const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('image indisponible'));im.src=src;});}
  const exportImageCache=new Map();
  function validateCanvasImage(im){
    const probe=document.createElement('canvas');probe.width=probe.height=2;const pctx=probe.getContext('2d',{willReadFrequently:true});
    try{pctx.clearRect(0,0,2,2);pctx.drawImage(im,0,0,2,2);pctx.getImageData(0,0,1,1);return true;}catch{return false;}
  }
  async function fetchImageBlob(resolved){
    if(/^data:|^blob:/i.test(resolved)){
      const im=await loadImageDirect(resolved);if(!validateCanvasImage(im))throw new Error('image non exportable');return im;
    }
    // On passe volontairement TOUTES les URL HTTP(S), même apparemment locales, par fetch.
    // Une redirection /assets -> CDN/Supabase ne peut ainsi jamais contaminer le canvas.
    const sameOrigin=(()=>{try{return new URL(resolved).origin===location.origin;}catch{return false;}})();
    const res=await fetch(resolved,{mode:'cors',credentials:sameOrigin?'same-origin':'omit',cache:'force-cache',redirect:'follow'});
    if(!res.ok||res.type==='opaque')throw new Error(`image non exportable (${res.status||'opaque'})`);
    const blob=await res.blob();if(!blob.size)throw new Error('image vide');
    const obj=URL.createObjectURL(blob);
    try{
      const im=await loadImageDirect(obj);
      if(!validateCanvasImage(im))throw new Error('image non exportable');
      // L'image est décodée ; on conserve l'URL un court instant pour Safari/WebKit.
      setTimeout(()=>URL.revokeObjectURL(obj),15000);
      return im;
    }catch(err){URL.revokeObjectURL(obj);throw err;}
  }
  async function loadImage(src){
    if(!src)throw new Error('image vide');const resolved=absoluteAssetUrl(src);
    if(!exportImageCache.has(resolved))exportImageCache.set(resolved,fetchImageBlob(resolved).catch(err=>{exportImageCache.delete(resolved);throw err;}));
    return exportImageCache.get(resolved);
  }
  function flagUrl(name){const code=window.BLEUS3000_FLAGS?.codeFor?.(name);return code?window.BLEUS3000_FLAGS?.urlForCode?.(code)||'':'';}
  function currentFixtureSides(){
    const m=state.upcoming.find(x=>String(x.id)===String(state.matchId));
    if(m){const opp=String(eff(m,'opponent_name')||m?.opponent?.name||'Adversaire').trim(),fr=cleanSelectionName(m)||'France';return m?.home_away==='away'?{left:opp,right:fr}:{left:fr,right:opp};}
    if(state.matchLabel&&state.matchLabel.includes(' – ')){const [left,right]=state.matchLabel.split(' – ');return {left:String(left||'').trim(),right:String(right||'').trim()};}
    return null;
  }
  function roundedRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
  function fitText(ctx,text,maxWidth,start=30,min=18){let size=start;ctx.font=`800 ${size}px Poppins, Arial`;while(size>min&&ctx.measureText(text).width>maxWidth){size-=1;ctx.font=`800 ${size}px Poppins, Arial`;}return size;}
  async function drawPhoto(ctx,p,x,y,size){const url=photoUrl(p);if(!url)return false;try{const im=await loadImage(url),sw=im.naturalWidth||im.width,sh=im.naturalHeight||im.height,s=Math.min(sw,sh),sx=(sw-s)/2,sy=(sh-s)/2;ctx.save();ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.clip();ctx.drawImage(im,sx,sy,s,s,x-size/2,y-size/2,size,size);ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.stroke();return true;}catch{return false;}}
  async function drawJersey(ctx,p,x,y,size){
    const n=jerseyNumber(p);if(n===null)return false;let ok=false;
    try{
      const previewJersey=$('.team-player-visual.is-jersey img')?.currentSrc||'assets/jersey-back-france-1998.webp';
      const jersey=await loadImage(previewJersey);ctx.drawImage(jersey,x-size*.47,y-size*.55,size*.94,size*.94);ok=true;
    }catch{}
    try{
      const chars=String(n).split(''),style=window.BLEUS3000_FLOCKING?.normalizeStyle?.(state.numberStyle)||state.numberStyle||defaultNumberStyle;
      const images=[];for(const ch of chars){images.push(await loadImage(window.BLEUS3000_FLOCKING?.assetUrl?.(style,ch)||`flocages_assets/${style}/${ch}.png`));}
      const digitH=size*.40,gap=Math.max(0,size*.006),widths=images.map(im=>digitH*((im.naturalWidth||im.width)/(im.naturalHeight||im.height))),total=widths.reduce((a,b)=>a+b,0)+gap*Math.max(0,images.length-1);
      let dx=x-total/2;for(let i=0;i<images.length;i++){ctx.drawImage(images[i],dx,y-size*.21,widths[i],digitH);dx+=widths[i]+gap;}return true;
    }catch{
      if(ok){ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.round(size*.26)}px Poppins, Arial`;ctx.fillText(String(n),x,y-size*.01);ctx.textAlign='start';ctx.textBaseline='alphabetic';return true;}
      return false;
    }
  }
  async function drawCustomNumber(ctx,number,x,y,size){
    const n=Number(number);if(!Number.isInteger(n)||n<0||n>99)return false;
    ctx.save();ctx.fillStyle='#123b8f';ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=5;ctx.stroke();ctx.restore();
    try{
      const chars=String(n).split(''),style=window.BLEUS3000_FLOCKING?.normalizeStyle?.(state.numberStyle)||state.numberStyle||defaultNumberStyle,images=[];
      for(const ch of chars)images.push(await loadImage(window.BLEUS3000_FLOCKING?.assetUrl?.(style,ch)||`flocages_assets/${style}/${ch}.png`));
      const digitH=size*.52,gap=size*.012,widths=images.map(im=>digitH*((im.naturalWidth||im.width)/(im.naturalHeight||im.height))),total=widths.reduce((a,b)=>a+b,0)+gap*Math.max(0,images.length-1);
      let dx=x-total/2;for(let i=0;i<images.length;i++){ctx.drawImage(images[i],dx,y-digitH/2,widths[i],digitH);dx+=widths[i]+gap;}return true;
    }catch{
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.round(size*.34)}px Poppins, Arial`;ctx.fillText(String(n),x,y+1);ctx.textAlign='start';ctx.textBaseline='alphabetic';return true;
    }
  }
  function drawInitials(ctx,p,x,y,size){const g=ctx.createLinearGradient(x-size/2,y-size/2,x+size/2,y+size/2);g.addColorStop(0,'#0b316f');g.addColorStop(1,'#2563eb');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.round(size*.34)}px Poppins, Arial`;ctx.fillText(initials(p.name||p.display_name),x,y+2);ctx.textAlign='start';ctx.textBaseline='alphabetic';}
  async function drawCaptain(ctx,x,y,size){try{const badgeSrc=$('[data-captain-toggle] img')?.currentSrc||'assets/achievement-capitanat.png';const im=await loadImage(badgeSrc);ctx.save();ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=7;ctx.drawImage(im,x,y,size,size);ctx.restore();}catch{ctx.fillStyle='#ffd54d';ctx.beginPath();ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#062654';ctx.font=`900 ${Math.round(size*.55)}px Arial`;ctx.textAlign='center';ctx.fillText('C',x+size/2,y+size*.72);ctx.textAlign='start';}}
  async function drawFixtureFlags(ctx,centerX,top,sides){
    if(!sides?.left||!sides?.right)return;
    const flagW=68,flagH=46,gap=38,nameY=top+64;
    const leftX=centerX-gap-flagW,rightX=centerX+gap;
    const drawFallback=(label,x)=>{ctx.fillStyle='#eaf1ff';roundedRect(ctx,x,top,flagW,flagH,12);ctx.fill();ctx.fillStyle='#123b8f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 22px Arial';ctx.fillText(flagEmoji(label),x+flagW/2,top+flagH/2+1);ctx.textBaseline='alphabetic';};
    for(const [label,x] of [[sides.left,leftX],[sides.right,rightX]]){
      let drawn=false;const url=flagUrl(label);
      if(url){try{const im=await loadImage(url);ctx.save();roundedRect(ctx,x,top,flagW,flagH,12);ctx.clip();ctx.drawImage(im,x,top,flagW,flagH);ctx.restore();ctx.strokeStyle='rgba(18,59,143,.15)';ctx.lineWidth=1.5;roundedRect(ctx,x,top,flagW,flagH,12);ctx.stroke();drawn=true;}catch{}}
      if(!drawn)drawFallback(label,x);
    }
    ctx.fillStyle='#123b8f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 16px Poppins, Arial';ctx.fillText('VS',centerX,top+flagH/2+1);
    ctx.fillStyle='#2a4365';ctx.font='700 16px Poppins, Arial';const leftLabel=String(sides.left).slice(0,20),rightLabel=String(sides.right).slice(0,20);ctx.fillText(leftLabel,leftX+flagW/2,nameY);ctx.fillText(rightLabel,rightX+flagW/2,nameY);ctx.textAlign='start';ctx.textBaseline='alphabetic';
  }
  function drawPitch(ctx,x,y,w,h){
    const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#167c52');g.addColorStop(.5,'#20915f');g.addColorStop(1,'#146b49');ctx.fillStyle=g;roundedRect(ctx,x,y,w,h,30);ctx.fill();ctx.save();roundedRect(ctx,x,y,w,h,30);ctx.clip();for(let i=0;i<12;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.035)':'rgba(0,0,0,.035)';ctx.fillRect(x,y+i*h/12,w,h/12);}ctx.globalAlpha=.12;for(let i=0;i<70;i++){const yy=y+(i*97%Math.round(h)),xx=x+(i*173%Math.round(w));ctx.strokeStyle='#d7ffe7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(Math.min(x+w,xx+35),yy+8);ctx.stroke();}ctx.restore();ctx.strokeStyle='rgba(255,255,255,.84)';ctx.lineWidth=4;roundedRect(ctx,x+24,y+24,w-48,h-48,5);ctx.stroke();ctx.beginPath();ctx.moveTo(x+24,y+h/2);ctx.lineTo(x+w-24,y+h/2);ctx.stroke();ctx.beginPath();ctx.arc(x+w/2,y+h/2,90,0,Math.PI*2);ctx.stroke();const boxW=w*.58,boxH=h*.14,smallW=w*.3,smallH=h*.055;ctx.strokeRect(x+(w-boxW)/2,y+24,boxW,boxH);ctx.strokeRect(x+(w-boxW)/2,y+h-24-boxH,boxW,boxH);ctx.strokeRect(x+(w-smallW)/2,y+24,smallW,smallH);ctx.strokeRect(x+(w-smallW)/2,y+h-24-smallH,smallW,smallH);ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(x+w/2,y+h*.115,5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+w/2,y+h*.885,5,0,Math.PI*2);ctx.fill();}
  async function renderExport(format='png'){
    if(state.busy)return;setBusy(true);showStatus(`Préparation du ${format.toUpperCase()}…`,'ok',0);
    try{
      await document.fonts?.ready?.catch?.(()=>{});const payload=compositionPayload(),title=String($('#toolTitleInput')?.value||'').trim()||(state.kind==='xi'?'Mon Onze France':'Mon Five France');
      const W=1200,H=1800,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{alpha:format!=='jpg'});ctx.fillStyle='#061427';ctx.fillRect(0,0,W,H);
      // Carte générale
      ctx.fillStyle='#f8fbff';roundedRect(ctx,42,42,W-84,H-84,34);ctx.fill();
      // En-tête export
      let logo=null;try{logo=await loadImage($('.team-export-logo')?.currentSrc||'3615-bleus-logo.png');}catch{}
      if(logo){const ratio=logo.width/logo.height,lh=105,lw=Math.min(190,lh*ratio);ctx.drawImage(logo,88,82,lw,lh);}else{ctx.fillStyle='#0c2f61';ctx.font='900 38px Poppins, Arial';ctx.fillText('3615',88,130);ctx.font='900 28px Poppins, Arial';ctx.fillText('BLEUS',90,166);}
      ctx.fillStyle='#0c2f61';ctx.font='800 22px Poppins, Arial';ctx.fillText('3615 BLEUS · COMPOSITION FICTION',315,105);ctx.fillStyle='#102f57';fitText(ctx,title,760,48,30);ctx.fillText(title,315,158);const sub=state.matchLabel?`${state.kind==='xi'?'Mon Onze':'Mon Five'} pour le match ${state.matchLabel}${state.matchDate?` · ${state.matchDate}`:''}`:'Composition libre · aucun impact sur les données officielles';ctx.fillStyle='#68809d';ctx.font='700 21px Poppins, Arial';const maxSub=780;let subText=sub;while(ctx.measureText(subText).width>maxSub&&subText.length>25)subText=subText.slice(0,-2);if(subText!==sub)subText=subText.trim()+'…';ctx.fillText(subText,315,198);
      const fixtureSides=currentFixtureSides();if(fixtureSides)await drawFixtureFlags(ctx,600,216,fixtureSides);
      // Terrain vertical
      const px=145,py=fixtureSides?310:265,pw=910,ph=fixtureSides?1345:1390;drawPitch(ctx,px,py,pw,ph);const layout=slotLayout();const playerMap=new Map(payload.players.map(x=>[Number(x.slot_index),x]));const visualSize=state.kind==='xi'?112:142;
      for(let i=0;i<layout.length;i++){
        const item=playerMap.get(i);if(!item)continue;const p=playerById(item.player_id)||{name:item.name,display_name:item.name,international_number:item.jersey_number,jersey_numbers:item.jersey_number!=null?[item.jersey_number]:[],photo_path:item.photo_path};const pos=layout[i],x=px+(pos.x/100)*pw,y=py+(pos.y/100)*ph;let drawn=false;if(state.displayMode==='photo')drawn=await drawPhoto(ctx,p,x,y,visualSize);else if(state.displayMode==='custom-number')drawn=await drawCustomNumber(ctx,item.custom_number??item.jersey_number,x,y,visualSize);else drawn=await drawJersey(ctx,p,x,y,visualSize);if(!drawn)drawInitials(ctx,p,x,y,visualSize);
        if(String(item.player_id)===String(state.captainPlayerId||''))await drawCaptain(ctx,x+visualSize*.24,y-visualSize*.66,42);
        const name=String(p.name||p.display_name||item.name||'').trim();ctx.font='800 22px Poppins, Arial';ctx.textAlign='center';const nameW=Math.min(230,Math.max(115,ctx.measureText(name).width+28));ctx.fillStyle='rgba(5,24,48,.88)';roundedRect(ctx,x-nameW/2,y+visualSize*.56,nameW,42,18);ctx.fill();ctx.fillStyle='#fff';let drawName=name;if(ctx.measureText(drawName).width>nameW-20){drawName=name.split(/\s+/).slice(-1)[0];if(ctx.measureText(drawName).width>nameW-20)drawName=drawName.slice(0,11)+'…';}ctx.fillText(drawName,x,y+visualSize*.56+29);ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='800 14px Poppins, Arial';ctx.fillText(pos.role,x,y-visualSize*.61);ctx.textAlign='start';
      }
      ctx.fillStyle='#6b7f99';ctx.font='700 17px Poppins, Arial';ctx.fillText('Outil ludique : cette composition personnelle ne modifie aucune donnée officielle de 3615 Bleus.',88,H-78);
      const mime=format==='jpg'?'image/jpeg':'image/png';let blob=null;try{blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(new Error('Blob vide')),mime,format==='jpg'?.94:undefined);}catch(err){reject(err);}});}catch(err){console.error('Canvas export safety failure',err);throw new Error('Export bloqué par le navigateur. Aucun asset externe non validé ne devrait atteindre ce canvas ; recharge forcée (Ctrl+F5) puis réessaie.');}if(!blob)throw new Error('Le navigateur n’a pas pu générer le fichier.');const safe=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')||'composition_3615_bleus';const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${safe}.${format==='jpg'?'jpg':'png'}`;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},4000);showStatus(`${format.toUpperCase()} généré avec succès.`,'ok');
    }catch(e){console.error('Export composition',e);showStatus(e?.message||'Export impossible.','error',6000);}finally{setBusy(false);}
  }

  function bind(){
    const modal=$('#teamToolModal');if(!modal)return;
    $('#teamFormationSelect')?.addEventListener('change',e=>{state.formation=e.target.value;buildSlots(true);});
    $('#teamMatchSelect')?.addEventListener('change',updateMatchFromSelect);
    $('#toolTitleInput')?.addEventListener('input',e=>{e.target.dataset.userEdited='1';updatePreviewHeader();});
    $$('input[name="teamDisplayMode"]').forEach(r=>r.addEventListener('change',()=>{state.displayMode=$('input[name="teamDisplayMode"]:checked')?.value||'photo';renderAllVisuals();}));
    $('#teamSaveBtn')?.addEventListener('click',saveCurrent);$('#teamExportPng')?.addEventListener('click',()=>renderExport('png'));$('#teamExportJpg')?.addEventListener('click',()=>renderExport('jpg'));$('#teamLibraryOpen')?.addEventListener('click',()=>openLibrary(state.kind));
    modal.addEventListener('input',e=>{const custom=e.target.closest('[data-custom-number]');if(custom){renderPlayerVisual(custom.closest('[data-team-slot]'));return;}const input=e.target.closest('[data-player-input]');if(!input)return;const slot=input.closest('[data-team-slot]');if(slot.dataset.playerId){const p=playerById(slot.dataset.playerId);if(!p||norm(input.value)!==norm(p.name||p.display_name))clearResolved(slot);}showSuggestions(input);});
    modal.addEventListener('keydown',e=>{const input=e.target.closest('[data-player-input]');if(!input)return;const box=$('[data-player-suggestions]',input.closest('[data-team-slot]'));if(e.key==='Enter'){e.preventDefault();const first=$('[data-suggest-player]',box);if(first){const p=playerById(first.dataset.suggestPlayer);if(p)choosePlayer(input.closest('[data-team-slot]'),p);}else resolveInput(input);}else if(e.key==='Escape'&&box)box.hidden=true;});
    modal.addEventListener('focusout',e=>{const input=e.target.closest('[data-player-input]');if(!input)return;setTimeout(()=>{resolveInput(input);const box=$('[data-player-suggestions]',input.closest('[data-team-slot]'));if(box)box.hidden=true;},120);});
    modal.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-suggest-player]');if(b){e.preventDefault();const p=playerById(b.dataset.suggestPlayer),slot=b.closest('[data-team-slot]');if(p&&slot)choosePlayer(slot,p);}});
    modal.addEventListener('click',e=>{const b=e.target.closest('[data-captain-toggle]');if(b){const slot=b.closest('[data-team-slot]');setCaptain(slot?.dataset.playerId||'');}});
    document.addEventListener('click',e=>{if(!e.target.closest('.team-player-search'))$$('[data-player-suggestions]').forEach(x=>x.hidden=true);});
    const library=ensureLibraryModal();library.addEventListener('click',async e=>{const tab=e.target.closest('[data-library-kind]');if(tab){await renderLibrary(tab.dataset.libraryKind);return;}const load=e.target.closest('[data-load-team]');if(load){const row=state.saved.find(x=>String(x.id)===String(load.dataset.loadTeam));library.hidden=true;await applySaved(row);return;}const del=e.target.closest('[data-delete-team]');if(del){await deleteSaved(del.dataset.deleteTeam);return;}if(e.target.closest('[data-library-new]')){const k=library.dataset.kind||'xi';library.hidden=true;await open(k);}});
    window.addEventListener('bleus:player-registry',()=>{if(!modal.hidden)buildSlots(true);});
    window.addEventListener('c3k:account-state',()=>{fetchSaved().catch(()=>{});loadPreferredNumberStyle().catch(()=>{});});
    window.addEventListener('c3k:preferences-changed',e=>{const key=e.detail?.jersey_number_style;if(key){state.numberStyle=window.BLEUS3000_FLOCKING?.normalizeStyle?.(key)||key;renderAllVisuals();}});window.addEventListener('bleus:flocking-style-changed',e=>{state.numberStyle=e.detail?.style||window.BLEUS3000_FLOCKING?.getStyle?.()||defaultNumberStyle;renderAllVisuals();});
  }

  window.BLEUS3000_TEAM_TOOLS={open,openLibrary,save:saveCurrent,export:renderExport,refreshSaved:fetchSaved};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
