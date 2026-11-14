-- AlterTable (additive only: old code keeps working if the deploy is rolled back)
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
