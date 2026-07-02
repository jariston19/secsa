import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const PASSWORD = __ENV.PASSWORD || "password123";
const STUDENT_COUNT = Number(__ENV.STUDENT_COUNT || 30);
const EXAM_KIND = __ENV.EXAM_KIND || "incoming_diagnostic";
const ANSWER_DELAY_SEC = Number(__ENV.ANSWER_DELAY_SEC || 0.05);
const SUBMIT_SAMPLE = __ENV.SUBMIT_SAMPLE !== "false";

const loginFailures = new Rate("login_failures");
const startFailures = new Rate("start_failures");
const submitFailures = new Rate("submit_failures");
const examsCompleted = new Counter("exams_completed");
const examDuration = new Trend("exam_flow_duration", true);

const targetVus = Number(__ENV.VUS || STUDENT_COUNT);
const rampUp = __ENV.RAMP_UP || "30s";
const hold = __ENV.HOLD || "2m";
const rampDown = __ENV.RAMP_DOWN || "15s";

export const options = {
  scenarios: {
    student_exam: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: rampUp, target: targetVus },
        { duration: hold, target: targetVus },
        { duration: rampDown, target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    login_failures: ["rate<0.05"],
    start_failures: ["rate<0.10"],
    submit_failures: ["rate<0.10"],
    exam_flow_duration: ["p(95)<120000"],
  },
};

function studentEmail(vu) {
  const index = ((vu - 1) % STUDENT_COUNT) + 1;
  return `student${String(index).padStart(2, "0")}@secsa.local`;
}

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

function randomOption() {
  const options = ["A", "B", "C", "D"];
  return options[Math.floor(Math.random() * options.length)];
}

export function setup() {
  const health = http.get(`${BASE_URL}/health`);
  check(health, { "backend healthy": (res) => res.status === 200 });
  return { baseUrl: BASE_URL };
}

export default function () {
  const startedAt = Date.now();
  const email = studentEmail(__VU);

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "login" } }
  );

  const loginOk = check(loginRes, {
    "login status 200": (res) => res.status === 200,
    "login has token": (res) => Boolean(res.json("token")),
  });
  loginFailures.add(!loginOk);
  if (!loginOk) {
    return;
  }

  const token = loginRes.json("token");
  const headers = authHeaders(token);

  const statusRes = http.get(`${BASE_URL}/api/exams/status`, {
    ...headers,
    tags: { name: "exam_status" },
  });
  check(statusRes, { "exam status 200": (res) => res.status === 200 });

  const startBody =
    EXAM_KIND === "comprehensive"
      ? JSON.stringify({ examKind: "comprehensive" })
      : JSON.stringify({ examKind: "incoming_diagnostic" });

  const startRes = http.post(`${BASE_URL}/api/exams/start`, startBody, {
    ...headers,
    tags: { name: "exam_start" },
  });

  const startOk = check(startRes, {
    "exam start ok": (res) => res.status === 200 || res.status === 201,
    "exam start has attempt": (res) => Boolean(res.json("attempt.id")),
    "exam start has questions": (res) => Array.isArray(res.json("questions")),
  });
  startFailures.add(!startOk);
  if (!startOk) {
    return;
  }

  const attemptId = startRes.json("attempt.id");
  const questions = startRes.json("questions") || [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    http.patch(
      `${BASE_URL}/api/exams/${attemptId}/answers/${question.id}`,
      JSON.stringify({
        selectedOption: randomOption(),
        timeSpentSeconds: 20 + (index % 5),
      }),
      { ...headers, tags: { name: "save_answer" } }
    );

    if (index % 5 === 0 || index === questions.length - 1) {
      http.patch(
        `${BASE_URL}/api/exams/${attemptId}/progress`,
        JSON.stringify({ currentQuestionIndex: index }),
        { ...headers, tags: { name: "save_progress" } }
      );
    }

    if (ANSWER_DELAY_SEC > 0) {
      sleep(ANSWER_DELAY_SEC);
    }
  }

  const answers = SUBMIT_SAMPLE
    ? questions.map((question, index) => ({
        questionId: question.id,
        selectedOption: randomOption(),
        timeSpentSeconds: 15 + (index % 10),
      }))
    : [];

  const submitRes = http.post(
    `${BASE_URL}/api/exams/${attemptId}/submit`,
    JSON.stringify({ answers, focusWarningCount: 0 }),
    { ...headers, tags: { name: "exam_submit" } }
  );

  const submitOk = check(submitRes, {
    "submit status 200": (res) => res.status === 200,
    "submit has result": (res) => res.json("result.percentage") !== undefined,
  });
  submitFailures.add(!submitOk);
  if (submitOk) {
    examsCompleted.add(1);
    examDuration.add(Date.now() - startedAt);
  }

  sleep(1);
}
