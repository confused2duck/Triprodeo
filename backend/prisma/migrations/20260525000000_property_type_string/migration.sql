ALTER TABLE "properties" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "properties" ALTER COLUMN "type" TYPE TEXT USING lower("type"::text);
ALTER TABLE "properties" ALTER COLUMN "type" SET DEFAULT 'villa';
DROP TYPE IF EXISTS "PropertyType";
