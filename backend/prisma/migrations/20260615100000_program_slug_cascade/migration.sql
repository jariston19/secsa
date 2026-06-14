-- Redefine foreign keys to Program.slug with ON UPDATE CASCADE.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "yearLevel" INTEGER,
    "programCourse" TEXT,
    "qaUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_email_key" UNIQUE ("email"),
    CONSTRAINT "User_programCourse_fkey" FOREIGN KEY ("programCourse") REFERENCES "Program" ("slug") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_User" (
    "id",
    "email",
    "passwordHash",
    "firstName",
    "lastName",
    "role",
    "yearLevel",
    "programCourse",
    "qaUnlimited",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "email",
    "passwordHash",
    "firstName",
    "lastName",
    "role",
    "yearLevel",
    "programCourse",
    "qaUnlimited",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE TABLE "new_SubjectProgramCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "programCourse" TEXT NOT NULL,
    CONSTRAINT "SubjectProgramCourse_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectProgramCourse_programCourse_fkey" FOREIGN KEY ("programCourse") REFERENCES "Program" ("slug") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_SubjectProgramCourse" ("id", "subjectId", "programCourse")
SELECT "id", "subjectId", "programCourse" FROM "SubjectProgramCourse";

DROP TABLE "SubjectProgramCourse";
ALTER TABLE "new_SubjectProgramCourse" RENAME TO "SubjectProgramCourse";
CREATE UNIQUE INDEX "SubjectProgramCourse_subjectId_programCourse_key" ON "SubjectProgramCourse"("subjectId", "programCourse");

CREATE TABLE "new_QuestionSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "programCourse" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalItems" INTEGER NOT NULL,
    "passThreshold" REAL NOT NULL DEFAULT 75,
    "createdById" TEXT NOT NULL,
    "deployedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionSet_programCourse_fkey" FOREIGN KEY ("programCourse") REFERENCES "Program" ("slug") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_QuestionSet" (
    "id",
    "name",
    "yearLevel",
    "programCourse",
    "type",
    "status",
    "totalItems",
    "passThreshold",
    "createdById",
    "deployedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "yearLevel",
    "programCourse",
    "type",
    "status",
    "totalItems",
    "passThreshold",
    "createdById",
    "deployedAt",
    "createdAt",
    "updatedAt"
FROM "QuestionSet";

DROP TABLE "QuestionSet";
ALTER TABLE "new_QuestionSet" RENAME TO "QuestionSet";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
