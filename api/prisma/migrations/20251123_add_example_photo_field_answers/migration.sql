-- Add ExamplePhotoFieldAnswer table to store questionnaire answers for example photos
-- This allows tagging photos with answers to ALL standard questionnaire fields

CREATE TABLE "ExamplePhotoFieldAnswer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "examplePhotoId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "ExamplePhotoFieldAnswer_examplePhotoId_fkey" 
    FOREIGN KEY ("examplePhotoId") REFERENCES "ExamplePhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExamplePhotoFieldAnswer_fieldId_fkey" 
    FOREIGN KEY ("fieldId") REFERENCES "QuestionnaireField"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ensure one answer per field per photo
CREATE UNIQUE INDEX "ExamplePhotoFieldAnswer_examplePhotoId_fieldId_key" 
  ON "ExamplePhotoFieldAnswer"("examplePhotoId", "fieldId");

-- Index for querying photo answers
CREATE INDEX "ExamplePhotoFieldAnswer_examplePhotoId_idx" 
  ON "ExamplePhotoFieldAnswer"("examplePhotoId");

-- Index for field key lookups
CREATE INDEX "ExamplePhotoFieldAnswer_fieldKey_idx" 
  ON "ExamplePhotoFieldAnswer"("fieldKey");
