// Shared display formatters

// Turns an internal student record id (e.g. 'stu-1') into the
// human-readable Student ID shown across the app (e.g. 'EKO-0001').
export function formatStudentId(id: string): string {
  const num = parseInt(id.replace(/\D/g, ''), 10) || 0;
  return `EKO-${String(num).padStart(4, '0')}`;
}
