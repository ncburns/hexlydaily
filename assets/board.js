export class Board {
 constructor(element,viewport,onAction){this.el=element;this.viewport=viewport;this.onAction=onAction;this.focused=null;this.active=null;this.pointer=null;this.ignore=null;this.zoom=1;this.timers=new Set();
  window.addEventListener('pointermove',e=>{if(this.pointer&&e.pointerId===this.pointer.id&&Math.hypot(e.clientX-this.pointer.x,e.clientY-this.pointer.y)>10){this.ignore={cell:this.pointer.cell,until:performance.now()+900};this.cancelPointer();}},{passive:true});
  for(const event of ['pointerup','pointercancel','blur'])window.addEventListener(event,()=>this.cancelPointer());
 }
 later(fn,ms){const id=setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;}
 cancelPointer(){if(this.pointer){clearTimeout(this.pointer.timer);this.pointer=null;}}
 adjacent(a,b){const q=+a.dataset.q-+b.dataset.q,r=+a.dataset.r-+b.dataset.r;return (Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2===1;}
 key(cell){return cell.dataset.q+','+cell.dataset.r;}
 render(puzzle){this.cancelPointer();this.timers.forEach(clearTimeout);this.timers.clear();this.focused=null;this.active=null;this.ignore=null;this.puzzle=puzzle;
  const radius=puzzle.radius,size=Math.min(38,336/(Math.sqrt(3)*(2*radius+1)),316/(3*radius+2)),w=Math.sqrt(3)*size,h=2*size;
  const points=r=>Array.from({length:6},(_,i)=>{const angle=(i*60-30)*Math.PI/180;return (w/2+Math.cos(angle)*r).toFixed(4)+','+(h/2+Math.sin(angle)*r).toFixed(4);}).join(' ');
  const hex=points(w*.46),ring=points(h*1.06*.46),map=new Map(puzzle.clues.map(([q,r,n])=>[q+','+r,n])),rows={};
  this.el.innerHTML=[...puzzle.cells].sort((a,b)=>a[1]-b[1]||a[0]-b[0]).map(([q,r],i)=>{const row=r+radius+1;rows[row]=(rows[row]||0)+1;const n=map.get(q+','+r),label='Row '+row+', hex '+rows[row]+(n!==undefined?', clue '+n:'');const x=180+Math.sqrt(3)*size*(q+r/2),y=170+1.5*size*r,id='mark-'+i;
   return `<button class="demo-hex ${n!==undefined?'demo-clue':'demo-choice'}" type="button" style="left:${(x-w/2)/360*100}%;top:${(y-h/2)/340*100}%;width:${w/360*100}%;height:${h/340*100}%" data-q="${q}" data-r="${r}" ${n!==undefined?'data-clue="'+n+'"':'data-choice'} data-cell-label="${label}" aria-label="${label}" aria-pressed="false"><svg class="demo-tile" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="110" height="120"><polygon class="tile-mark-draw" points="${hex}" pathLength="100" fill="none" stroke="white" stroke-width="5"/></mask></defs><polygon class="tile-base" points="${hex}"/><polygon class="tile-fill" points="${hex}"/><polygon class="tile-glow" points="${hex}"/><polygon class="tile-border" points="${hex}"/><polygon class="tile-mark" points="${hex}" mask="url(#${id})"/><polygon class="tile-neighbor" points="${hex}"/><polygon class="tile-focus" points="${hex}"/><polygon class="tile-active" points="${ring}"/><polygon class="tile-bloom" points="${hex}"/></svg>${n!==undefined?'<span class="demo-number" aria-hidden="true">'+n+'</span>':''}</button>`;
  }).join('');
  this.el.style.setProperty('--number-size',(Math.min(18,size*.62)/360*100)+'cqw');this.el.setAttribute('aria-label',puzzle.size+' daily puzzle');
  this.cells=[...this.el.querySelectorAll('[data-q]')];this.choices=this.cells.filter(c=>c.hasAttribute('data-choice'));this.clues=this.cells.filter(c=>c.hasAttribute('data-clue'));
  this.cells.forEach(cell=>{
   cell.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||this.record?.solvedAt)return;this.onAction('unlock');this.cancelPointer();this.pointer={cell,id:e.pointerId,x:e.clientX,y:e.clientY};if(cell.hasAttribute('data-choice'))this.pointer.timer=setTimeout(()=>{if(!this.pointer||this.pointer.cell!==cell)return;this.ignore={cell,until:performance.now()+1200};this.action('mark',cell);},350);});
   cell.addEventListener('click',e=>{if(e.detail>0&&this.ignore?.cell===cell&&performance.now()<this.ignore.until){e.preventDefault();this.ignore=null;return;}this.ignore=null;this.action('select',cell);});
   cell.addEventListener('contextmenu',e=>{e.preventDefault();if(this.ignore?.cell===cell&&performance.now()<this.ignore.until)return;this.cancelPointer();this.action('mark',cell);});
   cell.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='m'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)this.action('mark',cell);}});
  });this.setZoom(1);
 }
 action(type,cell){if(this.record?.solvedAt)return;this.active=cell;if(cell.hasAttribute('data-clue')){if(type==='select'){this.focused=this.focused?null:cell;this.focus();}return;}this.focused=null;this.focus();this.onAction(type,this.key(cell),cell);}
 focus(){this.cells.forEach(c=>{c.classList.toggle('is-active',c===this.active);c.classList.toggle('is-focused',c===this.focused);c.classList.toggle('is-neighbor',!!this.focused&&c.hasAttribute('data-choice')&&this.adjacent(c,this.focused));if(c.hasAttribute('data-clue'))c.setAttribute('aria-pressed',String(c===this.focused));});}
 evaluate(record){let correct=0,over=false;const selected=new Set(record.selected);const details=this.puzzle.clues.map(([q,r,n])=>{const count=this.puzzle.cells.filter(([a,b])=>selected.has(a+','+b)&&(Math.abs(a-q)+Math.abs(b-r)+Math.abs(a+b-q-r))/2===1).length;if(count===n)correct++;if(count>n)over=true;return {q,r,n,count};});return {correct,over,total:this.puzzle.clues.length,solved:correct===this.puzzle.clues.length,details};}
 update(record,{celebrate=false,revealKeys=[],revealInterval=38}={}){this.record=record;const selected=new Set(record.selected),marked=new Set(record.marked),result=this.evaluate(record);this.choices.forEach(c=>{const key=this.key(c);c.classList.toggle('is-selected',selected.has(key));c.classList.toggle('is-marked',marked.has(key));c.setAttribute('aria-pressed',String(selected.has(key)));c.setAttribute('aria-label',c.dataset.cellLabel+(selected.has(key)?', selected':marked.has(key)?', marked unused':''));});
  for(const detail of result.details){const c=this.clues.find(c=>+c.dataset.q===detail.q&&+c.dataset.r===detail.r);c.classList.toggle('is-correct',detail.count===detail.n);c.classList.toggle('is-over',detail.count>detail.n);c.setAttribute('aria-label',c.dataset.cellLabel+': '+detail.count+' selected neighbors'+(detail.count===detail.n?', correct':detail.count>detail.n?', too many':''));}
  this.cells.forEach(c=>record.solvedAt?c.setAttribute('aria-disabled','true'):c.removeAttribute('aria-disabled'));
  if(record.solvedAt){this.active=null;this.focused=null;this.focus();}
  if(celebrate){this.setZoom(1);const reveal=new Set(revealKeys);let n=0;for(const c of this.choices.filter(c=>reveal.has(this.key(c))).sort((a,b)=>+a.dataset.q-+b.dataset.q||+a.dataset.r-+b.dataset.r)){c.classList.remove('is-marked');this.later(()=>{c.classList.add('is-marked');},n++*revealInterval);}}


  return result;
 }
 animate(cell,type){cell.classList.add(type==='select'?'is-placing':'is-new-mark');this.later(()=>cell.classList.remove('is-placing','is-new-mark'),220);}
 setZoom(value){const old=this.zoom,mx=this.viewport.scrollLeft+this.viewport.clientWidth/2,my=this.viewport.scrollTop+this.viewport.clientHeight/2;this.zoom=Math.max(1,Math.min(2.5,value));this.el.style.width=this.zoom*100+'%';this.viewport.classList.toggle('is-zoomed',this.zoom>1);if(this.zoom>1){this.viewport.scrollLeft=mx*this.zoom/old-this.viewport.clientWidth/2;this.viewport.scrollTop=my*this.zoom/old-this.viewport.clientHeight/2;}else{this.viewport.scrollLeft=0;this.viewport.scrollTop=0;}return this.zoom;}
}
