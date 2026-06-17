import { BloomLevel, Gender, QuestionSetType, SchoolType } from "@prisma/client";
import { BLOOM_LEVEL_ORDER, BLOOM_LEVEL_SHORT_LABELS } from "../lib/bloomLevel.js";
import { prisma } from "../lib/prisma.js";
import { nonQaStudentWhere } from "../lib/studentFilters.js";

const HIGHER_BLOOM_LEVELS: BloomLevel[] = [
  BloomLevel.ANALYSIS,
  BloomLevel.SYNTHESIS,
  BloomLevel.EVALUATION,
];

function pct(correct: number, total: number) {
  return total > 0 ? (correct / total) * 100 : 0;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function topicLabel(question: {
  topic: { name: string } | null;
  subject: { courseCode: string; courseTitle: string };
}) {
  return question.topic?.name ?? `${question.subject.courseCode} ${question.subject.courseTitle}`;
}

function accumulateBloom(
  target: Map<BloomLevel, { correct: number; total: number }>,
  bloomLevel: BloomLevel,
  isCorrect: boolean
) {
  const row = target.get(bloomLevel) ?? { correct: 0, total: 0 };
  row.total += 1;
  if (isCorrect) row.correct += 1;
  target.set(bloomLevel, row);
}

function bloomScores(map: Map<BloomLevel, { correct: number; total: number }>) {
  return BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const row = map.get(bloomLevel);
    return {
      bloomLevel,
      label: BLOOM_LEVEL_SHORT_LABELS[bloomLevel],
      score: row ? pct(row.correct, row.total) : 0,
      total: row?.total ?? 0,
    };
  }).filter((row) => row.total > 0);
}

function higherOrderReadiness(map: Map<BloomLevel, { correct: number; total: number }>) {
  let correct = 0;
  let total = 0;
  for (const bloomLevel of HIGHER_BLOOM_LEVELS) {
    const row = map.get(bloomLevel);
    if (!row) continue;
    correct += row.correct;
    total += row.total;
  }
  return pct(correct, total);
}

