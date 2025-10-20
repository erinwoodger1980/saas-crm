/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."User_email_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
