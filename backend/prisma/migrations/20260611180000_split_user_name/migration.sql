PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "yearLevel" INTEGER,
    "qaUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_User" (
    "id",
    "email",
    "passwordHash",
    "firstName",
    "lastName",
    "role",
    "yearLevel",
    "qaUnlimited",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "email",
    "passwordHash",
    CASE
        WHEN instr("name" || ' ', ' ') > length("name") THEN "name"
        ELSE substr("name", 1, instr("name" || ' ', ' ') - 1)
    END,
    CASE
        WHEN instr("name" || ' ', ' ') > length("name") THEN ''
        ELSE trim(substr("name", instr("name" || ' ', ' ') + 1))
    END,
    "role",
    "yearLevel",
    "qaUnlimited",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_keys=ON;
