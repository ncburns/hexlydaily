import {MODES,SIZE_NAMES,dayKey,displayDay,formatTime,summary,dailySummary} from './state.js';

//Public destination for Hexly Daily share links.
export const SHARE_URL='https://hexlydaily.com';

export function shareModel(records,day,today=dayKey()) {
 const daily=dailySummary(records,day),stats=summary(records,today);
 return {
  day,date:displayDay(day,{month:'long',day:'numeric',year:'numeric'}),
  count:daily.count,complete:daily.complete,total:daily.complete?formatTime(daily.totalMs):null,
  streak:stats.streak,precisionStreak:stats.precisionStreak,url:SHARE_URL,
  runs:MODES.map(mode=>{
   const r=records.find(r=>r.day===day&&r.mode===mode&&r.solvedAt);
   return {title:SIZE_NAMES[mode],time:r?formatTime(r.elapsedMs||0):'—',state:r?(r.precisionWin?'precision':'normal'):'pending'};
  })
 };
}

export function shareText(model) {
 return `Hexly · ${model.date}\n\n${model.runs.map(r=>`${r.title}: ${r.time}${r.state==='precision'?' · Precision':''}`).join('\n')}${model.complete?'\nTOTAL TIME '+model.total:''}\n\n${model.streak}-day streak · ${model.precisionStreak}-day Precision streak\n${model.complete?'Beat my times ↓':`${model.count} of 4 done so far. Can you go faster? ↓`}\n${model.url}`;
}

function loadIcon(name) {
 return new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Share card icon could not load.'));
  image.src=new URL(`./${name}.svg${name==='flame'?'?v=2':''}`,import.meta.url).href;
 });
}
let icons;

//HomeShare.swift: StreakShareCard, ShareRunTile and ShareStreakStat at 360pt / 3x.
//The image carries the native card. The clickable website link is shared beneath it.
export async function renderShareCard(model) {
 const [flame,scope]=await (icons??=(Promise.all([loadIcon('flame'),loadIcon('scope-bright')]).catch(error=>{icons=null;throw error;})));
 const width=360,tileWidth=76,tileHeight=tileWidth/0.8660254037844386;
 const tilesY=103,tilesBottom=tilesY+tileHeight;
 const streakY=tilesBottom+16+(model.complete?29:0),ctaY=streakY+110,height=Math.ceil(ctaY+33);
 const canvas=document.createElement('canvas');canvas.width=width*3;canvas.height=height*3;
 const c=canvas.getContext('2d');c.scale(3,3);
 const color={bg0:'#0f1214',bg1:'#171a1f',text:'#ebedf2',secondary:'#a6adb8',muted:'#6b7380',teal:'#3dd6db',line:'#ffffff14'};
 const text=(value,x,y,size,weight=500,fill=color.text,align='left')=>{
  c.font=`${weight} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  c.fillStyle=fill;c.textAlign=align;c.textBaseline='top';c.fillText(String(value),x,y);
 };
 const tracked=(value,x,y,size,spacing,fill,center=false)=>{
  c.font=`700 ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;c.fillStyle=fill;c.textAlign='left';c.textBaseline='top';
  const total=[...value].reduce((sum,ch)=>sum+c.measureText(ch).width,0)+(value.length-1)*spacing;
  if(center)x-=total/2;
  for(const ch of value){c.fillText(ch,x,y);x+=c.measureText(ch).width+spacing;}
  return total;
 };
 c.fillStyle=color.bg0;c.fillRect(0,0,width,height);
 const gradient=c.createLinearGradient(0,0,width,height);gradient.addColorStop(0,color.bg1);gradient.addColorStop(1,color.bg0);
 c.beginPath();c.roundRect(.5,.5,width-1,height-1,22);c.fillStyle=gradient;c.fill();c.strokeStyle=color.line;c.lineWidth=1;c.stroke();
 text('Hexly',16,16,22,700);text(model.date,16,46,13,500,color.muted);
 tracked('TODAY',16,76,11,1.5,color.teal);
 const rule=c.createLinearGradient(75,0,255,0);rule.addColorStop(0,'#3dd6db59');rule.addColorStop(1,'#3dd6db00');
 c.fillStyle=rule;c.fillRect(75,82,177,1);c.drawImage(scope,263,76,11,11);text('= Precision',279,76,11,500,color.muted);
 for(const [i,run] of model.runs.entries()){
  const x=16+i*(tileWidth+8),cx=x+tileWidth/2;
  c.beginPath();c.moveTo(cx,tilesY);c.lineTo(x+tileWidth,tilesY+tileHeight/4);c.lineTo(x+tileWidth,tilesY+tileHeight*.75);c.lineTo(cx,tilesBottom);c.lineTo(x,tilesY+tileHeight*.75);c.lineTo(x,tilesY+tileHeight/4);c.closePath();
  c.fillStyle=run.state==='precision'?'#3dd6db1a':run.state==='normal'?'#1f212959':'#0f121466';c.fill();
  c.strokeStyle=run.state==='precision'?color.teal:run.state==='normal'?color.line:'#6b738080';c.lineWidth=run.state==='normal'?1:1.5;c.setLineDash(run.state==='pending'?[4,3]:[]);c.stroke();c.setLineDash([]);
  const centerY=tilesY+tileHeight/2;
  text(run.title,cx,centerY-21,10,600,run.state==='pending'?color.muted:color.secondary,'center');
  //Fit hour-length records without allowing them to cross the tile's sides.
  c.font='700 15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';const timeSize=Math.min(15,15*(tileWidth-10)/Math.max(1,c.measureText(run.time).width));
  text(run.time,cx,centerY-7,timeSize,700,run.state==='pending'?'#6b7380b3':color.text,'center');
  if(run.state==='precision')c.drawImage(scope,cx-5,centerY+13,10,10);
  if(run.state==='normal'){c.fillStyle=color.muted;c.beginPath();c.arc(cx,centerY+18,2,0,Math.PI*2);c.fill();}
 }
 if(model.complete){
  c.font='700 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';const timeWidth=c.measureText(model.total).width,labelWidth=c.measureText('TOTAL TIME').width+9*1.5;
  const start=(width-labelWidth-8-timeWidth)/2;tracked('TOTAL TIME',start,tilesBottom+16,11,1.5,color.muted);text(model.total,start+labelWidth+8,tilesBottom+16,11,700);
 }
 c.drawImage(flame,92-9,streakY+2,18,21);c.drawImage(scope,268-7.5,streakY+5,15,15);
 text(model.streak,92,streakY+28,28,700,color.text,'center');text(model.precisionStreak,268,streakY+28,28,700,color.teal,'center');
 tracked('DAY STREAK',92,streakY+68,11,.5,color.muted,true);tracked('PRECISION STREAK',268,streakY+68,11,.5,color.muted,true);
 c.fillStyle=color.line;c.fillRect(179.5,streakY+21,1,40);
 if(model.complete)text('Beat my times  ↓',180,ctaY,14,500,color.secondary,'center');
 else{
  const lead=`${model.count} of 4 done so far.  `,end='Can you go faster?  ↓';
  c.font='500 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';const leadWidth=c.measureText(lead).width;
  c.font='600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';const start=(width-leadWidth-c.measureText(end).width)/2;
  text(lead,start,ctaY,13,500,color.muted);text(end,start+leadWidth,ctaY,13,600,color.secondary);
 }
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)throw Error('Share card could not be generated.');
 return blob;
}
