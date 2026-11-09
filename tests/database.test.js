import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('Postgres schema, constraints, RLS ownership, admin isolation and reserved admin account',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const schema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
 for(const [id,name,meta]of [[a,'banan',{}],[b,'banbinh',{role:'admin'}],[admin,'admin',{}]]){
  await db.query('insert into auth.users values($1,$2,$3)',[id,{username:name,full_name:name,...meta},name==='admin'?{tipy_role:'admin'}:{}]);
 }
 assert.equal((await db.query('select role from profiles where user_id=$1',[b])).rows[0].role,'student');
 await assert.rejects(db.query('insert into auth.users values(gen_random_uuid(),$1,$2)',[{username:'admin',full_name:'Fake admin'},{}]));
 const game=(await db.query('select game_id from games')).rows[0].game_id;
 for(const id of [a,b])await db.query('insert into play_history(user_id,game_id) values($1,$2)',[id,game]);
 await assert.rejects(db.query("insert into play_history(user_id,game_id,result) values($1,$2,'game_over')",[a,game]));
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 assert.equal((await db.query('select * from profiles')).rows.length,1);assert.equal((await db.query('select * from play_history')).rows.length,1);
 await assert.rejects(db.exec("update profiles set role='admin'"));
 await assert.rejects(db.query('insert into play_history(user_id,game_id) values($1,$2)',[a,game]));
 await db.exec(`set request.jwt.claim.sub='${admin}';`);assert.equal((await db.query('select * from profiles')).rows.length,3);assert.equal((await db.query('select * from play_history')).rows.length,2);
 await db.exec('reset role;set role anon;');assert.equal((await db.query('select * from games')).rows.length,1);await assert.rejects(db.exec('select * from profiles'));await assert.rejects(db.exec('select * from play_history'));
 await db.exec('reset role;set role service_role;');
 for(let i=0;i<10;i++)assert.equal((await db.query('select tipy_auth_limit($1,10) as allowed',['a'.repeat(64)])).rows[0].allowed,true);
 assert.equal((await db.query('select tipy_auth_limit($1,10) as allowed',['a'.repeat(64)])).rows[0].allowed,false);
 }finally{await db.close()}
});
