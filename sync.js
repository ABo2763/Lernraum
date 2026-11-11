/* Lernraum-Sync: saves still happen locally. Cloud updates are conservative. */
(()=>{'use strict';
const K='lernraum-cloud-config', STATE='lernraum-cloud-state', DATA={cards:'lernraum-v1',plan:'lernraum-wiederholungsplan-v1'};
const cfg=()=>{try{return JSON.parse(localStorage.getItem(K))||{}}catch{return {}}};
const state=()=>{try{return JSON.parse(localStorage.getItem(STATE))||{}}catch{return {}}};
const writeState=s=>localStorage.setItem(STATE,JSON.stringify(s));
let db=null,user=null,busy=false,timer=null;
function status(t){const el=document.getElementById('syncStatus');if(el)el.textContent=' · '+t;window.dispatchEvent(new CustomEvent('lernraum-sync-status',{detail:t}));}
function localData(kind){try{return JSON.parse(localStorage.getItem(DATA[kind]))}catch{return null}}
function meaningful(kind,p){return kind==='cards'?!!p?.decks?.length:!!p?.topics?.length}
function setDirty(kind){const s=state();if(!s[kind])s[kind]={revision:null,dirty:true};else s[kind].dirty=true;writeState(s);status('Änderung noch nicht synchronisiert');schedule()}
window.addEventListener('lernraum-local-change',e=>{if(e.detail in DATA)setDirty(e.detail)});
async function client(){const c=cfg();if(!c.url||!c.key)return null;if(!window.supabase){status('Cloud-Bibliothek konnte nicht geladen werden');return null}if(!db)db=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return db;}
async function getUser(){const c=await client();if(!c)return null;const r=await c.auth.getUser();user=r.data?.user||null;if(user){const last=localStorage.getItem('lernraum-cloud-last-user');if(last&&last!==user.id){localStorage.removeItem(STATE);status('Anderes Konto: bitte Erstabgleich prüfen')}localStorage.setItem('lernraum-cloud-last-user',user.id)}return user}
async function remote(kind){const {data,error}=await db.from('lernraum_sync').select('revision,payload').eq('kind',kind).maybeSingle();if(error)throw error;return data}
async function syncKind(kind,mode='auto'){
 const p=localData(kind),s=state(),base=s[kind]||{},r=await remote(kind);
 if(mode==='download'){
  if(!r)throw Error('Für diesen Bereich liegen noch keine Cloud-Daten vor.');
  if(meaningful(kind,p)&&!confirm('Lokale '+(kind==='cards'?'Karteikarten':'Planung')+' durch den Cloud-Stand ersetzen? Erstelle vorher bei Bedarf ein JSON-Backup.'))return;
  localStorage.setItem(DATA[kind],JSON.stringify(r.payload));s[kind]={revision:r.revision,dirty:false};writeState(s);return 'reload';
 }
 if(mode==='upload'){
  if(!p||!meaningful(kind,p))throw Error('Hier sind noch keine lokalen Daten zum Hochladen.');
  if(r&&!confirm('Vorhandene Cloud-Daten für '+(kind==='cards'?'Karten':'Wiederholungsplan')+' durch diesen Gerätestand ersetzen? Dadurch können Änderungen vom anderen Gerät verloren gehen.'))return;
  let next=crypto.randomUUID();
  if(r){let {data,error}=await db.from('lernraum_sync').update({payload:p,revision:next,updated_at:new Date().toISOString()}).eq('kind',kind).eq('revision',r.revision).select('revision');if(error)throw error;if(!data?.length)throw Error('Zwischenzeitliche Änderung auf anderem Gerät. Bitte neu laden.');}
  else{let {error}=await db.from('lernraum_sync').insert({kind,payload:p,revision:next});if(error)throw error;}
  s[kind]={revision:next,dirty:false};writeState(s);return;
 }
 // First connection: never overwrite a populated device or a populated cloud automatically.
 if(!base.revision){
  if(r&&!meaningful(kind,p)){localStorage.setItem(DATA[kind],JSON.stringify(r.payload));s[kind]={revision:r.revision,dirty:false};writeState(s);return 'reload'}
  if(r||meaningful(kind,p)){status('Erstabgleich benötigt Auswahl unter Synchronisierung');return}
  return;
 }
 if(!r){status('Cloud-Stand fehlt – bitte Synchronisierung öffnen');return}
 if(r.revision!==base.revision){
  if(base.dirty){status('Konflikt: beide Geräte geändert – bitte Synchronisierung öffnen');return}
  localStorage.setItem(DATA[kind],JSON.stringify(r.payload));s[kind]={revision:r.revision,dirty:false};writeState(s);return 'reload';
 }
 if(base.dirty){
  if(!p)return;
  const next=crypto.randomUUID();const {data,error}=await db.from('lernraum_sync').update({payload:p,revision:next,updated_at:new Date().toISOString()}).eq('kind',kind).eq('revision',base.revision).select('revision');if(error)throw error;
  if(!data?.length){status('Konflikt – bitte Synchronisierung öffnen');return}
  s[kind]={revision:next,dirty:false};writeState(s);
 }
}
async function syncAll(mode,kind){if(busy)return;busy=true;try{
 if(!await getUser()){status('Nicht angemeldet');return}
 const kinds=kind?[kind]:['cards','plan'];let reload=false;
 for(const item of kinds){const ret=await syncKind(item,mode);if(ret==='reload')reload=true}
 status('Cloud verbunden · Stand '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
 if(reload){if(document.visibilityState==='visible'&&document.querySelector('input:focus,textarea:focus,[contenteditable="true"]:focus'))status('Neue Daten geladen – Seite bitte neu laden');else location.reload()}
 }catch(e){console.error('Lernraum-Sync',e);status('Fehler: '+(e.message||e));if(mode!=='auto')alert('Synchronisierung: '+e.message)}finally{busy=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>syncAll('auto'),1700)}
window.LernraumCloud={cfg,state,getUser,syncAll,client,status,resetClient(){db=null}};
setTimeout(()=>syncAll('auto'),700);setInterval(()=>syncAll('auto'),30000);
})();
