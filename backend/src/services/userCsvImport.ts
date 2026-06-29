import bcrypt from "bcryptjs";
import { Gender, Role, SchoolType, type PrismaClient } from "@prisma/client";
import { parseCsv } from "../lib/parseCsv.js";
import { toProgramSlug } from "../lib/programCourse.js";
import { assertYearLevelForProgram } from "../lib/yearLevel.js";
import { findDuplicateUserEmail, normalizeUserEmail } from "./userDuplicates.js";

export const USER_CSV_HEADERS = [
  "email",
  "password",
  "first_name",
  "last_name",
  "role",
  "year_level",
  "program_course",
  "gender",
  "school_type",
  "qa_unlimited",
] as const;

const HEADER_ALIASES: Record<string, (typeof USER_CSV_HEADERS)[number]> = {
  email: "email",
  password: "password",
  first_name: "first_name",
  firstname: "first_name",
  first: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  last: "last_name",
  surname: "last_name",
  role: "role",
  year_level: "year_level",
  yearlevel: "year_level",
  year: "year_level",
  program_course: "program_course",
  programcourse: "program_course",
  program: "program_course",
  gender: "gender",
  school_type: "school_type",
  schooltype: "school_type",
  school: "school_type",
  qa_unlimited: "qa_unlimited",
  qaunlimited: "qa_unlimited",
  qa: "qa_unlimited",
};

type ActiveProgram = {
  slug: string;
  label: string;
  abbr: string;
};

type ParsedUserRow = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  yearLevel: number | null;
  programCourse: string | null;
  gender: Gender | null;
  schoolType: SchoolType | null;
  qaUnlimited: boolean;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapHeaders(headerRow: string[]) {
  const indexes = new Map<(typeof USER_CSV_HEADERS)[number], number>();
  for (const [index, header] of headerRow.entries()) {
    const canonical = HEADER_ALIASES[normalizeHeader(header)];
    if (canonical && !indexes.has(canonical)) {
      indexes.set(canonical, index);
    }
  }
  return indexes;
}

function readCell(row: string[], indexes: Map<string, number>, key: string) {
  const index = indexes.get(key);
  if (index == null) return "";
  return row[index]?.trim() ?? "";
}

function parseRole(value: string): Role | null {
  const key = value.trim().toUpperCase();
  if (key === "STUDENT") return Role.STUDENT;
  if (key === "TEACHER") return Role.TEACHER;
  if (key === "SUPERADMIN" || key === "ADMIN") return Role.SUPERADMIN;
  return null;
}

function parseGender(value: string): Gender | null {
  const key = value.trim().toUpperCase();
  if (key === "MALE" || key === "M") return Gender.MALE;
  if (key === "FEMALE" || key === "F") return Gender.FEMALE;
  return null;
}

function parseSchoolType(value: string): SchoolType | null {
  const key = value.trim().toUpperCase();
  if (key === "PUBLIC") return SchoolType.PUBLIC;
  if (key === "PRIVATE") return SchoolType.PRIVATE;
  return null;
}

function parseBoolean(value: string) {
  const key = value.trim().toLowerCase();
  if (!key || key === "false" || key === "no" || key === "0" || key === "n") return false;
  if (key === "true" || key === "yes" || key === "1" || key === "y") return true;
  return null;
}

function resolveProgramCourse(value: string, programs: ActiveProgram[]) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upperSlug = trimmed.toUpperCase().replace(/\s+/g, "_");
  const bySlug = programs.find((program) => program.slug === upperSlug);
  if (bySlug) return bySlug.slug;

  const byAbbr = programs.find(
    (program) => program.abbr.trim().toUpperCase() === trimmed.toUpperCase()
  );
  if (byAbbr) return byAbbr.slug;

  const byLabel = programs.find(
    (program) => program.label.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (byLabel) return byLabel.slug;

  const slugified = toProgramSlug(trimmed);
  const bySlugified = programs.find((program) => program.slug === slugified);
  return bySlugified?.slug ?? null;
}

