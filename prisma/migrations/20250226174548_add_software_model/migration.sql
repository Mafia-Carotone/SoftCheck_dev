-- CreateTable
CREATE TABLE "Software" (
    "id" TEXT NOT NULL,
    "softwareName" TEXT NOT NULL,
    "windowsEXE" TEXT NOT NULL,
    "macosEXE" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "approvalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Software_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Software_id_key" ON "Software"("id");
