let pendingRefresh:Promise<Response>|undefined;
export async function sessionFetch(input:string,init:RequestInit={}){
 if(input.startsWith('/api/'))try{const user=JSON.parse(localStorage.getItem('learnos_cached_user')||'null'),subject=user?.uid&&localStorage.getItem('ss_teaching_subject:'+user.uid);if(user?.role==='teacher'&&subject)init={...init,headers:{...Object.fromEntries(new Headers(init.headers).entries()),'X-Teaching-Subject':subject}};}catch{/* A missing browser preference never grants permission. */}
 const response=await fetch(input,{...init,credentials:'same-origin'});
 // Only repeat an unauthorized request: the server rejected it before a mutation.
 // Preserve its operation ID/body; never retry successful or ambiguous writes here.
 if(response.status!==401||!input.startsWith('/api/')||input.startsWith('/api/auth/'))return response;
 try{
  if(!pendingRefresh)pendingRefresh=fetch('/api/auth/refresh',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).finally(()=>{pendingRefresh=undefined;});
  const refresh=await pendingRefresh;if(!refresh.ok)return response;
  return fetch(input,{...init,credentials:'same-origin'});
 }catch{return response;}
}
