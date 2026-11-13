import React from 'react';
export function FeedbackTemplates({rows, onChoose}: {rows: any[]; onChoose: (text: string) => void}) {
  if (!rows?.length) return null;
  return <div className="space-y-2"><p className="text-sm text-slate-500">Tayyor fikrni tanlab, o‘quvchiga moslang</p><div className="flex flex-wrap gap-2">{rows.map(r => <button key={r.id} type="button" className="ss-secondary max-w-full whitespace-normal text-left text-sm" onClick={() => onChoose(r.text)}>{r.text}</button>)}</div></div>;
}
