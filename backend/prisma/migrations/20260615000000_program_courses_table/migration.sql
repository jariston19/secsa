-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "abbr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- Seed default program courses
INSERT INTO "Program" ("id", "slug", "label", "abbr", "isActive", "createdAt", "updatedAt") VALUES
  ('prog_ce', 'CIVIL_ENGINEERING', 'Civil Engineering', 'CE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prog_me', 'MECHANICAL_ENGINEERING', 'Mechanical Engineering', 'ME', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prog_ee', 'ELECTRICAL_ENGINEERING', 'Electrical Engineering', 'EE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prog_it', 'INFORMATION_TECHNOLOGY', 'Information Technology', 'IT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prog_arch', 'ARCHITECTURE', 'Architecture', 'ARCH', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
