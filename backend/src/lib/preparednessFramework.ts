export type PreparednessCategoryId =
  | "very_high"
  | "high"
  | "moderate"
  | "low"
  | "very_low";

export type PreparednessCategory = {
  id: PreparednessCategoryId;
  label: string;
  performanceLabel: string;
  min: number;
  max: number;
};

const PREPAREDNESS_CATEGORIES: PreparednessCategory[] = [
  {
    id: "very_high",
    label: "Very High Preparedness",
    performanceLabel: "Very High Performance",
    min: 80,
    max: 100,
  },
  {
    id: "high",
    label: "High Preparedness",
    performanceLabel: "High Performance",
    min: 60,
    max: 79.99,
  },
  {
    id: "moderate",
    label: "Moderate Preparedness",
    performanceLabel: "Moderate Performance",
    min: 40,
    max: 59.99,
  },
  {
    id: "low",
    label: "Low Preparedness",
    performanceLabel: "Low Performance",
    min: 20,
    max: 39.99,
  },
  {
    id: "very_low",
    label: "Very Low Preparedness",
    performanceLabel: "Very Low Performance",
    min: 0,
    max: 19.99,
  },
];

const FRAMEWORK_COPY: Record<
  PreparednessCategoryId,
  { interpretation: string; suggestedIntervention: string }
> = {
  very_high: {
    interpretation:
      "This result indicates that students possess strong foundational knowledge and higher-order cognitive skills necessary for academic success in the program. Performance across the assessed unit topics demonstrates a high level of mastery, suggesting that learners are capable of understanding concepts, applying knowledge to practical situations, analyzing information, evaluating alternatives, and creating solutions with minimal assistance. The overall results indicate readiness for advanced learning experiences and complex academic tasks.",
    suggestedIntervention:
      "Rather than remediation, enrichment initiatives are recommended. The institution may implement advanced workshops, innovation projects, research-oriented activities, coding competitions, collaborative problem-solving exercises, and industry-based learning experiences. Instruction may focus on extending higher-order thinking skills and providing opportunities for leadership, innovation, and creative application of knowledge.",
  },
  high: {
    interpretation:
      "The findings suggest that students possess adequate knowledge and skills across most assessed learning domains and are generally prepared to meet the academic demands of the program. While students demonstrate competence in foundational and intermediate cognitive processes, certain areas may require reinforcement to strengthen analytical, evaluative, and creative thinking abilities. The results indicate that students are likely to succeed in the curriculum with targeted instructional support.",
    suggestedIntervention:
      "The institution may implement enhancement programs focusing on identified weaker unit topics. Recommended interventions include supplemental learning modules, guided practice activities, laboratory exercises, collaborative learning strategies, and periodic formative assessments. Emphasis should be placed on strengthening higher-order cognitive skills through problem-based learning and authentic learning tasks.",
  },
  moderate: {
    interpretation:
      "The results indicate that students possess basic competencies necessary for entry into the program; however, several learning gaps are evident across the assessed unit topics. While foundational understanding may be present, students may encounter difficulties when required to apply, analyze, evaluate, or create solutions in more complex learning situations. Without timely intervention, these deficiencies may affect academic performance in higher-level courses.",
    suggestedIntervention:
      "A structured bridging program is recommended prior to or during the initial stages of instruction. Intervention strategies may include diagnostic-based remediation, tutorial sessions, peer-assisted learning, scaffolded learning activities, and competency-building workshops. Particular attention should be given to topics with the lowest performance and Bloom's domains requiring improvement. Continuous monitoring and reassessment should be conducted to measure learning gains.",
  },
  low: {
    interpretation:
      "The findings reveal substantial learning deficiencies across multiple unit topics and cognitive domains. Students may struggle to demonstrate adequate understanding of essential concepts and may encounter significant challenges when applying knowledge to academic tasks. The results suggest a heightened risk of learning difficulties and poor academic performance if appropriate support mechanisms are not provided.",
    suggestedIntervention:
      "The institution should implement intensive academic support programs focusing on foundational competencies. Recommended interventions include comprehensive bridging courses, structured remediation programs, individualized learning plans, faculty mentoring, guided practice sessions, and regular progress monitoring. Priority should be given to addressing fundamental knowledge gaps before introducing more advanced concepts and skills.",
  },
  very_low: {
    interpretation:
      "The results indicate severe deficiencies in foundational knowledge and cognitive skills across the assessed unit topics. Students may lack the prerequisite competencies necessary for successful participation in the academic program and are likely to experience substantial difficulty in meeting course requirements. Immediate intervention is necessary to prevent learning failure and improve academic readiness.",
    suggestedIntervention:
      "An intensive readiness enhancement program should be implemented before students engage in regular coursework. Recommended interventions include foundational skills training, extended bridging courses, diagnostic-driven remediation plans, individualized academic counseling, mentoring programs, and continuous assessment mechanisms. Institutional support should focus on rebuilding fundamental competencies while gradually introducing higher-level learning tasks.",
  },
};

