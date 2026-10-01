/* 3615 Bleus V1.3.3 — authentification administrateur uniquement */
(() => {
  'use strict';
  const cfg=window.BLEUS3000_CONFIG||{};
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=r=>({admin:'ADMIN',superadmin:'SUPERADMIN'}[String(r||'').toLowerCase()]||String(r||'').toUpperCase());
  const localPrefsKey='bleus3000.preferences.local.v1',localPrefsSyncKey='bleus3000.preferences.synced-at.v1';
  let client=null,session=null,profile=null;
  const configured=()=>!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase?.createClient);
  const isAdmin=()=>['admin','superadmin'].includes(String(profile?.role||'').toLowerCase());
  const isSuperAdmin=()=>String(profile?.role||'').toLowerCase()==='superadmin';
  const toast=(node,msg,type='')=>{if(!node)return;node.hidden=false;node.className='c3k-v8-status'+(type?` is-${type}`:'');node.textContent=msg;};
  function loadLocalPrefs(){try{return JSON.parse(localStorage.getItem(localPrefsKey)||'{}')||{};}catch{return {};}}
  async function getPrefs(force=false){const local=loadLocalPrefs();if(!client||!session?.user)return local;const syncedAt=Number(localStorage.getItem(localPrefsSyncKey)||0);if(!force&&Object.keys(local).length&&Date.now()-syncedAt<6*60*60*1000)return local;try{const {data,error}=await client.from('user_preferences').select('settings').eq('user_id',session.user.id).maybeSingle();if(error)throw error;const merged={...local,...(data?.settings||{})};localStorage.setItem(localPrefsKey,JSON.stringify(merged));localStorage.setItem(localPrefsSyncKey,String(Date.now()));return merged;}catch(err){console.warn('3615 Bleus · préférences',err);return local;}}
  async function setPrefs(settings){const next={...(settings||{})};localStorage.setItem(localPrefsKey,JSON.stringify(next));localStorage.setItem(localPrefsSyncKey,String(Date.now()));if(!client||!session?.user)return next;const {error}=await client.from('user_preferences').upsert({user_id:session.user.id,settings:next,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;return next;}

  function buildUi(){
    document.body.insertAdjacentHTML('beforeend',`<div class="c3k-v8-panel-backdrop" id="c3kV8AccountBackdrop" hidden><section class="c3k-v8-panel c3k-admin-dashboard" role="dialog" aria-modal="true" aria-label="Administration 3615 Bleus"><header class="c3k-v8-panel-head"><strong id="c3kV8PanelTitle">Administration</strong><button class="c3k-v8-close" id="c3kV8Close" type="button" aria-label="Fermer">×</button></header><div class="c3k-v8-panel-body" id="c3kV8PanelBody"></div></section></div>`);
    $('#c3kV8Close')?.addEventListener('click',closeAccount);
    $('#c3kV8AccountBackdrop')?.addEventListener('pointerdown',e=>{if(e.target.id==='c3kV8AccountBackdrop')closeAccount();});
    const adminLink=$('#adminLoginLink');
    adminLink?.addEventListener('click',e=>{e.preventDefault();openAccount();});
    updateAdminLink();
  }
  function setPanelTitle(txt){const t=$('#c3kV8PanelTitle');if(t)t.textContent=txt;}
  function openAccount(){const b=$('#c3kV8AccountBackdrop');if(!b)return;b.hidden=false;document.body.classList.add('b3k-admin-modal-open');renderAccount();}
  function closeAccount(){const b=$('#c3kV8AccountBackdrop');if(b)b.hidden=true;document.body.classList.remove('b3k-admin-modal-open');}
  function updateAdminLink(){const a=$('#adminLoginLink');if(!a)return;a.textContent=isAdmin()?'Tableau de bord administrateur':'Administration';a.setAttribute('aria-label',isAdmin()?'Ouvrir le tableau de bord administrateur':'Connexion administrateur');}
  function dispatchState(){window.C3K_ACCOUNT_STATE={session,profile,role:profile?.role||'guest'};const can=isAdmin();document.body?.classList.toggle('b3k-can-edit',can);updateAdminLink();window.dispatchEvent(new CustomEvent('c3k:account-state',{detail:window.C3K_ACCOUNT_STATE}));}

  function renderAccount(){
    const body=$('#c3kV8PanelBody');if(!body)return;
    if(!session?.user||!profile){renderAuth();return;}
    if(!isAdmin()){renderUnauthorized();return;}
    setPanelTitle('Tableau de bord administrateur');
    body.innerHTML=`<section class="c3k-admin-identity"><div><strong>${esc(profile.username||profile.first_name||'Administrateur')}</strong><small>${esc(session.user.email||profile.email||'')}</small></div><span class="c3k-v8-role">${esc(roleLabel(profile.role))}</span></section><div class="c3k-v8-menu c3k-admin-menu"><button id="c3kV8Tags" type="button"><span>Tags & étiquettes</span><span>🏷️</span></button><button id="c3kV8Achievements" type="button"><span>Accomplissements</span><span>🏅</span></button><button id="c3kV8Broadcasts" type="button"><span>Chaînes de diffusion</span><span>📺</span></button><button id="c3kV8Equipment" type="button"><span>Équipementiers</span><span>👕</span></button><button id="c3kV8Balls" type="button"><span>Base de données · Ballons</span><span>⚽</span></button><button id="c3kV8ForceDataRefresh" type="button"><span>Rafraîchir les données</span><span>↻</span></button>${isSuperAdmin()?'<button id="c3kV8Admin" type="button"><span>Comptes administrateurs</span><span>🛠</span></button>':''}<button id="c3kV8Logout" type="button"><span>Se déconnecter</span><span>↪</span></button></div>`;
    $('#c3kV8Tags',body)?.addEventListener('click',()=>window.BLEUS3000_TAGS?.open?.());
    $('#c3kV8Achievements',body)?.addEventListener('click',()=>window.BLEUS3000_ACHIEVEMENTS?.open?.());
    $('#c3kV8Broadcasts',body)?.addEventListener('click',()=>window.BLEUS3000_BROADCASTS?.open?.());
    $('#c3kV8Equipment',body)?.addEventListener('click',()=>window.BLEUS3000_EQUIPMENT?.open?.());
    $('#c3kV8Balls',body)?.addEventListener('click',()=>window.BLEUS3000_BALLS?.open?.());
    $('#c3kV8ForceDataRefresh',body)?.addEventListener('click',async()=>{const btn=$('#c3kV8ForceDataRefresh',body),api=window.BLEUS3000_DATA_CACHE;if(!isAdmin()||!api?.forceRefresh)return;if(btn){btn.disabled=true;btn.innerHTML='<span>Rafraîchissement…</span><span>↻</span>';}await api.forceRefresh();location.reload();});
    $('#c3kV8Admin',body)?.addEventListener('click',renderAdmin);
    $('#c3kV8Logout',body)?.addEventListener('click',()=>client?.auth.signOut());
  }
  function renderAuth(){
    const body=$('#c3kV8PanelBody');if(!body)return;setPanelTitle('Connexion administrateur');
    if(!configured()){body.innerHTML='<div class="c3k-v8-status is-error">Supabase n’est pas configuré. La lecture publique reste disponible, mais l’administration nécessite le projet Supabase 3615 Bleus.</div>';return;}
    body.innerHTML=`<p class="c3k-admin-login-copy">Accès réservé aux comptes ADMIN / SUPERADMIN existants.</p><form class="c3k-v8-form" id="c3kV8LoginForm"><label>E-mail<input type="email" name="email" required autocomplete="username" inputmode="email"></label><label>Mot de passe<input type="password" name="password" required autocomplete="current-password"></label><div class="c3k-v8-actions"><button class="c3k-v8-primary" type="submit">Se connecter</button></div></form><div class="c3k-v8-status" id="c3kV8AuthStatus" hidden></div>`;
    $('#c3kV8LoginForm',body)?.addEventListener('submit',login);
  }
  async function login(e){e.preventDefault();const fd=new FormData(e.currentTarget),st=$('#c3kV8AuthStatus');toast(st,'Connexion…');const {error}=await client.auth.signInWithPassword({email:String(fd.get('email')).trim(),password:String(fd.get('password'))});if(error)toast(st,'Connexion impossible. Vérifie les identifiants administrateur.','error');}
  async function renderUnauthorized(){const body=$('#c3kV8PanelBody');setPanelTitle('Accès refusé');body.innerHTML=`<div class="c3k-v8-status is-error">Ce compte n’a pas de droit ADMIN ou SUPERADMIN sur 3615 Bleus.</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="c3kV8UnauthorizedLogout" type="button">Se déconnecter</button></div>`;$('#c3kV8UnauthorizedLogout',body)?.addEventListener('click',()=>client?.auth.signOut());}
  function openAdmin(){openAccount();renderAdmin();}
  async function renderAdmin(){
    const body=$('#c3kV8PanelBody');if(!body||!isSuperAdmin())return renderAccount();setPanelTitle('Comptes administrateurs');
    body.innerHTML='<div class="c3k-v8-muted">Chargement des comptes existants…</div>';
    const {data:users,error}=await client.from('profiles').select('id,first_name,username,email,role').in('role',['admin','superadmin']).order('role').order('username');
    if(error){body.innerHTML=`<div class="c3k-v8-status is-error">${esc(error.message)}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="adminBack" type="button">Retour</button></div>`;$('#adminBack',body)?.addEventListener('click',renderAccount);return;}
    body.innerHTML=`<p class="c3k-v8-muted">Les inscriptions publiques sont désactivées. Ce registre affiche uniquement les comptes administrateurs déjà présents.</p><div class="c3k-v8-admin-list">${(users||[]).map(u=>`<div class="c3k-v8-admin-user"><div><strong>${esc(u.username||u.first_name||'Compte')}</strong><small>${esc(u.email||'')}</small></div><span class="c3k-v8-role">${esc(roleLabel(u.role))}</span></div>`).join('')}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="adminBack" type="button">Retour</button></div>`;
    $('#adminBack',body)?.addEventListener('click',renderAccount);
  }
  async function loadProfile(){
    if(!session?.user){profile=null;dispatchState();return;}
    const {data,error}=await client.from('profiles').select('id,first_name,username,email,role').eq('id',session.user.id).maybeSingle();
    if(error)console.warn('3615 Bleus · profil administrateur',error);
    profile=data||{id:session.user.id,email:session.user.email,role:'user'};
    dispatchState();
  }
  async function handleSession(s,event=''){
    const prevUser=session?.user?.id||null,nextUser=s?.user?.id||null;session=s;
    if(['TOKEN_REFRESHED','SIGNED_IN','INITIAL_SESSION'].includes(event)&&prevUser&&prevUser===nextUser)return;
    await loadProfile();
    const panel=$('#c3kV8AccountBackdrop');if(panel&&!panel.hidden&&prevUser!==nextUser)renderAccount();
  }
  const isJwtTimeError=e=>/jwt\s+(issued\s+at\s+future|expired)|issued\s+at\s+future/i.test(String(e?.message||e||''));
  function clearStoredAuth(){try{const ref=new URL(cfg.SUPABASE_URL).hostname.split('.')[0],exact=`sb-${ref}-auth-token`;localStorage.removeItem(exact);for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(`sb-${ref}-auth-token`))localStorage.removeItem(k);}}catch{}}
  function jwtTemporalState(s){try{const token=String(s?.access_token||''),part=token.split('.')[1];if(!part)return {refresh:false};const b64=part.replace(/-/g,'+').replace(/_/g,'/'),padded=b64+'==='.slice((b64.length+3)%4),payload=JSON.parse(atob(padded)),now=Math.floor(Date.now()/1000),iat=Number(payload.iat||0),exp=Number(payload.exp||0);return {refresh:(iat>now+90)||(exp>0&&exp<=now+90)};}catch{return {refresh:false};}}
  async function sanitizeInitialSession(){const {data,error}=await client.auth.getSession();if(error&&!isJwtTimeError(error))console.warn('3615 Bleus · lecture session',error);let s=data?.session||null;if(!s)return null;if(!jwtTemporalState(s).refresh)return s;const refreshed=await client.auth.refreshSession().catch(e=>({data:null,error:e}));if(!refreshed?.error&&refreshed?.data?.session)return refreshed.data.session;try{await client.auth.signOut({scope:'local'});}catch{}clearStoredAuth();return null;}
  async function init(){
    buildUi();profile=null;session=null;dispatchState();window.BLEUS3000_SUPABASE=null;
    if(configured()){
      client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:window.BLEUS3000_SUPABASE_FETCH||window.fetch.bind(window)}});
      window.BLEUS3000_SUPABASE=client;
      window.dispatchEvent(new CustomEvent('bleus:supabase-ready',{detail:{client,session:null,phase:'client'}}));
      const cleanSession=await sanitizeInitialSession();
      window.dispatchEvent(new CustomEvent('bleus:auth-ready',{detail:{client,session:cleanSession,phase:'session'}}));
      if(cleanSession)await handleSession(cleanSession);else dispatchState();
      client.auth.onAuthStateChange((event,s)=>setTimeout(()=>handleSession(s,event).catch(err=>console.warn('3615 Bleus · auth state',err)),0));
    }
    window.C3K_UI?.hydrate?.();
  }
  window.C3K_ACCOUNT_PREFS={get:getPrefs,set:setPrefs,getLocal:loadLocalPrefs};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
