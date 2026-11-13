import type {RequestHandler} from 'express';
export const CANONICAL_ORIGIN='https://specializedschool.vercel.app';
export const canonicalProduction:RequestHandler=(req,res,next)=>{if(process.env.VERCEL_ENV==='production'&&req.hostname!=='specializedschool.vercel.app')return res.redirect(307,CANONICAL_ORIGIN+req.originalUrl);next();};
