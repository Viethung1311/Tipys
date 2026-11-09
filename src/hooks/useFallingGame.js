import { useEffect,useRef,useState,useCallback } from 'react';
import {createGame,advance,press} from '../game/engine.js';
export default function useFallingGame(settings,onFinish,onSound){
 const model=useRef(null);if(!model.current)model.current=createGame(settings);
 const [view,setView]=useState(()=>({...model.current}));const finish=useRef(onFinish),sound=useRef(onSound);finish.current=onFinish;sound.current=onSound;
 const publish=useCallback(()=>setView({...model.current,letters:[...model.current.letters]}),[]);
 const hit=useCallback(key=>{const s=model.current;if(s.status!=='playing')return;press(s,key);sound.current(s.feedback);publish()},[publish]);
 const pause=useCallback(()=>{const s=model.current;if(['playing','countdown'].includes(s.status)){s.previous=s.status;s.status='paused';publish()}},[publish]);
 const resume=()=>{const s=model.current;if(s.status==='paused'){s.status=s.previous||'playing';publish()}};
 const restart=()=>{model.current=createGame(settings);publish()};
 useEffect(()=>{let frame,last=0,paint=0,reported=false;const loop=now=>{const dt=last?Math.max(0,(now-last)/1000):0;last=now;const s=model.current;const oldLives=s.lives;advance(s,dt);if(s.lives<oldLives)sound.current('missed');if(s.status==='result'&&!reported){finish.current({...s});reported=true}if(s.status!=='result')reported=false;if(now-paint>32){publish();paint=now}frame=requestAnimationFrame(loop)};frame=requestAnimationFrame(loop);return()=>cancelAnimationFrame(frame)},[publish]);
 useEffect(()=>{const down=e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.code==='Escape'){e.preventDefault();pause();return}if(/^Key[A-Z]$/.test(e.code)){e.preventDefault();hit(e.code.slice(3))}};const hidden=()=>{if(document.hidden)pause()};window.addEventListener('keydown',down);document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',pause);window.addEventListener('blur',pause);return()=>{window.removeEventListener('keydown',down);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',pause);window.removeEventListener('blur',pause)}},[hit,pause]);
 return {view,hit,pause,resume,restart};
}
