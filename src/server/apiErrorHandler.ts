import type {ErrorRequestHandler} from 'express';
export const apiErrorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
 if(res.headersSent){res.end();return;}
 const safeCode=typeof error?.code==='string'&&/^[A-Z0-9_]{1,24}$/.test(error.code)?error.code:'UNEXPECTED';
 console.warn(JSON.stringify({event:'api_request_failed',code:safeCode,route:_req.route?.path||'api'}));
 const conflict=error?.code==='40001'||error?.code==='P0001';if(conflict){res.status(409).set('Cache-Control','no-store').json({code:'DATA_CONFLICT',error:'Ma’lumot yoki dars holati o‘zgargan. Yangilab, taklif va tarixni tekshiring.'});return;}
 if(safeCode==='UPSTREAM_UNAVAILABLE'){res.status(503).set('Retry-After','3').json({code:'TEMPORARY',error:'Server aloqasi vaqtincha uzildi. Javobingizni saqlab, qayta urinib ko‘ring.'});return;}
 const large=error?.type==='entity.too.large',invalid=error?.type==='entity.parse.failed';
 res.status(large?413:invalid?400:500).set('Cache-Control','no-store').json({code:large?'PAYLOAD_TOO_LARGE':invalid?'INVALID_JSON':'INTERNAL',error:large?'Yuborilgan ma’lumot juda katta.':invalid?'So‘rov formati noto‘g‘ri.':'So‘rov bajarilmadi. Qayta urinib ko‘ring.'});
};
