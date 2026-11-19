import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LearningDashboardHeader({eyebrow,title,subtitle,links,children}:{
  eyebrow:string;title:string;subtitle?:string;links:Array<{label:string;to:string}>;children?:ReactNode;
}){
  return <header className="overflow-hidden rounded-[2rem] border border-blue-100 bg-[#eef5ff] text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
    <div className="grid gap-7 px-6 py-8 sm:px-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div>
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle&&<p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>}
      </div>
      {children&&<div className="flex flex-wrap gap-x-9 gap-y-4 border-t border-blue-200/80 pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0 dark:border-slate-700">{children}</div>}
    </div>
    <nav aria-label="Asosiy amallar" className="grid border-t border-blue-100 bg-white/75 sm:grid-cols-3 dark:border-slate-700 dark:bg-slate-950/60">
      {links.map(({to,label})=><Link key={to} to={to} className="flex min-h-12 items-center justify-between gap-3 border-b border-blue-100 px-6 py-3 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 motion-reduce:transition-none sm:border-b-0 sm:border-r dark:border-slate-700 dark:text-blue-200 dark:hover:bg-slate-800">
        {label}<ArrowUpRight size={16} aria-hidden="true"/>
      </Link>)}
    </nav>
  </header>;
}

export function DashboardMetric({value,label}:{value:string|number;label:string}){
  return <div><strong className="block text-3xl font-semibold tracking-tight tabular-nums text-blue-800 dark:text-blue-300">{value}</strong><span className="text-xs text-slate-600 dark:text-slate-300">{label}</span></div>;
}

