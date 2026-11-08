//MusicPlayer.swift 1.0.35 build 2: both original stems share one audio clock.
//Music stays opt-in and independent of the sound-effects switch.
//A started puzzle uses the core stem until its winning move, including after reload.
export function musicShouldUseCore(record){return record?.startedAt!=null&&record.solvedAt==null;}

export function makeMusic(onStatus=()=>{}) {
 let enabled=false,inGame=false,context,fullGain,coreGain,buffersPromise;
 let sources=[],active=false,starting=null,generation=0,stopTimer,status='off';
 const report=value=>{if(status!==value){status=value;onStatus(value);}};
 const hidden=()=>document.hidden;
 const stopSources=()=>{for(const source of sources){try{source.stop();}catch(_){}source.disconnect();}sources=[];active=false;};
 function configure(){
  if(context)return;
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)throw Error('Web Audio unavailable');
  context=new AudioContext();fullGain=context.createGain();coreGain=context.createGain();
  for(const gain of [fullGain,coreGain]){gain.gain.value=0;gain.connect(context.destination);}
  context.addEventListener('statechange',()=>{
   if(active&&context.state!=='running'){
    generation++;starting=null;stopSources();
    report(enabled?'paused':'off');
   }
  });
 }
 function load(){
  if(!buffersPromise)buffersPromise=Promise.all(['full','core'].map(async stem=>{
   const response=await fetch(new URL(`./music/music_${stem}.mp3`,import.meta.url));
   if(!response.ok)throw Error('Music could not load');
   return context.decodeAudioData(await response.arrayBuffer());
  })).catch(error=>{buffersPromise=null;throw error;});
  return buffersPromise;
 }
 function fade(param,target,duration,at=context.currentTime){
  const now=context.currentTime;
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
  else{const current=param.value;param.cancelScheduledValues(now);param.setValueAtTime(current,now);}
  if(at>now)param.setValueAtTime(param.value,at);
  param.linearRampToValueAtTime(target,at+duration);
 }
 function applyScene(duration=.9,at=context.currentTime){
  fade(fullGain.gain,inGame?0:.55,duration,at);
  fade(coreGain.gain,.55,duration,at);
 }
 function activate(){
  if(!enabled||hidden()||active&&context?.state==='running')return Promise.resolve();
  let resume;
  try{
   configure();
   //Resume inside the click, before any downloads or decoding await.
   resume=context.state==='running'?Promise.resolve():context.resume();
  }catch(_){report('error');return Promise.resolve();}
  if(starting){resume.catch(()=>{});return starting;}
  const run=++generation;clearTimeout(stopTimer);stopSources();report('loading');
  let resumeTimer;
  const ready=Promise.race([resume,new Promise((_,reject)=>{resumeTimer=setTimeout(()=>reject(Error('Audio needs a click')),1500);})]);
  const attempt=Promise.all([load(),ready]).then(([buffers])=>{
   if(run!==generation||!enabled||hidden())return;
   if(context.state!=='running'){report('blocked');return;}
   //Start from zero together, just as the native player does on activation.
   const startAt=context.currentTime+.06;
   for(const gain of [fullGain,coreGain]){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);}
   sources=buffers.map((buffer,i)=>{
    const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
    source.connect(i===0?fullGain:coreGain);return source;
   });
   sources.forEach(source=>source.start(startAt));active=true;applyScene(1.2,startAt);report('playing');
  }).catch(()=>{if(run===generation&&enabled&&!hidden())report(context.state==='running'?'error':'blocked');})
   .finally(()=>{clearTimeout(resumeTimer);if(starting===attempt)starting=null;});
  starting=attempt;return attempt;
 }
 function setEnabled(on,{activateNow=true}={}){
  enabled=on===true;
  if(enabled){if(activateNow)return activate();report('paused');return Promise.resolve();}
  const run=++generation;starting=null;clearTimeout(stopTimer);report('off');
  if(!context)return Promise.resolve();
  if(active&&context.state==='running'){
   active=false;fade(fullGain.gain,0,.9);fade(coreGain.gain,0,.9);
   stopTimer=setTimeout(()=>{if(run===generation&&!enabled){stopSources();context.suspend().catch(()=>{});}},950);
  }else{stopSources();context.suspend().catch(()=>{});}
  return Promise.resolve();
 }
 function pause(){generation++;starting=null;clearTimeout(stopTimer);stopSources();context?.suspend().catch(()=>{});report(enabled?'paused':'off');}
 return {
  setEnabled,unlock:activate,pause,
  setInGame(value){if(inGame===value)return;inGame=value;if(active)applyScene();},
  foreground(){return activate();}
 };
}
