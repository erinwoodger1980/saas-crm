-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "timberNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "glassNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ironmongeryNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paintNotApplicable" BOOLEAN NOT NULL DEFAULT false;
