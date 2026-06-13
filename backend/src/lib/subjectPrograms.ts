import { ProgramCourse } from "@prisma/client";
import { z } from "zod";
import { programCourseSchema } from "./programCourse.js";

export const programCoursesSchema = z
  .array(programCourseSchema)
  .min(1, "Select at least one program course.");

export function subjectIncludesProgram(
  programCourses: Array<{ programCourse: ProgramCourse }>,
  programCourse: ProgramCourse
) {
  return programCourses.some((link) => link.programCourse === programCourse);
}

export const subjectProgramCoursesInclude = {
  programCourses: {
    select: { programCourse: true },
    orderBy: { programCourse: "asc" as const },
  },
} as const;
