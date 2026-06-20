import { BloomLevel, Difficulty, type PrismaClient } from "@prisma/client";
import { isBloomLevelAllowed } from "../lib/bloomLevel.js";
import { parseCsv } from "../lib/parseCsv.js";
import { questionDuplicateKey } from "./questionDuplicates.js";

export const QUESTION_CSV_HEADERS = [
  "course_code",
  "curriculum_year",
  "topic",
  "difficulty",
  "bloom_level",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
] as const;

const HEADER_ALIASES: Record<string, (typeof QUESTION_CSV_HEADERS)[number]> = {
  course_code: "course_code",
  coursecode: "course_code",
  code: "course_code",
  curriculum_year: "curriculum_year",
  curriculumyear: "curriculum_year",
  year: "curriculum_year",
  year_level: "curriculum_year",
  topic: "topic",
  topic_name: "topic",
  difficulty: "difficulty",
  bloom_level: "bloom_level",
  bloomlevel: "bloom_level",
  domain: "bloom_level",
  question_text: "question_text",
  questiontext: "question_text",
  question: "question_text",
  text: "question_text",
  option_a: "option_a",
  optiona: "option_a",
  option_b: "option_b",
  optionb: "option_b",
  option_c: "option_c",
  optionc: "option_c",
  option_d: "option_d",
  optiond: "option_d",
  correct_option: "correct_option",
  correctoption: "correct_option",
  correct: "correct_option",
  answer: "correct_option",
};

