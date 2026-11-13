export function feedbackTemplates(db: any, user: any) {
  if (!['teacher', 'admin', 'platform_owner'].includes(user.role)) return [];
  return (db.feedbackComments || []).filter((c: any) =>
    c.institutionId === user.institutionId &&
    (user.role !== 'teacher' || !c.subject || c.subject === user.subject)
  ).slice(0, 100).map((c: any) => ({id: c.id, category: c.category, text: c.text}));
}
