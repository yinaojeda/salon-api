-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "salonId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_salonId_idx" ON "Category"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_salonId_name_key" ON "Category"("salonId", "name");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: nueva columna, todavía sin tocar la vieja
ALTER TABLE "Service" ADD COLUMN "categoryId" INTEGER;

-- DataMigration: una Category por cada string distinto de Service.category, por salón
INSERT INTO "Category" ("salonId", "name")
SELECT DISTINCT "salonId", "category" FROM "Service" WHERE "category" IS NOT NULL;

-- DataMigration: enlazar cada Service con su Category recién creada
UPDATE "Service" s
SET "categoryId" = c."id"
FROM "Category" c
WHERE c."salonId" = s."salonId" AND c."name" = s."category";

-- AlterTable: ahora sí, fuera la columna vieja
ALTER TABLE "Service" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
