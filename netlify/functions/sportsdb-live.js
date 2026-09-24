/* Bleus 3000 V1.1.35 — proxy livescore TheSportsDB (clé jamais exposée au navigateur) */
const API='https://www.thesportsdb.com/api/v2/json';
const BUILTIN={'FRA-A-M':[133913],'FRA-ESP-M':[136843,143161],'FRA-U20-M':[152249],'FRA-U19-M':[149863],'FRA-U17-M':[149609],'FRA-A-F':[136801],'FRA-U17-F':[153623]};
const arr=v=>(Array.isArray(v)?v:[v]).map(Number).filter(Number.isFinite).filter(Boolean);
const sbHeaders=(secret)=>{const h={apikey:secret};if(!String(secret).startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;return h;};
exports.handler=async()=>{
  const key=process.env.THESPORTSDB_KEY||process.env.SPORTSDB_KEY;
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key||!url||!secret)return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60'},body:JSON.stringify({livescore:[],configured:false})};
  try{
    const sr=await fetch(`${url.replace(/\/$/,'')}/rest/v1/selection_teams?active=eq.true&select=code,provider_ids`,{headers:sbHeaders(secret)});
    const selections=sr.ok?await sr.json():[];const ids=new Set();
    for(const s of selections){for(const x of arr(BUILTIN[s.code]||[]))ids.add(x);for(const x of arr(s.provider_ids?.thesportsdb||[]))ids.add(x);}
    const r=await fetch(`${API}/livescore/soccer`,{headers:{'X-API-KEY':key,accept:'application/json'}});if(!r.ok)throw new Error(`TheSportsDB ${r.status}`);
    const data=await r.json();const lives=Array.isArray(data?.livescore)?data.livescore:[];
    const filtered=lives.filter(x=>ids.has(Number(x.idHomeTeam))||ids.has(Number(x.idAwayTeam)));
    return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=90, s-maxage=90','Access-Control-Allow-Origin':'*'},body:JSON.stringify({livescore:filtered,updatedAt:new Date().toISOString()})};
  }catch(e){console.error('sportsdb-live',e.message);return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({livescore:[],error:'live unavailable'})};}
};
