-- Participant codes for login. NOT NULL without a default is safe: no users exist yet.
ALTER TABLE "users" ADD COLUMN "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_code_key" ON "users"("code");
