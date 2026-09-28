/* 3615 Bleus V1.1.61.25 — Mode Formation · éditeur de schémas tactiques */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role=()=>String(window.C3K_ACCOUNT_STATE?.profile?.role||'').toLowerCase();
  const canEdit=()=>['admin','superadmin'].includes(role());
  let client=null, formations=[], positions=[], selectedId=null, draftSlots=[], dirty=false, loading=null;

  async function waitClient(timeout=12000){
    client=window.BLEUS3000_SUPABASE||null;if(client)return client;
    return await new Promise(resolve=>{let done=false,t=null;const finish=c=>{if(done)return;done=true;if(t)clearTimeout(t);window.removeEventListener('bleus:supabase-ready',ready);client=c||window.BLEUS3000_SUPABASE||null;resolve(client);};const ready=e=>finish(e.detail?.client);window.addEventListener('bleus:supabase-ready',ready);t=setTimeout(()=>finish(),timeout);});
  }
  function normalizeRows(fs,ss){
    const by=new Map((ss||[]).map(s=>[String(s.formation_id),[]]));
    for(const s of ss||[]){const a=by.get(String(s.formation_id))||[];a.push(s);by.set(String(s.formation_id),a);}
    return (fs||[]).map(f=>({...f,slots:(by.get(String(f.id))||[]).sort((a,b)=>Number(a.slot_number)-Number(b.slot_number))}));
  }
  async function load(force=false){
    if(loading&&!force)return loading;
    loading=(async()=>{const c=await waitClient();if(!c){formations=[];positions=[];return formations;}const [fr,pr,sr]=await Promise.all([
      c.from('tactical_formations').select('*').eq('is_active',true).order('sort_order').order('name'),
      c.from('football_positions').select('id,slug,label_text,position_group,sort_order').order('sort_order'),
      c.from('tactical_formation_slots').select('id,formation_id,slot_number,position_id,x,y,label').order('slot_number')
    ]);if(fr.error)throw fr.error;if(pr.error)throw pr.error;if(sr.error)throw sr.error;positions=pr.data||[];formations=normalizeRows(fr.data||[],sr.data||[]);window.dispatchEvent(new CustomEvent('bleus:formations-updated',{detail:{formations}}));return formations;})().finally(()=>{loading=null;});
    return loading;
  }
  const list=()=>formations.slice();
  const getBySlug=slug=>formations.find(f=>String(f.slug)===String(slug))||null;
  const getById=id=>formations.find(f=>String(f.id)===String(id))||null;
  const defaultFormation=()=>formations.find(f=>f.is_default)||formations[0]||null;
  const snapshot=f=>f?{id:f.id,slug:f.slug,name:f.name,slots:(f.slots||[]).map(s=>({slot_number:Number(s.slot_number),position_id:s.position_id,x:Number(s.x),y:Number(s.y),label:s.label||positions.find(p=>String(p.id)===String(s.position_id))?.label_text||''}))}:null;

  function ensureModal(){
    let m=$('#formationBuilderModal');if(m)return m;
    m=document.createElement('div');m.className='modal-backdrop formation-builder-modal';m.id='formationBuilderModal';m.hidden=true;
    m.innerHTML=`<section class="modal-dialog formation-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="formationBuilderTitle"><header class="modal-head"><div><h2 id="formationBuilderTitle">Mode Formation</h2><p>Les positions enregistrées ici sont figées puis restituées dans les feuilles de match.</p></div><button class="modal-close" type="button" data-formation-close>×</button></header><div class="modal-body formation-builder-body"><aside class="formation-library"><div class="formation-library-head"><strong>Formations</strong><button type="button" class="secondary-btn" data-formation-new>＋</button></div><div id="formationLibraryList"></div></aside><main class="formation-workspace"><div class="formation-editor-top"><label>Nom<input id="formationName" maxlength="80"></label><label class="formation-default-check"><input id="formationDefault" type="checkbox"> Formation par défaut</label><div class="formation-editor-actions"><button type="button" class="secondary-btn" data-formation-duplicate>Dupliquer</button><button type="button" class="formation-delete-btn" data-formation-delete>Supprimer</button><button type="button" class="primary-btn" data-formation-save>Enregistrer</button></div></div><div class="formation-builder-grid"><div><div class="formation-pitch" id="formationPitch" aria-label="Terrain tactique"></div><small class="formation-help">Déplace les 11 pions au doigt ou à la souris. Leur position est enregistrée en pourcentage pour rester identique sur tous les écrans.</small></div><section class="formation-slot-editor"><strong id="formationSlotTitle">Emplacement</strong><label>Poste<select id="formationSlotPosition"></select></label><div class="formation-slot-coords"><span>X <b id="formationSlotX">—</b></span><span>Y <b id="formationSlotY">—</b></span></div><p>Le poste choisi ici sera imposé dans la feuille de match pour cet emplacement.</p></section></div><div class="formation-status" id="formationStatus" hidden></div></main></div></section>`;
    document.body.appendChild(m);
    m.querySelectorAll('[data-formation-close]').forEach(b=>b.addEventListener('click',close));
    $('[data-formation-save]',m)?.addEventListener('click',saveCurrent);
    $('[data-formation-new]',m)?.addEventListener('click',createNew);
    $('[data-formation-duplicate]',m)?.addEventListener('click',duplicateCurrent);
    $('[data-formation-delete]',m)?.addEventListener('click',deleteCurrent);
    $('#formationName',m)?.addEventListener('input',()=>{dirty=true;});
    $('#formationDefault',m)?.addEventListener('change',()=>{dirty=true;});
    $('#formationSlotPosition',m)?.addEventListener('change',e=>{const s=draftSlots.find(x=>x.slot_number===Number(m.dataset.selectedSlot));if(s){s.position_id=e.target.value;s.label=positions.find(p=>String(p.id)===String(e.target.value))?.label_text||'';dirty=true;renderPitch();}});
    return m;
  }
  function status(msg,type='ok'){const el=$('#formationStatus');if(!el)return;el.hidden=false;el.className=`formation-status is-${type}`;el.textContent=msg;}
  function slugify(v){return String(v||'formation').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'formation';}
  function renderLibrary(){const h=$('#formationLibraryList');if(!h)return;h.innerHTML=formations.map(f=>`<button type="button" class="formation-library-item ${String(f.id)===String(selectedId)?'is-active':''}" data-formation-id="${esc(f.id)}"><span><strong>${esc(f.name)}</strong><small>${f.is_default?'Par défaut · ':''}${(f.slots||[]).length}/11 emplacements</small></span><span>›</span></button>`).join('');$$('[data-formation-id]',h).forEach(b=>b.addEventListener('click',()=>selectFormation(b.dataset.formationId)));}
  function current(){return getById(selectedId);}
  function cloneSlots(f){return (f?.slots||[]).map(s=>({slot_number:Number(s.slot_number),position_id:s.position_id,x:Number(s.x),y:Number(s.y),label:s.label||''}));}
  function selectFormation(id){if(dirty&&!confirm('Abandonner les modifications non enregistrées ?'))return;selectedId=id;const f=current();if(!f)return;draftSlots=cloneSlots(f);dirty=false;const m=ensureModal();$('#formationName',m).value=f.name||'';$('#formationDefault',m).checked=!!f.is_default;m.dataset.selectedSlot='1';renderLibrary();renderPitch();renderSlotEditor(1);}
  function posLabel(id){return positions.find(p=>String(p.id)===String(id))?.label_text||'Poste';}
  function renderPitch(){const p=$('#formationPitch');if(!p)return;p.innerHTML=`<div class="pitch-line halfway"></div><div class="pitch-circle"></div><div class="pitch-box top"></div><div class="pitch-box bottom"></div>`+draftSlots.map(s=>`<button type="button" class="formation-token ${Number(ensureModal().dataset.selectedSlot)===s.slot_number?'is-selected':''}" data-slot="${s.slot_number}" style="left:${s.x}%;top:${s.y}%"><b>${s.slot_number}</b><span>${esc(posLabel(s.position_id))}</span></button>`).join('');$$('.formation-token',p).forEach(t=>bindDrag(t));}
  function renderSlotEditor(n){const m=ensureModal(),s=draftSlots.find(x=>x.slot_number===Number(n));if(!s)return;m.dataset.selectedSlot=String(n);$('#formationSlotTitle',m).textContent=`Emplacement ${n}`;const sel=$('#formationSlotPosition',m);sel.innerHTML=positions.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(s.position_id)?'selected':''}>${esc(p.label_text)}</option>`).join('');$('#formationSlotX',m).textContent=Number(s.x).toFixed(1);$('#formationSlotY',m).textContent=Number(s.y).toFixed(1);renderPitch();}
  function bindDrag(token){
    token.addEventListener('pointerdown',e=>{if(!canEdit())return;e.preventDefault();const n=Number(token.dataset.slot),pitch=$('#formationPitch'),s=draftSlots.find(x=>x.slot_number===n);if(!s)return;renderSlotEditor(n);token.setPointerCapture?.(e.pointerId);const move=ev=>{const r=pitch.getBoundingClientRect();s.x=Math.max(4,Math.min(96,((ev.clientX-r.left)/r.width)*100));s.y=Math.max(4,Math.min(96,((ev.clientY-r.top)/r.height)*100));token.style.left=`${s.x}%`;token.style.top=`${s.y}%`;$('#formationSlotX').textContent=s.x.toFixed(1);$('#formationSlotY').textContent=s.y.toFixed(1);dirty=true;};const up=()=>{token.removeEventListener('pointermove',move);token.removeEventListener('pointerup',up);token.removeEventListener('pointercancel',up);};token.addEventListener('pointermove',move);token.addEventListener('pointerup',up);token.addEventListener('pointercancel',up);});
    token.addEventListener('click',()=>renderSlotEditor(Number(token.dataset.slot)));
  }
  async function saveCurrent(){if(!canEdit())return status('Modification réservée aux ADMIN et SUPERADMIN.','error');const f=current();if(!f||!client)return;const name=String($('#formationName')?.value||'').trim();if(!name)return status('Donne un nom à la formation.','error');if(draftSlots.length!==11)return status('Une formation doit contenir exactement 11 emplacements.','error');status('Enregistrement…');try{const wantDefault=!!$('#formationDefault')?.checked;if(wantDefault){const {error:e0}=await client.from('tactical_formations').update({is_default:false}).neq('id',f.id);if(e0)throw e0;}const {error:e1}=await client.from('tactical_formations').update({name,is_default:wantDefault,updated_at:new Date().toISOString()}).eq('id',f.id);if(e1)throw e1;for(const s of draftSlots){const {error}=await client.from('tactical_formation_slots').upsert({formation_id:f.id,slot_number:s.slot_number,position_id:s.position_id,x:Number(s.x.toFixed(2)),y:Number(s.y.toFixed(2)),label:posLabel(s.position_id),updated_at:new Date().toISOString()},{onConflict:'formation_id,slot_number'});if(error)throw error;}dirty=false;await load(true);selectedId=f.id;renderLibrary();selectFormation(f.id);status('Formation enregistrée ✓');}catch(e){status(e?.message||String(e),'error');}}
  async function createFrom(base,name){if(!canEdit()||!client)return;const slug=`${slugify(name)}-${Date.now().toString(36)}`;const {data:f,error}=await client.from('tactical_formations').insert({slug,name,is_active:true,is_system:false,sort_order:Math.max(0,...formations.map(x=>Number(x.sort_order)||0))+10,created_by:window.C3K_ACCOUNT_STATE?.profile?.id||null}).select('*').single();if(error)throw error;const src=cloneSlots(base||defaultFormation());for(const s of src){const {error:se}=await client.from('tactical_formation_slots').insert({formation_id:f.id,slot_number:s.slot_number,position_id:s.position_id,x:s.x,y:s.y,label:posLabel(s.position_id)});if(se)throw se;}await load(true);selectedId=f.id;selectFormation(f.id);}
  async function createNew(){const name=prompt('Nom de la nouvelle formation :','Nouvelle formation');if(!name?.trim())return;try{await createFrom(defaultFormation(),name.trim());status('Nouvelle formation créée.');}catch(e){status(e?.message||String(e),'error');}}
  async function duplicateCurrent(){const f=current();if(!f)return;const name=prompt('Nom de la copie :',`${f.name} — variante`);if(!name?.trim())return;try{await createFrom(f,name.trim());status('Formation dupliquée.');}catch(e){status(e?.message||String(e),'error');}}
  async function deleteCurrent(){const f=current();if(!f||!canEdit())return;if(f.is_system)return status('Les 7 formations historiques sont conservées. Duplique-les pour créer tes variantes.','error');if(!confirm(`Supprimer « ${f.name} » ?`))return;try{const {count,error:ce}=await client.from('matches').select('id',{count:'exact',head:true}).eq('sheet_formation_id',f.id);if(ce)throw ce;if(Number(count||0)>0)return status('Cette formation est déjà utilisée par une feuille de match et ne peut pas être supprimée.','error');const {error}=await client.from('tactical_formations').delete().eq('id',f.id);if(error)throw error;await load(true);selectedId=defaultFormation()?.id||formations[0]?.id||null;if(selectedId)selectFormation(selectedId);else{renderLibrary();$('#formationPitch').innerHTML='';}status('Formation supprimée.');}catch(e){status(e?.message||String(e),'error');}}
  async function open(){if(!canEdit())return alert('Mode Formation réservé aux ADMIN et SUPERADMIN.');const m=ensureModal();m.hidden=false;document.body.style.overflow='hidden';try{status('Chargement…');await load(true);selectedId=selectedId&&getById(selectedId)?selectedId:(defaultFormation()?.id||formations[0]?.id);renderLibrary();if(selectedId)selectFormation(selectedId);const st=$('#formationStatus');if(st)st.hidden=true;}catch(e){status(e?.message||String(e),'error');}}
  function close(){const m=$('#formationBuilderModal');if(!m)return;if(dirty&&!confirm('Fermer sans enregistrer les modifications ?'))return;m.hidden=true;document.body.style.overflow='';dirty=false;}

  window.BLEUS3000_FORMATIONS={load,list,getBySlug,getById,defaultFormation,snapshot,open,canEdit};
  const pre=()=>load().catch(e=>console.warn('Formations',e));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pre,{once:true});else pre();
  window.addEventListener('c3k:account-state',()=>{document.querySelectorAll('[data-tool-open="formations"]').forEach(b=>b.hidden=!canEdit());});
})();
