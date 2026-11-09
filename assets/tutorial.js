// TutorialView.swift: HowToExampleAnimated. Same four cells, colors and cadence.
const HEX='19.05256,-11 19.05256,11 0,22 -19.05256,11 -19.05256,-11 0,-22';
const DESCRIPTIONS=[
 'A clue of 2 with one glowing neighbor. The number is white because it needs one more.',
 'A clue of 2 with two glowing neighbors. The number is green: the count is correct.',
 'A clue of 2 with three glowing neighbors. The number is yellow: too many are touching.'
];
export function howToExampleMarkup(){
 const choice=(name,x,y)=>`<g class="tutorial-hex tutorial-${name}" transform="translate(${x} ${y})"><polygon class="tutorial-glow" points="${HEX}"/><polygon class="tutorial-fill" points="${HEX}"/></g>`;
 return `<section class="howto-example" id="howto-example" data-phase="0" aria-labelledby="example-title"><h3 id="example-title">Example</h3><p>Watch the number react as nearby hexes glow:</p><div class="tutorial-stage"><svg viewBox="0 0 320 140" role="img" aria-label="${DESCRIPTIONS[0]}">${choice('left',121.89488,86.5)}${choice('right',198.10512,86.5)}${choice('top',140.94744,53.5)}<g class="tutorial-clue" transform="translate(160 86.5)"><polygon class="tutorial-clue-glow" points="${HEX}"/><polygon class="tutorial-clue-fill" points="${HEX}"/><text text-anchor="middle" dominant-baseline="central">2</text></g></svg></div><div class="tutorial-footer"><div class="tutorial-legend"><span><svg class="tutorial-ok" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="m6 10 3 3 5-6"/></svg>Green means correct</span><span><svg class="tutorial-warn" viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 9 16H1Z M10 7v5 M10 15v.2"/></svg>Yellow means too many are touching</span></div><button class="text-button tutorial-toggle" type="button">Pause animation</button></div></section>`;
}
export function mountHowToExample(root){
 const graphic=root.querySelector('.tutorial-stage svg'),toggle=root.querySelector('.tutorial-toggle');
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let phase=motion.matches?1:0,playing=!motion.matches,visible=true,timer=null,disposed=false;
 const render=()=>{root.dataset.phase=String(phase);graphic.setAttribute('aria-label',DESCRIPTIONS[phase]);toggle.textContent=playing?'Pause animation':'Play animation';};
 const stop=()=>{if(timer!==null){clearInterval(timer);timer=null;}};
 const sync=()=>{stop();if(!disposed&&playing&&visible&&!document.hidden)timer=setInterval(()=>{phase=(phase+1)%3;render();},2000);};
 const changeMotion=()=>{playing=!motion.matches;if(motion.matches)phase=1;render();sync();};
 toggle.onclick=()=>{playing=!playing;render();sync();};
 document.addEventListener('visibilitychange',sync);
 motion.addEventListener('change',changeMotion);
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.1}):null;
 observer?.observe(graphic);
 render();sync();
 return ()=>{disposed=true;stop();observer?.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',changeMotion);toggle.onclick=null;};
}
