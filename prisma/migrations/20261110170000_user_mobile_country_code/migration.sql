-- DropIndex
DROP INDEX "users_mobile_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "countryCode" VARCHAR(3) NOT NULL,
ALTER COLUMN "mobile" SET DATA TYPE VARCHAR(14);

-- CreateIndex
CREATE UNIQUE INDEX "users_countryCode_mobile_key" ON "users"("countryCode", "mobile");
