import type {Express, Request} from 'express';
import {z} from 'zod';
import {asyncRoute} from './asyncRoute';
import {hasLeadershipPermission} from './leadershipSecurity';
import {studyRpc,supabaseEnabled} from './supabaseClient';
import {runtimeNamespace} from './runtimeScope';

type Context = {user:{uid:string;institutionId:string}; db:{institutions:Array<{id:string;academicYear?:string}>}};
export function registerContentOperationsRoutes(app:Express,deps:{
  authenticate:(req:Request)=>Context|null;
  owner:(user:any)=>boolean;
}){
  app.get('/api/content-operations',asyncRoute(async(req,res)=>{
    const context=deps.authenticate(req);
    if(!context)return res.status(401).json({error:'Hisobga kiring.'});
    if(!deps.owner(context.user)&&!hasLeadershipPermission(context,'overview.read'))
      return res.status(403).json({error:'O‘quv rejalari monitoringiga ruxsat yo‘q.'});
    if(!supabaseEnabled())return res.json({sources:[],jobs:[],missing:{total:0,rows:[]}});
    const query=z.object({page:z.coerce.number().int().min(0).max(400).default(0),subject:z.string().max(100).default('')}).safeParse(req.query);
    if(!query.success)return res.status(400).json({error:'Fan yoki sahifa qiymati xato.'});
    const school=context.user.institutionId;
    const year=context.db.institutions.find(entry=>entry.id===school)?.academicYear||'2026-2027';
    const scope={p_namespace:runtimeNamespace(),p_school:school,p_year:year};
    const [summary,missing,entries]=await Promise.all([
      studyRpc('study_content_summary',scope),
      studyRpc('study_content_unresolved',{...scope,p_offset:query.data.page*25,p_subject:query.data.subject}),
      studyRpc('study_content_job_list',scope)
    ]);
    res.set('Cache-Control','private, no-store').json({...summary,year,missing,entries,canManage:deps.owner(context.user)&&runtimeNamespace().startsWith('_specialized_preview_')});
  }));
  app.post('/api/content-operations/jobs/:id',asyncRoute(async(req,res)=>{
    const context=deps.authenticate(req);
    if(!context)return res.status(401).json({error:'Hisobga kiring.'});
    const namespace=runtimeNamespace();
    if(!deps.owner(context.user)||!supabaseEnabled()||!namespace.startsWith('_specialized_preview_'))
      return res.status(403).json({error:'Faqat sinov muhitida navbatni boshqarish mumkin.'});
    const parsed=z.object({id:z.string().min(1).max(100),action:z.enum(['pause','resume','retry'])}).safeParse({id:req.params.id,action:req.body?.action});
    if(!parsed.success)return res.status(400).json({error:'Navbat amali noto‘g‘ri.'});
    const school=context.user.institutionId;
    const year=context.db.institutions.find(entry=>entry.id===school)?.academicYear||'2026-2027';
    const result=await studyRpc('study_content_job_action',{
      p_namespace:namespace,p_school:school,p_year:year,p_id:parsed.data.id,p_action:parsed.data.action,p_actor:context.user.uid
    });
    if(!result.updated)return res.status(409).json({error:'Navbat holati o‘zgargan yoki qayta urinishlar chegarasi tugagan.'});
    return res.json(result);
  }));
}
