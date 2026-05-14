/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."Job" DROP CONSTRAINT "Job_userId_fkey";

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "userId" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "userId" SET DATA TYPE BIGINT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("userId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
