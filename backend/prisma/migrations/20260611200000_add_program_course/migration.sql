PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "programCourse" TEXT NOT NULL DEFAULT 'INFORMATION_TECHNOLOGY',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Subject" (
    "id", "courseCode", "courseTitle", "yearLevel", "programCourse", "createdById", "createdAt", "updatedAt"
)
SELECT
    "id", "courseCode", "courseTitle", "yearLevel", 'INFORMATION_TECHNOLOGY', "createdById", "createdAt", "updatedAt"
FROM "Subject";

DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE UNIQUE INDEX "Subject_courseCode_yearLevel_programCourse_key" ON "Subject"("courseCode", "yearLevel", "programCourse");

ALTER TABLE "User" ADD COLUMN "programCourse" TEXT;

UPDATE "User"
SET "programCourse" = 'INFORMATION_TECHNOLOGY'
WHERE "role" = 'STUDENT';

ALTER TABLE "QuestionSet" ADD COLUMN "programCourse" TEXT NOT NULL DEFAULT 'INFORMATION_TECHNOLOGY';

PRAGMA foreign_keys=ON;
