/* 3615 Bleus V1.1.40 — tags : création d’entrée Compétitions + dégradés 5 couleurs */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localKey='bleus3000.tags.local.v1';
  const iconChoices=['🏷️','⭐','🇫🇷','⚽','🏆','📊','📅','📚','📍','👤','👥','🧤','🎯','🔥','✨','🧠','🩺','🎥','📰','🔎'];
  let tags=[],selectionTeams=[],competitions=[],referenceLinks=[],editingId=null,lastError='',pendingIconFile=null,pendingIconPreview='';

  const state=()=>window.C3K_ACCOUNT_STATE||{};
  const client=()=>window.BLEUS3000_SUPABASE;
  const role=()=>state().profile?.role||'user';
  const canCreate=()=>['contributor','editor','admin','superadmin'].includes(role());
  const canEditAll=()=>['editor','admin','superadmin'].includes(role());
  const userId=()=>state().profile?.id||'local-demo';
  const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72)||'tag';
  const uuid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const localRows=()=>{try{return JSON.parse(localStorage.getItem(localKey)||'[]');}catch{return [];}};
  const saveLocal=()=>localStorage.setItem(localKey,JSON.stringify(tags));
  const gradientColors=t=>{
    let colors=Array.isArray(t?.gradient_colors)?t.gradient_colors.filter(Boolean).slice(0,5):[];
    if(!colors.length)colors=[t?.color_start||'#2563EB',t?.color_end||t?.color_start||'#0EA5C6'];
    if(colors.length===1)colors.push(t?.color_end||colors[0]);
    return colors.slice(0,5);
  };
  const tagStyle=t=>{
    const colors=gradientColors(t);
    const bg=t.appearance==='solid'?colors[0]:`linear-gradient(${Number(t.gradient_angle)||135}deg,${colors.join(',')})`;
    return `--tag-bg:${bg};--tag-text:${t.text_color};--tag-border:${t.border_color};--tag-radius:${Number(t.border_radius)||8}px;--tag-bw:${Number(t.border_width)??1}px`;
  };
  const publicIconUrl=t=>{
    const c=client();
    if(!t?.icon_image_path||!c)return '';
    const {data}=c.storage.from('tag-icons').getPublicUrl(t.icon_image_path);
    return data?.publicUrl||'';
  };
  const iconMarkup=t=>{
    const u=publicIconUrl(t);
    return u?`<img class="b3k-tag-chip-icon-img" src="${esc(u)}" alt="">`:`<span class="b3k-tag-chip-icon">${esc(t.icon_text||'🏷️')}</span>`;
  };
  const tagHtml=(t,extra='')=>`<span class="b3k-tag-chip ${extra}" style="${tagStyle(t)}">${iconMarkup(t)}<span>${esc(t.label_text)}</span></span>`;

  async function load(){
    lastError='';
    const c=client();
    if(c&&state().session?.user){
      const [{data,error},{data:teamsData,error:teamsError},{data:compData,error:compError},{data:linksData,error:linksError}]=await Promise.all([
        c.from('tags').select('*').eq('is_active',true).order('label_text',{ascending:true}),
        c.from('selection_teams').select('id,code,name,gender,category,sort_order,team_tag_id').eq('active',true).order('sort_order'),
        c.from('competitions').select('id,name,edition,tag_id').order('name'),
        c.from('tag_reference_links').select('id,tag_id,reference_type,reference_id,relation_kind')
      ]);
      if(error){lastError=error.message;tags=[];}else tags=data||[];
      if(teamsError)lastError=lastError||teamsError.message;selectionTeams=teamsData||[];
      if(compError)lastError=lastError||compError.message;competitions=compData||[];
      if(linksError)lastError=lastError||linksError.message;referenceLinks=linksData||[];
    }else{tags=localRows();selectionTeams=[];competitions=[];referenceLinks=[];}
    render();
  }

  function open(){
    const body=$('#c3kV8PanelBody');
    if(!body)return;
    body.innerHTML='<div class="c3k-v8-muted">Chargement des tags et étiquettes…</div>';
    editingId=null;pendingIconFile=null;pendingIconPreview='';
    load();
  }

  function blank(){return {kind:'tag',label_text:'',icon_text:'🏷️',icon_image_path:null,appearance:'gradient',color_start:'#2563EB',color_end:'#0EA5C6',gradient_colors:['#2563EB','#0EA5C6'],text_color:'#FFFFFF',border_color:'#1E4FA7',gradient_angle:135,border_radius:8,border_width:1,aliases:[]};}
  function current(){return tags.find(t=>t.id===editingId)||blank();}

  function render(){
    const body=$('#c3kV8PanelBody');if(!body)return;
    const editable=canCreate(), cur=current();
    const list=tags.map(t=>{
      const mine=t.created_by===userId();
      const mayEdit=editable&&(mine||canEditAll());
      const assoc=referenceLinks.filter(l=>l.tag_id===t.id).map(l=>{if(l.reference_type==='selection'){const tm=selectionTeams.find(x=>x.id===l.reference_id);return tm?`Sélection · ${tm.name}`:'';}if(l.reference_type==='competition'){const cp=competitions.find(x=>x.id===l.reference_id);return cp?`Compétition · ${cp.name}${cp.edition?` · ${cp.edition}`:''}`:'';}return '';}).filter(Boolean);
      return `<article class="b3k-tag-row" data-tag-row="${esc(t.id)}">
        <div class="b3k-tag-row-preview">${tagHtml(t)}</div>
        <div class="b3k-tag-row-meta"><strong>${esc(t.kind==='label'?'Étiquette':'Tag')}</strong><small>${esc((t.aliases||[]).join(' · ')||t.slug||'')}</small>${assoc.length?`<small class="b3k-tag-ref-meta">Référentiel · ${esc(assoc.join(' · '))}</small>`:''}</div>
        <div class="b3k-tag-row-actions">${mayEdit?`<button type="button" data-tag-edit="${esc(t.id)}">Modifier</button><button type="button" class="is-danger" data-tag-delete="${esc(t.id)}">Supprimer</button>`:''}</div>
      </article>`;
    }).join('')||'<div class="b3k-tags-empty">Aucun tag pour le moment.</div>';

    body.innerHTML=`<section class="b3k-tags-manager">
      <div class="b3k-tags-head"><div><strong>Tags & étiquettes</strong><span>Catalogue global : sections, compétitions et étiquettes personnalisées. Toute modification se répercute dans Matchs et Calendrier.</span></div><span class="b3k-tags-count">${tags.length}</span></div>
      ${lastError?`<div class="c3k-v8-status is-error">${esc(lastError)}</div>`:''}
      ${editable?editorHtml(cur):`<div class="b3k-tags-readonly">Ton rôle <strong>${esc(role().toUpperCase())}</strong> peut consulter le catalogue. La création et la modification sont réservées aux contributeurs, éditeurs et administrateurs.</div>`}
      <div class="b3k-tags-list-head"><strong>Catalogue</strong><small>${tags.length} élément${tags.length>1?'s':''}</small></div>
      <div class="b3k-tags-list">${list}</div>
      <div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="b3kTagsBack" type="button">Retour</button></div>
    </section>`;

    $('#b3kTagsBack',body)?.addEventListener('click',()=>$('#c3kV8AccountBtn')?.click());
    $('#b3kTagForm',body)?.addEventListener('submit',save);
    $('#b3kTagCancel',body)?.addEventListener('click',()=>{editingId=null;render();});
    $$('[data-tag-edit]',body).forEach(b=>b.addEventListener('click',()=>{editingId=b.dataset.tagEdit;render();}));
    $$('[data-tag-delete]',body).forEach(b=>b.addEventListener('click',()=>removeTag(b.dataset.tagDelete)));
    $$('.b3k-tag-icon-choice',body).forEach(b=>b.addEventListener('click',()=>{const f=$('#b3kTagForm');if(!f)return;f.icon_text.value=b.dataset.icon;pendingIconFile=null;pendingIconPreview='';updatePreview(f);}));
    const form=$('#b3kTagForm',body);
    if(form){
      const file=$('#b3kTagIconFile',form),clear=$('#b3kTagIconClear',form);
      file?.addEventListener('change',async()=>{
        const f=file.files?.[0];
        if(!f)return;
        try{
          const out=await prepareIcon(f);
          pendingIconFile=out.blob;pendingIconPreview=out.preview;
          updatePreview(form);
          const meta=$('#b3kTagIconMeta',form);if(meta)meta.textContent=`${out.width}×${out.height}px → 128×128 WebP · ${Math.max(1,Math.round(out.blob.size/1024))} Ko`;
        }catch(err){alert(err.message||'Image invalide');file.value='';}
      });
      clear?.addEventListener('click',()=>{pendingIconFile=null;pendingIconPreview='';form.dataset.removeIcon='1';if(file)file.value='';updatePreview(form);});
      const refType=form.elements.reference_type,refId=form.elements.reference_id;
      const syncReferenceChoices=()=>{const type=refType?.value||'';if(!refId)return;[...refId.querySelectorAll('optgroup')].forEach(g=>{const gt=g.label==='Sélections'?'selection':'competition';g.hidden=!!type&&gt!==type;});if(type){const selected=refId.selectedOptions?.[0];if(selected?.dataset?.refType&&selected.dataset.refType!==type)refId.value='';}const box=form.querySelector('[data-new-competition]');if(box)box.hidden=!(type==='competition'&&!refId.value);};
      refType?.addEventListener('change',syncReferenceChoices);refId?.addEventListener('change',syncReferenceChoices);syncReferenceChoices();
      $$('input,select',form).forEach(n=>n.addEventListener('input',()=>updatePreview(form)));updatePreview(form);
    }
  }

  function currentReferenceLinks(t){return referenceLinks.filter(l=>l.tag_id===t.id&&(l.reference_type==='selection'||l.reference_type==='competition'));}
  function currentReferenceLink(t){return currentReferenceLinks(t)[0]||null;}
  function referenceEditorHtml(t){
    const links=currentReferenceLinks(t);
    if(editingId&&links.length){
      const labels=links.map(l=>{
        if(l.reference_type==='selection'){const tm=selectionTeams.find(x=>x.id===l.reference_id);return tm?`Sélection · ${tm.name}`:'';}
        const cp=competitions.find(x=>x.id===l.reference_id);return cp?`Compétition · ${cp.name}${cp.edition?` · ${cp.edition}`:''}`:'';
      }).filter(Boolean);
      return `<fieldset class="b3k-tag-reference-box"><legend>Associations au référentiel</legend><div class="b3k-tag-ref-readonly">${labels.map(x=>`<span>${esc(x)}</span>`).join('')}</div><small>${links.length>1?'Ce tag est partagé par plusieurs entrées.':'Association existante.'} Modifier le texte, les couleurs ou l’icône conserve toutes les associations.</small></fieldset>`;
    }
    const link=currentReferenceLink(t), selected=link?.reference_id||'', type=link?.reference_type||t.reference_scope||'', kind=link?.relation_kind||'membership';
    const teamOpts=selectionTeams.map(tm=>`<option value="${esc(tm.id)}" data-ref-type="selection" ${selected===tm.id?'selected':''}>${esc(tm.name)}</option>`).join('');
    const compOpts=competitions.map(cp=>`<option value="${esc(cp.id)}" data-ref-type="competition" ${selected===cp.id?'selected':''}>${esc(cp.name)}${cp.edition?` · ${esc(cp.edition)}`:''}</option>`).join('');
    return `<fieldset class="b3k-tag-reference-box"><legend>Association au référentiel</legend><div class="b3k-tag-grid three"><label>Référentiel<select name="reference_type"><option value="">Aucun</option><option value="selection" ${type==='selection'?'selected':''}>Sélections</option><option value="competition" ${type==='competition'?'selected':''}>Compétitions</option></select></label><label>Entrée existante<select name="reference_id"><option value="">Aucune / créer une nouvelle entrée</option><optgroup label="Sélections">${teamOpts}</optgroup><optgroup label="Compétitions">${compOpts}</optgroup></select></label><label>Type de lien<select name="relation_kind"><option value="membership" ${kind==='membership'?'selected':''}>Appartenance</option><option value="status" ${kind==='status'?'selected':''}>Statut</option><option value="topic" ${kind==='topic'?'selected':''}>Sujet</option></select></label></div><div class="b3k-tag-new-competition" data-new-competition hidden><strong>Nouvelle entrée Compétitions</strong><div class="b3k-tag-grid two"><label>Nom de la compétition<input name="new_competition_name" maxlength="160" placeholder="Par défaut : le texte du tag"></label><label>Édition / saison<input name="new_competition_edition" maxlength="80" placeholder="Facultatif · ex. 2027"></label></div><small>Si aucune entrée existante n’est choisie, 3615 Bleus crée automatiquement cette nouvelle compétition et lui associe le tag.</small></div><small>Un nouveau tag peut donc soit rejoindre une entrée existante, soit créer lui-même la nouvelle entrée Compétitions.</small></fieldset>`;
  }

  function editorHtml(t){
    const colors=gradientColors(t), color=(i,fallback)=>colors[i]||fallback;
    return `<form class="b3k-tag-editor" id="b3kTagForm">
      <div class="b3k-tag-editor-title"><strong>${editingId?'Modifier le tag':'Créer un tag / une étiquette'}</strong><small>Texte, icône et dégradé jusqu’à 5 couleurs sont personnalisables.</small></div>
      <div class="b3k-tag-preview-wrap"><span>APERÇU</span><div id="b3kTagPreview"></div></div>
      <div class="b3k-tag-grid two">
        <label>Type<select name="kind"><option value="tag" ${t.kind==='tag'?'selected':''}>Tag</option><option value="label" ${t.kind==='label'?'selected':''}>Étiquette</option></select></label>
        <label>Texte<input name="label_text" maxlength="40" required value="${esc(t.label_text||'')}"></label>
      </div>
      <div class="b3k-tag-grid two">
        <label>Icône<input name="icon_text" maxlength="12" value="${esc(t.icon_text||'🏷️')}"></label>
        <label>Style<select name="appearance"><option value="gradient" ${t.appearance!=='solid'?'selected':''}>Dégradé</option><option value="solid" ${t.appearance==='solid'?'selected':''}>Couleur unie</option></select></label>
      </div>
      <div class="b3k-tag-icon-palette">${iconChoices.map(i=>`<button type="button" class="b3k-tag-icon-choice" data-icon="${esc(i)}" title="${esc(i)}">${esc(i)}</button>`).join('')}</div>
      <div class="b3k-tag-icon-upload">
        <div><strong>Icône personnalisée</strong><small>PNG/JPG/WebP · redimensionnée automatiquement en 128×128, sans déformation.</small></div>
        <label class="b3k-tag-file-btn">Importer une image<input id="b3kTagIconFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
        <button type="button" class="c3k-v8-secondary" id="b3kTagIconClear">Retirer</button>
        <small id="b3kTagIconMeta">${t.icon_image_path?'Icône personnalisée active':'Aucune image importée'}</small>
      </div>
      <label class="b3k-tag-wide">Alias / mots-clés<input name="aliases" placeholder="ex : EDF, A, senior" value="${esc((t.aliases||[]).join(', '))}"></label>
      ${referenceEditorHtml(t)}
      <fieldset class="b3k-tag-gradient-box"><legend>Couleurs du tag</legend><small>Les couleurs 1 et 2 sont toujours utilisées pour un dégradé. Active jusqu’à trois couleurs supplémentaires.</small>
        <div class="b3k-tag-color-grid is-gradient-stops">
          <label>Couleur 1<input type="color" name="color_1" value="${esc(color(0,'#2563EB'))}"></label>
          <label>Couleur 2<input type="color" name="color_2" value="${esc(color(1,'#0EA5C6'))}"></label>
          <label class="b3k-optional-color"><span>Couleur 3 <input type="checkbox" name="use_color_3" ${colors.length>=3?'checked':''}></span><input type="color" name="color_3" value="${esc(color(2,'#FFFFFF'))}"></label>
          <label class="b3k-optional-color"><span>Couleur 4 <input type="checkbox" name="use_color_4" ${colors.length>=4?'checked':''}></span><input type="color" name="color_4" value="${esc(color(3,'#E63946'))}"></label>
          <label class="b3k-optional-color"><span>Couleur 5 <input type="checkbox" name="use_color_5" ${colors.length>=5?'checked':''}></span><input type="color" name="color_5" value="${esc(color(4,'#082654'))}"></label>
          <label>Texte<input type="color" name="text_color" value="${esc(t.text_color||'#FFFFFF')}"></label>
          <label>Bordure<input type="color" name="border_color" value="${esc(t.border_color||'#1E4FA7')}"></label>
        </div>
      </fieldset>
      <div class="b3k-tag-grid three">
        <label>Angle<input type="number" name="gradient_angle" min="0" max="360" step="5" value="${Number(t.gradient_angle)||135}"></label>
        <label>Arrondi<input type="number" name="border_radius" min="2" max="24" value="${Number(t.border_radius)||8}"></label>
        <label>Bordure<input type="number" name="border_width" min="0" max="4" value="${Number(t.border_width)??1}"></label>
      </div>
      <div class="b3k-tag-editor-actions"><button type="button" class="c3k-v8-secondary" id="b3kTagCancel">${editingId?'Annuler':'Vider'}</button><button class="c3k-v8-primary" type="submit">${editingId?'Enregistrer':'Ajouter'}</button></div>
      <div class="c3k-v8-status" id="b3kTagStatus" hidden></div>
    </form>`;
  }

  function formPayload(form){
    const fd=new FormData(form), label=String(fd.get('label_text')||'').trim();
    const colors=[String(fd.get('color_1')||'#2563EB'),String(fd.get('color_2')||'#0EA5C6')];
    for(let i=3;i<=5;i++)if(fd.get(`use_color_${i}`)==='on')colors.push(String(fd.get(`color_${i}`)||'#2563EB'));
    return {
      kind:String(fd.get('kind')||'tag'),label_text:label,icon_text:String(fd.get('icon_text')||'🏷️').trim()||'🏷️',icon_image_path:current().icon_image_path||null,
      appearance:String(fd.get('appearance')||'gradient'),color_start:colors[0],color_end:colors[colors.length-1],gradient_colors:colors.slice(0,5),
      text_color:String(fd.get('text_color')||'#FFFFFF'),border_color:String(fd.get('border_color')||'#1E4FA7'),gradient_angle:Number(fd.get('gradient_angle')||135),
      border_radius:Number(fd.get('border_radius')||8),border_width:Number(fd.get('border_width')||1),aliases:String(fd.get('aliases')||'').split(',').map(x=>x.trim()).filter(Boolean),
      reference_type:String(fd.get('reference_type')||''),reference_id:String(fd.get('reference_id')||''),relation_kind:String(fd.get('relation_kind')||'membership'),
      new_competition_name:String(fd.get('new_competition_name')||'').trim(),new_competition_edition:String(fd.get('new_competition_edition')||'').trim()
    };
  }

  function updatePreview(form){
    const out=$('#b3kTagPreview');if(!out)return;
    const p=formPayload(form);p.label_text=p.label_text||'Exemple';
    if(form.dataset.removeIcon==='1')p.icon_image_path=null;
    if(pendingIconPreview){const bg=tagStyle(p);out.innerHTML=`<span class="b3k-tag-chip is-preview" style="${bg}"><img class="b3k-tag-chip-icon-img" src="${pendingIconPreview}" alt=""><span>${esc(p.label_text)}</span></span>`;}
    else out.innerHTML=tagHtml(p,'is-preview');
  }

  async function save(e){
    e.preventDefault();const form=e.currentTarget,st=$('#b3kTagStatus'),payload=formPayload(form);
    if(!payload.label_text)return status(st,'Ajoute un texte.','error');
    status(st,'Enregistrement…');
    const c=client();
    const removeIcon=form.dataset.removeIcon==='1';
    if(removeIcon)payload.icon_image_path=null;
    if(c&&state().session?.user&&pendingIconFile){
      try{payload.icon_image_path=await uploadIcon(pendingIconFile,payload.label_text,editingId);}catch(err){return status(st,err.message||'Échec de l’import de l’icône.','error');}
    }
    const refSpec={reference_type:payload.reference_type,reference_id:payload.reference_id,relation_kind:payload.relation_kind,new_competition_name:payload.new_competition_name,new_competition_edition:payload.new_competition_edition};
    payload.reference_scope=refSpec.reference_type||current().reference_scope||null;
    if(refSpec.reference_type==='selection'&&refSpec.reference_id&&!selectionTeams.some(x=>String(x.id)===String(refSpec.reference_id)))return status(st,'Choisis une entrée du référentiel Sélections.','error');
    if(refSpec.reference_type==='competition'&&refSpec.reference_id&&!competitions.some(x=>String(x.id)===String(refSpec.reference_id)))return status(st,'Choisis une entrée du référentiel Compétitions.','error');
    delete payload.reference_type;delete payload.reference_id;delete payload.relation_kind;delete payload.new_competition_name;delete payload.new_competition_edition;
    let savedTagId=editingId;
    if(c&&state().session?.user){
      if(editingId){
        const {error}=await c.from('tags').update({...payload,updated_at:new Date().toISOString()}).eq('id',editingId);
        if(error)return status(st,error.message,'error');
      }else{
        const row={...payload,slug:slugify(payload.label_text),created_by:userId()};
        const {data:created,error}=await c.from('tags').insert(row).select('id').single();
        if(error)return status(st,error.message.includes('duplicate')?'Ce texte est déjà utilisé par un tag.':error.message,'error');
        savedTagId=created?.id||null;
      }
      if(savedTagId&&!editingId){
        if(refSpec.reference_type==='competition'&&!refSpec.reference_id){
          const competitionName=(refSpec.new_competition_name||payload.label_text).trim();
          if(competitionName){
            const compPayload={name:competitionName,edition:refSpec.new_competition_edition||null,competition_type:'Sélection nationale',status:'active',tag_id:savedTagId,external_ids:{manual_tag_entry:true}};
            const {data:newComp,error:compErr}=await c.from('competitions').insert(compPayload).select('id,name,edition,tag_id').single();
            if(compErr){await c.from('tags').delete().eq('id',savedTagId).catch?.(()=>{});return status(st,'Création de la compétition · '+compErr.message,'error');}
            refSpec.reference_id=newComp?.id||'';
          }
        }
        const oldLinks=referenceLinks.filter(l=>l.tag_id===savedTagId&&(l.reference_type==='selection'||l.reference_type==='competition'));
        for(const l of oldLinks){
          const {error:delErr}=await c.from('tag_reference_links').delete().eq('id',l.id);
          if(delErr)return status(st,'Association référentiel · '+delErr.message,'error');
          if(l.relation_kind==='membership'&&l.reference_type==='selection')await c.from('selection_teams').update({team_tag_id:null}).eq('id',l.reference_id).eq('team_tag_id',savedTagId);
          if(l.relation_kind==='membership'&&l.reference_type==='competition')await c.from('competitions').update({tag_id:null}).eq('id',l.reference_id).eq('tag_id',savedTagId);
        }
        if((refSpec.reference_type==='selection'||refSpec.reference_type==='competition')&&refSpec.reference_id){
          const {error:linkErr}=await c.from('tag_reference_links').insert({tag_id:savedTagId,reference_type:refSpec.reference_type,reference_id:refSpec.reference_id,relation_kind:refSpec.relation_kind||'membership',created_by:userId()});
          if(linkErr)return status(st,'Association référentiel · '+linkErr.message,'error');
          if(refSpec.relation_kind==='membership'&&refSpec.reference_type==='selection')await c.from('selection_teams').update({team_tag_id:savedTagId}).eq('id',refSpec.reference_id);
          if(refSpec.relation_kind==='membership'&&refSpec.reference_type==='competition')await c.from('competitions').update({tag_id:savedTagId}).eq('id',refSpec.reference_id);
        }
      }
    }else{
      if(editingId){const i=tags.findIndex(x=>x.id===editingId);if(i>=0)tags[i]={...tags[i],...payload,updated_at:new Date().toISOString()};}
      else tags.push({id:uuid(),...payload,slug:slugify(payload.label_text),created_by:userId(),is_active:true,created_at:new Date().toISOString()});
      saveLocal();
    }
    const old=current().icon_image_path||null;
    if(c&&state().session?.user&&old&&(removeIcon||pendingIconFile)&&old!==payload.icon_image_path){await c.storage.from('tag-icons').remove([old]).catch?.(()=>{});}
    editingId=null;pendingIconFile=null;pendingIconPreview='';await load();
    window.BLEUS3000_RELATIONAL_REFS?.invalidate?.();
    await window.BLEUS3000_RELATIONAL_REFS?.load?.();
    await window.BLEUS3000_CALENDAR?.refresh?.();
  }


  async function prepareIcon(file){
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('Format accepté : PNG, JPG ou WebP.');
    if(file.size>8*1024*1024)throw new Error('Image trop lourde : 8 Mo maximum avant optimisation.');
    const src=await createImageBitmap(file),originalWidth=src.width,originalHeight=src.height;
    const side=Math.max(src.width,src.height), canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,128,128);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const scale=128/side,w=src.width*scale,h=src.height*scale,x=(128-w)/2,y=(128-h)/2;ctx.drawImage(src,x,y,w,h);
    src.close?.();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Conversion impossible.')),'image/webp',0.88));
    return {blob,preview:canvas.toDataURL('image/webp',0.88),width:originalWidth,height:originalHeight};
  }

  async function uploadIcon(blob,label,id){
    const c=client(),uid=state().session?.user?.id;if(!c||!uid)throw new Error('Connexion requise pour importer une icône.');
    const safe=slugify(label),key=`${uid}/${id||uuid()}-${safe}-${Date.now()}.webp`;
    const {error}=await c.storage.from('tag-icons').upload(key,blob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return key;
  }

  async function removeTag(id){
    const t=tags.find(x=>x.id===id);if(!t||!confirm(`Supprimer « ${t.label_text} » ?`))return;
    const c=client();
    if(c&&state().session?.user){const {error}=await c.from('tags').delete().eq('id',id);if(error)return alert(error.message);}
    else{tags=tags.filter(x=>x.id!==id);saveLocal();}
    if(editingId===id)editingId=null;await load();
    window.BLEUS3000_RELATIONAL_REFS?.invalidate?.();
    window.BLEUS3000_CALENDAR?.refresh?.();
  }

  function status(node,msg,type=''){if(!node)return;node.hidden=false;node.className='c3k-v8-status'+(type?` is-${type}`:'');node.textContent=msg;}

  window.BLEUS3000_TAGS={open,refresh:load,getAll:()=>[...tags],chipHtml:tagHtml};
})();
