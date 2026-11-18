import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const editorialSource = z.object({
  topicId: digest,
  sourceHash: digest,
  templateVersion: z.string().min(1).max(80),
  trace: z.object({
    file: z.string().min(1).max(500),
    sheet: z.string().min(1).max(64),
    row: z.number().int().positive(),
    kind: z.literal('lesson')
  })
});
export const solutionSteps = z.array(z.string().trim().min(1).max(1500)).min(1).max(12);

export function readEditorialDraft(input:unknown) {
  const draft = editorialSource.extend({
    validation:z.literal('passed'),review:z.literal('pending'),published:z.literal(false),
    question:z.object({
      kind:z.literal('short'),prompt:z.string().min(3).max(12000),key:z.string().min(1).max(8000),
      explanation:z.string().min(1).max(5000),steps:solutionSteps.optional(),diagram:z.literal('quadratic-substitution').optional(),hint:z.string().max(2000),
      difficulty:z.enum(['easy','medium','hard']),points:z.number().positive().max(100)
    })
  }).safeParse(input);
  if (!draft.success) throw Error('Qoralama shakli yoki manba ma’lumotlari xato.');
  const {question,trace}=draft.data;
  return {...question, editorialSource:editorialSource.parse(draft.data),
    source:{title:trace.sheet,page:String(trace.row)}};
}
