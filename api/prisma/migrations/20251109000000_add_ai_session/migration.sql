-- CreateTable
CREATE TABLE "AiSession" (
    "id" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "mode" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "messages" JSONB NOT NULL,
    "patchText" TEXT,
    "branch" TEXT,
    "prUrl" TEXT,
    "logs" TEXT,
    "usageInput" INTEGER NOT NULL DEFAULT 0,
    "usageOutput" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSession_status_idx" ON "AiSession"("status");