const BLOOM_ALIASES: Record<string, BloomLevel> = {
  KNOWLEDGE: BloomLevel.KNOWLEDGE,
  L1: BloomLevel.KNOWLEDGE,
  COMPREHENSION: BloomLevel.COMPREHENSION,
  L2: BloomLevel.COMPREHENSION,
  APPLICATION: BloomLevel.APPLICATION,
  L3: BloomLevel.APPLICATION,
  ANALYSIS: BloomLevel.ANALYSIS,
  L4: BloomLevel.ANALYSIS,
  SYNTHESIS: BloomLevel.SYNTHESIS,
  L5: BloomLevel.SYNTHESIS,
  EVALUATION: BloomLevel.EVALUATION,
  L6: BloomLevel.EVALUATION,
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseDifficulty(value: string): Difficulty | null {
  const key = value.trim().toUpperCase();
  if (key === "EASY") return Difficulty.EASY;
  if (key === "MEDIUM") return Difficulty.MEDIUM;
  if (key === "HARD") return Difficulty.HARD;
  return null;
}

function parseBloomLevel(value: string): BloomLevel | null {
  const key = value.trim().toUpperCase().replace(/\s+/g, "_");
  return BLOOM_ALIASES[key] ?? null;
}

function parseCorrectOption(value: string): "A" | "B" | "C" | "D" | null {
  const key = value.trim().toUpperCase();
  if (key === "A" || key === "B" || key === "C" || key === "D") return key;
  return null;
}

type ParsedQuestionRow = {
  courseCode: string;
  curriculumYear: number;
  topic: string;
  difficulty: Difficulty;
  bloomLevel: BloomLevel;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
};

function mapHeaders(headerRow: string[]) {
  const indexes = new Map<(typeof QUESTION_CSV_HEADERS)[number], number>();
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

function parseRow(
  row: string[],
  indexes: Map<string, number>,
  rowNumber: number
): { data?: ParsedQuestionRow; error?: string } {
  const courseCode = readCell(row, indexes, "course_code");
  const curriculumYearRaw = readCell(row, indexes, "curriculum_year");
  const topic = readCell(row, indexes, "topic");
  const difficultyRaw = readCell(row, indexes, "difficulty");
  const bloomRaw = readCell(row, indexes, "bloom_level");
  const text = readCell(row, indexes, "question_text");
  const optionA = readCell(row, indexes, "option_a");
  const optionB = readCell(row, indexes, "option_b");
  const optionC = readCell(row, indexes, "option_c");
  const optionD = readCell(row, indexes, "option_d");
  const correctRaw = readCell(row, indexes, "correct_option");

  if (!courseCode) return { error: `Row ${rowNumber}: course_code is required.` };
  const curriculumYear = Number(curriculumYearRaw);
  if (!Number.isInteger(curriculumYear) || curriculumYear < 1) {
    return { error: `Row ${rowNumber}: curriculum_year must be a positive whole number.` };
  }

  const difficulty = parseDifficulty(difficultyRaw);
  if (!difficulty) {
    return { error: `Row ${rowNumber}: difficulty must be EASY, MEDIUM, or HARD.` };
  }

  const bloomLevel = parseBloomLevel(bloomRaw);
  if (!bloomLevel) {
    return {
      error: `Row ${rowNumber}: bloom_level must be KNOWLEDGE, COMPREHENSION, APPLICATION, ANALYSIS, SYNTHESIS, EVALUATION, or L1–L6.`,
    };
  }

  if (!isBloomLevelAllowed(difficulty, bloomLevel)) {
    return {
      error: `Row ${rowNumber}: ${bloomLevel} is not allowed for ${difficulty} difficulty.`,
    };
  }

  if (!text) return { error: `Row ${rowNumber}: question_text is required.` };
  if (!optionA || !optionB || !optionC || !optionD) {
    return { error: `Row ${rowNumber}: option_a through option_d are required.` };
  }

  const correctOption = parseCorrectOption(correctRaw);
  if (!correctOption) {
    return { error: `Row ${rowNumber}: correct_option must be A, B, C, or D.` };
  }

  return {
    data: {
      courseCode,
      curriculumYear,
      topic,
      difficulty,
      bloomLevel,
      text,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
    },
  };
}

export function questionCsvTemplate() {
  return [
    QUESTION_CSV_HEADERS.join(","),
    'ACEE 106,1,Electrostatics,EASY,KNOWLEDGE,"What is the SI unit of electric charge?",Coulomb,Ampere,Volt,Ohm,A',
    'ACEE 106,1,Electrostatics,MEDIUM,APPLICATION,"A 2 μC charge experiences 4 N force. Find field strength.",2 N/C,4 N/C,8 N/C,16 N/C,B',
  ].join("\n");
}

export async function importQuestionsFromCsv(
  prisma: PrismaClient,
  csvText: string,
  createdById: string
) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { created: 0, failed: 0, errors: [{ row: 0, message: "CSV file is empty." }] };
  }

  const headerRow = rows[0];
  const indexes = mapHeaders(headerRow);
  const requiredHeaders = [
    "course_code",
    "curriculum_year",
    "difficulty",
    "bloom_level",
    "question_text",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_option",
  ] as const;

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
    return { created: 0, failed: 0, errors: [{ row: 1, message: "No question rows found." }] };
  }

  const [subjects, topics, existingQuestions] = await Promise.all([
    prisma.subject.findMany({
      select: { id: true, courseCode: true, yearLevel: true },
    }),
    prisma.topic.findMany({
      select: { id: true, name: true, subjectId: true },
    }),
    prisma.question.findMany({
      select: { subjectId: true, topicId: true, text: true },
    }),
  ]);

  const subjectByKey = new Map(
    subjects.map((subject) => [`${subject.courseCode.toLowerCase()}::${subject.yearLevel}`, subject])
  );
  const topicByKey = new Map(
    topics.map((topic) => [`${topic.subjectId}::${topic.name.trim().toLowerCase()}`, topic])
  );
  const duplicateKeys = new Set(existingQuestions.map(questionDuplicateKey));

  let created = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const parsed = parseRow(row, indexes, rowNumber);
    if (parsed.error) {
      errors.push({ row: rowNumber, message: parsed.error });
      continue;
    }

    const data = parsed.data!;
    const subjectKey = `${data.courseCode.toLowerCase()}::${data.curriculumYear}`;
    const subject = subjectByKey.get(subjectKey);
    if (!subject) {
      errors.push({
        row: rowNumber,
        message: `Subject not found for ${data.courseCode} (curriculum year ${data.curriculumYear}). Create it in Setup first.`,
      });
      continue;
    }

    let topicId: string | null = null;
    if (data.topic) {
      const topic = topicByKey.get(`${subject.id}::${data.topic.toLowerCase()}`);
      if (!topic) {
        errors.push({
          row: rowNumber,
          message: `Topic "${data.topic}" not found under ${data.courseCode}.`,
        });
        continue;
      }
      topicId = topic.id;
    }

    const duplicateKey = questionDuplicateKey({
      subjectId: subject.id,
      topicId,
      text: data.text,
    });
    if (duplicateKeys.has(duplicateKey)) {
      errors.push({
        row: rowNumber,
        message: "Duplicate question text already exists for this subject and topic.",
      });
      continue;
    }

    try {
      await prisma.question.create({
        data: {
          subjectId: subject.id,
          topicId,
          difficulty: data.difficulty,
          bloomLevel: data.bloomLevel,
          text: data.text,
          optionA: data.optionA,
          optionB: data.optionB,
          optionC: data.optionC,
          optionD: data.optionD,
          correctOption: data.correctOption,
          createdById,
        },
      });
      created += 1;
      duplicateKeys.add(duplicateKey);
    } catch {
      errors.push({ row: rowNumber, message: "Could not save question." });
    }
  }

  return {
    created,
    failed: errors.length,
    errors: errors.slice(0, 50),
  };
}
