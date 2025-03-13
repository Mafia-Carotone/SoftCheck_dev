/*
  Warnings:

  - A unique constraint covering the columns `[id,teamId]` on the table `Software` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[apiKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `teamId` to the `Software` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Software_id_key";

-- AlterTable
ALTER TABLE "Software" ADD COLUMN     "answers" JSONB DEFAULT '{}',
ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamId" TEXT NOT NULL,
ALTER COLUMN "windowsEXE" DROP NOT NULL,
ALTER COLUMN "macosEXE" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "apiKey" TEXT;

-- CreateTable
CREATE TABLE "SoftwareRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileUrl" TEXT,
    "downloadSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "SoftwareRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoftwareRequest_teamId_idx" ON "SoftwareRequest"("teamId");

-- CreateIndex
CREATE INDEX "SoftwareRequest_userId_idx" ON "SoftwareRequest"("userId");

-- CreateIndex
CREATE INDEX "SoftwareRequest_status_idx" ON "SoftwareRequest"("status");

-- CreateIndex
CREATE INDEX "Software_teamId_idx" ON "Software"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Software_id_teamId_key" ON "Software"("id", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- AddForeignKey
ALTER TABLE "Software" ADD CONSTRAINT "Software_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareRequest" ADD CONSTRAINT "SoftwareRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareRequest" ADD CONSTRAINT "SoftwareRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
