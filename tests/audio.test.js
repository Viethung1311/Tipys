import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio, AUDIO_DEFAULTS, normalizeAudio, SOUNDS} from '../src/game/audio.js';

class Parameter {
  values=[];
  setValueAtTime(value,time){this.values.push({value,time})}
  exponentialRampToValueAtTime(value,time){this.values.push({value,time})}
  setTargetAtTime(value,time){this.values.push({value,time})}
  cancelScheduledValues(){}
}
class FakeContext {
  currentTime=0;state='running';destination={};oscillators=[];gains=[];
  createGain(){const gain={gain:new Parameter(),connect(){},disconnect(){}};this.gains.push(gain);return gain}
  createOscillator(){const oscillator={frequency:new Parameter(),connect(){},disconnect(){},start(time){this.started=time},stop(time){this.stopped=time}};this.oscillators.push(oscillator);return oscillator}
  resume(){return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
}
function setup(preferences=AUDIO_DEFAULTS){const ctx=new FakeContext(),audio=new GameAudio(()=>ctx);audio.configure(preferences);audio.unlock();return {ctx,audio}}

test('effects default on, music off; old mute preference and malformed values are safe',()=>{
 assert.equal(normalizeAudio().effectsEnabled,true);assert.equal(normalizeAudio().musicEnabled,false);
 assert.equal(normalizeAudio({},true).effectsEnabled,false);
 assert.deepEqual(normalizeAudio({effectsVolume:2,musicVolume:-3,musicEnabled:'true'}),{...AUDIO_DEFAULTS,effectsVolume:1,musicVolume:0});
 assert.equal(normalizeAudio(null).musicEnabled,false);
});
test('nothing plays before user gesture; unsupported audio fails without breaking game',()=>{
 let created=0;const audio=new GameAudio(()=>{created++;throw Error('unsupported')});audio.play('correct');assert.equal(created,0);assert.doesNotThrow(()=>audio.unlock());assert.doesNotThrow(()=>audio.play('correct'));audio.destroy();
});
test('correct pop is short and wrong sound is quieter; countdown ends higher',()=>{
 assert.ok(SOUNDS.correct[0].duration>=.08&&SOUNDS.correct[0].duration<=.15);
 assert.ok(SOUNDS.wrong[0].volume<SOUNDS.correct[0].volume);
 assert.ok(SOUNDS.countdownLast[0].frequency>SOUNDS.countdown[0].frequency);
 for(const kind of ['finish','record'])assert.ok(SOUNDS[kind].every(note=>note.volume<=.15));
});
test('rapid key spam is limited and at most four effect groups overlap',()=>{
 const {ctx,audio}=setup();audio.play('correct');for(let i=0;i<40;i++)audio.play('correct');assert.equal(ctx.oscillators.length,1);
 for(let i=0;i<20;i++){ctx.currentTime+=.05;audio.play('countdown')}
 assert.ok(audio.groups.length<=4);audio.destroy();assert.equal(ctx.state,'closed');
});
test('effects mute and volume zero silence immediately, independently of music',()=>{
 const {ctx,audio}=setup();audio.play('correct');assert.equal(audio.groups.length,1);
 audio.configure({...AUDIO_DEFAULTS,effectsEnabled:false});assert.equal(audio.groups.length,0);ctx.currentTime+=1;audio.play('correct');assert.equal(ctx.oscillators.length,1);
 audio.configure({...AUDIO_DEFAULTS,effectsVolume:0,musicEnabled:true});audio.play('correct');assert.equal(ctx.oscillators.length,1);audio.destroy();
});
test('background melody only runs during active play and stops on pause or exit',async()=>{
 const {ctx,audio}=setup({...AUDIO_DEFAULTS,musicEnabled:true});assert.equal(ctx.oscillators.length,0);
 audio.setActive(true);assert.equal(ctx.oscillators.length,1);audio.setActive(true);assert.equal(ctx.oscillators.length,1);
 audio.setActive(false);const count=ctx.oscillators.length;await new Promise(resolve=>setTimeout(resolve,480));assert.equal(ctx.oscillators.length,count);assert.equal(audio.musicTimer,null);assert.equal(audio.musicVoices.size,0);
 audio.setActive(true);assert.equal(ctx.oscillators.length,count+1);audio.configure({...AUDIO_DEFAULTS,musicEnabled:false});assert.equal(audio.musicTimer,null);audio.destroy();
});
test('new-record jingle replaces old effects instead of stacking over end-of-round audio',()=>{
 const {ctx,audio}=setup();audio.play('missed');ctx.currentTime+=.01;audio.play('record');assert.equal(audio.groups.length,1);assert.equal(audio.groups[0].voices.size,SOUNDS.record.length);audio.destroy();
});
