export function deliveredNotification(
  value: { cancelled?: boolean; deliverOn?: string },
  day: string,
) {
  return (
    !value.cancelled &&
    (!value.deliverOn ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value.deliverOn) && value.deliverOn <= day))
  );
}
