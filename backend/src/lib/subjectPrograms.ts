import { z } from "zod";
import { programCoursesSchema } from "./programCourse.js";

export { programCoursesSchema };

export function subjectIncludesProgram(
  programCourses: Array<{ programCourse: string }>,
  programCourse: string
) {
  return programCourses.some((link) => link.programCourse === programCourse);
}

export const subjectProgramCoursesInclude = {
  programCourses: {
    select: { programCourse: true },
    orderBy: { programCourse: "asc" as const },
  },
} as const;
