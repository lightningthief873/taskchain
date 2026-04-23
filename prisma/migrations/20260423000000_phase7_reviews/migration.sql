-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "TaskStep" ADD COLUMN "stepContext" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskStepId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_taskStepId_userId_key" ON "Review"("taskStepId", "userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_taskStepId_fkey" FOREIGN KEY ("taskStepId") REFERENCES "TaskStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
