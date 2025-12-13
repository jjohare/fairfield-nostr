export function formatUnreadCount(count: number): string {
  if (count === 0) return '';
  if (count > 99) return '99+';
  return count.toString();
}
