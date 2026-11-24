-- Pre/post-test items live in the questions table but are never used in practice.
ALTER TABLE "questions" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
