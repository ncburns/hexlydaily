import {shareModel,shareText,renderShareCard} from './share.js';
import {howToExampleMarkup,mountHowToExample} from './tutorial.js?v=2';
import {copy} from './native-copy.js';
import {CompletionSequence,completionTiming,unlockTiming,DAY_COMPLETE_DELAY} from './completion.js';
import {Board} from './board.js';
import {makeSounds} from './audio.js';
import {LocalProgress,MODES,SIZE_NAMES,applyPrecisionPreference,PREFIX,dayKey,displayDay,formatTime,summary,dailySummary,weekHistory} from './state.js';
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=new LocalProgress(()=>{$('save-warning').hidden=false;$('save-label').textContent='Saving is unavailable in this browser.';});
let currentDay=dayKey(),mode=MODES.includes(new URLSearchParams(location.search).get('size'))?new URLSearchParams(location.search).get('size'):store.setting('lastSize','mini');
if(!MODES.includes(mode))mode='mini';
let record=null,puzzle=null,loadNumber=0,loading=true,toastTimer,worker,dialogAfterClose=null,confettiTimer,dayTimer;
const completionSequence=new CompletionSequence(),unlockSequence=new CompletionSequence();let completionPending=false,pendingUnlock=null,dayBannerPending=false,selectedHistoryDay=dayKey();
const cache=new Map(),pending=new Map();let workerId=0;
const sound=makeSounds(state=>{$('audio-notice').hidden=state!=='blocked';$('sound-button').title=state==='blocked'?'Retry sound effects':state==='muted'?'Enable sound effects':'Mute sound effects';});
let soundEnabled=store.setting('sound',true)!==false;
if(!soundEnabled)sound.toggle();$('sound-button').setAttribute('aria-pressed',String(soundEnabled));
const board=new Board($('board'),$('board-viewport'),handleAction);
function notify(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},3500);}
function persist(){if(!record)return;if(store.save(record)){$('save-label').textContent='Progress saved in this browser.';$('save-warning').hidden=true;}}
function newWorker(){try{worker=new Worker(new URL('./puzzle-worker.js',import.meta.url),{type:'module'});worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;clearTimeout(p.timeout);pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.puzzle);};worker.onerror=()=>{for(const p of pending.values()){clearTimeout(p.timeout);p.reject(Error('Worker unavailable'));}pending.clear();worker.terminate();worker=null;};}catch(_){worker=null;}}
async function loadPuzzle(day,size){const key=day+'|'+size;if(cache.has(key))return cache.get(key);if(!worker)newWorker();let result;
 if(worker){try{result=await new Promise((resolve,reject)=>{const id=++workerId,timeout=setTimeout(()=>{pending.delete(id);reject(Error('Puzzle preparation timed out'));},12000);pending.set(id,{resolve,reject,timeout});worker.postMessage({id,day,mode:size});});}catch(_){worker?.terminate();worker=null;}}
 if(!result){const {generateDaily}=await import('./generator.mjs');const {solution,...data}=generateDaily(size,day);result=data;}
 cache.set(key,result);return result;
}
function sizeGraphic(index){let polygons='';const points=(cx,cy,r)=>Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return `${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`;}).join(' ');const radius=index+1,cell=12/(radius+1);for(let r=-radius;r<=radius;r++)for(let q=-radius;q<=radius;q++){if(Math.abs(q+r)>radius)continue;polygons+=`<polygon points="${points(22+Math.sqrt(3)*cell*(q+r/2),24+1.5*cell*r,cell*.83)}"/>`;}return `<svg class="size-graphic" viewBox="0 0 44 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width=".8">${polygons}</svg>`;}
function createSizes(){$('size-list').innerHTML=MODES.map((m,i)=>`<button class="size-button" data-size="${m}" aria-pressed="false">${sizeGraphic(i)}<span class="size-label"><strong>${SIZE_NAMES[m]}</strong><small data-size-state></small></span><span class="done-icon" aria-hidden="true"></span></button>`).join('');document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>openBoard(b.dataset.size)));}
function icon(name,extra=''){return `<img class="native-icon ${extra}" src="assets/${name}.svg${name==='flame'?'?v=2':''}" alt="">`;}
function bestMarkup(s,records){return MODES.map(m=>{const best=records.find(r=>r.mode===m&&r.solvedAt&&r.elapsedMs===s.bestTimes[m]);return `<div><dt>${SIZE_NAMES[m]} - ${best?formatTime(best.elapsedMs):'—'}</dt><dd>${best?escapeHTML(displayDay(best.day,{month:'numeric',day:'numeric',year:'2-digit'})):''}</dd></div>`;}).join('');}
function resultsMarkup(day){return MODES.map(m=>{const r=store.load(day,m),state=r.solvedAt?(r.precisionWin?'precision':'normal'):'pending',time=r.solvedAt?formatTime(r.elapsedMs||0):'—',label=`${SIZE_NAMES[m]}: ${r.solvedAt?time+(r.precisionWin?', completed in Precision Mode':', completed in Normal Mode'):'not completed'}`;
 return `<div class="daily-run ${state}" data-result-size="${m}" role="img" aria-label="${escapeHTML(label)}"><svg class="run-hex" viewBox="0 0 86.60254 100" aria-hidden="true"><polygon points="43.30127,2 84.87049,26 84.87049,74 43.30127,98 1.73205,74 1.73205,26" vector-effect="non-scaling-stroke"/></svg><div class="run-content" aria-hidden="true"><span>${SIZE_NAMES[m]}</span><strong>${time}</strong><i>${state==='precision'?icon('scope-bright'):state==='normal'?'<b class="normal-dot"></b>':''}</i></div></div>`;
 }).join('');}
