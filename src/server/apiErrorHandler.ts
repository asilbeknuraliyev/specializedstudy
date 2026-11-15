import type {ErrorRequestHandler} from 'express';
export const apiErrorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
 if(res.headersSent){res.end();return;}
 const conflict=error?.code==='40001'||error?.code==='P0001';if(conflict){res.status(409).set('Cache-Control','no-store').json({code:'DATA_CONFLICT',error:'Ma’lumot yoki dars holati o‘zgargan. Yangilab, taklif va tarixni tekshiring.'});return;}
 const large=error?.type==='entity.too.large',invalid=error?.type==='entity.parse.failed';
 res.status(large?413:invalid?400:500).set('Cache-Control','no-store').json({code:large?'PAYLOAD_TOO_LARGE':invalid?'INVALID_JSON':'INTERNAL',error:large?'Yuborilgan ma’lumot juda katta.':invalid?'So‘rov formati noto‘g‘ri.':'So‘rov bajarilmadi. Qayta urinib ko‘ring.'});
};
