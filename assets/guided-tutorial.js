import {Board} from './board.js?v=2';
import {generateUnique} from './generator.mjs';
import {CompletionSequence,completionTiming} from './completion.js';

//The app's TutorialView seed and lesson order. Tutorial state stays in memory.
export function tutorialPlan(puzzle){
 const key=cell=>cell.join(','),solution=new Set(puzzle.solution.map(key)),clues=new Set(puzzle.clues.map(([q,r])=>q+','+r));
 const playable=puzzle.cells.filter(cell=>!clues.has(key(cell)));
 const touchesClue=([q,r])=>puzzle.clues.some(([a,b])=>(Math.abs(a-q)+Math.abs(b-r)+Math.abs(a+b-q-r))/2===1);
 const wrong=key(playable.find(cell=>!solution.has(key(cell))&&touchesClue(cell))||playable.find(cell=>!solution.has(key(cell))));
 const actives=puzzle.solution.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),steps=[];
 actives.forEach((cell,index)=>{
  steps.push({kind:'activate',target:key(cell),title:'Activate a Hex',body:index===0?'Each numbered hex shows how many glowing hexes should be touching it. Click the highlighted hex to make it glow.':'Click the highlighted hex to make it glow. Each numbered hex shows how many glowing hexes should be touching it.'});
  if(index===Math.max(0,Math.min(2,actives.length-1))){
   steps.push({kind:'mark',target:wrong,title:'Mark as Unused',body:'Click and hold the highlighted hex to Mark it as unused. Marked hexes show a dashed outline and help you keep track of spaces you know are not part of the solution.'});
   steps.push({kind:'clear',target:wrong,title:'Clear a Mark',body:'Click and hold the marked hex again to Clear it. Marks are notes, so you can clear them anytime if your thinking changes.'});
  }
 });
 steps.push(
  {kind:'wrong',target:wrong,title:'Make a wrong move',body:'On purpose, click this hex to make it glow. The numbers above it will turn yellow because too many glowing hexes are touching them.'},
  {kind:'fix',target:wrong,title:'Fix the mistake',body:'Click the same hex again to turn it off. The yellow numbers will turn green because the right amount of glowing hexes are now touching them.'},
  {kind:'finish',title:'Puzzle solved!',body:'Nice work. You solved the puzzle by turning every number green. The remaining empty hexes fill in to celebrate.'},
  {kind:'precisionIntro',title:'Precision Mode',body:'Precision Mode is for players who want a real challenge. One wrong move, and you will have to start over from the beginning.'},
  {kind:'enablePrecision',title:'Step Up',body:'Click the button to activate Precision Mode. Hexly will track whether you can solve this puzzle cleanly from start to finish.'},
  {kind:'precisionSolve',title:'Earn It',body:'In Precision Mode, glowing moves are final once you begin. Marks are still notes you can clear anytime. Solve the puzzle if you can!'}
 );
 return steps;
}

