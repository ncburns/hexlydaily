//Deterministic port of Hexly 1.0.34 PuzzleGenerator, RNG, and hex enumeration.
//Unsigned 64-bit operations use BigInt; never coerce seeds to Number.
export const GENERATOR_VERSION = 'hexly-1.0.34';
const MASK = (1n << 64n) - 1n;
const STEP = 0x9e3779b97f4a7c15n;
export const MODES = Object.freeze({mini:{radius:2,density:.22,gimmes:1,clueFraction:.55},small:{radius:3,density:.25,gimmes:2,clueFraction:.50},medium:{radius:4,density:.28,gimmes:1,clueFraction:.30},large:{radius:5,density:.30,gimmes:0,clueFraction:0}});
const key = ([q,r]) => `${q},${r}`;
const neighbors = ([q,r]) => [[q+1,r],[q-1,r],[q,r+1],[q,r-1],[q+1,r-1],[q-1,r+1]];
export function hash64(value) {
  let h=0xcbf29ce484222325n;
  for(const byte of new TextEncoder().encode(value)) h=((h^BigInt(byte))*0x100000001b3n)&MASK;
  return h;
}
class SplitMix64 {
  constructor(seed) { this.state=BigInt(seed)&MASK; }
  next() {
    this.state=(this.state+STEP)&MASK;
    let z=this.state;
    z=((z^(z>>30n))*0xbf58476d1ce4e5b9n)&MASK;
    z=((z^(z>>27n))*0x94d049bb133111ebn)&MASK;
    return z^(z>>31n);
  }
  shuffle(array) {
    for(let i=array.length-1;i>0;i--) {const j=Number(this.next()%BigInt(i+1)); [array[i],array[j]]=[array[j],array[i]];}
  }
}
function geometry(mode) {
  const radius=MODES[mode].radius, cells=[];
  for(let q=-radius;q<=radius;q++) for(let r=Math.max(-radius,-q-radius);r<=Math.min(radius,-q+radius);r++) cells.push([q,r]);
  const indices=new Map(cells.map((c,i)=>[key(c),i]));
  const adjacent=cells.map(c=>neighbors(c).map(n=>indices.get(key(n))).filter(i=>i!==undefined));
  return {cells,adjacent};
}
const geometries=Object.fromEntries(Object.keys(MODES).map(mode=>[mode,geometry(mode)]));
//Exact complete binary constraint solver. Branch order may differ from Swift's
//dictionary traversal but exact solution counts (limited to two) cannot differ.
function countIndexed(adjacent, clues, limit=2) {
  const N=adjacent.length, a=new Int8Array(N).fill(-1), rules=[], weights=new Int8Array(N);
  for(let i=0;i<N;i++) if(clues.has(i)) a[i]=0;
  for(const [i,n] of clues) {
    const vars=adjacent[i].filter(j=>!clues.has(j));
    rules.push([vars,n]);for(const j of vars) weights[j]++;
  }
  function propagate(state) {
    let changed=true;
    while(changed) {
      changed=false;
      for(const [vars,target] of rules) {
        let placed=0,unknown=0;
        for(const j of vars) {if(state[j]===1) placed++;else if(state[j]<0) unknown++;}
        const need=target-placed;
        if(need<0||need>unknown) return false;
        if(unknown && (need===0||need===unknown)) {
          const val=need===0?0:1;
          for(const j of vars) if(state[j]<0) {state[j]=val;changed=true;}
        }
      }
    }
    return true;
  }
  let found=0;
  function search(state) {
    if(!propagate(state)) return;
    let best=-1,score=-1;
    for(let i=0;i<N;i++) if(state[i]<0&&weights[i]>score) {best=i;score=weights[i];}
    if(best<0) {found++;return;}
    for(const val of [1,0]) {const next=state.slice();next[best]=val;search(next);if(found>=limit)return;}
  }
  search(a);return found;
}
export function countSolutions(board,limit=2) {
  const indices=new Map(board.cells.map((c,i)=>[key(c),i]));
  const adjacent=board.cells.map(c=>neighbors(c).map(n=>indices.get(key(n))).filter(i=>i!==undefined));
  const clues=new Map(board.clues.map(([q,r,n])=>[indices.get(`${q},${r}`),n]));
  return countIndexed(adjacent,clues,limit);
}
function reduceFrom(seed,mode) {
  const {cells,adjacent}=geometries[mode],rng=new SplitMix64(seed);
  const shuffled=cells.map((_,i)=>i);rng.shuffle(shuffled);
  const locks=new Set(shuffled.slice(0,Math.floor(cells.length*MODES[mode].density)));
  const nonlocks=shuffled.filter(i=>!locks.has(i)).sort((a,b)=>a-b);
  const clues=new Map(nonlocks.map(i=>[i,adjacent[i].filter(j=>locks.has(j)).length]));
  let removal=nonlocks.slice();rng.shuffle(removal);
  removal=[...removal.filter(i=>clues.get(i)===0),...removal.filter(i=>clues.get(i)!==0)];
  for(const i of removal) {const value=clues.get(i);clues.delete(i);if(countIndexed(adjacent,clues)!==1) clues.set(i,value);}
  return {seed,cells,adjacent,clues,locks,unique:countIndexed(adjacent,clues)===1};
}
function reclue(board,mode,dayKey) {
  let {gimmes,clueFraction}=MODES[mode];
  if(dayKey.startsWith('pack-') && ['challenge','challenge2','precision','speed'].includes(dayKey.slice(5).split('-')[0])) return board;
  if(!gimmes&&!clueFraction) return board;
  const {cells,adjacent,locks,clues,seed}=board;
  const trueClue=i=>adjacent[i].filter(j=>locks.has(j)).length;
  let candidates=cells.map((_,i)=>i).filter(i=>!locks.has(i)&&!clues.has(i)&&trueClue(i)>0);
  new SplitMix64(seed^0xa5a55a5af0f00f0fn).shuffle(candidates);
  const desired=Math.max(clues.size,Math.round((cells.length-locks.size)*clueFraction));
  const isGimme=i=>{const value=trueClue(i), unknown=adjacent[i].filter(j=>!clues.has(j)).length;return value>0&&unknown>0&&value===unknown;};
  const reveal=i=>{clues.set(i,trueClue(i));candidates.splice(candidates.indexOf(i),1);};
  let added=0;
  while(clues.size<desired||added<gimmes) {const i=candidates.find(isGimme);if(i===undefined) break;reveal(i);added++;}
  while(clues.size<desired&&candidates.length) reveal(candidates[0]);
  return board;
}
export function generateUnique(mode,dayKey,seedOverride) {
  if(!Object.hasOwn(MODES,mode)) throw new Error('Unknown puzzle size');
  const startSeed=seedOverride===undefined?hash64(`${dayKey}|${mode}|D`):BigInt(seedOverride);
  const allowsZeros=startSeed%100n<5n;
  let seed=startSeed,best=null,firstUnique=null,bestZeros=Infinity;
  for(let attempt=0;attempt<60;attempt++) {
    const board=reduceFrom(seed,mode);
    if(board.unique) {
      if(!firstUnique) firstUnique=board;
      const zeros=[...board.clues.values()].filter(n=>n===0).length;
      if(allowsZeros||zeros===0) {best=board;break;}
      if(zeros<bestZeros) {bestZeros=zeros;best=board;}
    }
    seed=(seed+STEP)&MASK;
  }
  const board=reclue(best||firstUnique||reduceFrom(startSeed,mode),mode,dayKey);
  return {
    size:mode[0].toUpperCase()+mode.slice(1),radius:MODES[mode].radius,
    dayKey,seed:board.seed.toString(),generatorVersion:GENERATOR_VERSION,
    cells:board.cells.map(c=>c.slice()),
    clues:[...board.clues].sort((a,b)=>a[0]-b[0]).map(([i,n])=>[...board.cells[i],n]),
    solutionSize:board.locks.size,
    solution:[...board.locks].sort((a,b)=>a-b).map(i=>board.cells[i].slice())
  };
}
export function generateDaily(mode,dayKey) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error('Invalid day key');
  return generateUnique(mode,dayKey);
}
