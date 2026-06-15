-- Keep only the most recent in-progress attempt per student.
DELETE FROM "ExamAttempt"
WHERE "submittedAt" IS NULL
AND "id" IN (
  SELECT "id"
  FROM "ExamAttempt" AS older
  WHERE older."submittedAt" IS NULL
  AND older."id" != (
    SELECT latest."id"
    FROM "ExamAttempt" AS latest
    WHERE latest."studentId" = older."studentId"
    AND latest."submittedAt" IS NULL
    ORDER BY latest."startedAt" DESC, latest."createdAt" DESC
    LIMIT 1
  )
);

CREATE UNIQUE INDEX "ExamAttempt_one_in_progress_per_student"
ON "ExamAttempt"("studentId")
WHERE "submittedAt" IS NULL;