function visibleSummaryRecords(){return store.all().map(r=>pendingUnlock&&r.day===pendingUnlock.day&&r.mode===pendingUnlock.mode?{...r,solvedAt:null,elapsedMs:null,precisionWin:false}:r);}
function refreshSummary(){if(completionPending)return;const records=store.all(),visible=visibleSummaryRecords(),s=summary(visible,dayKey()),d=dailySummary(visible,currentDay);
 $('today-count').textContent=d.complete&&!dayBannerPending?'Day Complete!':`${d.count}/4 Complete`;$('today-count').classList.toggle('day-complete',d.complete&&!dayBannerPending);
 $('daily-progress-hexes').setAttribute('aria-label',`${d.count} of 4 daily puzzles complete`);$('daily-progress-hexes').querySelectorAll('svg').forEach((hex,i)=>hex.classList.toggle('filled',i<d.count));
 document.querySelectorAll('[data-size]').forEach(b=>{const r=store.load(currentDay,b.dataset.size);b.setAttribute('aria-pressed',String(b.dataset.size===mode));b.querySelector('[data-size-state]').textContent=r.solvedAt?formatTime(r.elapsedMs||0):'';b.querySelector('.done-icon').innerHTML=r.solvedAt?(r.precisionWin?icon('scope'):'✓'):'';});
 $('best-times-list').innerHTML=bestMarkup(s,records);$('streak').textContent=s.streak;$('precision-streak').textContent=s.precisionStreak;
 refreshHistory(records);applyUnlockAppearance();
}
//Match HomeCards.swift's one-time launch highlight for completed daily hexes.
function animateSavedProgress(){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 $('daily-progress-hexes').querySelectorAll('svg.filled').forEach((hex,i)=>{
  hex.style.setProperty('--intro-delay',`${200+i*235}ms`);
  hex.classList.add('progress-intro');
  hex.addEventListener('animationend',()=>hex.classList.remove('progress-intro'),{once:true});
 });
}
function weekMarkup(records){return weekHistory(records).map(({day,count,played})=>{
 const selected=day===selectedHistoryDay,today=day===dayKey();
 return `<button type="button" class="week-day ${count?'complete':''} ${played?'played':''} ${today?'today':''} ${selected?'selected':''}" data-history-day="${day}" aria-pressed="${selected}" ${today?'aria-current="date"':''} aria-label="${escapeHTML(displayDay(day))}: ${count} of 4 solved"><span>${escapeHTML(displayDay(day,{weekday:'narrow'}))}</span><svg class="week-hex" viewBox="0 0 26 30" aria-hidden="true"><polygon points="13,1 25,8 25,22 13,29 1,22 1,8"/>${today&&!count?'<circle cx="13" cy="15" r="1.5"/>':''}</svg></button>`;
 }).join('');}
function refreshHistory(records=store.all()){
 if(!weekHistory(records).some(d=>d.day===selectedHistoryDay))selectedHistoryDay=dayKey();
 const d=dailySummary(records,selectedHistoryDay);
 $('week').innerHTML=weekMarkup(records);$('history-date').textContent=displayDay(selectedHistoryDay,{month:'short',day:'numeric',year:'numeric'});$('history-date').dateTime=selectedHistoryDay;$('history-count').textContent=`${d.count}/4 solved`;
 $('daily-results').innerHTML=resultsMarkup(selectedHistoryDay);$('total-time').hidden=!d.complete;$('total-time-value').textContent=d.complete?formatTime(d.totalMs):'';
 applyUnlockAppearance();
}
function bindHistory(element){element.addEventListener('click',event=>{
 const button=event.target.closest('[data-history-day]');if(!button||!element.contains(button))return;
 const day=button.dataset.historyDay;if(!weekHistory(store.all()).some(d=>d.day===day))return;
 selectedHistoryDay=day;refreshHistory();element.querySelector(`[data-history-day="${day}"]`)?.focus({preventScroll:true});
 });}

