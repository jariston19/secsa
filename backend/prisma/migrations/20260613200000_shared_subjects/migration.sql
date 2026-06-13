-- Create junction table for shared subjects across program courses.
CREATE TABLE "SubjectProgramCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "programCourse" TEXT NOT NULL,
    CONSTRAINT "SubjectProgramCourse_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SubjectProgramCourse_subjectId_programCourse_key"
  ON "SubjectProgramCourse"("subjectId", "programCourse");

-- Copy existing single-program links into the junction table.
INSERT INTO "SubjectProgramCourse" ("id", "subjectId", "programCourse")
SELECT
  lower(hex(randomblob(12))),
  "id",
  "programCourse"
FROM "Subject";

-- Merge duplicate subjects that share the same course code and year level.
-- Keep the oldest subject; move questions/topics/config links; combine program links.
CREATE TEMP TABLE "_subject_merge_map" (
  "duplicateId" TEXT NOT NULL PRIMARY KEY,
  "keeperId" TEXT NOT NULL
);

INSERT INTO "_subject_merge_map" ("duplicateId", "keeperId")
SELECT s."id", keeper."id"
FROM "Subject" s
JOIN (
  SELECT "courseCode", "yearLevel", MIN("createdAt") AS "minCreatedAt"
  FROM "Subject"
  GROUP BY "courseCode", "yearLevel"
  HAVING COUNT(*) > 1
) grouped
  ON grouped."courseCode" = s."courseCode"
 AND grouped."yearLevel" = s."yearLevel"
JOIN "Subject" keeper
  ON keeper."courseCode" = grouped."courseCode"
 AND keeper."yearLevel" = grouped."yearLevel"
 AND keeper."createdAt" = grouped."minCreatedAt"
WHERE s."id" <> keeper."id";

INSERT OR IGNORE INTO "SubjectProgramCourse" ("id", "subjectId", "programCourse")
SELECT lower(hex(randomblob(12))), map."keeperId", link."programCourse"
FROM "SubjectProgramCourse" link
JOIN "_subject_merge_map" map ON map."duplicateId" = link."subjectId";

UPDATE "Question"
SET "subjectId" = map."keeperId"
FROM "_subject_merge_map" map
WHERE "Question"."subjectId" = map."duplicateId";

UPDATE "Question"
SET "topicId" = keeperTopic."id"
FROM "_subject_merge_map" map
JOIN "Topic" dupTopic ON dupTopic."subjectId" = map."duplicateId"
JOIN "Topic" keeperTopic
  ON keeperTopic."subjectId" = map."keeperId"
 AND keeperTopic."name" = dupTopic."name"
WHERE "Question"."subjectId" = map."keeperId"
  AND "Question"."topicId" = dupTopic."id";

UPDATE "Question"
SET "topicId" = NULL
FROM "_subject_merge_map" map
JOIN "Topic" dupTopic ON dupTopic."subjectId" = map."duplicateId"
WHERE "Question"."subjectId" = map."keeperId"
  AND "Question"."topicId" = dupTopic."id";

UPDATE "Topic"
SET "subjectId" = map."keeperId"
FROM "_subject_merge_map" map
WHERE "Topic"."subjectId" = map."duplicateId"
  AND NOT EXISTS (
    SELECT 1
    FROM "Topic" existing
    WHERE existing."subjectId" = map."keeperId"
      AND existing."name" = "Topic"."name"
  );

DELETE FROM "Topic"
WHERE "subjectId" IN (SELECT "duplicateId" FROM "_subject_merge_map");

UPDATE "QuestionSetConfig"
SET "subjectId" = map."keeperId"
FROM "_subject_merge_map" map
WHERE "QuestionSetConfig"."subjectId" = map."duplicateId";

DELETE FROM "Subject"
WHERE "id" IN (SELECT "duplicateId" FROM "_subject_merge_map");

DROP TABLE "_subject_merge_map";

-- Replace per-program uniqueness with shared subject identity.
DROP INDEX "Subject_courseCode_yearLevel_programCourse_key";
CREATE UNIQUE INDEX "Subject_courseCode_yearLevel_key" ON "Subject"("courseCode", "yearLevel");

CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Subject" ("id", "courseCode", "courseTitle", "yearLevel", "createdById", "createdAt", "updatedAt")
SELECT "id", "courseCode", "courseTitle", "yearLevel", "createdById", "createdAt", "updatedAt"
FROM "Subject";

DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE UNIQUE INDEX "Subject_courseCode_yearLevel_key" ON "Subject"("courseCode", "yearLevel");
