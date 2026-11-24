// Read-only catalogue; no peer endpoint is called and no received HTML is executed.
export function validateCatalog(x) {
  if (!x || x.schema !== "janus.ark.federation_catalog.v1" ||
      x.status !== "RESEARCH_SNAPSHOT_NOT_LIVE" ||
      typeof x.snapshot_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.snapshot_date)) throw Error("Invalid catalogue");
  const groups = [x.local_nodes, x.verified_external_peers, x.candidates];
  const ids = new Set();
  for (const list of groups) {
    if (!Array.isArray(list) || list.length > 100) throw Error("Invalid group");
    for (const n of list) {
      if (!n || !["id","name","role","state"].every(k => typeof n[k] === "string" && n[k].length > 0 && n[k].length <= 240) || ids.has(n.id)) throw Error("Invalid node");
      ids.add(n.id);
      for (const k of ["url","evidence"]) if (n[k] !== undefined && !safeLink(n[k])) throw Error("Invalid link");
    }
  }
  if (x.candidates.some(n => n.state !== "NOT_CONNECTED")) throw Error("Invalid candidate status");
  if (x.verified_external_peers.some(n => n.state !== "VERIFIED_RECEIPT_SNAPSHOT" || !n.evidence)) throw Error("Missing peer evidence");
  return x;
}
export function safeLink(v) {
  try {const u = new URL(v);return u.protocol === "https:" && u.hostname === "github.com" && !u.username && !u.password && !u.port && typeof v === "string" && v.length <= 400;}
  catch {return false;}
}
export function freshness(date, now = Date.now()) {
  const t = Date.parse(date+"T00:00:00Z");
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10) !== date || t > now) return "Дата снимка не подтверждена";
  return now-t > 86400000*7 ? "Устаревший снимок · текущая доступность неизвестна" : "Датированный снимок · текущая доступность неизвестна";
}
function mount() {
  const get = id => document.getElementById(id);
  const btn=get("refresh"), status=get("catalog-status");
  function item(tag,text,cls) { const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e; }
  function render(list,id,empty) {
    const root=get(id);root.replaceChildren();
    if (!list.length) {root.append(item("p",empty,"muted"));return;}
    for (const n of list) {
      const card=item("article","","node");card.append(item("h3",n.name),item("p",n.role),item("p",n.state,"status"));
      for(const [key,label] of [["url","Репозиторий ↗"],["evidence","Свидетельство ↗"]]) if(n[key] && safeLink(n[key])) {
        const a=item("a",label);a.href=n[key];a.target="_blank";a.rel="noopener noreferrer";
        const p=item("p","");p.append(a);card.append(p);
      }
      root.append(card);
    }
  }
  function clear() {
    for(const id of ["local-count","peer-count","candidate-count"])get(id).textContent="—";
    for(const id of ["local-list","peer-list","candidate-list"])get(id).replaceChildren();
  }
  async function refresh() {
    btn.disabled=true;clear();status.textContent="Проверяем снимок…";
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
    try {
      const r=await fetch(new URL("../federation-catalog.json",import.meta.url),{cache:"no-store",signal:ctrl.signal,credentials:"same-origin",redirect:"error"});
      if(!r.ok)throw Error("HTTP");
      const raw=await r.text();if(raw.length>100000)throw Error("Size");
      const x=validateCatalog(JSON.parse(raw));
      get("local-count").textContent=String(x.local_nodes.length);
      get("peer-count").textContent=String(x.verified_external_peers.length);
      get("candidate-count").textContent=String(x.candidates.length);
      render(x.local_nodes,"local-list","Нет описанных узлов");
      render(x.verified_external_peers,"peer-list","В опубликованном снимке нет подтверждённых внешних партнёров.");
      render(x.candidates,"candidate-list","Нет кандидатов");
      status.textContent=x.snapshot_date+" · "+freshness(x.snapshot_date);
    } catch {clear();status.textContent="Каталог недоступен или не прошёл проверку. Текущее состояние неизвестно.";}
    finally {clearTimeout(timer);btn.disabled=false;}
  }
  btn.addEventListener("click",refresh);refresh();
}
if(typeof document!=="undefined")mount();
