-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('personalised', 'fixed');

-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('pre', 'post');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "condition" "Condition" NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "curriculum_order" INTEGER NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "p_bkt" DOUBLE PRECISION,
    "p_dkt" DOUBLE PRECISION,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery" (
    "user_id" UUID NOT NULL,
    "topic_id" TEXT NOT NULL,
    "p_known" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mastery_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "TestKind" NOT NULL,
    "items" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sus_responses" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "responses" INTEGER[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sus_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_key" ON "topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topics_curriculum_order_key" ON "topics"("curriculum_order");

-- CreateIndex
CREATE INDEX "questions_topic_id_idx" ON "questions"("topic_id");

-- CreateIndex
CREATE INDEX "attempts_user_id_created_at_idx" ON "attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "attempts_question_id_idx" ON "attempts"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "tests_user_id_kind_key" ON "tests"("user_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "sus_responses_user_id_key" ON "sus_responses"("user_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery" ADD CONSTRAINT "mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery" ADD CONSTRAINT "mastery_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sus_responses" ADD CONSTRAINT "sus_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written range checks: Prisma's schema language cannot express these.
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_difficulty_check" CHECK ("difficulty" BETWEEN 1 AND 3),
  ADD CONSTRAINT "questions_answer_is_option_check" CHECK ("options" ? "answer");

ALTER TABLE "attempts"
  ADD CONSTRAINT "attempts_response_time_ms_check" CHECK ("response_time_ms" >= 0),
  ADD CONSTRAINT "attempts_p_bkt_check" CHECK ("p_bkt" BETWEEN 0 AND 1),
  ADD CONSTRAINT "attempts_p_dkt_check" CHECK ("p_dkt" BETWEEN 0 AND 1);

ALTER TABLE "mastery"
  ADD CONSTRAINT "mastery_p_known_check" CHECK ("p_known" BETWEEN 0 AND 1);

-- COALESCE and array_position are needed because a CHECK passes when it evaluates to NULL.
ALTER TABLE "sus_responses"
  ADD CONSTRAINT "sus_responses_responses_check" CHECK (
    COALESCE(cardinality("responses"), 0) = 10
    AND array_position("responses", NULL) IS NULL
    AND 1 <= ALL ("responses")
    AND 5 >= ALL ("responses")
  );
