const ALLOWED = new Set([
  'fixtures','fixtures/players','players','players/squads','teams','leagues','standings','injuries','transfers'
]);
const API_BASE = 'https://v3.football.api-sports.io';
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({error:'Méthode non autorisée'}) };
  const key = process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY;
  if (!key) return { statusCode: 503, body: JSON.stringify({error:'API_FOOTBALL_KEY non configurée'}) };
  const raw = String(event.queryStringParameters?.path || '').replace(/^\/+|\/+$/g,'');
  if (!ALLOWED.has(raw)) return { statusCode: 400, body: JSON.stringify({error:'Endpoint non autorisé'}) };
  const params = new URLSearchParams();
  for (const [k,v] of Object.entries(event.queryStringParameters || {})) if (k !== 'path' && v != null) params.set(k,String(v));
  const url = `${API_BASE}/${raw}${params.size ? `?${params}` : ''}`;
  try {
    const res = await fetch(url,{headers:{'x-apisports-key':key,'accept':'application/json'}});
    const body = await res.text();
    return {statusCode:res.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=90, s-maxage=300'},body};
  } catch (e) {
    return {statusCode:502,body:JSON.stringify({error:'Fournisseur football indisponible'})};
  }
};
