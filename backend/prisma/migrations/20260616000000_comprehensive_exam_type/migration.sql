-- Existing "Comprehensive" sets were stored as DIAGNOSTIC. Reserve DIAGNOSTIC for
-- incoming 1st-year placement exams and rename legacy rows to COMPREHENSIVE.
UPDATE "QuestionSet" SET "type" = 'COMPREHENSIVE' WHERE "type" = 'DIAGNOSTIC';
