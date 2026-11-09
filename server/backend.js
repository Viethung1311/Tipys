import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

export class ApiError extends Error { constructor(status,message){super(message);this.status=status} }
export function username(value){const name=String(value??'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(name))throw new ApiError(400,'Tên đăng nhập dùng chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.');return name}
export function credential(name,password,secret){if(typeof password!=='string'||!password.length)throw new ApiError(400,'Bạn nhập mật khẩu nhé.');if(Buffer.byteLength(password)>1024)throw new ApiError(413,'Nội dung nhập quá lớn.');return createHmac('sha256',secret).update(`tipy-pin-v1\0${name}\0${password}`).digest('hex')}
export const emailFor=name=>`${createHash('sha256').update(name).digest('hex')}@accounts.tipy.invalid`;
export function requireAdmin(profile){if(profile.role!=='admin')throw new ApiError(403,'Chỉ giáo viên quản trị được dùng chức năng này.')}
const fail=(error,message='Chưa xử lý được yêu cầu. Bạn thử lại nhé.')=>{if(error)throw new ApiError(400,message)};
export const ready=env=>Boolean(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY&&env.TIPY_AUTH_SECRET?.length>=32);
export function createBackend(env,clientFactory=createClient){
 if(!ready(env))throw new ApiError(503,'Phần tài khoản đang được thiết lập. Bạn vẫn có thể chơi thử.');
 const client=()=>clientFactory(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const db=client();
 return {
  async auth(action,input,ip){
   const name=username(input.username);
   const password=credential(name,input.password,env.TIPY_AUTH_SECRET);
   const limitKey=createHmac('sha256',env.TIPY_AUTH_SECRET).update(`${action}\0${ip}\0${action==='signup'?'':name}`).digest('hex');
   const limit=await db.rpc('tipy_auth_limit',{p_key:limitKey,p_limit:action==='signup'?60:10});
   if(limit.error)throw new ApiError(503,'Chưa kết nối được phần tài khoản.');
   if(!limit.data)throw new ApiError(429,'Bạn thử nhiều lần rồi. Chờ 5 phút hoặc nhờ giáo viên giúp nhé.');
   if(action==='login'&&name==='admin'&&env.TIPY_ADMIN_INITIAL_PASSWORD){
    const expected=credential(name,env.TIPY_ADMIN_INITIAL_PASSWORD,env.TIPY_AUTH_SECRET);
    if(timingSafeEqual(Buffer.from(password),Buffer.from(expected))){
     const existing=await db.from('profiles').select('user_id').eq('username','admin').maybeSingle();
     if(existing.error)throw new ApiError(503,'Chưa kết nối được phần tài khoản.');
     if(!existing.data){
      const created=await db.auth.admin.createUser({email:emailFor('admin'),password,email_confirm:true,user_metadata:{username:'admin',full_name:'Giáo viên TIPY'},app_metadata:{tipy_role:'admin'}});
      // A concurrent first login may already have created the same admin.
      if(created.error&&!/already|registered|exists/i.test(created.error.message))throw new ApiError(503,'Chưa khởi tạo được tài khoản giáo viên.');
     }
    }
   }
   if(action==='signup'){
    if(name==='admin')throw new ApiError(400,'Tên này dành riêng cho giáo viên. Bạn chọn tên khác nhé.');
    const fullName=String(input.fullName??'').trim();if(!fullName||fullName.length>100)throw new ApiError(400,'Bạn nhập tên của mình nhé.');
    const created=await db.auth.admin.createUser({email:emailFor(name),password,email_confirm:true,user_metadata:{username:name,full_name:fullName},app_metadata:{tipy_role:'student'}});
    fail(created.error,'Chưa tạo được tài khoản. Tên đăng nhập có thể đã được sử dụng.');
   }
   const signed=await client().auth.signInWithPassword({email:emailFor(name),password});
   if(signed.error||!signed.data.session)throw new ApiError(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
   const profile=await this.profile(signed.data.user.id);
   return {profile,session:signed.data.session};
  },
  async profile(id){const {data,error}=await db.from('profiles').select('user_id,username,full_name,role,is_active').eq('user_id',id).single();if(error||!data?.is_active)throw new ApiError(403,'Tài khoản đang được khóa. Bạn nhờ giáo viên hỗ trợ nhé.');return data},
  async session(access,refresh){
   let rotated=null;
   let result=access?await db.auth.getUser(access):{error:true};
   if(result.error&&refresh){const renewed=await client().auth.refreshSession({refresh_token:refresh});if(!renewed.error){rotated=renewed.data.session;result=await db.auth.getUser(rotated.access_token)}}
   if(result.error||!result.data?.user)throw new ApiError(401,'Bạn đăng nhập trước nhé.');
   return {profile:await this.profile(result.data.user.id),session:rotated,access:rotated?.access_token||access};
  },
  async logout(access){if(access){const response=await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${access}`}});if(!response.ok&&response.status!==401)throw new ApiError(503,'Chưa đăng xuất được. Bạn thử lại nhé.')}},
  async games(admin=false){const query=db.from('games').select('*').order('created_at');const {data,error}=await(admin?query:query.eq('is_active',true));fail(error);return data},
  async history(profile){let query=db.from('play_history').select('*,games(game_code,game_name),profiles(username,full_name)').order('started_at',{ascending:false}).limit(100);if(profile.role!=='admin')query=query.eq('user_id',profile.user_id);const {data,error}=await query;fail(error);return data},
  async students(profile){requireAdmin(profile);const {data,error}=await db.from('profiles').select('user_id,username,full_name,role,is_active,created_at').eq('role','student').order('created_at',{ascending:false}).limit(200);fail(error);return data},
  async studentUpdate(profile,input){requireAdmin(profile);if(typeof input.active!=='boolean')throw new ApiError(400,'Trạng thái chưa hợp lệ.');const {data,error}=await db.from('profiles').update({is_active:input.active}).eq('user_id',input.userId).eq('role','student').select('user_id,is_active').single();fail(error);return data},
  async saveGame(profile,input){
   requireAdmin(profile);const code=String(input.gameCode??'');if(!/^[a-z][a-z0-9_]{0,49}$/.test(code))throw new ApiError(400,'Mã game dùng chữ thường, số và gạch dưới.');
   const name=String(input.name??'').trim();if(!name||name.length>100)throw new ApiError(400,'Bạn nhập tên game tối đa 100 ký tự.');
   if(!input.config||typeof input.config!=='object'||Array.isArray(input.config))throw new ApiError(400,'Cấu hình game phải là một đối tượng JSON.');
   if(code==='falling_letters')validateLevels(input.config.levels);
   const {data,error}=await db.from('games').upsert({game_code:code,game_name:name,engine_code:String(input.engineCode||code).slice(0,50),description:String(input.description||'').slice(0,1000),is_active:input.active!==false,config:input.config},{onConflict:'game_code'}).select().single();fail(error);return data;
  },
  async start(profile,input){
   const {data:game,error}=await db.from('games').select('*').eq('game_code',input.gameCode).eq('is_active',true).single();fail(error,'Trò chơi chưa được mở.');
   const difficulty=input.difficulty??null;if(difficulty!==null&&(!/^[a-z0-9_-]{1,40}$/.test(difficulty)||!game.config?.levels?.[difficulty]))throw new ApiError(400,'Độ khó chưa hợp lệ.');
   const keys=Array.isArray(input.keys)?[...new Set(input.keys)]:[];if(keys.some(k=>typeof k!=='string'||!/^[A-Z]$/.test(k)))throw new ApiError(400,'Bộ phím chưa hợp lệ.');
   if(game.engine_code==='falling_letters'&&!keys.length)throw new ApiError(400,'Bạn chọn ít nhất một phím nhé.');
   const {data,error:insertError}=await db.from('play_history').insert({user_id:profile.user_id,game_id:game.game_id,difficulty,metrics:{keys,config_snapshot:game.config}}).select().single();fail(insertError);return data;
  },
  async progress(profile,input){
   const {data:play,error}=await db.from('play_history').select('*,games(engine_code)').eq('play_id',input.playId).eq('user_id',profile.user_id).single();fail(error,'Không tìm thấy lượt chơi của bạn.');
   if(play.result!=='in_progress')return play; // Retrying a final save is idempotent.
   const values=validateProgress(play,input);
   const {data,error:updateError}=await db.from('play_history').update(values).eq('play_id',play.play_id).eq('user_id',profile.user_id).eq('result','in_progress').select().maybeSingle();fail(updateError);return data||play;
  }
 };
}
export function validateLevels(levels){
 if(!levels||!['easy','normal','hard'].every(key=>levels[key]))throw new ApiError(400,'Chữ rơi cần ba độ khó: easy, normal, hard.');
 for(const level of Object.values(levels)){
  if(!['fall','minFall','spawn','minSpawn','max'].every(key=>Number.isFinite(level[key])&&level[key]>0)||level.minFall>level.fall||level.minSpawn>level.spawn||level.minFall<1||level.minSpawn<.2||!Number.isInteger(level.max)||level.max>12)throw new ApiError(400,'Tốc độ hoặc số chữ vượt giới hạn cho phép.');
 }
}
export function validateProgress(play,input,now=Date.now()){
 const seconds=input.seconds,score=input.score,result=input.result??'in_progress';
 if(!Number.isInteger(seconds)||seconds<play.active_seconds||seconds>86400||!Number.isInteger(score)||score<play.score||score>1000000||!['in_progress','completed','game_over','quit'].includes(result))throw new ApiError(400,'Kết quả lượt chơi chưa hợp lệ.');
 if(seconds>Math.max(0,(now-Date.parse(play.started_at))/1000)+3)throw new ApiError(400,'Thời gian chơi chưa hợp lệ.');
 const old=play.metrics||{},metrics=input.metrics||{};
 if(play.games.engine_code==='falling_letters'){
  const {correct,wrong,missed}=metrics;
  if(![correct,wrong,missed].every(n=>Number.isInteger(n)&&n>=0)||correct<(old.correct||0)||wrong<(old.wrong||0)||missed<(old.missed||0)||missed>3||score!==correct*10||correct>seconds*20+20||wrong>seconds*30+30||(result==='game_over'&&missed!==3)||result==='completed')throw new ApiError(400,'Số chữ hoặc điểm chưa hợp lệ.');
 }
 return {score,active_seconds:seconds,result,ended_at:result==='in_progress'?null:new Date(now).toISOString(),metrics:{...old,correct:metrics.correct??0,wrong:metrics.wrong??0,missed:metrics.missed??0}};
}