function parseRow(
  row: string[],
  indexes: Map<string, number>,
  rowNumber: number,
  programs: ActiveProgram[]
): { data?: ParsedUserRow; error?: string } {
  const emailRaw = readCell(row, indexes, "email");
  const password = readCell(row, indexes, "password");
  const firstName = readCell(row, indexes, "first_name");
  const lastName = readCell(row, indexes, "last_name");
  const roleRaw = readCell(row, indexes, "role");
  const yearLevelRaw = readCell(row, indexes, "year_level");
  const programCourseRaw = readCell(row, indexes, "program_course");
  const genderRaw = readCell(row, indexes, "gender");
  const schoolTypeRaw = readCell(row, indexes, "school_type");
  const qaUnlimitedRaw = readCell(row, indexes, "qa_unlimited");

  if (!emailRaw) return { error: `Row ${rowNumber}: email is required.` };
  if (!password) return { error: `Row ${rowNumber}: password is required.` };
  if (password.length < 6) {
    return { error: `Row ${rowNumber}: password must be at least 6 characters.` };
  }
  if (!firstName) return { error: `Row ${rowNumber}: first_name is required.` };
  if (!lastName) return { error: `Row ${rowNumber}: last_name is required.` };
  if (!roleRaw) return { error: `Row ${rowNumber}: role is required.` };

  const email = normalizeUserEmail(emailRaw);
  if (!email.includes("@")) {
    return { error: `Row ${rowNumber}: email must be valid.` };
  }

  const role = parseRole(roleRaw);
  if (!role) {
    return {
      error: `Row ${rowNumber}: role must be STUDENT, TEACHER, or SUPERADMIN.`,
    };
  }

  if (role === Role.STUDENT) {
    if (!yearLevelRaw) {
      return { error: `Row ${rowNumber}: year_level is required for students.` };
    }
    const yearLevel = Number(yearLevelRaw);
    if (!Number.isInteger(yearLevel) || yearLevel < 1) {
      return { error: `Row ${rowNumber}: year_level must be a positive whole number.` };
    }

    if (!programCourseRaw) {
      return { error: `Row ${rowNumber}: program_course is required for students.` };
    }
    const programCourse = resolveProgramCourse(programCourseRaw, programs);
    if (!programCourse) {
      const examples = programs.map((program) => program.slug).join(", ");
      return {
        error: `Row ${rowNumber}: program_course "${programCourseRaw}" not found. Use a slug such as ${examples}.`,
      };
    }

    try {
      assertYearLevelForProgram(programCourse, yearLevel);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid year level.";
      return { error: `Row ${rowNumber}: ${message}` };
    }

    if (!genderRaw) {
      return { error: `Row ${rowNumber}: gender is required for students (MALE or FEMALE).` };
    }
    const gender = parseGender(genderRaw);
    if (!gender) {
      return { error: `Row ${rowNumber}: gender must be MALE or FEMALE.` };
    }

    if (!schoolTypeRaw) {
      return {
        error: `Row ${rowNumber}: school_type is required for students (PUBLIC or PRIVATE).`,
      };
    }
    const schoolType = parseSchoolType(schoolTypeRaw);
    if (!schoolType) {
      return { error: `Row ${rowNumber}: school_type must be PUBLIC or PRIVATE.` };
    }

    const qaUnlimited = qaUnlimitedRaw ? parseBoolean(qaUnlimitedRaw) : false;
    if (qaUnlimitedRaw && qaUnlimited === null) {
      return {
        error: `Row ${rowNumber}: qa_unlimited must be true/false, yes/no, or 1/0.`,
      };
    }

    return {
      data: {
        email,
        password,
        firstName,
        lastName,
        role,
        yearLevel,
        programCourse,
        gender,
        schoolType,
        qaUnlimited: qaUnlimited ?? false,
      },
    };
  }

  if (yearLevelRaw || programCourseRaw || genderRaw || schoolTypeRaw || qaUnlimitedRaw) {
    return {
      error: `Row ${rowNumber}: year_level, program_course, gender, school_type, and qa_unlimited apply only to STUDENT rows.`,
    };
  }

  return {
    data: {
      email,
      password,
      firstName,
      lastName,
      role,
      yearLevel: null,
      programCourse: null,
      gender: null,
      schoolType: null,
      qaUnlimited: false,
    },
  };
}

export function userCsvTemplate() {
  return [
    USER_CSV_HEADERS.join(","),
    "student1@school.edu,password123,Juan,Dela Cruz,STUDENT,1,INFORMATION_TECHNOLOGY,MALE,PUBLIC,false",
    "teacher1@school.edu,password123,Maria,Santos,TEACHER,,,,,",
  ].join("\n");
}

export async function importUsersFromCsv(prisma: PrismaClient, csvText: string) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { created: 0, failed: 0, errors: [{ row: 0, message: "CSV file is empty." }] };
  }

  const headerRow = rows[0];
  const indexes = mapHeaders(headerRow);
  const requiredHeaders = ["email", "password", "first_name", "last_name", "role"] as const;
  const missingHeaders = requiredHeaders.filter((header) => !indexes.has(header));
  if (missingHeaders.length > 0) {
    return {
      created: 0,
      failed: 0,
      errors: [
        {
          row: 1,
          message: `Missing required column(s): ${missingHeaders.join(", ")}.`,
        },
      ],
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return { created: 0, failed: 0, errors: [{ row: 1, message: "No user rows found." }] };
  }

  const programs = await prisma.program.findMany({
    where: { isActive: true },
    select: { slug: true, label: true, abbr: true },
    orderBy: { label: "asc" },
  });

  if (programs.length === 0) {
    return {
      created: 0,
      failed: 0,
      errors: [{ row: 0, message: "No active program courses are configured." }],
    };
  }

  let created = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const emailsInFile = new Set<string>();

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const parsed = parseRow(row, indexes, rowNumber, programs);
    if (parsed.error) {
      errors.push({ row: rowNumber, message: parsed.error });
      continue;
    }

    const data = parsed.data!;
    if (emailsInFile.has(data.email)) {
      errors.push({ row: rowNumber, message: `Duplicate email "${data.email}" in this CSV file.` });
      continue;
    }
    emailsInFile.add(data.email);

    const duplicate = await findDuplicateUserEmail(prisma, data.email);
    if (duplicate) {
      errors.push({
        row: rowNumber,
        message: `A user with email "${data.email}" already exists.`,
      });
      continue;
    }

    try {
      const passwordHash = await bcrypt.hash(data.password, 10);
      await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          yearLevel: data.role === Role.STUDENT ? data.yearLevel : null,
          programCourse: data.role === Role.STUDENT ? data.programCourse : null,
          gender: data.role === Role.STUDENT ? data.gender : null,
          schoolType: data.role === Role.STUDENT ? data.schoolType : null,
          qaUnlimited: data.role === Role.STUDENT ? data.qaUnlimited : false,
        },
      });
      created += 1;
    } catch {
      errors.push({ row: rowNumber, message: "Could not create user." });
    }
  }

  return {
    created,
    failed: errors.length,
    errors: errors.slice(0, 50),
  };
}
