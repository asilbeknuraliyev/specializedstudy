import crypto from 'node:crypto';
const key=(purpose:string)=>{
 const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw Error('Server encryption configuration missing');
 return crypto.createHmac('sha256',secret).update('specialized-study:envelope:v1:'+purpose).digest();
};
export function sealSecret(value:unknown,purpose:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(purpose),iv);cipher.setAAD(Buffer.from(purpose));const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.');}
export function openSecret<T>(sealed:string,purpose:string):T{const [version,iv,tag,value]=sealed.split('.');if(version!=='v1'||!iv||!tag||!value)throw Error('Invalid envelope');const decipher=crypto.createDecipheriv('aes-256-gcm',key(purpose),Buffer.from(iv,'base64url'));decipher.setAAD(Buffer.from(purpose));decipher.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value,'base64url')),decipher.final()]).toString('utf8'));}
