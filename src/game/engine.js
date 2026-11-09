import { LEVELS } from './config.js';
export const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
export const accuracy=s=>s.correct+s.wrong?Math.round(s.correct/(s.correct+s.wrong)*100):0;
export function shuffle(keys,random=Math.random){const a=[...keys];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function createGame(settings){return {settings:{...settings,keys:[...settings.keys]},status:'countdown',countdown:3,elapsed:0,score:0,lives:3,correct:0,wrong:0,missed:0,letters:[],bag:[],spawnIn:0,nextId:0,lastKey:'',feedback:''}}
export function speed(s){const c=(s.settings.levels||LEVELS)[s.settings.difficulty],step=Math.floor(s.elapsed/20);return {fall:Math.max(c.minFall,c.fall-step*.5),spawn:Math.max(c.minSpawn,c.spawn-step*.1),max:c.max}}
export function press(s,key){if(s.status!=='playing')return; s.lastKey=key;const target=s.letters.filter(x=>x.key===key).sort((a,b)=>b.y-a.y)[0];if(target){s.letters=s.letters.filter(x=>x.id!==target.id);s.score+=10;s.correct++;s.feedback='correct'}else{s.wrong++;s.feedback='wrong';if(s.wrong>5){s.status='result';s.endReason='wrong_limit'}}}
export function advance(s,dt,random=Math.random){
 if(s.status==='countdown'){s.countdown=Math.max(0,s.countdown-dt);if(s.countdown===0)s.status='playing';return}
 if(s.status!=='playing')return;
 s.elapsed+=dt;const v=speed(s);
 for(const letter of s.letters)letter.y+=dt/letter.fall;
 const lost=s.letters.filter(x=>x.y>=1);s.letters=s.letters.filter(x=>x.y<1);
 if(lost.length){const n=Math.min(s.lives,lost.length);s.lives-=n;s.missed+=n;s.feedback='missed'}
 if(!s.lives){s.status='result';return}
 s.spawnIn-=dt;
 if(s.spawnIn<=0&&s.letters.length<v.max&&s.settings.keys.length){
  if(!s.bag.length)s.bag=shuffle(s.settings.keys,random);
  const occupied=new Set(s.letters.filter(x=>x.y<.2).map(x=>x.column));const cols=[0,1,2,3,4,5].filter(c=>!occupied.has(c));
  if(cols.length){s.letters.push({id:s.nextId++,key:s.bag.pop(),column:cols[Math.floor(random()*cols.length)],y:0,fall:v.fall});s.spawnIn=v.spawn}
 }
}
