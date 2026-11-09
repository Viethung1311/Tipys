export const ROWS=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
export const PRESETS={'4 phím':['F','G','H','J'],'6 phím':['D','F','G','H','J','K'],'8 phím':['A','S','D','F','H','J','K','L'],'A–Z':'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')};
export const LEVELS={easy:{name:'Dễ',icon:'🌱',description:'Chậm rãi làm quen',fall:9,minFall:5,spawn:2,minSpawn:1.2,max:4},normal:{name:'Bình thường',icon:'🌿',description:'Tự tin tăng tốc',fall:7,minFall:4,spawn:1.5,minSpawn:.9,max:6},hard:{name:'Khó',icon:'🌳',description:'Thử tài phản xạ',fall:5.5,minFall:3,spawn:1.1,minSpawn:.65,max:8}};
export const DEFAULT={difficulty:'easy',keys:PRESETS['4 phím']};
export function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
export function save(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* Game stays playable when storage is unavailable. */}}
export function readSettings(){const s=load('tipy-settings',DEFAULT);return s&&LEVELS[s.difficulty]&&Array.isArray(s.keys)?{difficulty:s.difficulty,keys:[...new Set(s.keys.filter(k=>/^[A-Z]$/.test(k)))]}:DEFAULT}
export function recordKey(s){return `tipy-best-${s.difficulty}-${[...s.keys].sort().join('')}`}
