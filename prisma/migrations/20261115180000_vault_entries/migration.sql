-- Additive only: a new column with a default and a new table, so old code keeps working if the deploy is rolled back.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vaultSeq" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "vault_entries" (
    "id" CHAR(26) NOT NULL,
    "userId" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "envelopeVersion" INTEGER NOT NULL,
    "algorithm" VARCHAR(32) NOT NULL,
    "iv" VARCHAR(32) NOT NULL,
    "ciphertext" TEXT NOT NULL,
    CONSTRAINT "vault_entries_pkey" PRIMARY KEY ("userId","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vault_entries_userId_seq_key" ON "vault_entries"("userId", "seq");

-- AddForeignKey
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
