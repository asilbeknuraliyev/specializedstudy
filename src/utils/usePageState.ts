import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {useLearnOS} from '../context/LearnOSContext';
const preferences=new Map<string,unknown>();
/** Only list filters use this hook; learning content and answers stay server-owned. */
export function usePageState<T>(name:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{const {currentUser}=useLearnOS();const key=`${currentUser?.uid}:${window.location.pathname}:${name}`;const [value,setValue]=useState<T>(()=>preferences.has(key)?preferences.get(key) as T:typeof initial==='function'?(initial as ()=>T)():initial);useEffect(()=>{preferences.set(key,value);if(preferences.size>300)preferences.delete(preferences.keys().next().value!);},[key,value]);return[value,setValue];}
