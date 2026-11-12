// Private server memory only. Reads return isolated JSON values; total memory,
// entry count, individual report size and age are all bounded.
export class AnalysisCache<T>{
 private entries=new Map<string,{value:string;bytes:number;at:number}>();private bytes=0;
 constructor(private maxBytes=8*1024*1024,private maxEntry=2*1024*1024,private maxEntries=20,private ttl=300000,private now=()=>Date.now()){}
 get(key:string):T|undefined{const e=this.entries.get(key);if(!e)return;if(this.now()-e.at>=this.ttl){this.entries.delete(key);this.bytes-=e.bytes;return;}this.entries.delete(key);this.entries.set(key,e);return JSON.parse(e.value);}
 set(key:string,value:T){const previous=this.entries.get(key);if(previous){this.entries.delete(key);this.bytes-=previous.bytes;}const serialized=JSON.stringify(value),bytes=Buffer.byteLength(serialized);if(bytes>this.maxEntry||bytes>this.maxBytes)return;while(this.entries.size&&(this.bytes+bytes>this.maxBytes||this.entries.size>=this.maxEntries)){const first=this.entries.keys().next().value!;this.bytes-=this.entries.get(first)!.bytes;this.entries.delete(first);}this.entries.set(key,{value:serialized,bytes,at:this.now()});this.bytes+=bytes;}
}
