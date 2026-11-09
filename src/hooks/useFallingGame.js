import { useEffect,useRef,useState,useCallback } from 'react';
import {createGame,advance,press,speed} from '../game/engine.js';
export default function useFallingGame(settings,onFinish,onSound,onProgress){
 const model=useRef(null);if(!model.current)model.current=createGame(settings);
 const [view,setView]=useState(()=>({...model.current}));const finish=useRef(onFinish),sound=useRef(onSound),progress=useRef(onProgress);finish.current=onFinish;sound.current=onSound;progress.current=onProgress;
 const publish=useCallback(()=>setView({...model.current,letters:[...model.current.letters]}),[]);
 const hit=useCallback(key=>{const s=model.current;if(s.status!=='playing')return;press(s,key);sound.current(s.feedback);publish()},[publish]);
 const pause=useCallback(()=>{const s=model.current;if(['playing','countdown'].includes(s.status)){s.previous=s.status;s.status='paused';publish()}},[publish]);
 const resume=()=>{const s=model.current;if(s.status==='paused'){s.status=s.previous||'playing';publish()}};
 const restart=()=>{model.current=createGame(settings);publish()};
 useEffect(()=>{
  let frame,last=0,paint=0,reported=false,lastBeat=null,lastRound=model.current;
  const loop=now=>{
   const dt=last?Math.max(0,(now-last)/1000):0;last=now;
   const s=model.current;
   if(lastRound!==s){lastRound=s;lastBeat=null;reported=false}
   if(s.status==='countdown'){
    const beat=Math.ceil(s.countdown);
    if(beat!==lastBeat&&beat>0){sound.current(beat===1?'countdownLast':'countdown');lastBeat=beat}
   }
   const previousStatus=s.status,oldLives=s.lives,oldSpeed=speed(s);
   advance(s,dt);
   if(previousStatus==='countdown'&&s.status==='playing')sound.current('start');
   if(s.lives<oldLives)sound.current('missed');
   const nextSpeed=speed(s);
   if(s.status==='playing'&&(nextSpeed.fall<oldSpeed.fall||nextSpeed.spawn<oldSpeed.spawn))sound.current('speed');
   if(s.status==='result'&&!reported){const newRecord=finish.current({...s});sound.current(newRecord?'record':'finish');reported=true}
   if(now-paint>32){progress.current?.(s);publish();paint=now}
   frame=requestAnimationFrame(loop);
  };
  frame=requestAnimationFrame(loop);return()=>cancelAnimationFrame(frame);
 },[publish]);
 useEffect(()=>{const down=e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.code==='Escape'){e.preventDefault();pause();return}if(/^Key[A-Z]$/.test(e.code)){e.preventDefault();hit(e.code.slice(3))}};const hidden=()=>{if(document.hidden)pause()};window.addEventListener('keydown',down);document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',pause);window.addEventListener('blur',pause);return()=>{window.removeEventListener('keydown',down);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',pause);window.removeEventListener('blur',pause)}},[hit,pause]);
 return {view,hit,pause,resume,restart};
}
