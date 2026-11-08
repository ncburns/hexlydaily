//SplashView.swift / AppRootView.swift / HomeView.swift, Hexly 1.0.35 build 2.
export const LAUNCH_TIMING = Object.freeze({minimum:1250,fade:280,sound:70,timeout:20000});

export function createLaunchScreen({screen,content,body,makeAudio,visible=()=>!document.hidden}) {
 let ready=false,minimumElapsed=false,revealing=false,closed=false,soundEnabled=false,audio;
 let soundTimer,fadeTimer,resolveFinished;
 const finished=new Promise(resolve=>{resolveFinished=resolve;});
 const stopSound=()=>{try{audio?.pause();}catch(_){};};
 const playSound=()=>{
  if(!soundEnabled||!visible())return;
  try {
   audio??=makeAudio();audio.volume=.78;
   //A rejected autoplay must never delay the page or replay on a later puzzle click.
   Promise.resolve(audio.play()).catch(stopSound);
  }catch(_){stopSound();}
 };
 const finish=(revealed=true)=>{
  if(closed)return;closed=true;
  clearTimeout(minimumTimer);clearTimeout(watchdog);clearTimeout(fadeTimer);
  screen.hidden=true;screen.classList.remove('is-revealing');
  body.classList.remove('is-launching','is-launch-revealing');
  content.inert=false;content.removeAttribute('aria-hidden');resolveFinished(revealed);
 };
 const reveal=()=>{
  if(closed||revealing||!ready||!minimumElapsed)return;
  revealing=true;clearTimeout(watchdog);
  body.classList.add('is-launch-revealing');screen.classList.add('is-revealing');
  soundTimer=setTimeout(playSound,LAUNCH_TIMING.sound);
  fadeTimer=setTimeout(finish,LAUNCH_TIMING.fade);
 };
 const minimumTimer=setTimeout(()=>{minimumElapsed=true;reveal();},LAUNCH_TIMING.minimum);
 //Always release the page if initialization fails, so errors/retry controls remain accessible.
 const watchdog=setTimeout(()=>{ready=true;reveal();},LAUNCH_TIMING.timeout);
 return {
  finished,
  ready(){ready=true;reveal();},
  setSoundEnabled(enabled){soundEnabled=enabled===true;if(!soundEnabled)stopSound();else{try{if(!audio){audio=makeAudio();audio.preload='auto';audio.load?.();}}catch(_){audio=null;}}},
  pauseSound(){clearTimeout(soundTimer);stopSound();},
  cancel(){clearTimeout(soundTimer);stopSound();finish(false);}
 };
}

export const launchScreen=typeof document==='undefined'?null:createLaunchScreen({
 screen:document.getElementById('launch-screen'),content:document.getElementById('site-content'),body:document.body,
 makeAudio:()=>new Audio(new URL('./sounds/ui_launch.mp3',import.meta.url).href)
});
if(launchScreen){
 window.addEventListener('pagehide',()=>launchScreen.cancel());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)launchScreen.pauseSound();});
}
