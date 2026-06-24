export function formatCourseCode(courseCode: string) {
  return courseCode.trim().replace(/\s+/g, " ");
}

export function normalizeCourseCode(courseCode: string) {
  return formatCourseCode(courseCode).toLowerCase();
}

export function findDuplicateCourseCode<
  T extends { id: string; courseCode: string; courseTitle: string; yearLevel: number },
>(subjects: T[], courseCode: string, excludeId?: string) {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) return null;

  return (
    subjects.find(
      (subject) =>
        subject.id !== excludeId &&
        normalizeCourseCode(subject.courseCode) === normalizedCode
    ) ?? null
  );
}

export function duplicateCourseCodeMessage<
  T extends { courseCode: string; courseTitle: string; yearLevel: number },
>(duplicate: T) {
  return `Course code "${duplicate.courseCode}" is already used by ${duplicate.courseTitle} (curriculum year ${duplicate.yearLevel}).`;
}
