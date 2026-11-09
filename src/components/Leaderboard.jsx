import {useEffect,useState} from 'react';
import {api} from '../game/backend.js';
import {LEVELS} from '../game/config.js';
import Loading from './Loading.jsx';
export default function Leaderboard({user}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>{setBusy(true);setError('');try{setRows((await api('leaderboard')).leaderboard)}catch(e){setError(e.message)}finally{setBusy(false)}};
 useEffect(()=>{let live=true;setRows([]);setError('');if(!user){setBusy(false);return}setBusy(true);api('leaderboard').then(data=>{if(live)setRows(data.leaderboard)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[user?.user_id]);
 return <section className="leaderboard panel" aria-labelledby="class-top"><div className="section-heading"><div><span className="eyebrow">CÙNG NHAU TIẾN BỘ</span><h2 id="class-top">🏆 Top gõ phím cả lớp</h2><p>Mỗi bạn một kỷ lục cao nhất · Chữ rơi · Top 50</p></div>{user&&<button className="secondary" disabled={busy} onClick={load}>Làm mới bảng top</button>}</div>{!user?<p>Đăng nhập để xem bảng xếp hạng của lớp và lưu kỷ lục của bạn nhé!</p>:busy?<Loading label="Đang tải bảng xếp hạng…"/>:error?<p role="alert">{error} <button className="text-button" onClick={load}>Thử lại</button></p>:rows.length?<ol className="ranking-list">{rows.map(row=><li key={row.user_id} className={row.user_id===user.user_id?'is-you':''}><span className="rank">{row.rank<=3?['🥇','🥈','🥉'][row.rank-1]:row.rank}</span><span className="rank-name"><b>{row.name}{row.user_id===user.user_id?' (bạn)':''}</b><small>{LEVELS[row.difficulty]?.name||'Chữ rơi'}</small></span><strong>{row.score.toLocaleString('vi-VN')} <small>điểm</small></strong></li>)}</ol>:<p>Chưa có kỷ lục. Cùng hoàn thành lượt luyện đầu tiên nhé!</p>}</section>
}