function updateClock(){const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);$('countdown').textContent=formatTime(next-now);
 $('today-date').textContent=displayDay(dayKey(),{weekday:'long',month:'short',day:'numeric'});$('today-date').dateTime=dayKey();
 if(record){$('timer').textContent=formatTime(record.solvedAt?record.elapsedMs||0:record.startedAt?Math.max(0,Date.now()-record.startedAt):0);$('timer').setAttribute('aria-label',record.solvedAt?'Completed solve time':'Elapsed solve time');}
 if(dayKey()!==currentDay)$('new-day').hidden=false;
}
function refreshGame({celebrate=false,revealKeys=[]}={}){if(completionPending||!record||!puzzle)return;board.update(record,{celebrate,revealKeys});$('game').classList.toggle('is-solved',!!record.solvedAt&&!$('game').classList.contains('is-completing'));
 $('precision-button').setAttribute('aria-pressed',String(record.precision));$('precision-button').disabled=!!record.solvedAt||record.precisionFailed;
 $('precision-button').title=record.precisionFailed?'Precision is disabled for this attempt':record.startedAt?'Cannot change mode mid-game':record.precision?'Disable Precision Mode':'Enable Precision Mode';
 $('reset-button').hidden=!!record.solvedAt;$('reset-button').disabled=!!record.solvedAt||record.precision&&record.precisionAttempted;
 $('completion').hidden=!record.solvedAt;
 if(record.solvedAt){$('next-size').hidden=!nextUnsolved();$('next-size').textContent='Next Puzzle';}
 updateZoom();updateClock();refreshSummary();
}
function nextUnsolved(){const start=MODES.indexOf(mode);for(let i=1;i<=4;i++){const m=MODES[(start+i)%4];if(!store.load(currentDay,m).solvedAt)return m;}return null;}
async function openBoard(size,remember=true){cancelCompletion();mode=size;if(remember)store.setSetting('lastSize',mode);const request=++loadNumber;loading=true;$('precision-button').disabled=true;record=null;puzzle=null;clearTimeout(confettiTimer);if(!pendingUnlock?.started)sound.stop();$('game').classList.remove('is-celebrating','is-solved');$('completion').hidden=true;$('loading').hidden=false;$('loading-text').textContent='Preparing your daily puzzle…';$('retry-load').hidden=true;$('board-title').textContent=SIZE_NAMES[size];$('timer').textContent='0:00';$('timer').setAttribute('aria-label','Elapsed solve time');refreshSummary();
 try{const data=await loadPuzzle(currentDay,size);if(request!==loadNumber)return;puzzle=data;record=store.load(currentDay,size);if(applyPrecisionPreference(record,store.setting('precisionAlwaysOn',false)))persist();const clueKeys=new Set(puzzle.clues.map(([q,r])=>q+','+r));const valid=new Set(puzzle.cells.filter(([q,r])=>!clueKeys.has(q+','+r)).map(([q,r])=>q+','+r));record.selected=record.selected.filter(k=>valid.has(k));record.marked=record.marked.filter(k=>valid.has(k));board.render(puzzle);if(record.solvedAt&&!board.evaluate(record).solved){record.solvedAt=null;record.elapsedMs=null;record.precisionWin=false;persist();}loading=false;$('loading').hidden=true;updateZoom();refreshGame();if(pendingUnlock&&!pendingUnlock.started)startDailyUnlock();
 }catch(error){if(request!==loadNumber)return;$('loading-text').textContent='The puzzle couldn’t load. Please try again.';$('retry-load').hidden=false;console.error('Puzzle preparation failed',error);if(pendingUnlock&&!pendingUnlock.started)startDailyUnlock();}
}
function handleAction(type,key,cell){if(type==='unlock'){sound.unlock();return;}if(loading||!record||record.solvedAt)return;sound.unlock();record.startedAt??=Date.now();
 if(type==='mark'){
  if(record.selected.includes(key)){persist();notify('Clear the hex first');return;}
  if(record.marked.includes(key)){record.marked=record.marked.filter(k=>k!==key);sound.play('clearMark');}
  else{record.marked.push(key);sound.play('mark');board.animate(cell,'mark');}
 }else{
  if(record.marked.includes(key)){persist();notify('Clear mark first');return;}
  if(record.selected.includes(key)){if(record.precision){persist();notify('No undo in Precision Mode');return;}record.selected=record.selected.filter(k=>k!==key);sound.play('deactivate');}
  else{record.selected.push(key);if(record.precision)record.precisionAttempted=true;sound.play('activate',1+Math.min(record.selected.length/puzzle.solutionSize,1)*.08);board.animate(cell,'select');}
  record.moves++;
 }
 const result=board.evaluate(record);
 if(record.precision&&result.over){record.precisionFailed=true;record.precision=false;record.selected=[];record.marked=[];persist();refreshGame();showPrecisionFailure();return;}
 let celebrate=false,revealKeys=[],personalBest=false,completedDay=false;
 if(result.solved){record.solvedAt=Date.now();record.elapsedMs=Math.max(0,record.solvedAt-record.startedAt);record.precisionWin=record.precision;
  const best=summary(store.all(),currentDay).bestTimes[mode];personalBest=Math.floor(record.elapsedMs/1000)<Math.floor(best/1000);
  const priorMarks=new Set(record.marked);record.marked=board.choices.map(c=>board.key(c)).filter(k=>!record.selected.includes(k));revealKeys=record.marked.filter(k=>!priorMarks.has(k));celebrate=true;
 }
 persist();
 if(celebrate){completedDay=dailySummary(store.all(),currentDay).complete;startCompletion(revealKeys,personalBest,completedDay);}
 else refreshGame();
}
function clearUnlockAppearance(){
 document.querySelectorAll('.progress-intro').forEach(hex=>hex.classList.remove('progress-intro'));
 document.querySelectorAll('.unlock-fill,.unlock-flash,.unlock-settle,.precision-waiting,.precision-revealing,.precision-pop,.precision-settle').forEach(el=>el.classList.remove('unlock-fill','unlock-flash','unlock-settle','precision-waiting','precision-revealing','precision-pop','precision-settle'));
}
function applyUnlockAppearance(){
 const u=pendingUnlock;if(!u)return;
 const hex=$('daily-progress-hexes').querySelectorAll('svg')[u.index];
 if(hex&&u.day===currentDay){hex.classList.add('unlock-fill');hex.classList.toggle('filled',u.phase!=='waiting');hex.classList.toggle('unlock-flash',u.phase==='flash');hex.classList.toggle('unlock-settle',u.phase==='settle');}
 if(u.precision){
  const targets=[...document.querySelectorAll(`[data-size="${u.mode}"] .done-icon .native-icon`),...(selectedHistoryDay===u.day?document.querySelectorAll(`[data-result-size="${u.mode}"] .native-icon`):[])];
  targets.forEach(el=>{el.style.setProperty('--precision-fade',u.timing.fadeDuration+'ms');el.classList.toggle('precision-waiting',!u.badge);el.classList.toggle('precision-revealing',u.badge);el.classList.toggle('precision-pop',u.pop==='out');el.classList.toggle('precision-settle',u.pop==='settle');});
 }
}
function finishUnlock(){
 if(!pendingUnlock)return;const complete=pendingUnlock.completedDay;pendingUnlock=null;unlockSequence.cancel();clearUnlockAppearance();refreshSummary();if(complete)celebrateDay();
}
function startDailyUnlock(){
 const u=pendingUnlock;if(!u||u.started)return;u.started=true;refreshSummary();
 const guarded=fn=>()=>{if(pendingUnlock===u)fn();};
 const t=u.timing;
 unlockSequence.start([
  [t.fillAt,guarded(()=>{u.phase='fill';applyUnlockAppearance();})],
  [t.flashAt,guarded(()=>{u.phase='flash';applyUnlockAppearance();})],
  [t.settleAt,guarded(()=>{u.phase='settle';sound.play('dailyUnlockSettle');if(u.precision){u.badge=true;sound.play('precisionBadgeReveal');}applyUnlockAppearance();})],
  ...(u.precision?[
   [t.popAt,guarded(()=>{u.pop='out';applyUnlockAppearance();})],
   [t.popSettleAt,guarded(()=>{u.pop='settle';applyUnlockAppearance();})]
  ]:[]),
  [t.finishAt,guarded(finishUnlock)]
 ]);
}
function cancelCompletion(){completionSequence.cancel();completionPending=false;$('game').classList.remove('is-completing','is-celebrating');delete $('game').dataset.completionPhase;}
function startCompletion(revealKeys,personalBest,completedDay){
 finishUnlock();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,timing=completionTiming(revealKeys.length,reduced),solvedRecord=record,request=loadNumber;
 pendingUnlock={day:currentDay,mode,precision:record.precisionWin,completedDay,index:dailySummary(store.all(),currentDay).count-1,phase:'waiting',badge:false,pop:null,started:false,timing:unlockTiming(record.precisionWin,sound.duration('dailyUnlockSettle'),sound.duration('precisionBadgeReveal'))};
 dayBannerPending=completedDay;
 completionPending=true;$('game').classList.add('is-completing');$('game').dataset.completionPhase='reveal';
 board.update(record,{celebrate:!reduced,revealKeys,revealInterval:timing.revealInterval});updateZoom();updateClock();$('reset-button').hidden=true;$('precision-button').disabled=true;
 const guarded=fn=>()=>{if(record===solvedRecord&&request===loadNumber)fn();};
 completionSequence.start([
  [timing.popupAt,guarded(()=>{
   completionPending=false;$('game').classList.remove('is-completing');$('game').dataset.completionPhase='popup';
   refreshGame();if(!reduced)$('game').classList.add('is-celebrating');sound.play('solved');showSolved(personalBest,completedDay);
  })],
  [timing.finishAt,guarded(()=>{$('game').classList.remove('is-celebrating');$('game').dataset.completionPhase='complete';})]
 ]);
}

