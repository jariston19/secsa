import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const PASSWORD = __ENV.PASSWORD || "password123";
const STUDENT_COUNT = Number(__ENV.STUDENT_COUNT || 30);

export const options = {
  vus: Number(__ENV.VUS || 30),
  duration: __ENV.HOLD || __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<5000"],
  },
};

function studentEmail(vu) {
  const index = ((vu - 1) % STUDENT_COUNT) + 1;
  return `student${String(index).padStart(2, "0")}@secsa.local`;
}

export default function () {
  const email = studentEmail(__VU);
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(loginRes, {
    "login 200": (res) => res.status === 200,
  });

  const token = loginRes.json("token");
  if (!token) {
    return;
  }

  http.get(`${BASE_URL}/api/exams/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  sleep(0.5);
}
