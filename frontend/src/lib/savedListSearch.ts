export function matchesTokenSearch(haystack: string, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const normalized = haystack.toLowerCase();
  return tokens.every((token) => normalized.includes(token));
}

export function matchesSubjectSearch(
  subject: {
    courseCode: string;
    courseTitle: string;
    programCourses?: Array<{ programCourse: string }>;
  },
  query: string,
  programLabels: Record<string, string> = {}
) {
  const programs =
    subject.programCourses
      ?.map((row) => programLabels[row.programCourse] ?? row.programCourse)
      .join(" ") ?? "";
  const haystack = `${subject.courseCode} ${subject.courseTitle} ${programs}`;
  return matchesTokenSearch(haystack, query);
}

export function matchesTopicSearch(topic: { name: string }, query: string) {
  return matchesTokenSearch(topic.name, query);
}
