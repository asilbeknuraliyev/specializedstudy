import {RichQuestionText} from './QuestionInput';
import {QuadraticExplorer} from './QuadraticExplorer';

export function ExplanationPanel({explanation,steps=[],diagram}:{explanation?:string;steps?:string[];diagram?:'quadratic-substitution'}) {
  return <section aria-label="Yechim izohi" className="space-y-3 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-slate-800 dark:bg-blue-950 dark:text-slate-100">
    <h3 className="font-semibold">Yechim izohi</h3>
    <RichQuestionText text={explanation || 'Ustoz izohi kutilmoqda.'}/>
    {diagram==='quadratic-substitution' && <QuadraticExplorer/>}
    {steps.map((step,index)=><details key={index} className="border-t border-blue-200 py-1 dark:border-blue-800">
      <summary className="cursor-pointer py-2 font-medium">{index+1}-qadam</summary>
      <RichQuestionText text={step}/>
    </details>)}
  </section>;
}
