import {
  Difficulty,
  PrismaClient,
  QuestionSetStatus,
  QuestionSetType,
  type Question,
  type User,
} from "@prisma/client";

const prisma = new PrismaClient();

type DemoQuestion = {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  difficulty: Difficulty;
};

type DemoTopic = {
  name: string;
  questions: DemoQuestion[];
};

type DemoSubject = {
  courseCode: string;
  courseTitle: string;
  curriculumYear: number;
  topics: DemoTopic[];
};

export const ANALYTICS_DEMO_SUBJECT_CODES = [
  "MATH 105",
  "ENG 101",
  "SCI 102",
  "FIL 101",
  "HIST 105",
  "VAL 101",
] as const;

const DEMO_PROGRAM_COURSES = [
  "INFORMATION_TECHNOLOGY",
  "CIVIL_ENGINEERING",
  "MECHANICAL_ENGINEERING",
  "ELECTRICAL_ENGINEERING",
  "ARCHITECTURE",
] as const;

export const ANALYTICS_DEMO_PROGRAMS = [...DEMO_PROGRAM_COURSES];

export const PROGRAM_COURSE_ABBREV: Record<string, string> = {
  INFORMATION_TECHNOLOGY: "IT",
  CIVIL_ENGINEERING: "CE",
  MECHANICAL_ENGINEERING: "ME",
  ELECTRICAL_ENGINEERING: "EE",
  ARCHITECTURE: "ARCH",
};

export function comprehensiveSetName(programCourse: string, type: QuestionSetType) {
  const abbrev = PROGRAM_COURSE_ABBREV[programCourse];
  const label =
    type === QuestionSetType.DIAGNOSTIC ? "Comprehensive Review" : "Comprehensive Retake";
  return `${abbrev} Y2 ${label}`;
}

