export type ProgramCourseId = string;

export interface ProgramRecord {
  id: string;
  slug: string;
  label: string;
  abbr: string;
}

const FALLBACK_PROGRAMS: ProgramRecord[] = [
  { id: "prog_ce", slug: "CIVIL_ENGINEERING", label: "Civil Engineering", abbr: "CE" },
  { id: "prog_me", slug: "MECHANICAL_ENGINEERING", label: "Mechanical Engineering", abbr: "ME" },
  { id: "prog_ee", slug: "ELECTRICAL_ENGINEERING", label: "Electrical Engineering", abbr: "EE" },
  { id: "prog_it", slug: "INFORMATION_TECHNOLOGY", label: "Information Technology", abbr: "IT" },
  { id: "prog_arch", slug: "ARCHITECTURE", label: "Architecture", abbr: "ARCH" },
];

let programRegistry: ProgramRecord[] = FALLBACK_PROGRAMS;

export const DEFAULT_PROGRAM_COURSE = "INFORMATION_TECHNOLOGY";

export function toProgramSlug(label: string) {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug;
}

export function previewProgramSlug(label: string) {
  return toProgramSlug(label);
}

export function syncProgramCourses(programs: ProgramRecord[]) {
  programRegistry = programs;
}

export function getProgramCourses() {
  return programRegistry.map((program) => ({
    id: program.slug,
    label: program.label,
    abbr: program.abbr,
  }));
}

/** @deprecated Use getProgramCourses() for up-to-date list */
export const PROGRAM_COURSES = getProgramCourses();

export type ProgramCourseFilter = ProgramCourseId | "ALL";

export function formatProgramCourse(course: string | null | undefined) {
  if (!course) return "—";
  return programRegistry.find((item) => item.slug === course)?.label ?? course;
}

export function abbreviateProgramCourse(course: string | null | undefined) {
  if (!course) return "—";
  return programRegistry.find((item) => item.slug === course)?.abbr ?? course;
}

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
  if (courses.length === programRegistry.length) return "All programs";
  return courses.map((course) => abbreviateProgramCourse(course)).join(", ");
}
