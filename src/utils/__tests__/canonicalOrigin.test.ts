import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalProduction} from '../../server/canonicalOrigin';
test('production canonical domain preserves API path/query while preview remains isolated and new host does not redirect',()=>{
  const previous=process.env.VERCEL_ENV;
  function run(hostname:string,env:string){process.env.VERCEL_ENV=env;let next=false,redirect:any;canonicalProduction({hostname,originalUrl:'/api/health?check=release'} as any,{redirect:(status:number,url:string)=>{redirect={status,url};}} as any,()=>{next=true;});return {next,redirect};}
  try{
    assert.deepEqual(run('specializedschool.vercel.app','production'),{next:true,redirect:undefined});
    assert.deepEqual(run('specializedstudy.vercel.app','production'),{next:false,redirect:{status:307,url:'https://specializedschool.vercel.app/api/health?check=release'}});
    assert.deepEqual(run('preview.vercel.app','preview'),{next:true,redirect:undefined});
  }finally{if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;}
});
