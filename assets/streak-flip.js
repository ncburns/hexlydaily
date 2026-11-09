//Match HomeCards.swift's FlipClockNumber: 420ms, ease-in-out, two folding halves.
export const STREAK_FLIP_DURATION=420;
export class StreakFlipNumber {
 constructor(element){this.element=element;this.value=null;this.animations=[];this.generation=0;}
 set(value,{animate=false}={}){
  if(value===this.value)return;
  const previous=this.value,generation=++this.generation,element=this.element;
  this.animations.forEach(animation=>animation.cancel());this.animations=[];
  this.value=value;element.classList.remove('streak-number-flip');element.textContent=value;element.setAttribute('aria-label',String(value));
  if(!animate||previous===null||value<=previous||matchMedia('(prefers-reduced-motion: reduce)').matches||typeof element.animate!=='function')return;
  const from=String(previous),to=String(value),widthText=from.length>to.length?from:to;
  const half=(position,content,extra='')=>`<b class="streak-flip-half streak-flip-${position} ${extra}" aria-hidden="true"><b class="streak-flip-glyph">${content}</b></b>`;
  element.classList.add('streak-number-flip');
  element.innerHTML=`<b class="streak-flip-size" aria-hidden="true">${widthText}</b>`+half('top',to,'streak-flip-top-base')+half('bottom',from,'streak-flip-bottom-base')+half('top',from,'streak-flip-fold')+half('bottom',to,'streak-flip-unfold');
  const options={duration:STREAK_FLIP_DURATION,easing:'ease-in-out',fill:'both'};
  this.animations=[
   element.querySelector('.streak-flip-top-base').animate([{opacity:0},{opacity:0,offset:.4999},{opacity:1,offset:.5},{opacity:1}],options),
   element.querySelector('.streak-flip-bottom-base').animate([{opacity:1},{opacity:1,offset:.4999},{opacity:0,offset:.5},{opacity:0}],options),
   element.querySelector('.streak-flip-fold').animate([{transform:'rotateX(0deg)',opacity:1},{transform:'rotateX(-89.98deg)',opacity:1,offset:.4999},{transform:'rotateX(-90deg)',opacity:0,offset:.5},{transform:'rotateX(-90deg)',opacity:0}],options),
   element.querySelector('.streak-flip-unfold').animate([{transform:'rotateX(90deg)',opacity:0},{transform:'rotateX(90deg)',opacity:0,offset:.4999},{transform:'rotateX(90deg)',opacity:1,offset:.5},{transform:'rotateX(0deg)',opacity:1}],options)
  ];
  Promise.all(this.animations.map(animation=>animation.finished)).then(()=>{
   if(this.generation!==generation)return;
   element.textContent=value;element.classList.remove('streak-number-flip');this.animations=[];
  }).catch(()=>{});
 }
}
