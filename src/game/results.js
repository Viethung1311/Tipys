export function resultRows(stats){
 return stats.flatMap(stat=>{
  const base={user_id:stat.user_id,game_id:stat.game_id,profiles:stat.profiles,games:stat.games,total_active_seconds:Number(stat.total_active_seconds),total_plays:Number(stat.total_plays)};
  const best=stat.best_play,recent=stat.latest_play;
  if(best&&recent&&best.play_id===recent.play_id)return [{...base,...best,result_type:'best_recent'}];
  return [...(best?[{...base,...best,result_type:'best'}]:[]),...(recent?[{...base,...recent,result_type:'recent'}]:[])];
 });
}
export const resultType=type=>({best:'Cao nhất',recent:'Gần nhất',best_recent:'Cao nhất & gần nhất'}[type]||'Gần nhất');
export const resultLabel=row=>row.metrics?.wrong>5?'Sai quá 5 lần':({game_over:'Hết mạng',quit:'Dừng giữa chừng',completed:'Hoàn thành',in_progress:'Đang chơi'}[row.result]||row.result);
export function practiceTime(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${h} giờ ${m} phút`:`${m} phút ${s} giây`}
