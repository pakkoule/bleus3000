/* 3615 Bleus V1.1.65 — Importeur PDF FFF + création manuelle des nouveaux appelés */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'`´]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const compact=v=>norm(v).replace(/\s+/g,'');
  const canEdit=()=>['admin','superadmin'].includes(String(window.C3K_ACCOUNT_STATE?.profile?.role||window.C3K_ACCOUNT_STATE?.role||'').toLowerCase());
  const db=()=>window.BLEUS3000_SUPABASE;
  const refs=()=>window.BLEUS3000_RELATIONAL_REFS;
  const state={file:null,parsed:null,targetGatheringId:null,pdfLibPromise:null,createIndex:null};
  const groupLabels={goalkeeper:'Gardiens de but',defender:'Défenseurs',midfielder:'Milieux de terrain',forward:'Attaquants'};

  function playerCatalog(){
    return (window.BLEUS3000_PLAYER_REGISTRY||window.BLEUS3000_PLAYER_REGISTRY_ALL||[]).map(p=>({
      id:String(p.id||''),name:String(p.display_name||p.name||'').replace(/\s+/g,' ').trim(),birth_date:p.birth_date||null,position:p.position||''
    })).filter(p=>p.id&&p.name);
  }
  function frDateToIso(v){const m=String(v||'').replace(/\s+/g,'').match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}
  function detectGroup(line){const n=norm(line);if(/gardiens?\s+de\s+but/.test(n)||/^gardiens?$/.test(n))return 'goalkeeper';if(/defenseurs?/.test(n))return 'defender';if(/milieux?\s+de\s+terrain/.test(n)||/^milieux?$/.test(n))return 'midfielder';if(/attaquants?/.test(n))return 'forward';return null;}
  function levenshtein(a,b){a=compact(a);b=compact(b);const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let prev=Array.from({length:n+1},(_,i)=>i),cur=new Array(n+1);for(let i=1;i<=m;i++){cur[0]=i;for(let j=1;j<=n;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));[prev,cur]=[cur,prev];}return prev[n];}
  function similarity(a,b){const aa=compact(a),bb=compact(b),max=Math.max(aa.length,bb.length);return max?1-levenshtein(aa,bb)/max:0;}

  async function loadPdfJs(){
    if(window.pdfjsLib)return window.pdfjsLib;
    if(state.pdfLibPromise)return state.pdfLibPromise;
    state.pdfLibPromise=new Promise((resolve,reject)=>{
      const existing=$('script[data-3615-pdfjs]');
      const done=()=>{if(!window.pdfjsLib)return reject(new Error('PDF.js chargé mais indisponible.'));window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';resolve(window.pdfjsLib);};
      if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>reject(new Error('Impossible de charger le moteur PDF.')), {once:true});return;}
      const s=document.createElement('script');s.dataset['3615Pdfjs']='1';s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.crossOrigin='anonymous';s.onload=done;s.onerror=()=>reject(new Error('Impossible de charger PDF.js depuis le CDN.'));document.head.appendChild(s);
    }).catch(err=>{state.pdfLibPromise=null;throw err;});
    return state.pdfLibPromise;
  }

  function groupTextItems(items){
    const groups=[];
    for(const item of items){const text=String(item.str||'').trim();if(!text)continue;const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0),w=Number(item.width||0);let line=groups.find(g=>Math.abs(g.y-y)<=2.4);if(!line){line={y,items:[]};groups.push(line);}line.items.push({text,x,w});}
    return groups.sort((a,b)=>b.y-a.y).map(g=>{const parts=g.items.sort((a,b)=>a.x-b.x);let out='';let prevEnd=null;for(const it of parts){const gap=prevEnd==null?99:it.x-prevEnd;const needsSpace=out&&gap>0.7&&!/[\s\-/]$/.test(out)&&!/^[-–—/,.;:)]/.test(it.text);out+=(needsSpace?' ':'')+it.text;prevEnd=Math.max(prevEnd??-Infinity,it.x+Math.max(it.w,1));}return out.replace(/\s+/g,' ').trim();}).filter(Boolean);
  }

  async function extractLines(file){
    const pdfjs=await loadPdfJs(),buffer=await file.arrayBuffer();
    const task=pdfjs.getDocument({data:new Uint8Array(buffer)}),pdf=await task.promise,lines=[];
    for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),tc=await page.getTextContent({normalizeWhitespace:true});lines.push(...groupTextItems(tc.items));}
    return lines;
  }

  function parseRoster(lines){
    const roster=[];let group=null;const metadata=[];
    const dateRe=/(\d{2}[.\/-]\d{2}[.\/-]\s*\d{4})/;
    for(const raw of lines){const line=String(raw||'').replace(/\s+/g,' ').trim();if(!line)continue;const g=detectGroup(line);if(g){group=g;continue;}if(!group){metadata.push(line);continue;}const m=line.match(dateRe);if(!m)continue;const birth=frDateToIso(m[1]),idx=m.index??-1;if(idx<1||!birth)continue;let name=line.slice(0,idx).trim().replace(/^[•·\-–—\s]+/,'').replace(/[,:;]+$/,'').trim();let club=line.slice(idx+m[1].length).trim().replace(/^[-–—,:;\s]+/,'').trim();if(!name||name.length<3)continue;
      // Certains PDF FFF collent prénom et nom dans l'extraction texte ; le rapprochement compact le gère.
      roster.push({name,birth_date:birth,club,group,group_label:groupLabels[group]});
    }
    return {roster,metadata,lines};
  }

  function bestMatch(entry){
    const players=playerCatalog();if(!players.length)return {player:null,score:0,reason:'Registre joueurs indisponible'};
    const exact=players.find(p=>compact(p.name)===compact(entry.name)&&(!entry.birth_date||!p.birth_date||p.birth_date===entry.birth_date));
    if(exact)return {player:exact,score:1,reason:'Nom + date concordants'};
    let best=null,bestScore=0;
    for(const p of players){const sim=similarity(entry.name,p.name),sameDob=Boolean(entry.birth_date&&p.birth_date&&entry.birth_date===p.birth_date);let score=sim+(sameDob?.34:0);if(entry.birth_date&&p.birth_date&&!sameDob)score-=.24;if(score>bestScore){bestScore=score;best=p;}}
    if(!best)return {player:null,score:0,reason:'Aucune correspondance'};
    const confidence=Math.min(1,bestScore);return confidence>=.74?{player:best,score:confidence,reason:entry.birth_date===best.birth_date?'Date de naissance concordante':'Nom proche'}:{player:null,suggested:best,score:confidence,reason:'À vérifier'};
  }

  function enrichParsed(parsed){return {...parsed,roster:parsed.roster.map(x=>({...x,match:bestMatch(x)}))};}
  function statusFor(match){if(match?.player&&match.score>=.95)return ['ok','✓'];if(match?.player)return ['maybe','~'];return ['miss','!'];}

  function ensurePreview(){
    let m=$('#gatheringPdfPreviewModal');if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="gatheringPdfPreviewModal" hidden><section class="modal-dialog gathering-pdf-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Importer une liste FFF</h2><p>Contrôle des joueurs détectés avant ajout au rassemblement</p></div><button class="modal-close" type="button" data-pdf-preview-close>×</button></header><div class="modal-body"><div id="gatheringPdfSummary" class="gathering-pdf-summary"></div><div id="gatheringPdfRows" class="gathering-pdf-rows"></div><div class="gathering-pdf-actions"><button type="button" class="secondary-btn" data-pdf-preview-close>Annuler</button><button type="button" class="secondary-btn" data-pdf-apply="merge">Ajouter / mettre à jour</button><button type="button" class="primary-btn" data-pdf-apply="replace">Remplacer la liste</button></div><div id="gatheringPdfStatus" class="c3k-v8-status" hidden></div></div></section></div>`);
    m=$('#gatheringPdfPreviewModal');$$('[data-pdf-preview-close]',m).forEach(b=>b.addEventListener('click',()=>m.hidden=true));m.addEventListener('pointerdown',e=>{if(e.target===m)m.hidden=true;});$$('[data-pdf-apply]',m).forEach(b=>b.addEventListener('click',()=>applyImport(b.dataset.pdfApply)));return m;
  }

  function renderPreview(parsed,file){
    const m=ensurePreview(),host=$('#gatheringPdfRows',m),summary=$('#gatheringPdfSummary',m),catalog=playerCatalog();
    const matched=parsed.roster.filter(x=>x.match?.player).length,uncertain=parsed.roster.length-matched;
    const headline=parsed.metadata.find(x=>/uefa|coupe|euro|qualification|ligue|tournoi/i.test(x))||'';
    summary.innerHTML=`<strong>${esc(file.name)}</strong><span>${parsed.roster.length} joueur(s) détecté(s) · ${matched} correspondance(s) · ${uncertain} à vérifier</span>${headline?`<small>${esc(headline)}</small>`:''}`;
    host.innerHTML=parsed.roster.length?parsed.roster.map((x,i)=>{const [cls,icon]=statusFor(x.match),selected=x.match?.player?.id||'',suggested=x.match?.suggested;return `<div class="gathering-pdf-row is-${cls}" data-pdf-row="${i}"><span class="gathering-pdf-state">${icon}</span><div class="gathering-pdf-source"><strong>${esc(x.name)}</strong><small>${esc(x.group_label)} · ${esc(x.birth_date.split('-').reverse().join('/'))}${x.club?` · ${esc(x.club)}`:''}</small></div><div class="gathering-pdf-arrow">→</div><label><span>3615 Bleus</span><select data-pdf-player><option value="">— Ne pas importer —</option>${catalog.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.name)}${p.birth_date?` · ${esc(p.birth_date.split('-').reverse().join('/'))}`:''}</option>`).join('')}</select><div class="gathering-pdf-link-actions">${!selected?`<button type="button" class="secondary-btn gathering-pdf-create-player" data-pdf-create-player="${i}">＋ Créer la tuile joueur</button>`:''}${!selected&&suggested?`<small>Suggestion : ${esc(suggested.name)}</small>`:`<small>${esc(x.match?.reason||'')}</small>`}</div></label></div>`;}).join(''):'<div class="gathering-pdf-empty">Aucun joueur détecté. Vérifie qu’il s’agit bien d’une liste FFF avec du texte sélectionnable.</div>';
    $$('[data-pdf-create-player]',host).forEach(b=>b.addEventListener('click',()=>openCreatePlayer(Number(b.dataset.pdfCreatePlayer))));
    const st=$('#gatheringPdfStatus',m);st.hidden=true;state.parsed=parsed;state.file=file;m.hidden=false;
  }

  function ensureCreatePlayerModal(){
    let m=$('#gatheringPdfCreatePlayerModal');if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop gathering-pdf-create-backdrop" id="gatheringPdfCreatePlayerModal" hidden><section class="modal-dialog gathering-pdf-create-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Créer un nouvel appelé</h2><p>Une tuile International France A sera créée puis sélectionnée dans l’import PDF.</p></div><button class="modal-close" type="button" data-pdf-create-close>×</button></header><div class="modal-body"><form id="gatheringPdfCreatePlayerForm" class="gathering-pdf-create-form"><input type="hidden" name="entry_index"><label>Nom complet<input name="display_name" required maxlength="120"></label><label>Date de naissance<input name="birth_date" type="date"></label><div class="gathering-pdf-create-context"><span data-pdf-create-group></span><small data-pdf-create-club></small></div><p class="gathering-pdf-create-note">Le groupe FFF sera conservé dans le rassemblement. Aucun poste détaillé (DC, DG, BU…) n’est inventé sur la tuile joueur.</p><div class="gathering-editor-actions"><button type="button" class="secondary-btn" data-pdf-create-close>Annuler</button><button type="submit" class="primary-btn">Créer la tuile et sélectionner</button></div><div id="gatheringPdfCreateStatus" class="c3k-v8-status" hidden></div></form></div></section></div>`);
    m=$('#gatheringPdfCreatePlayerModal');$$('[data-pdf-create-close]',m).forEach(b=>b.addEventListener('click',()=>m.hidden=true));$('#gatheringPdfCreatePlayerForm',m)?.addEventListener('submit',createPlayerFromPdf);return m;
  }

  function openCreatePlayer(index){
    const entry=state.parsed?.roster?.[index];if(!entry||!canEdit())return;const m=ensureCreatePlayerModal(),form=$('#gatheringPdfCreatePlayerForm',m);state.createIndex=index;form.reset();form.elements.entry_index.value=String(index);form.elements.display_name.value=entry.name||'';form.elements.birth_date.value=entry.birth_date||'';$('[data-pdf-create-group]',m).textContent=entry.group_label||'Groupe FFF';$('[data-pdf-create-club]',m).textContent=entry.club?`Club indiqué sur le PDF : ${entry.club}`:'';$('#gatheringPdfCreateStatus',m).hidden=true;m.hidden=false;
  }

  async function ensureFranceAContext(playerId){
    await refs()?.load?.();const c=db(),team=refs()?.getSelections?.()?.find(x=>x.code==='FRA-A-M');if(!c||!team)throw new Error('Référentiel France A indisponible.');
    const {data:existing,error:checkError}=await c.from('player_selection_stats').select('id').eq('player_id',playerId).eq('selection_id',team.id).limit(1);if(checkError)throw checkError;
    if(!(existing||[]).length){const {error}=await c.from('player_selection_stats').insert({player_id:playerId,selection_id:team.id,appearance_status:'called_only',international_number:null,selections:0,goals:0,wins:0,draws:0,losses:0,starts:0,minutes:0,data_status:'sheet_rebuild_pending'});if(error)throw error;}
    const {error:updateError}=await c.from('players').update({senior_a_called:true,france_eligibility:true,active:true}).eq('id',playerId);if(updateError)throw updateError;
  }

  async function createPlayerFromPdf(e){
    e.preventDefault();if(!canEdit())return;const c=db(),form=e.currentTarget,st=$('#gatheringPdfCreateStatus'),index=Number(form.elements.entry_index.value),entry=state.parsed?.roster?.[index];if(!c||!entry)return;
    const name=String(form.elements.display_name.value||'').replace(/\s+/g,' ').trim(),birth=String(form.elements.birth_date.value||'').trim()||null;if(!name)return;
    st.hidden=false;st.className='c3k-v8-status';st.textContent='Création de la tuile…';let createdId=null;
    try{
      let existing=null;if(birth){const {data,error}=await c.from('players').select('id,display_name,birth_date').eq('birth_date',birth).limit(20);if(error)throw error;existing=(data||[]).find(p=>compact(p.display_name)===compact(name))||null;}
      let player=existing;
      if(!player){const slug=name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now();const {data,error}=await c.from('players').insert({display_name:name,last_name:name,gender:'M',birth_date:birth,primary_position:null,secondary_positions:[],france_eligibility:true,senior_a_called:true,active:true,name_normalized:name.toLocaleLowerCase('fr'),profile_slug:slug}).select('id,display_name,birth_date').single();if(error)throw error;player=data;createdId=player.id;}
      try{await ensureFranceAContext(player.id);}catch(err){if(createdId){try{await c.from('players').delete().eq('id',createdId);}catch(_){}}throw err;}
      try{await c.rpc('record_selection_contribution',{p_player_id:player.id,p_type:'create'});}catch(_){}
      await Promise.all([window.BLEUS3000_PLAYERS_DB?.reload?.(),window.BLEUS3000_SELECTIONS?.reload?.()]);
      const label=player.display_name||name;$$('[data-pdf-player]').forEach(sel=>{if(![...sel.options].some(o=>String(o.value)===String(player.id))){const o=document.createElement('option');o.value=player.id;o.textContent=`${label}${birth?` · ${birth.split('-').reverse().join('/')}`:''}`;sel.appendChild(o);}});
      const row=$(`[data-pdf-row="${index}"]`,ensurePreview()),sel=$('[data-pdf-player]',row);if(sel)sel.value=player.id;row?.classList.remove('is-miss','is-maybe');row?.classList.add('is-ok');const mark=$('.gathering-pdf-state',row);if(mark)mark.textContent='✓';const actions=$('.gathering-pdf-link-actions',row);if(actions)actions.innerHTML='<small>Tuile International France A créée ✓</small>';
      entry.match={player:{id:String(player.id),name:label,birth_date:birth},score:1,reason:'Tuile créée depuis le PDF'};st.className='c3k-v8-status is-ok';st.textContent=createdId?'Nouvelle tuile créée ✓':'Joueur existant rattaché à France A ✓';setTimeout(()=>{ensureCreatePlayerModal().hidden=true;const main=$('#gatheringPdfStatus');if(main){main.hidden=false;main.className='c3k-v8-status is-ok';main.textContent=`${label} est maintenant sélectionné pour l’import.`;}},500);
    }catch(err){console.error('Création joueur depuis PDF',err);st.className='c3k-v8-status is-error';st.textContent=String(err?.message||err);}
  }

  function ensureEditorImportButton(){
    const form=$('#gatheringEditorForm');if(!form||form.closest('#gatheringEditorModal')?.hidden||$('[data-gathering-pdf-editor]',form))return;
    const tools=$('#gatheringQuickTools',form)||$('#gatheringPlayerRows',form)?.closest('.gathering-editor-section')?.querySelector(':scope > header');if(!tools)return;
    const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.dataset.gatheringPdfEditor='1';b.textContent='⇧ Importer PDF FFF';b.addEventListener('click',()=>chooseFile(null));tools.appendChild(b);
  }

  function chooseFile(gatheringId=null){
    if(!canEdit())return;
    const input=document.createElement('input');input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;document.body.appendChild(input);
    input.addEventListener('change',async()=>{const file=input.files?.[0];input.remove();if(!file)return;state.targetGatheringId=gatheringId||$('#gatheringEditorForm [name="id"]')?.value||null;if(gatheringId){await window.BLEUS3000_GATHERINGS?.openEditor?.(gatheringId);await new Promise(r=>setTimeout(r,80));}
      const status=$('#gatheringEditorStatus');if(status){status.hidden=false;status.className='c3k-v8-status';status.textContent='Lecture du PDF FFF…';}
      try{const lines=await extractLines(file),parsed=enrichParsed(parseRoster(lines));if(status)status.hidden=true;renderPreview(parsed,file);}catch(err){console.error('Import PDF FFF',err);if(status){status.hidden=false;status.className='c3k-v8-status is-error';status.textContent=`Import PDF impossible · ${String(err?.message||err)}`;}else alert(`Import PDF impossible : ${String(err?.message||err)}`);}
    },{once:true});input.click();
  }

  function setRow(row,entry,playerId){
    const sel=$('[name="player_id"]',row),pos=$('[name="position_group"]',row),status=$('[name="status"]',row);if(!sel)return false;sel.value=playerId;if(!sel.value)return false;if(pos)pos.value=entry.group_label;if(status)status.value='called';sel.dispatchEvent(new Event('change',{bubbles:true}));status?.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }

  function applyImport(mode){
    const modal=ensurePreview(),form=$('#gatheringEditorForm'),status=$('#gatheringPdfStatus',modal);if(!form||form.closest('#gatheringEditorModal')?.hidden){status.hidden=false;status.className='c3k-v8-status is-error';status.textContent='Ouvre d’abord le rassemblement à modifier.';return;}
    const picks=$$('[data-pdf-row]',modal).map(row=>{const i=Number(row.dataset.pdfRow),playerId=$('[data-pdf-player]',row)?.value||'';return playerId&&state.parsed?.roster?.[i]?{entry:state.parsed.roster[i],playerId}:null;}).filter(Boolean);
    if(!picks.length){status.hidden=false;status.className='c3k-v8-status is-error';status.textContent='Aucune correspondance sélectionnée.';return;}
    const host=$('#gatheringPlayerRows',form);if(mode==='replace')host.innerHTML='';else $$('.gathering-player-editor-row',host).filter(r=>!$('[name="player_id"]',r)?.value).forEach(r=>r.remove());
    const existing=new Map($$('.gathering-player-editor-row',host).map(r=>[$('[name="player_id"]',r)?.value,r]).filter(([id])=>id));let added=0,updated=0;
    for(const pick of picks){let row=existing.get(pick.playerId);if(row){setRow(row,pick.entry,pick.playerId);updated++;continue;}$('[data-gathering-add-player]',form)?.click();row=$$('.gathering-player-editor-row',host).at(-1);if(row&&setRow(row,pick.entry,pick.playerId)){existing.set(pick.playerId,row);added++;}}
    ensureEditorImportButton();window.dispatchEvent(new CustomEvent('bleus:gathering-pdf-imported',{detail:{added,updated,fileName:state.file?.name||'',count:picks.length}}));status.hidden=false;status.className='c3k-v8-status is-ok';status.textContent=`${picks.length} joueur(s) prêts dans la liste · ${added} ajouté(s), ${updated} mis à jour. Clique sur « Enregistrer » pour valider.`;setTimeout(()=>{modal.hidden=true;const main=$('#gatheringEditorStatus');if(main){main.hidden=false;main.className='c3k-v8-status is-ok';main.textContent=`PDF FFF importé : ${picks.length} joueur(s). Enregistre le rassemblement pour confirmer.`;}},650);
  }

  document.addEventListener('click',e=>{const b=e.target.closest('[data-gathering-pdf]');if(!b)return;e.preventDefault();e.stopPropagation();chooseFile(b.dataset.gatheringPdf||null);});
  let timer=0;const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(ensureEditorImportButton,40);});obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('bleus:gatherings-ready',()=>setTimeout(ensureEditorImportButton,80));
  setTimeout(ensureEditorImportButton,900);
  window.BLEUS3000_GATHERING_PDF_IMPORT={chooseFile,parseRoster,extractLines};
})();
