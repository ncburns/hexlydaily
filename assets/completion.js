// Native GameViewModel, GameView, BoardJuice and HomeView timings (milliseconds).
export const DAY_COMPLETE_DELAY=300;
export function completionTiming(count,reducedMotion=false){
 const revealInterval=reducedMotion?0:38;
 const popupAt=reducedMotion||!count?0:count*38+280;
 // Solved card, answer fill, bounce and solved sound share the same trigger.
 return {revealInterval,popupAt,borderAt:popupAt,finishAt:popupAt+(reducedMotion?0:240)};
}
export function unlockTiming(precision,settleSoundMs,precisionSoundMs){
 const fillAt=50,flashAt=1050,settleAt=1170;
 const fadeDuration=Math.max(50,precisionSoundMs*.1512);
 const popStartDelay=Math.max(0,fadeDuration-150);
 const precisionTail=precision?Math.max(precisionSoundMs,popStartDelay+100+125):0;
 return {fillAt,flashAt,settleAt,fadeDuration,popAt:settleAt+popStartDelay,
  popSettleAt:settleAt+popStartDelay+100,
  finishAt:settleAt+Math.max(settleSoundMs,precisionTail)+120};
}
export class CompletionSequence {
 constructor(schedule=(fn,delay)=>setTimeout(fn,delay),clear=timer=>clearTimeout(timer)){this.schedule=schedule;this.clear=clear;this.timers=new Set();this.generation=0;}
 start(stages){this.cancel();const generation=this.generation;for(const [delay,action] of stages){const timer=this.schedule(()=>{this.timers.delete(timer);if(this.generation===generation)action();},delay);this.timers.add(timer);}}
 cancel(){this.generation++;this.timers.forEach(timer=>this.clear(timer));this.timers.clear();}
}