export function createGuidedTutorial({sound,showHelp,showPopup}){
 const dialog=document.createElement('dialog');
 dialog.id='tutorial-dialog';dialog.className='guided-tutorial';dialog.setAttribute('aria-labelledby','tutorial-title');
 dialog.innerHTML=`<div class="guided-header"><button class="icon-button" id="tutorial-exit" aria-label="Exit tutorial" autofocus>×</button><h2 id="tutorial-title">Tutorial</h2><button class="icon-button" id="tutorial-help" aria-label="How to play instructions">?</button></div><div class="guided-game demo-native" id="tutorial-game"><div class="board-viewport" id="tutorial-viewport"><div class="demo-board" id="tutorial-board" role="group" aria-label="Tutorial puzzle"></div></div><div class="guided-controls" hidden><button class="precision-toggle" id="tutorial-precision" aria-label="Tutorial Precision Mode" aria-pressed="false" hidden><svg class="precision-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22.75"/></svg><img src="assets/scope.svg" alt="" width="22" height="22"></button></div></div><section class="guided-instruction" aria-labelledby="tutorial-step-title"><div class="guided-step-heading"><h3 id="tutorial-step-title"></h3><span id="tutorial-progress"></span></div><p id="tutorial-instruction" aria-live="polite"></p><p id="tutorial-feedback" role="status" hidden></p><button class="button quiet full" id="tutorial-continue" hidden>Continue</button></section>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id),game=$('tutorial-game'),precision=$('tutorial-precision');
 const puzzle=generateUnique('mini','tutorial',0xC0FFEEn),plan=tutorialPlan(puzzle),sequence=new CompletionSequence();
 const board=new Board($('tutorial-board'),$('tutorial-viewport'),act);
 let record,index=0,finishing=false;
 const step=()=>plan[index];
 function message(text){$('tutorial-feedback').textContent=text;$('tutorial-feedback').hidden=false;}
 function resetBoard(){
  sequence.cancel();finishing=false;record={selected:[],marked:[],precision:false,solvedAt:null};
  game.classList.remove('is-solved','is-celebrating');board.render(puzzle);board.el.setAttribute('aria-label','Mini tutorial puzzle');
 }
 function render(){
  const s=step(),free=s.kind==='precisionSolve',canPlay=!!s.target||free;
  board.update(record);
  $('tutorial-step-title').textContent=s.title;$('tutorial-progress').textContent=`${index+1}/${plan.length}`;$('tutorial-instruction').textContent=s.body;
  $('tutorial-feedback').hidden=true;$('tutorial-continue').hidden=s.kind!=='precisionIntro';
  precision.hidden=!['precisionIntro','enablePrecision','precisionSolve'].includes(s.kind);
  dialog.querySelector('.guided-controls').hidden=precision.hidden;
  precision.disabled=s.kind!=='enablePrecision';precision.setAttribute('aria-pressed',String(record.precision));
  precision.classList.toggle('tutorial-target',s.kind==='enablePrecision');
  board.cells.forEach(cell=>{
   const target=board.key(cell)===s.target;
   cell.classList.toggle('tutorial-target',target);
   cell.disabled=finishing||!canPlay||(!free&&!target);
   cell.querySelector('.guided-click-label')?.remove();
   if(target){const label=document.createElement('span');label.className='guided-click-label';label.setAttribute('aria-hidden','true');label.textContent=['mark','clear'].includes(s.kind)?'Click and hold':'Click';cell.append(label);}
  });
 }
 function enter(next){
  index=next;board.active=null;board.focused=null;board.focus();render();
  if(step().kind==='finish')finish(false);
 }
 function completePopup(isPrecision){
  if(!dialog.open)return;
  if(isPrecision){showPopup('Solved!','You now know the basics of Hexly, Mark/Clear, and Precision Mode. You can replay this tutorial anytime by clicking How to play. Good luck, and have fun.','Exit Tutorial',close);}
  else showPopup('Solved!',step().body,'Continue',()=>{if(!dialog.open)return;resetBoard();enter(plan.findIndex(s=>s.kind==='precisionIntro'));});
 }
 function finish(isPrecision){
  finishing=true;record.solvedAt=Date.now();
  const prior=new Set(record.marked),remaining=board.choices.map(cell=>board.key(cell)).filter(key=>!record.selected.includes(key)),reveal=remaining.filter(key=>!prior.has(key));
  record.marked=remaining;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,timing=completionTiming(reveal.length,reduced);
  board.update(record,{celebrate:!reduced,revealKeys:reveal,revealInterval:timing.revealInterval});board.cells.forEach(cell=>{cell.disabled=true;cell.classList.remove('tutorial-target');cell.querySelector('.guided-click-label')?.remove();});
  sequence.start([[timing.popupAt,()=>{if(!dialog.open)return;game.classList.add('is-solved');if(!reduced)game.classList.add('is-celebrating');sound.play('solved');completePopup(isPrecision);}],[timing.finishAt,()=>game.classList.remove('is-celebrating')]]);
 }
 function act(type,key,cell){
  if(type==='unlock'){sound.unlock();return;}
  if(!dialog.open||finishing||record.solvedAt)return;
  const s=step(),free=s.kind==='precisionSolve';
  if(!free&&key!==s.target)return;
  if(!free&&(['mark','clear'].includes(s.kind)?type!=='mark':type!=='select')){message(['mark','clear'].includes(s.kind)?'Click and hold the highlighted hex.':'Click the highlighted hex.');return;}
  sound.unlock();
  if(type==='mark'){
   if(record.selected.includes(key)){message('Clear the hex first');return;}
   if(record.marked.includes(key)){record.marked=record.marked.filter(k=>k!==key);sound.play('clearMark');}
   else{record.marked.push(key);sound.play('mark');board.animate(cell,'mark');}
  }else{
   if(record.marked.includes(key)){message('Clear mark first');return;}
   if(record.selected.includes(key)){
    if(record.precision){message('No undo in Precision Mode');return;}
    record.selected=record.selected.filter(k=>k!==key);sound.play('deactivate');
   }else{record.selected.push(key);sound.play('activate',1+Math.min(record.selected.length/puzzle.solutionSize,1)*.08);board.animate(cell,'select');}
  }
  const result=board.update(record);
  if(free){
   if(result.over){
    finishing=true;sound.play('precisionFail');
    showPopup('Precision attempt ended','All Precision Mode moves are final. You can restart this tutorial at any time to try again.','Restart Tutorial',()=>{if(!dialog.open)return;resetBoard();enter(plan.findIndex(s=>s.kind==='enablePrecision'));},'precision-dialog');
   }else if(result.solved)finish(true);
  }else enter(index+1);
 }
 function open(){if(dialog.open)return;resetBoard();index=0;render();dialog.showModal();dialog.scrollTop=0;}
 function close(){sequence.cancel();board.cancelPointer();board.timers.forEach(clearTimeout);board.timers.clear();sound.stop();dialog.close();}
 $('tutorial-exit').onclick=close;$('tutorial-help').onclick=showHelp;
 $('tutorial-continue').onclick=()=>{sound.unlock();enter(index+1);};
 precision.onclick=()=>{if(step().kind!=='enablePrecision')return;sound.unlock();record.precision=true;sound.play('precisionToggle');enter(index+1);};
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)board.cancelPointer();});
 return {open,close};
}
