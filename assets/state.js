export const MODES = ['mini','small','medium','large'];
export const SIZE_NAMES = {mini:'Mini',small:'Small',medium:'Medium',large:'Large'};
export const HEX_COUNTS = {mini:19,small:37,medium:61,large:91};
export const PREFIX = 'hexly.daily.v1.';
export function dayKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDay(day) {if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false; const [y,m,d]=day.split('-').map(Number); const date=new Date(y,m-1,d,12);return dayKey(date)===day;}
export function shiftDay(day,n) { const [y,m,d]=day.split('-').map(Number);return dayKey(new Date(y,m-1,d+n,12)); }
export function displayDay(day,options={month:'long',day:'numeric',year:'numeric'}) {const [y,m,d]=day.split('-').map(Number);return new Date(y,m-1,d,12).toLocaleDateString(undefined,options);}
export function formatTime(ms) {const s=Math.max(0,Math.floor(ms/1000));return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
export function blankRecord(day,mode){return {day,mode,selected:[],marked:[],precision:false,precisionManuallyChosen:false,precisionFailed:false,precisionAttempted:false,precisionWin:false,startedAt:null,solvedAt:null,elapsedMs:null,moves:0,updatedAt:0};}
export function cleanRecord(input){
 if(!input||!validDay(input.day)||!MODES.includes(input.mode))return null;
 const r=blankRecord(input.day,input.mode);const coord=v=>typeof v==='string'&&/^-?\d,-?\d$/.test(v)&&v.split(',').every(n=>Math.abs(+n)<=5);
 r.selected=Array.isArray(input.selected)?[...new Set(input.selected.filter(coord))].slice(0,91):[];
 r.marked=Array.isArray(input.marked)?[...new Set(input.marked.filter(coord))].filter(k=>!r.selected.includes(k)).slice(0,91):[];
 for(const name of ['precision','precisionManuallyChosen','precisionFailed','precisionAttempted','precisionWin'])r[name]=input[name]===true;
 for(const name of ['startedAt','solvedAt','elapsedMs'])r[name]=Number.isFinite(input[name])&&input[name]>=0?input[name]:null;
 r.moves=Number.isSafeInteger(input.moves)&&input.moves>=0?input.moves:0;r.updatedAt=Number.isFinite(input.updatedAt)?input.updatedAt:0;
 if(r.precisionFailed){r.precision=false;r.precisionWin=false;}if(!r.solvedAt)r.precisionWin=false;
 return r;
}
export function applyPrecisionPreference(record,alwaysOn){
 if(!alwaysOn||record.precision||record.precisionManuallyChosen||record.startedAt!==null||record.solvedAt!==null||record.moves>0||record.precisionFailed)return false;
 record.precision=true;return true;
}
export function summary(records,today=dayKey()){
 const valid=records.filter(r=>r.day<=today&&r.solvedAt);
 const days=[...new Set(valid.map(r=>r.day))].sort(); const precisionDays=[...new Set(valid.filter(r=>r.precisionWin).map(r=>r.day))].sort();
 const streak=arr=>{let cursor=arr.includes(today)?today:shiftDay(today,-1),count=0;const set=new Set(arr);while(set.has(cursor)){count++;cursor=shiftDay(cursor,-1);}return count;};
 const longest=arr=>{let best=0,run=0,prev=null;for(const day of arr){run=prev&&shiftDay(prev,1)===day?run+1:1;best=Math.max(best,run);prev=day;}return best;};
 let ps=streak(precisionDays);
 const todays=records.filter(r=>r.day===today);
 if(!precisionDays.includes(today)&&MODES.every(m=>todays.some(r=>r.mode===m&&r.precisionFailed)))ps=0;
 const bestTimes=Object.fromEntries(MODES.map(mode=>[mode,Math.min(...valid.filter(r=>r.mode===mode&&r.elapsedMs!==null).map(r=>r.elapsedMs))]));
 return {streak:streak(days),precisionStreak:ps,longest:longest(days),total:valid.length,days,precisionDays,bestTimes,todaySolved:valid.filter(r=>r.day===today).length};
}
export class LocalProgress {
 constructor(onError){this.onError=onError;this.memory=new Map();this.failed=false;try{this.storage=window.localStorage;}catch(_){this.report();}}
 report(){this.failed=true;this.onError?.();}
 readRaw(key){try{return this.storage?.getItem(key)??this.memory.get(key)??null;}catch(_){this.report();return this.memory.get(key)??null;}}
 writeRaw(key,value){this.memory.set(key,value);try{if(!this.storage)throw Error('Storage unavailable');this.storage.setItem(key,value);this.failed=false;return true;}catch(_){this.report();return false;}}
 recordKey(day,mode){return PREFIX+'board.'+day+'.'+mode;}
 load(day,mode){try{return cleanRecord(JSON.parse(this.readRaw(this.recordKey(day,mode))))||blankRecord(day,mode);}catch(_){return blankRecord(day,mode);}}
 save(record){record.updatedAt=Date.now();return this.writeRaw(this.recordKey(record.day,record.mode),JSON.stringify(record));}
 all(){const keys=new Set(this.memory.keys());try{for(let i=0;i<(this.storage?.length||0);i++)keys.add(this.storage.key(i));}catch(_){this.report();}return [...keys].filter(k=>k.startsWith(PREFIX+'board.')).map(k=>{try{return cleanRecord(JSON.parse(this.readRaw(k)));}catch(_){return null;}}).filter(Boolean);}
 setting(key,fallback){try{const v=this.readRaw(PREFIX+'setting.'+key);return v===null?fallback:JSON.parse(v);}catch(_){return fallback;}}
 setSetting(key,value){return this.writeRaw(PREFIX+'setting.'+key,JSON.stringify(value));}
 forget(key){this.memory.delete(key);}
 clearAll(){
  //Only remove this game's keys; never clear other data on the same origin.
  let ok=true;const keys=new Set([...this.memory.keys()].filter(key=>key.startsWith(PREFIX)));
  try{for(let i=0;i<(this.storage?.length||0);i++){const key=this.storage.key(i);if(key?.startsWith(PREFIX))keys.add(key);}}
  catch(_){ok=false;}
  for(const key of keys){
   this.memory.delete(key);
   try{this.storage?.removeItem(key);if(this.storage?.getItem(key)!==null&&this.storage)ok=false;}
   catch(_){ok=false;}
  }
  if(ok)this.failed=false;else this.report();
  return ok;
 }
 backup(){return {application:'Hexly Daily',format:1,exportedAt:new Date().toISOString(),records:this.all(),settings:{sound:this.setting('sound',true),precisionAlwaysOn:this.setting('precisionAlwaysOn',false),showPrecisionWarnings:this.setting('showPrecisionWarnings',true)}};}
 restore(data){if(data?.application!=='Hexly Daily'||data.format!==1||!Array.isArray(data.records)||data.records.length>20000)throw Error('Choose a Hexly Daily progress backup.');const records=data.records.map(cleanRecord);if(records.some(r=>!r))throw Error('This backup contains invalid progress.');let count=0;for(const r of records){const old=this.load(r.day,r.mode);if(old.solvedAt&&!r.solvedAt)continue;if(old.solvedAt&&r.solvedAt){if(old.updatedAt>=r.updatedAt)continue;}else if(old.updatedAt>r.updatedAt)continue;this.save(r);count++;}for(const key of ['sound','precisionAlwaysOn','showPrecisionWarnings'])if(typeof data.settings?.[key]==='boolean')this.setSetting(key,data.settings[key]);return count;}
}

// HomeShare.swift sums each displayed whole-second time, avoiding fractional carry.
export function dailySummary(records,day) {
 const solved=MODES.map(mode=>records.find(r=>r.day===day&&r.mode===mode&&r.solvedAt)).filter(Boolean);
 const fastest=solved.reduce((best,r)=>!best||(r.elapsedMs??Infinity)<(best.elapsedMs??Infinity)?r:best,null);
 return {count:solved.length,complete:solved.length===4,fastest,totalMs:solved.length===4?solved.reduce((sum,r)=>sum+Math.floor((r.elapsedMs||0)/1000)*1000,0):null};
}
export function mondayOfWeek(day) {
 const [y,m,d]=day.split('-').map(Number),weekday=new Date(y,m-1,d,12).getDay();
 return shiftDay(day,-((weekday+6)%7));
}

// Reading a history day never changes the active puzzle or writes progress.
export function weekHistory(records,today=dayKey()) {
 const monday=mondayOfWeek(today);
 return Array.from({length:7},(_,i)=>{
  const day=shiftDay(monday,i),entries=records.filter(r=>r.day===day);
  return {day,...dailySummary(entries,day),played:entries.some(r=>r.startedAt!==null||r.solvedAt||r.moves>0||r.selected.length||r.marked.length)};
 });
}
