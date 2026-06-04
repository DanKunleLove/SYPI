-- CreateTable
CREATE TABLE "CanvasTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasTemplate_userId_idx" ON "CanvasTemplate"("userId");

-- CreateIndex
CREATE INDEX "CanvasTemplate_isPublic_idx" ON "CanvasTemplate"("isPublic");

-- AddForeignKey
ALTER TABLE "CanvasTemplate" ADD CONSTRAINT "CanvasTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
