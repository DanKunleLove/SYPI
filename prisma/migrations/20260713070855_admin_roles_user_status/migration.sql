-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyGenLimit" INTEGER,
ADD COLUMN     "platformRole" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
