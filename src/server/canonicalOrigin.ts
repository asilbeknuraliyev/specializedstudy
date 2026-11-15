import type {RequestHandler} from 'express';
export const CANONICAL_ORIGIN='https://specializedschool.vercel.app';
export const canonicalProduction:RequestHandler=(req,res,next)=>{if(process.env.VERCEL_ENV==='production'&&req.hostname!=='specializedschool.vercel.app')return res.redirect(['GET','HEAD'].includes(req.method)?301:308,CANONICAL_ORIGIN+req.originalUrl);next();};
