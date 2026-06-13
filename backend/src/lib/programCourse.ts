import { ProgramCourse } from "@prisma/client";
import { z } from "zod";

export const PROGRAM_COURSE_LABELS: Record<ProgramCourse, string> = {
  CIVIL_ENGINEERING: "Civil Engineering",
  MECHANICAL_ENGINEERING: "Mechanical Engineering",
  ELECTRICAL_ENGINEERING: "Electrical Engineering",
  INFORMATION_TECHNOLOGY: "Information Technology",
  ARCHITECTURE: "Architecture",
};

export const PROGRAM_COURSES = Object.entries(PROGRAM_COURSE_LABELS).map(([id, label]) => ({
  id: id as ProgramCourse,
  label,
}));

export const programCourseSchema = z.nativeEnum(ProgramCourse);

export function formatProgramCourse(course: ProgramCourse) {
  return PROGRAM_COURSE_LABELS[course];
}