const DEMO_SUBJECTS: DemoSubject[] = [
  {
    courseCode: "ENG 101",
    courseTitle: "English Communication",
    curriculumYear: 1,
    topics: [
      {
        name: "Grammar",
        questions: [
          {
            text: "[Demo] Choose the sentence with correct subject-verb agreement.",
            optionA: "The list of items are on the desk.",
            optionB: "The list of items is on the desk.",
            optionC: "The list of items were on the desk.",
            optionD: "The list of items be on the desk.",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which word is an adverb?",
            optionA: "quick",
            optionB: "quickly",
            optionC: "quicken",
            optionD: "quickness",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Identify the error: 'Neither the coach nor the players was ready.'",
            optionA: "Neither",
            optionB: "nor",
            optionC: "was",
            optionD: "ready",
            correctOption: "C",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Which sentence uses the semicolon correctly?",
            optionA: "I like tea; and coffee.",
            optionB: "I like tea; coffee is fine too.",
            optionC: "I like; tea and coffee.",
            optionD: "I; like tea and coffee.",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Select the best revision for a dangling modifier.",
            optionA: "Running to class, the bell rang.",
            optionB: "Running to class, I heard the bell ring.",
            optionC: "The bell rang running to class.",
            optionD: "Running, the bell to class rang.",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Which sentence is in active voice?",
            optionA: "The exam was taken by the students.",
            optionB: "The students took the exam.",
            optionC: "The exam had been taken.",
            optionD: "The exam is being taken.",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Reading Comprehension",
        questions: [
          {
            text: "[Demo] A passage states the author 'resents bureaucracy.' The tone is best described as:",
            optionA: "celebratory",
            optionB: "critical",
            optionC: "indifferent",
            optionD: "humorous",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] What does 'infer' mean in reading?",
            optionA: "Quote directly",
            optionB: "Guess without evidence",
            optionC: "Draw a logical conclusion",
            optionD: "Summarize the title",
            correctOption: "C",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] If a paragraph's topic sentence is missing, a reader should:",
            optionA: "Skip the paragraph",
            optionB: "Infer the main idea from supporting details",
            optionC: "Only read the last sentence",
            optionD: "Assume it has no main idea",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] An author's use of contrast signals:",
            optionA: "Two ideas are identical",
            optionB: "Two ideas differ",
            optionC: "The passage is fictional",
            optionD: "The passage is outdated",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Which question tests evaluation skills?",
            optionA: "Who is the narrator?",
            optionB: "When did the event occur?",
            optionC: "Is the author's argument convincing?",
            optionD: "How many characters appear?",
            correctOption: "C",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] A biased source is most likely to:",
            optionA: "Present all sides equally",
            optionB: "Use only statistics",
            optionC: "Favor one perspective unfairly",
            optionD: "Avoid opinions entirely",
            correctOption: "C",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Writing",
        questions: [
          {
            text: "[Demo] The first step in the writing process is usually:",
            optionA: "Editing",
            optionB: "Publishing",
            optionC: "Prewriting",
            optionD: "Proofreading",
            correctOption: "C",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] A thesis statement should be:",
            optionA: "A list of questions",
            optionB: "A clear claim",
            optionC: "A direct quote only",
            optionD: "A vague opinion",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Which transition best shows cause and effect?",
            optionA: "However",
            optionB: "Therefore",
            optionC: "Meanwhile",
            optionD: "Similarly",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] In a formal essay, second person ('you') is often avoided because it:",
            optionA: "Is too informal for academic tone",
            optionB: "Is grammatically incorrect",
            optionC: "Is always plural",
            optionD: "Replaces the thesis",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] A strong conclusion should:",
            optionA: "Introduce a new argument",
            optionB: "Repeat the thesis and synthesize ideas",
            optionC: "List every example again",
            optionD: "End with a rhetorical question only",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Plagiarism is best avoided by:",
            optionA: "Changing one word in a copied sentence",
            optionB: "Citing sources and paraphrasing properly",
            optionC: "Using longer quotes only",
            optionD: "Avoiding all outside information",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
    ],
  },
  {
    courseCode: "SCI 102",
    courseTitle: "General Science",
    curriculumYear: 1,
    topics: [
      {
        name: "Biology",
        questions: [
          {
            text: "[Demo] The basic unit of life is the:",
            optionA: "Tissue",
            optionB: "Cell",
            optionC: "Organ",
            optionD: "Atom",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Photosynthesis primarily occurs in:",
            optionA: "Roots",
            optionB: "Chloroplasts",
            optionC: "Mitochondria",
            optionD: "Nuclei",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] DNA stands for:",
            optionA: "Deoxyribonucleic acid",
            optionB: "Dinitrogen acid",
            optionC: "Dynamic nuclear acid",
            optionD: "Dual nucleotide array",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Which organelle is responsible for protein synthesis?",
            optionA: "Ribosome",
            optionB: "Lysosome",
            optionC: "Golgi body",
            optionD: "Vacuole",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Natural selection acts on:",
            optionA: "Genes directly",
            optionB: "Phenotypic variation",
            optionC: "Fossils only",
            optionD: "Climate alone",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] A heterozygous genotype means:",
            optionA: "Two identical alleles",
            optionB: "Two different alleles",
            optionC: "No alleles present",
            optionD: "Only dominant traits show",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Chemistry",
        questions: [
          {
            text: "[Demo] The chemical symbol for water is:",
            optionA: "HO2",
            optionB: "H2O",
            optionC: "OH",
            optionD: "H2O2",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] An atom with 6 protons is:",
            optionA: "Oxygen",
            optionB: "Carbon",
            optionC: "Nitrogen",
            optionD: "Neon",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] A pH of 3 indicates a:",
            optionA: "Strong base",
            optionB: "Neutral solution",
            optionC: "Acidic solution",
            optionD: "Salt only",
            correctOption: "C",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] In a chemical reaction, mass is:",
            optionA: "Created",
            optionB: "Destroyed",
            optionC: "Conserved",
            optionD: "Always doubled",
            correctOption: "C",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Which bond shares electrons between atoms?",
            optionA: "Ionic",
            optionB: "Covalent",
            optionC: "Metallic only",
            optionD: "Hydrogen only",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Avogadro's number relates moles to:",
            optionA: "Volume only",
            optionB: "Particles",
            optionC: "Temperature",
            optionD: "Pressure",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Physics",
        questions: [
          {
            text: "[Demo] The SI unit of force is the:",
            optionA: "Joule",
            optionB: "Watt",
            optionC: "Newton",
            optionD: "Pascal",
            correctOption: "C",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Speed is defined as:",
            optionA: "Distance × time",
            optionB: "Distance / time",
            optionC: "Mass × acceleration",
            optionD: "Force / area",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Newton's first law is also called the law of:",
            optionA: "Gravity",
            optionB: "Inertia",
            optionC: "Action-reaction",
            optionD: "Conservation of charge",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Kinetic energy depends on:",
            optionA: "Mass and velocity",
            optionB: "Height only",
            optionC: "Charge only",
            optionD: "Volume only",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Ohm's law relates voltage, current, and:",
            optionA: "Resistance",
            optionB: "Power",
            optionC: "Capacitance",
            optionD: "Frequency",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] In a closed system, total momentum is:",
            optionA: "Always zero",
            optionB: "Conserved",
            optionC: "Doubled",
            optionD: "Undefined",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
    ],
  },
  {
    courseCode: "FIL 101",
    courseTitle: "Filipino",
    curriculumYear: 1,
    topics: [
      {
        name: "Wika",
        questions: [
          {
            text: "[Demo] Aling salita ang pandiwa?",
            optionA: "maganda",
            optionB: "tumakbo",
            optionC: "mabilis",
            optionD: "bahay",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Ang 'ng' sa 'bahay ng guro' ay:",
            optionA: "Pang-abay",
            optionB: "Pang-ukol",
            optionC: "Panghalip",
            optionD: "Pang-uri",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Ano ang aspekto ng 'nagbasa'?",
            optionA: "Kontemplatibo",
            optionB: "Perfektibo",
            optionC: "Pawatas",
            optionD: "Aspektwal na naganap",
            correctOption: "D",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Alin ang tamang pagbigkas ng 'po' sa pormal na usapan?",
            optionA: "Hindi kailangan",
            optionB: "Gamitin sa pagpapakita ng paggalang",
            optionC: "Palitan ng 'pre'",
            optionD: "Gamitin lamang sa sulat",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Ang salitang 'nakakapagpabagabag' ay halimbawa ng:",
            optionA: "Pangngalang pantangi",
            optionB: "Pang-abay na pamamangha",
            optionC: "Panghalip na panao",
            optionD: "Pang-ukol na laman",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Sa balarila, ang tuwirang pangungusap ay:",
            optionA: "Nagsisimula sa pantulong na pandiwa",
            optionB: "Di-tuwirang panaginip",
            optionC: "May di-pantay na sukatan",
            optionD: "Walang panaguri",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Panitikan",
        questions: [
          {
            text: "[Demo] Sino ang sumulat ng 'Noli Me Tangere'?",
            optionA: "Andrés Bonifacio",
            optionB: "José Rizal",
            optionC: "Francisco Balagtas",
            optionD: "Lope K. Santos",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Ang 'Florante at Laura' ay isang:",
            optionA: "Nobela",
            optionB: "Dula",
            optionC: "Awit",
            optionD: "Sanaysay",
            correctOption: "C",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Ang tema ay:",
            optionA: "Pangalan ng tauhan",
            optionB: "Pangunahing mensahe ng akda",
            optionC: "Lugar ng pangyayari",
            optionD: "Uri ng taludtod",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Ang 'Ibong Adarna' ay bahagi ng:",
            optionA: "Mitolohiyang Romano",
            optionB: "Kuwentong bayan",
            optionC: "Epikong Sumerian",
            optionD: "Talambuhay",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Sa pagtatasa ng tula, ang sukat ay tumutukoy sa:",
            optionA: "Bilang ng pantig bawat taludtod",
            optionB: "Simuno at panaguri",
            optionC: "Uri ng pangungusap",
            optionD: "Pangngalan ng may-akda",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Ang akdang pampanitikan na naglalayong magpatawa ay:",
            optionA: "Trahedya",
            optionB: "Komedya",
            optionC: "Elegiya",
            optionD: "Alamat",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
    ],
  },
  {
    courseCode: "HIST 105",
    courseTitle: "Philippine History",
    curriculumYear: 1,
    topics: [
      {
        name: "Pre-colonial Era",
        questions: [
          {
            text: "[Demo] Pre-colonial Filipinos traded using:",
            optionA: "Barter and coastal exchange",
            optionB: "Only paper money",
            optionC: "Credit cards",
            optionD: "No trade at all",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] The barangay was primarily a:",
            optionA: "Religious order",
            optionB: "Political community",
            optionC: "Foreign colony",
            optionD: "Mountain range",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] The Laguna Copperplate Inscription dates to:",
            optionA: "900 CE",
            optionB: "1521",
            optionC: "1898",
            optionD: "1946",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Rajah Matanda was associated with:",
            optionA: "Tondo",
            optionB: "Rome",
            optionC: "Madrid",
            optionD: "Beijing",
            correctOption: "A",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Pre-colonial writing included:",
            optionA: "Baybayin",
            optionB: "Latin only",
            optionC: "Cyrillic",
            optionD: "No writing systems",
            correctOption: "A",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] The Code of Kalantiaw is historically:",
            optionA: "A verified ancient code",
            optionB: "Considered a hoax by scholars",
            optionC: "A Spanish law",
            optionD: "A US treaty",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Modern Era",
        questions: [
          {
            text: "[Demo] The Philippines declared independence in 1898 under:",
            optionA: "Emilio Aguinaldo",
            optionB: "Ferdinand Marcos",
            optionC: "Manuel Quezon",
            optionD: "José Rizal",
            correctOption: "A",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Martial Law was declared in:",
            optionA: "1946",
            optionB: "1972",
            optionC: "1986",
            optionD: "2000",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] The EDSA People Power Revolution occurred in:",
            optionA: "1972",
            optionB: "1986",
            optionC: "1998",
            optionD: "2010",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] The Commonwealth period prepared the country for:",
            optionA: "Japanese rule",
            optionB: "Independence",
            optionC: "Permanent US statehood",
            optionD: "Spanish return",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] The Treaty of Paris (1898) transferred the Philippines from Spain to:",
            optionA: "Japan",
            optionB: "United States",
            optionC: "Britain",
            optionD: "France",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] The 1987 Constitution restored:",
            optionA: "Permanent martial law",
            optionB: "Democratic institutions",
            optionC: "Monarchy",
            optionD: "Foreign governorship",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
    ],
  },
  {
    courseCode: "VAL 101",
    courseTitle: "Values Education",
    curriculumYear: 1,
    topics: [
      {
        name: "Ethics",
        questions: [
          {
            text: "[Demo] Integrity means:",
            optionA: "Doing what is popular",
            optionB: "Acting consistently with moral principles",
            optionC: "Avoiding all rules",
            optionD: "Winning at any cost",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Empathy is the ability to:",
            optionA: "Ignore others' feelings",
            optionB: "Understand others' perspectives",
            optionC: "Break promises",
            optionD: "Avoid teamwork",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] A utilitarian approach judges actions by:",
            optionA: "Tradition only",
            optionB: "Their consequences for the greatest good",
            optionC: "Random chance",
            optionD: "Personal gain only",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Academic honesty requires:",
            optionA: "Sharing answers on exams",
            optionB: "Original work and proper attribution",
            optionC: "Copying without credit",
            optionD: "Hiding sources",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] A moral dilemma involves:",
            optionA: "No real choices",
            optionB: "Conflicting ethical values",
            optionC: "Only math problems",
            optionD: "Legal trivia",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] The golden rule advises:",
            optionA: "Take before others take",
            optionB: "Treat others as you want to be treated",
            optionC: "Ignore consequences",
            optionD: "Follow only laws you like",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
      {
        name: "Citizenship",
        questions: [
          {
            text: "[Demo] A responsible citizen:",
            optionA: "Ignores community rules",
            optionB: "Participates constructively in society",
            optionC: "Avoids voting",
            optionD: "Spreads false information",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Respect for diversity means:",
            optionA: "Everyone must be identical",
            optionB: "Valuing different backgrounds and views",
            optionC: "Rejecting all cultures",
            optionD: "Avoiding discussion",
            correctOption: "B",
            difficulty: Difficulty.EASY,
          },
          {
            text: "[Demo] Digital citizenship includes:",
            optionA: "Cyberbullying",
            optionB: "Responsible online behavior",
            optionC: "Sharing passwords",
            optionD: "Plagiarizing posts",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Community service develops:",
            optionA: "Selfishness",
            optionB: "Social responsibility",
            optionC: "Apathy",
            optionD: "Isolation",
            correctOption: "B",
            difficulty: Difficulty.MEDIUM,
          },
          {
            text: "[Demo] Civil discourse requires:",
            optionA: "Personal attacks",
            optionB: "Respectful disagreement",
            optionC: "Shouting down opponents",
            optionD: "Spreading rumors",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
          {
            text: "[Demo] Environmental stewardship means:",
            optionA: "Wasting resources",
            optionB: "Caring for shared natural resources",
            optionC: "Ignoring pollution",
            optionD: "Illegal dumping",
            correctOption: "B",
            difficulty: Difficulty.HARD,
          },
        ],
      },
    ],
  },
];

async function upsertSubjectPrograms(subjectId: string) {
  for (const programCourse of DEMO_PROGRAM_COURSES) {
    await prisma.subjectProgramCourse.upsert({
      where: {
        subjectId_programCourse: { subjectId, programCourse },
      },
      update: {},
      create: { subjectId, programCourse },
    });
  }
}

async function seedSubjectContent(teacherId: string, plan: DemoSubject) {
  const subject = await prisma.subject.upsert({
    where: {
      courseCode_yearLevel: {
        courseCode: plan.courseCode,
        yearLevel: plan.curriculumYear,
      },
    },
    update: { courseTitle: plan.courseTitle },
    create: {
      courseCode: plan.courseCode,
      courseTitle: plan.courseTitle,
      yearLevel: plan.curriculumYear,
      createdById: teacherId,
    },
  });

  await upsertSubjectPrograms(subject.id);

  let topicsCreated = 0;
  let questionsCreated = 0;

  for (const topicPlan of plan.topics) {
    const topic = await prisma.topic.upsert({
      where: { subjectId_name: { subjectId: subject.id, name: topicPlan.name } },
      update: {},
      create: { name: topicPlan.name, subjectId: subject.id },
    });
    topicsCreated += 1;

    for (const question of topicPlan.questions) {
      const existing = await prisma.question.findFirst({
        where: { subjectId: subject.id, text: question.text },
      });
      if (!existing) {
        await prisma.question.create({
          data: {
            ...question,
            subjectId: subject.id,
            topicId: topic.id,
            createdById: teacherId,
          },
        });
        questionsCreated += 1;
      }
    }
  }

  return { subjectId: subject.id, topicsCreated, questionsCreated };
}

async function upsertComprehensiveQuestionSet({
  teacherId,
  programCourse,
  type,
  subjectIds,
}: {
  teacherId: string;
  programCourse: string;
  type: QuestionSetType;
  subjectIds: string[];
}) {
  const yearLevel = 2;
  const name = comprehensiveSetName(programCourse, type);
  const perSubjectEasy = 3;
  const perSubjectMedium = 3;
  const perSubjectHard = 2;
  const totalItems = subjectIds.length * (perSubjectEasy + perSubjectMedium + perSubjectHard);

  const existing = await prisma.questionSet.findFirst({
    where: { name, yearLevel, programCourse, type },
  });

  const configCreates = [];
  for (const subjectId of subjectIds) {
    const topic = await prisma.topic.findFirst({
      where: { subjectId },
      orderBy: { name: "asc" },
    });
    configCreates.push({
      subjectId,
      topicId: topic?.id ?? null,
      easyCount: perSubjectEasy,
      mediumCount: perSubjectMedium,
      hardCount: perSubjectHard,
    });
  }

  if (existing) {
    await prisma.questionSetConfig.deleteMany({ where: { questionSetId: existing.id } });
    return prisma.questionSet.update({
      where: { id: existing.id },
      data: {
        totalItems,
        passThreshold: 75,
        status: QuestionSetStatus.DEPLOYED,
        deployedAt: new Date(),
        configs: { create: configCreates },
      },
    });
  }

  await prisma.questionSet.updateMany({
    where: { yearLevel, programCourse, type, status: QuestionSetStatus.DEPLOYED },
    data: { status: QuestionSetStatus.ARCHIVED },
  });

  return prisma.questionSet.create({
    data: {
      name,
      yearLevel,
      programCourse,
      type,
      status: QuestionSetStatus.DEPLOYED,
      totalItems,
      passThreshold: 75,
      deployedAt: new Date(),
      createdById: teacherId,
      configs: { create: configCreates },
    },
  });
}

export async function ensureAnalyticsSubjects(teacher: Pick<User, "id">) {
  let questionsCreated = 0;
  const subjectIds: string[] = [];

  for (const plan of DEMO_SUBJECTS) {
    const result = await seedSubjectContent(teacher.id, plan);
    subjectIds.push(result.subjectId);
    questionsCreated += result.questionsCreated;
  }

  const mathSubject = await prisma.subject.findFirst({
    where: { courseCode: "MATH 105" },
    select: { id: true },
  });
  if (mathSubject && !subjectIds.includes(mathSubject.id)) {
    subjectIds.unshift(mathSubject.id);
    await upsertSubjectPrograms(mathSubject.id);
  }

  const questionSets: Array<{ programCourse: string; diagnostic: string; retake: string }> =
    [];
  let itemsPerExam = 0;

  for (const programCourse of DEMO_PROGRAM_COURSES) {
    const diagnostic = await upsertComprehensiveQuestionSet({
      teacherId: teacher.id,
      programCourse,
      type: QuestionSetType.DIAGNOSTIC,
      subjectIds,
    });

    const retake = await upsertComprehensiveQuestionSet({
      teacherId: teacher.id,
      programCourse,
      type: QuestionSetType.RETAKE,
      subjectIds,
    });

    if (itemsPerExam === 0) itemsPerExam = diagnostic.totalItems;

    questionSets.push({
      programCourse,
      diagnostic: diagnostic.name,
      retake: retake.name,
    });
  }

  return {
    subjects: subjectIds.length,
    questionsCreated,
    questionSets,
    itemsPerExam,
  };
}

export async function buildComprehensiveExamQuestions(targetCount = 48): Promise<Question[]> {
  const subjects = await prisma.subject.findMany({
    where: { courseCode: { in: [...ANALYTICS_DEMO_SUBJECT_CODES] } },
    include: {
      topics: {
        include: {
          questions: { orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }] },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { courseCode: "asc" },
  });

  const examQuestions: Question[] = [];
  const perSubject = Math.max(6, Math.floor(targetCount / Math.max(subjects.length, 1)));

  for (const subject of subjects) {
    const subjectPool: Question[] = [];
    for (const topic of subject.topics) {
      subjectPool.push(...topic.questions.slice(0, 2));
    }

    const allSubjectQuestions = subject.topics.flatMap((topic) => topic.questions);
    for (const question of allSubjectQuestions) {
      if (subjectPool.length >= perSubject) break;
      if (!subjectPool.some((row) => row.id === question.id)) {
        subjectPool.push(question);
      }
    }

    examQuestions.push(...subjectPool.slice(0, perSubject));
  }

  if (examQuestions.length < targetCount) {
    const extras = await prisma.question.findMany({
      where: {
        subject: { courseCode: { in: [...ANALYTICS_DEMO_SUBJECT_CODES] } },
        id: { notIn: examQuestions.map((row) => row.id) },
      },
      orderBy: [{ subjectId: "asc" }, { difficulty: "asc" }],
      take: targetCount - examQuestions.length,
    });
    examQuestions.push(...extras);
  }

  return examQuestions.slice(0, targetCount);
}
