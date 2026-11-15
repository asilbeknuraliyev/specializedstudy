import type {RequestHandler} from 'express';
import {hasLeadershipPermission} from './leadershipSecurity';
/** New non-teaching roles must not fall through legacy teacher/student branches. */
export function staffPermissionGuard(authenticate:(req:any)=>any):RequestHandler{return(req,res,next)=>{
 if(!req.path.startsWith('/api/'))return next();const c=authenticate(req);if(c?.user.role!=='staff')return next();
 if(/^\/api\/(?:health$|state$|auth\/(?:login|provider-sync|logout|refresh)$|account\/(?:password|sessions|mfa|native-credentials|google-link)(?:\/|$))/.test(req.path))return next();
 if(req.path.startsWith('/api/leadership/')&&hasLeadershipPermission(c,'overview.read'))return next();
 if(req.path.startsWith('/api/content-imports')&&hasLeadershipPermission(c,'curriculum.manage'))return next();
 if(req.path.startsWith('/api/academic/')&&hasLeadershipPermission(c,'overview.read')&&(req.method==='GET'||hasLeadershipPermission(c,'curriculum.manage')))return next();
 return res.status(403).json({error:'Bu amal maktab xodimi vakolatiga kirmaydi.'});
};}