function setMode(precision){if(!record||loading||record.startedAt||record.solvedAt||precision&&record.precisionFailed)return;const changed=record.precision!==precision;record.precision=precision;record.precisionManuallyChosen=true;persist();refreshGame();if(changed)sound.play(precision?'precisionToggle':'cardClick');}
function showDialog(title,body,kind='',afterClose=null){
 if(dialogAfterClose){const fn=dialogAfterClose;dialogAfterClose=null;fn();}
 clearTimeout(confettiTimer);$('dialog').className=kind;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;dialogAfterClose=afterClose;if(!$('dialog').open)$('dialog').showModal();if(kind==='solved-dialog'){$('dialog').getAnimations().forEach(animation=>animation.cancel());if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('dialog').animate([{opacity:0,transform:'translateY(10px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});}
}
function closeDialog(){clearTimeout(confettiTimer);$('dialog').querySelectorAll('.confetti').forEach(el=>el.remove());$('dialog').close();const fn=dialogAfterClose;dialogAfterClose=null;fn?.();}
function showSolved(personalBest,completedDay){const next=nextUnsolved();
 showDialog('Solved!',`<div class="solved-time">${formatTime(record.elapsedMs||0)}</div>${personalBest?'<p class="personal-best">Personal Best!</p>':''}<div class="dialog-actions"><button class="button primary" id="solved-continue">${next?'Next Puzzle':'Continue'}</button></div>`,'solved-dialog',startDailyUnlock);
 $('solved-continue').onclick=()=>{if(next){dialogAfterClose=null;closeDialog();openBoard(next);}else closeDialog();};
 if(completedDay)confettiTimer=setTimeout(()=>{if($('dialog').open&&$('dialog').classList.contains('solved-dialog'))confetti();},sound.duration('solved'));
}
function confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const host=document.createElement('div');host.className='confetti';host.setAttribute('aria-hidden','true');
 for(let i=0;i<28;i++){const particle=document.createElement('i'),angle=Math.random()*Math.PI*2,d=80+Math.random()*90,size=5+Math.random()*4;particle.style.cssText=`--dx:${Math.cos(angle)*d}px;--dy:${Math.sin(angle)*d+95}px;--spin:${Math.random()*360}deg;--delay:${Math.random()*.08}s;width:${size}px;height:${size*1.4}px`;host.append(particle);}
 $('dialog').append(host);setTimeout(()=>host.remove(),1700);
}
function celebrateDay(){const day=currentDay;if(!dailySummary(store.all(),day).complete||store.setting('dayCompleteSeen.'+day,false))return;
 store.setSetting('dayCompleteSeen.'+day,true);clearTimeout(dayTimer);dayTimer=setTimeout(()=>{if(day!==currentDay)return;dayBannerPending=false;refreshSummary();sound.play('dayComplete');$('today-count').classList.add('celebrate-day');setTimeout(()=>$('today-count').classList.remove('celebrate-day'),700);},DAY_COMPLETE_DELAY);
}
function showPrecisionFailure(){const next=MODES.find(m=>m!==mode&&!store.load(currentDay,m).solvedAt&&!store.load(currentDay,m).precisionFailed);
 sound.play('precisionFail');showDialog(copy.precisionFailed,`<p>${next?copy.precisionRetry:copy.precisionExhausted}</p><div class="dialog-actions">${next?'<button class="button primary" id="try-another">Try Another Size</button>':''}<button class="button ${next?'quiet':'primary'}" id="continue-normal">Complete in Normal Mode</button><button class="button quiet" id="precision-exit">Exit</button></div>`,'precision-dialog');
 $('continue-normal').onclick=()=>{closeDialog();notify('Switched to Normal Mode');};$('precision-exit').onclick=()=>{closeDialog();document.querySelector('[data-size="'+mode+'"]').focus();};if(next)$('try-another').onclick=()=>{closeDialog();openBoard(next);};
}
function showHelp(){showDialog('How to play',`<p>${copy.howToClick}</p><p>${copy.howToMark}</p><p>${copy.howToNumber}</p><ul class="rule-list"><li class="green-copy">${copy.green}</li><li class="yellow-copy">${copy.yellow}</li></ul><h3>How to win</h3><p>${copy.howToWin}</p>${howToExampleMarkup()}<h3>What the colors mean</h3><dl class="color-meanings"><dt>Glowing hex</dt><dd>A hex you've clicked on</dd><dt>Marked hex</dt><dd>A space you marked as unused. It is a note and does not count toward solving.</dd><dt>Green number</dt><dd>The right amount of glowing hexes are touching it</dd><dt>Yellow number</dt><dd>Too many glowing hexes are touching it</dd></dl><h3>Sharing</h3><p>${copy.sharing}</p><div class="dialog-actions"><button class="button primary" id="help-done">Done</button></div>`);$('help-done').onclick=closeDialog;dialogAfterClose=mountHowToExample($('howto-example'));store.setSetting('howToPlaySeen',true);}
function showFirstVisitHelp(){
 if(store.setting('howToPlaySeen',false))return;
 //Recognize existing visitors before openBoard saves their last size.
 if(store.all().length||store.setting('lastSize',null)!==null){store.setSetting('howToPlaySeen',true);return;}
 showHelp();
}
function showPrecision(infoOnly=false){infoOnly=infoOnly===true;
 if(!infoOnly){if(!record||loading||$('precision-button').disabled)return;if(record.startedAt||record.moves>0){notify('Cannot change mode mid-game');return;}if(record.precision){setMode(false);return;}if(!store.setting('showPrecisionWarnings',true)){setMode(true);return;}}
 const canEnable=record&&!loading&&!record.startedAt&&!record.solvedAt&&!record.precisionFailed&&!record.precision;
 showDialog(copy.precisionTitle,`<p class="native-paragraph">${copy.precisionBody}</p><label class="always-on-setting"><input type="checkbox" id="precision-always-on" ${store.setting('precisionAlwaysOn',false)?'checked':''}><span>${copy.alwaysOn}</span></label><div class="dialog-actions">${canEnable?'<button class="button primary" id="precision-confirm">Enable</button><button class="button quiet" id="precision-cancel">Cancel</button>':'<button class="button primary" id="precision-cancel">Continue</button>'}</div>`,'precision-dialog');
 $('precision-always-on').onchange=()=>store.setSetting('precisionAlwaysOn',$('precision-always-on').checked);
 $('precision-cancel').onclick=closeDialog;if(canEnable)$('precision-confirm').onclick=()=>{setMode(true);closeDialog();};
}
function showSettings(){showDialog('Settings',`<div class="settings-list"><label><span>Sound effects</span><input id="sound-setting" type="checkbox" ${soundEnabled?'checked':''}></label><label><span>${copy.warnings}</span><input id="warnings-setting" type="checkbox" ${store.setting('showPrecisionWarnings',true)?'checked':''}></label><button class="button quiet full" id="precision-info">Precision mode info</button></div>`);
 $('sound-setting').onchange=()=>{$('sound-button').click();$('sound-setting').checked=soundEnabled;};$('warnings-setting').onchange=()=>store.setSetting('showPrecisionWarnings',$('warnings-setting').checked);$('precision-info').onclick=()=>showPrecision(true);
}
function showReset(){if(!record||record.solvedAt||record.precision&&record.precisionAttempted)return;showDialog(copy.resetTitle,`<p>${copy.resetBody}</p><div class="dialog-actions"><button class="button quiet" id="cancel-reset">Cancel</button><button class="button primary" id="confirm-reset">Yes</button></div>`,'reset-dialog');$('cancel-reset').onclick=closeDialog;$('confirm-reset').onclick=()=>{record.selected=[];record.marked=[];record.moves=0;persist();sound.play('reset');board.focused=null;board.active=null;board.focus();refreshGame();closeDialog();};}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function bindBackupControls(){
 $('export-data').onclick=()=>{download(new Blob([JSON.stringify(store.backup(),null,2)],{type:'application/json'}),'Hexly_Daily_Progress_'+dayKey()+'.json');notify('Progress backup downloaded.');};$('choose-backup').onclick=()=>$('import-data').click();
 $('import-data').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10000000)throw Error('This file is too large for a progress backup.');const count=store.restore(JSON.parse(await file.text()));const savedSound=store.setting('sound',true)!==false;if(savedSound!==soundEnabled){soundEnabled=sound.toggle();$('sound-button').setAttribute('aria-pressed',String(soundEnabled));}$('import-result').textContent=`Restored ${count} saved ${count===1?'puzzle':'puzzles'}.`;refreshSummary();await openBoard(mode);notify('Your progress is restored.');}catch(error){$('import-result').textContent=error.message;$('import-result').classList.add('import-error');}};
}
function showPrivacy(){showDialog('About your data',`<p>Hexly Daily saves your selections, unused marks, solve times, completed puzzles, streak history, and preferences in this browser’s local storage. Every move is saved automatically.</p><p><strong>Web progress is separate from the iPhone and iPad app.</strong> There is no app synchronization or website account for these saves.</p><p>Clearing this site’s browser data, using private browsing, or changing browsers can remove or separate your progress.</p><section class="data-backup" aria-labelledby="backup-title"><h3 id="backup-title">Keep your progress</h3><p>Download a backup before changing browsers, devices, or domains. Use Restore backup to bring your saved puzzles, streak history, solve times, and preferences into this browser.</p><div class="dialog-actions"><button class="button quiet" id="export-data">Download backup</button><button class="button quiet" id="choose-backup">Restore backup</button></div><input id="import-data" type="file" accept=".json,application/json" hidden><p id="import-result" class="fine-print" role="status"></p></section><p>This game code does not send your puzzle progress to a server or include analytics or advertising trackers. Sharing sends only the result you choose through your device’s sharing tools.</p><p>When you follow an App Store or Nox Studios link, that website’s policies apply. The hosting provider may process ordinary connection information to serve this site.</p><p><a class="underlined" href="https://noxstudios.net/hexly.html#privacy" target="_blank" rel="noopener">Read the Hexly app privacy policy ↗</a></p><div class="dialog-actions"><button class="button primary" id="privacy-done">Back to Hexly</button><button class="button danger" id="clear-local-data">Clear all local data</button></div>`);bindBackupControls();$('privacy-done').onclick=closeDialog;$('clear-local-data').onclick=showClearData;}
async function resetLocalGame(){
 unlockSequence.cancel();pendingUnlock=null;dayBannerPending=false;clearUnlockAppearance();cancelCompletion();clearTimeout(dayTimer);clearTimeout(confettiTimer);clearTimeout(toastTimer);dialogAfterClose=null;
 board.cancelPointer();board.timers.forEach(clearTimeout);board.timers.clear();sound.stop();board.setZoom(1);
 currentDay=dayKey();selectedHistoryDay=currentDay;$('new-day').hidden=true;$('today-count').classList.remove('celebrate-day');
 const enabled=store.setting('sound',true)!==false;if(enabled!==soundEnabled)soundEnabled=sound.toggle();
 $('sound-button').setAttribute('aria-pressed',String(soundEnabled));
 await openBoard('mini',false);
}
function showClearData(){
 showDialog('Clear all local data?',`<p>This permanently deletes <strong>all Hexly Daily game data and streak history saved in this browser</strong>, including puzzle progress, solve times, best times, and settings.</p><p>This cannot be undone. Your iPhone and iPad app data will not be affected.</p><label class="erase-acknowledgment"><input type="checkbox" id="erase-acknowledgment"><span>I understand that all game data and streak history in this browser will be permanently deleted.</span></label><p id="erase-error" role="alert" hidden></p><div class="dialog-actions"><button class="button quiet" id="cancel-erase">Cancel</button><button class="button danger" id="confirm-erase" disabled>Delete all game data</button></div>`,'erase-dialog');
 const acknowledge=$('erase-acknowledgment'),confirm=$('confirm-erase');
 acknowledge.onchange=()=>{confirm.disabled=!acknowledge.checked;};
 $('cancel-erase').onclick=showPrivacy;$('cancel-erase').focus();
 confirm.onclick=async()=>{
  if(!acknowledge.checked)return;confirm.disabled=true;acknowledge.disabled=true;
  const cleared=store.clearAll();await resetLocalGame();
  if(!cleared){
   const error=$('erase-error');if(error){error.textContent='Some saved data could not be removed. Please try again, or clear this site’s data in your browser settings.';error.hidden=false;confirm.disabled=false;acknowledge.disabled=false;}
   return;
  }
  closeDialog();notify('All local Hexly data has been cleared.');
 };
}
async function showShare(day=currentDay){
 const model=shareModel(store.all(),day),text=shareText(model),caption=`Hexly Daily ${model.url} - Play now!`;let shareBlob=null,previewURL=null;
 showDialog('Share',`<div class="share-preview" id="share-preview" aria-busy="true">Preparing your share card…</div><p class="share-caption">Hexly Daily <a class="share-link" href="${escapeHTML(model.url)}" target="_blank" rel="noopener">${escapeHTML(model.url)}</a> - Play now!</p><div class="share-buttons"><button class="button primary" id="native-share" disabled>Share card ↗</button><button class="button quiet" id="copy-results">Copy results</button><button class="button quiet" id="download-result" disabled>Save image</button></div><p class="fine-print">No puzzle answers are included.</p>`,'share-dialog');
 const preview=$('share-preview'),shareButton=$('native-share'),saveButton=$('download-result');
 dialogAfterClose=()=>{if(previewURL)URL.revokeObjectURL(previewURL);};
 const copy=async()=>{try{await navigator.clipboard.writeText(text);notify('Results copied.');}catch(_){showDialog('Copy your results',`<p>Select and copy the text below.</p><textarea id="copy-text" readonly style="width:100%;min-height:260px;background:#0b151b;color:#d8e8eb;border:1px solid #45616a;padding:15px"></textarea>`);$('copy-text').value=text;$('copy-text').select();}};
 $('copy-results').onclick=copy;
 const save=()=>{if(shareBlob)download(shareBlob,'Hexly_Daily_'+day+'.png');};saveButton.onclick=save;
 shareButton.onclick=async()=>{
  if(!navigator.share){save();return;}
  const file=new File([shareBlob],'Hexly_Daily_'+day+'.png',{type:'image/png'});
  const supportsFiles=navigator.canShare?.({files:[file]});
  //Keep the URL inside a text caption, not a standalone URL preview item.
  //The receiving app still controls attachment order and presentation.
  //Test the reversed field order in iOS Messages while keeping one combined share.
  const payload=supportsFiles?{text:caption,files:[file]}:{text:text.replace('\n'+model.url,'\n'+caption)};
  try{await navigator.share(payload);}catch(error){if(error.name!=='AbortError'){save();notify('Card downloaded. Use Copy results to include the website link.');}}
 };
 try{
  shareBlob=await renderShareCard(model);
  if(!preview.isConnected)return;
  previewURL=URL.createObjectURL(shareBlob);const img=new Image();img.className='share-card-image';img.alt=text.replace('\n'+model.url,'');img.src=previewURL;preview.replaceChildren(img);preview.setAttribute('aria-busy','false');
  shareButton.disabled=false;saveButton.disabled=false;
  if(!navigator.share)shareButton.hidden=true;
 }catch(_){if(preview.isConnected){preview.textContent='The share card couldn’t load. You can still copy your results and website link.';preview.setAttribute('aria-busy','false');}}
}
function updateZoom(){const z=board.zoom;$('zoom-label').textContent=Math.round(z*100)+'%';$('zoom-out').disabled=z===1;$('zoom-in').disabled=z===2.5;}
$('zoom-out').onclick=()=>{board.setZoom(board.zoom-.5);updateZoom();};$('zoom-in').onclick=()=>{board.setZoom(board.zoom+.5);updateZoom();};
$('sound-button').onclick=()=>{soundEnabled=sound.toggle();store.setSetting('sound',soundEnabled);$('sound-button').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled)sound.play('activate');};
$('precision-button').onclick=showPrecision;
$('settings-button').onclick=showSettings;
$('reset-button').onclick=showReset;
$('help-button').onclick=showHelp;
$('data-button').onclick=showPrivacy;
$('share-day').onclick=()=>showShare(selectedHistoryDay);$('share-solve').onclick=()=>showShare(currentDay);
$('next-size').onclick=()=>{const next=nextUnsolved();if(next)openBoard(next);};$('retry-load').onclick=()=>openBoard(mode);
$('close-dialog').onclick=closeDialog;$('dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
$('load-today').onclick=()=>{currentDay=dayKey();selectedHistoryDay=currentDay;$('new-day').hidden=true;closeDialog();openBoard('mini');};
window.addEventListener('storage',event=>{
 if(!event.key?.startsWith(PREFIX))return;
 store.forget(event.key);
 if(event.key===PREFIX+'setting.precisionAlwaysOn'&&$('precision-always-on'))$('precision-always-on').checked=store.setting('precisionAlwaysOn',false)===true;
 if(event.key===PREFIX+'setting.sound'){const enabled=store.setting('sound',true)!==false;if(enabled!==soundEnabled)soundEnabled=sound.toggle();$('sound-button').setAttribute('aria-pressed',String(soundEnabled));}
 if(event.key.startsWith(PREFIX+'board.')){
  if(record&&event.key===store.recordKey(currentDay,mode)){
   const incoming=store.load(currentDay,mode);
   if(event.newValue===null||incoming.updatedAt>record.updatedAt){
    cancelCompletion();
    if(event.newValue===null){clearTimeout(dayTimer);clearTimeout(confettiTimer);dialogAfterClose=null;closeDialog();board.render(puzzle);sound.stop();}
    record=incoming;refreshGame();
   }
  }
  refreshSummary();
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(pendingUnlock){unlockSequence.cancel();pendingUnlock=null;dayBannerPending=false;clearUnlockAppearance();dialogAfterClose=null;}clearTimeout(dayTimer);if(completionPending||$('game').classList.contains('is-completing')){cancelCompletion();refreshGame();}board.cancelPointer();sound.pause();}else{updateClock();refreshSummary();}});
window.addEventListener('pagehide',()=>{unlockSequence.cancel();cancelCompletion();sound.pause();});
$('year').textContent='2027';bindHistory($('week'));createSizes();updateClock();refreshSummary();animateSavedProgress();setInterval(updateClock,1000);showFirstVisitHelp();openBoard(mode);
