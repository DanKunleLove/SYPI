-- Additive, non-destructive.
ALTER TABLE "User" ADD COLUMN "customInstructions" TEXT;
ALTER TABLE "AIGeneration" ADD COLUMN "rating" INTEGER;