export const PREPAREDNESS_SCORE_BUCKETS = PREPAREDNESS_CATEGORIES.map((category) => ({
  label: category.label.replace(" Preparedness", ""),
  min: category.min,
  max: category.max,
}));

export function classifyPreparedness(score: number): PreparednessCategory {
  const value = Math.max(0, Math.min(100, score));
  const match =
    PREPAREDNESS_CATEGORIES.find((category) => value >= category.min && value <= category.max) ??
    PREPAREDNESS_CATEGORIES[PREPAREDNESS_CATEGORIES.length - 1];
  return match;
}

export function classifyPerformance(score: number) {
  return classifyPreparedness(score).performanceLabel;
}

export function preparednessLevelLabel(score: number) {
  return classifyPreparedness(score).label;
}

export type PreparednessTopicRow = {
  label: string;
  score: number;
  performanceLabel: string;
};

export type PreparednessReport = {
  cohortLabel: string;
  readinessIndex: number;
  categoryId: PreparednessCategoryId;
  categoryLabel: string;
  topicPerformance: PreparednessTopicRow[];
  interpretation: string;
  suggestedIntervention: string;
  narrative: string;
  basedOnDiagnostic: boolean;
};

function formatTopicList(
  topics: PreparednessTopicRow[],
  predicate: (topic: PreparednessTopicRow) => boolean
) {
  const matches = topics.filter(predicate);
  if (matches.length === 0) return "";
  return matches
    .map((topic) => `${topic.label} (${topic.score.toFixed(2)}%)`)
    .join(", ");
}

function buildNarrative(
  cohortLabel: string,
  readinessIndex: number,
  category: PreparednessCategory,
  topics: PreparednessTopicRow[]
) {
  const strongTopics = formatTopicList(
    topics,
    (topic) => topic.score >= 60
  );
  const weakTopics = formatTopicList(
    topics,
    (topic) => topic.score < 40
  );

  let topicSentence = "";
  if (topics.length > 0) {
    const parts: string[] = [];
    if (strongTopics) parts.push(`stronger performance in ${strongTopics}`);
    if (weakTopics) parts.push(`notable gaps in ${weakTopics}`);
    if (parts.length > 0) {
      topicSentence = ` Unit topic results revealed ${parts.join(", while ")}.`;
    }
  }

  const actionLead =
    category.id === "very_high" || category.id === "high"
      ? "To extend readiness"
      : "To address these gaps";

  const actionBody =
    category.id === "very_high"
      ? " enrichment activities emphasizing innovation, research, and advanced problem-solving are recommended."
      : category.id === "high"
        ? " targeted enhancement modules and guided practice on weaker topics are recommended."
        : category.id === "moderate"
          ? " a structured bridging program focusing on the lowest-performing topics and higher-order skills is recommended."
          : category.id === "low"
            ? " intensive remediation, mentoring, and foundational bridging courses are recommended."
            : " an immediate intensive readiness enhancement program is recommended before regular coursework.";

  return `${cohortLabel} obtained a Readiness Index of ${readinessIndex.toFixed(2)}, corresponding to the ${category.label} category.${topicSentence} These findings suggest that while students ${
    category.id === "very_high" || category.id === "high"
      ? "are generally prepared for program demands"
      : "require structured support before higher-level coursework"
  }. ${actionLead},${actionBody}`;
}

export function buildPreparednessReport(input: {
  cohortLabel: string;
  readinessIndex: number;
  topics: Array<{ label: string; score: number }>;
  basedOnDiagnostic?: boolean;
}): PreparednessReport {
  const category = classifyPreparedness(input.readinessIndex);
  const copy = FRAMEWORK_COPY[category.id];
  const topicPerformance = input.topics
    .map((topic) => ({
      label: topic.label,
      score: Math.round(topic.score * 100) / 100,
      performanceLabel: classifyPerformance(topic.score),
    }))
    .sort((a, b) => b.score - a.score);

  const readinessIndex = Math.round(input.readinessIndex * 100) / 100;

  return {
    cohortLabel: input.cohortLabel,
    readinessIndex,
    categoryId: category.id,
    categoryLabel: category.label,
    topicPerformance,
    interpretation: copy.interpretation,
    suggestedIntervention: copy.suggestedIntervention,
    narrative: buildNarrative(input.cohortLabel, readinessIndex, category, topicPerformance),
    basedOnDiagnostic: Boolean(input.basedOnDiagnostic),
  };
}

export function countPreparednessBuckets(scores: number[]) {
  return PREPAREDNESS_SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    students: scores.filter((score) => score >= bucket.min && score <= bucket.max).length,
  }));
}
