//SoundEffects.swift 1.0.35: sixteen pre-rendered +0.5% placement pitch steps.
export function placementRate(selected,solutionSize) {
    const fraction = Math.fround(selected / Math.max(1,solutionSize));
    return Math.fround(1 + Math.fround(Math.min(fraction,1) * Math.fround(.08)));
}
export function placementClip(rate = 1) {
    if (!Number.isFinite(rate)) return 'activate';
    const position = Math.fround(Math.fround(Math.fround(rate) - 1) / Math.fround(.005));
    const step = Math.round(Math.min(16, Math.max(0, position)));
    return step ? 'activatePitch' + step : 'activate';
}
export function makeSounds(onStatus) {
    let enabled = true;
    let context;
    let gain;
    let generation = 0;
    let useMedia = false;
    let needsRetry = false;
    const playing = new Set();
    const decoded = new Map();
    const clips = window.HEXLY_DEMO_AUDIO || {};
    const report = state => { needsRetry = state === 'blocked'; onStatus(state); };
    const stop = () => {
      generation++;
      playing.forEach(source => { try { source.stop ? source.stop() : source.pause(); } catch (_) {} });
      playing.clear();
    };
    const unlock = () => {
      if (!enabled || useMedia) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { useMedia = true; return; }
      try {
        if (!context) {
          context = new AudioContext();
          gain = context.createGain(); gain.gain.value = .85; gain.connect(context.destination);
          //Decode embedded bytes: no fetch, local-file CORS, or audio-server dependency.
          Object.entries(clips).forEach(([event, uri]) => {
            const encoded = uri.slice(uri.indexOf(',') + 1);
            const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
            decoded.set(event, context.decodeAudioData(bytes.buffer).catch(() => null));
          });
        }
        if (context.state !== 'running') context.resume().catch(() => {});
      } catch (_) { useMedia = true; }
    };
    const playMedia = (event, rate, run) => {
      if (!enabled || run !== generation || document.hidden) return;
      try {
        const audio = new Audio(clips[event]);
        audio.volume = .85; audio.playbackRate = rate;
        audio.preservesPitch = false; audio.webkitPreservesPitch = false;
        playing.add(audio);
        const cleanup = () => playing.delete(audio);
        audio.addEventListener('ended', cleanup, {once:true});
        audio.addEventListener('error', () => { cleanup(); if (run === generation && enabled) report('blocked'); }, {once:true});
        audio.play().then(() => {
          if (!enabled || run !== generation) audio.pause(); else report('ready');
        }).catch(() => { cleanup(); if (run === generation && enabled) report('blocked'); });
      } catch (_) { report('blocked'); }
    };
    const play = async (event, rate = 1) => {
      if (!enabled) return;
      if (event === 'activate') {
        const pitched = placementClip(rate);
        if (clips[pitched]) { event = pitched; rate = 1; }
      }
      if (!clips[event]) { report('blocked'); return; }
      unlock();
      const run = generation;
      if (useMedia || !context) { playMedia(event, rate, run); return; }
      try {
        const buffer = await decoded.get(event);
        if (!buffer) throw new Error('Audio could not decode');
        if (!enabled || run !== generation || document.hidden) return;
        if (context.state !== 'running') {
          let timeout;
          try {
            await Promise.race([context.resume(), new Promise((_, reject) => {
              timeout = setTimeout(() => reject(new Error('Audio needs another gesture')), 1200);
            })]);
          } finally { clearTimeout(timeout); }
        }
        if (!enabled || run !== generation || document.hidden) return;
        if (context.state !== 'running') throw new Error('Audio is suspended');
        const source = context.createBufferSource();
        source.buffer = buffer; source.playbackRate.value = rate; source.connect(gain);
        source.onended = () => { playing.delete(source); source.disconnect(); };
        playing.add(source); source.start(); report('ready');
      } catch (_) {
        if (enabled && run === generation && !document.hidden) {
          useMedia = true;
          playMedia(event, rate, run);
        }
      }
    };
    return {
      unlock, play, stop,
      duration(event) { return enabled ? (window.HEXLY_AUDIO_DURATION_MS?.[event] || 0) : 0; },
      toggle() {
        if (needsRetry) { enabled = true; report('ready'); unlock(); return true; }
        enabled = !enabled;
        if (!enabled) { stop(); report('muted'); } else { report('ready'); unlock(); }
        return enabled;
      },
      pause() { stop(); if (context && context.state === 'running') context.suspend().catch(() => {}); }
    };
  }