export async function buildDemographicAnalytics(filters: {
  yearLevel?: number;
  programCourse?: string;
}) {
  const students = await prisma.user.findMany({
    where: nonQaStudentWhere(filters.yearLevel, filters.programCourse),
    select: {
      id: true,
      gender: true,
      schoolType: true,
      programCourse: true,
      yearLevel: true,
    },
  });

  const studentIds = students.map((student) => student.id);
  const studentById = new Map(students.map((student) => [student.id, student]));

  const attempts = await prisma.examAttempt.findMany({
    where: {
      studentId: { in: studentIds },
      submittedAt: { not: null },
      questionSet: { type: QuestionSetType.DIAGNOSTIC },
    },
    include: {
      answers: {
        where: { selectedOption: { not: null } },
        include: {
          question: {
            include: {
              topic: { select: { name: true } },
              subject: { select: { courseCode: true, courseTitle: true } },
            },
          },
        },
      },
    },
    orderBy: [{ studentId: "asc" }, { submittedAt: "desc" }],
  });

  const latestAttemptByStudent = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestAttemptByStudent.has(attempt.studentId)) {
      latestAttemptByStudent.set(attempt.studentId, attempt);
    }
  }

  const diagnosticScores = {
    [SchoolType.PUBLIC]: [] as number[],
    [SchoolType.PRIVATE]: [] as number[],
  };
  const bloomBySchool = {
    [SchoolType.PUBLIC]: new Map<BloomLevel, { correct: number; total: number }>(),
    [SchoolType.PRIVATE]: new Map<BloomLevel, { correct: number; total: number }>(),
  };
  const bloomByGender = {
    [Gender.MALE]: new Map<BloomLevel, { correct: number; total: number }>(),
    [Gender.FEMALE]: new Map<BloomLevel, { correct: number; total: number }>(),
  };
  const topicBySchool = {
    [SchoolType.PUBLIC]: new Map<string, { correct: number; total: number }>(),
    [SchoolType.PRIVATE]: new Map<string, { correct: number; total: number }>(),
  };
  const topicByGender = {
    [Gender.MALE]: new Map<string, { correct: number; total: number }>(),
    [Gender.FEMALE]: new Map<string, { correct: number; total: number }>(),
  };
  const programScores = new Map<
    string,
    { scores: number[]; bloom: Map<BloomLevel, { correct: number; total: number }> }
  >();

  for (const attempt of latestAttemptByStudent.values()) {
    const student = studentById.get(attempt.studentId);
    if (!student || attempt.percentage == null) continue;

    if (student.schoolType) {
      diagnosticScores[student.schoolType].push(attempt.percentage);
    }

    if (student.programCourse) {
      const programRow = programScores.get(student.programCourse) ?? {
        scores: [],
        bloom: new Map<BloomLevel, { correct: number; total: number }>(),
      };
      programRow.scores.push(attempt.percentage);
      programScores.set(student.programCourse, programRow);
    }

    for (const answer of attempt.answers) {
      const isCorrect = Boolean(answer.isCorrect);
      const bloomLevel = answer.question.bloomLevel;
      const label = topicLabel(answer.question);

      if (student.schoolType) {
        accumulateBloom(bloomBySchool[student.schoolType], bloomLevel, isCorrect);
        const topicRow = topicBySchool[student.schoolType].get(label) ?? { correct: 0, total: 0 };
        topicRow.total += 1;
        if (isCorrect) topicRow.correct += 1;
        topicBySchool[student.schoolType].set(label, topicRow);
      }

      if (student.gender) {
        accumulateBloom(bloomByGender[student.gender], bloomLevel, isCorrect);
        const topicRow = topicByGender[student.gender].get(label) ?? { correct: 0, total: 0 };
        topicRow.total += 1;
        if (isCorrect) topicRow.correct += 1;
        topicByGender[student.gender].set(label, topicRow);
      }

      if (student.programCourse) {
        const programRow = programScores.get(student.programCourse)!;
        accumulateBloom(programRow.bloom, bloomLevel, isCorrect);
      }
    }
  }

  const publicBloom = bloomScores(bloomBySchool[SchoolType.PUBLIC]);
  const privateBloom = bloomScores(bloomBySchool[SchoolType.PRIVATE]);
  const maleBloom = bloomScores(bloomByGender[Gender.MALE]);
  const femaleBloom = bloomScores(bloomByGender[Gender.FEMALE]);

  const bloomGapByLevel = BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const publicScore = publicBloom.find((row) => row.bloomLevel === bloomLevel)?.score ?? null;
    const privateScore = privateBloom.find((row) => row.bloomLevel === bloomLevel)?.score ?? null;
    if (publicScore == null || privateScore == null) return null;
    return {
      bloomLevel,
      label: BLOOM_LEVEL_SHORT_LABELS[bloomLevel],
      gap: Math.abs(privateScore - publicScore),
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  const topicGapRows = [...topicBySchool[SchoolType.PUBLIC].keys()]
    .filter((label) => topicBySchool[SchoolType.PRIVATE].has(label))
    .map((label) => {
      const publicRow = topicBySchool[SchoolType.PUBLIC].get(label)!;
      const privateRow = topicBySchool[SchoolType.PRIVATE].get(label)!;
      const publicScore = pct(publicRow.correct, publicRow.total);
      const privateScore = pct(privateRow.correct, privateRow.total);
      return {
        label,
        gap: Math.abs(privateScore - publicScore),
        publicScore,
        privateScore,
      };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 6);

  const genderBloomRows = BLOOM_LEVEL_ORDER.map((bloomLevel) => {
    const maleScore = maleBloom.find((row) => row.bloomLevel === bloomLevel)?.score ?? null;
    const femaleScore = femaleBloom.find((row) => row.bloomLevel === bloomLevel)?.score ?? null;
    if (maleScore == null && femaleScore == null) return null;
    return {
      bloomLevel,
      label: BLOOM_LEVEL_SHORT_LABELS[bloomLevel],
      male: maleScore ?? 0,
      female: femaleScore ?? 0,
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  const sharedTopicLabels = [...topicByGender[Gender.MALE].keys()].filter((label) =>
    topicByGender[Gender.FEMALE].has(label)
  );
  const genderTopicRows = sharedTopicLabels
    .map((label) => {
      const maleRow = topicByGender[Gender.MALE].get(label)!;
      const femaleRow = topicByGender[Gender.FEMALE].get(label)!;
      return {
        label,
        male: pct(maleRow.correct, maleRow.total),
        female: pct(femaleRow.correct, femaleRow.total),
      };
    })
    .sort(
      (a, b) =>
        Math.max(b.male, b.female) - Math.max(a.male, a.female) ||
        a.label.localeCompare(b.label)
    )
    .slice(0, 6);

  const programDiagnosticRows = [...programScores.entries()]
    .map(([programCourse, row]) => ({
      programCourse,
      averageScore: average(row.scores),
      studentCount: row.scores.length,
      higherOrderReadiness: higherOrderReadiness(row.bloom),
    }))
    .filter((row) => row.studentCount > 0)
    .sort((a, b) => b.averageScore - a.averageScore);

  const studentsWithDiagnostic = latestAttemptByStudent.size;
  const studentsWithDemographics = students.filter(
    (student) => student.gender && student.schoolType
  ).length;

  return {
    studentsInScope: students.length,
    studentsWithDiagnostic,
    studentsWithDemographics,
    schoolType: {
      overallScores: [
        {
          label: "Public",
          value: average(diagnosticScores[SchoolType.PUBLIC]),
          count: diagnosticScores[SchoolType.PUBLIC].length,
        },
        {
          label: "Private",
          value: average(diagnosticScores[SchoolType.PRIVATE]),
          count: diagnosticScores[SchoolType.PRIVATE].length,
        },
      ],
      bloomGaps: bloomGapByLevel,
      topicGaps: topicGapRows,
    },
    gender: {
      bloomComparison: genderBloomRows,
      topicComparison: genderTopicRows,
    },
    programs: programDiagnosticRows,
    showProgramBreakdown: !filters.programCourse,
  };
}
