-- CreateTable
CREATE TABLE "PlatformFlag" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFlag_pkey" PRIMARY KEY ("id")
);
