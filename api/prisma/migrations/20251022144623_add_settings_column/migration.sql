/*
  Warnings:

  - You are about to drop the column `depth` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "depth",
ADD COLUMN     "settings" TEXT NOT NULL DEFAULT '{}';
