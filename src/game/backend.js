export async function api(action,body){
 const response=await fetch(body?'/api/tipy':`/api/tipy?action=${encodeURIComponent(action)}`,{
  method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,
  body:body?JSON.stringify({...body,action}):undefined
 });
 let data;try{data=await response.json()}catch{throw Error('Phần tài khoản đang được thiết lập. Bạn vẫn có thể chơi thử.')}
 if(!response.ok)throw Error(data.error||'Chưa xử lý được yêu cầu.');return data;
}
// The queue prevents a late heartbeat from overwriting the final result.
export function playRecorder(user,settings,report,request=api){
 let playId=null,closed=false,queue=Promise.resolve(),lastSeconds=0;
 const started=request('start',{gameCode:settings.gameCode||'falling_letters',difficulty:settings.difficulty,keys:settings.keys})
  .then(result=>{playId=result.data.play_id;return playId}).catch(error=>{report(error.message);return null});
 return {
  abandon(state){
   if(closed||!playId)return;
   closed=true;
   const body={action:'progress',playId,seconds:Math.floor(state.elapsed),score:state.score,result:'quit',metrics:{correct:state.correct,wrong:state.wrong,missed:state.missed}};
   if(typeof navigator!=='undefined'&&navigator.sendBeacon)navigator.sendBeacon('/api/tipy',new Blob([JSON.stringify(body)],{type:'application/json'}));
  },
  update(state,result='in_progress'){
   if(closed)return queue;
   const seconds=Math.floor(state.elapsed);
   if(result==='in_progress'&&seconds-lastSeconds<10)return queue;
   lastSeconds=seconds;if(result!=='in_progress')closed=true;
   const snapshot={seconds,score:state.score,result,metrics:{correct:state.correct,wrong:state.wrong,missed:state.missed}};
   queue=queue.then(async()=>{if(await started)await request('progress',{playId,...snapshot})}).catch(error=>report(error.message));return queue;
  }
 };
}
