import {useEffect} from 'react';
export function useUnsavedChanges(dirty:boolean){
 useEffect(()=>{if(!dirty)return;const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};const click=(event:MouseEvent)=>{const anchor=(event.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download')||anchor.href===location.href)return;if(!window.confirm('Saqlanmagan o‘zgarishlar bor. Sahifadan chiqasizmi?')){event.preventDefault();event.stopPropagation();}};window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);};},[dirty]);
}
