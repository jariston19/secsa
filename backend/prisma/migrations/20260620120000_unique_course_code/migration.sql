-- Merge subjects that share the same course code (case-insensitive).
-- Keep the oldest subject; move questions/topics/config links; combine program links.
CREATE TEMP TABLE "_subject_code_merge_map" (
  "duplicateId" TEXT NOT NULL PRIMARY KEY,
  "keeperId" TEXT NOT NULL
);

INSERT INTO "_subject_code_merge_map" ("duplicateId", "keeperId")
SELECT s."id", keeper."id"
FROM "Subject" s
JOIN (
  SELECT lower(trim("courseCode")) AS "normalizedCode", MIN("createdAt") AS "minCreatedAt"
  FROM "Subject"
  GROUP BY lower(trim("courseCode"))
  HAVING COUNT(*) > 1
) grouped
  ON lower(trim(s."courseCode")) = grouped."normalizedCode"
JOIN "Subject" keeper
  ON lower(trim(keeper."courseCode")) = grouped."normalizedCode"
 AND keeper."createdAt" = grouped."minCreatedAt"
WHERE s."id" <> keeper."id";

INSERT OR IGNORE INTO "SubjectProgramCourse" ("id", "subjectId", "programCourse")
SELECT lower(hex(randomblob(12))), map."keeperId", link."programCourse"
FROM "SubjectProgramCourse" link
JOIN "_subject_code_merge_map" map ON map."duplicateId" = link."subjectId";

UPDATE "Question"
SET "subjectId" = map."keeperId"
FROM "_subject_code_merge_map" map
WHERE "Question"."subjectId" = map."duplicateId";

UPDATE "Question"
SET "topicId" = keeperTopic."id"
FROM "_subject_code_merge_map" map
JOIN "Topic" dupTopic ON dupTopic."subjectId" = map."duplicateId"
JOIN "Topic" keeperTopic
  ON keeperTopic."subjectId" = map."keeperId"
 AND keeperTopic."name" = dupTopic."name"
WHERE "Question"."topicId" = dupTopic."id";

UPDATE "QuestionSetConfig"
SET "subjectId" = map."keeperId"
FROM "_subject_code_merge_map" map
WHERE "QuestionSetConfig"."subjectId" = map."duplicateId";

UPDATE "QuestionSetConfig"
SET "topicId" = keeperTopic."id"
FROM "_subject_code_merge_map" map
JOIN "Topic" dupTopic ON dupTopic."subjectId" = map."duplicateId"
JOIN "Topic" keeperTopic
  ON keeperTopic."subjectId" = map."keeperId"
 AND keeperTopic."name" = dupTopic."name"
WHERE "QuestionSetConfig"."topicId" = dupTopic."id";

DELETE FROM "Topic"
WHERE "subjectId" IN (SELECT "duplicateId" FROM "_subject_code_merge_map");

DELETE FROM "SubjectProgramCourse"
WHERE "subjectId" IN (SELECT "duplicateId" FROM "_subject_code_merge_map");

DELETE FROM "Subject"
WHERE "id" IN (SELECT "duplicateId" FROM "_subject_code_merge_map");

DROP INDEX "Subject_courseCode_yearLevel_key";
CREATE UNIQUE INDEX "Subject_courseCode_key" ON "Subject"("courseCode");
