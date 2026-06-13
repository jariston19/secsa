export const PROGRAM_COURSES = [
  { id: "CIVIL_ENGINEERING", label: "Civil Engineering", abbr: "CE" },
  { id: "MECHANICAL_ENGINEERING", label: "Mechanical Engineering", abbr: "ME" },
  { id: "ELECTRICAL_ENGINEERING", label: "Electrical Engineering", abbr: "EE" },
  { id: "INFORMATION_TECHNOLOGY", label: "Information Technology", abbr: "IT" },
  { id: "ARCHITECTURE", label: "Architecture", abbr: "ARCH" },
] as const;

export type ProgramCourseId = (typeof PROGRAM_COURSES)[number]["id"];

export type ProgramCourseFilter = ProgramCourseId | "ALL";

export function formatProgramCourse(course: string | null | undefined) {
  if (!course) return "—";
  return PROGRAM_COURSES.find((item) => item.id === course)?.label ?? course;
}

export function abbreviateProgramCourse(course: string | null | undefined) {
  if (!course) return "—";
  return PROGRAM_COURSES.find((item) => item.id === course)?.abbr ?? course;
}

export const DEFAULT_PROGRAM_COURSE: ProgramCourseId = "INFORMATION_TECHNOLOGY";

export function subjectHasProgram(
  programCourses: Array<{ programCourse: ProgramCourseId }> | ProgramCourseId[],
  course: ProgramCourseId
) {
  return programCourses.some((item) =>
    typeof item === "string" ? item === course : item.programCourse === course
  );
}

export function subjectProgramCourseIds(
  programCourses: Array<{ programCourse: ProgramCourseId }>
): ProgramCourseId[] {
  return programCourses.map((item) => item.programCourse);
}

export function formatProgramCoursesList(courses: ProgramCourseId[]) {
  if (courses.length === 0) return "—";
  if (courses.length === PROGRAM_COURSES.length) return "All programs";
  return courses.map((course) => abbreviateProgramCourse(course)).join(", ");
}
