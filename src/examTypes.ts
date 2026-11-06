export type ExamKind = 'BSB' | 'CHSB';
export type ExamState = 'draft' | 'scheduled' | 'open' | 'paused' | 'closed';
export interface ExamField { id:string; label:string; imageIndex:number; x:number; y:number; width:number; height:number; }
export interface ExamSourceQuestion { sourceNumber:number; variant:string; prompt:string; sourcePages:number[]; sourceImages:string[]; fields:ExamField[]; points:number; type:'written_open'|'single_choice'; options:string[]; correctAnswer:string; rubricText:string; }
export interface ExamSession { id:string; assessmentId:string; studentId:string; institutionId:string; startedAt:string; deadlineAt:string; pauseAtStart:number; revision:number; answers:Record<string,string>; events:Array<{type:string;at:string}>; submittedAttemptId?:string; }
