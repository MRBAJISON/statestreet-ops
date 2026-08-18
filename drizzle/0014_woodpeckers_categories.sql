-- Woodpeckers moves to its own eleven categories.
--
-- Everything here is mapping-only. daily_sales_lines records a store and a
-- category but no brand, so no historical row can be attributed to Woodpeckers
-- and nothing is repointed. Reports already filed keep the category names they
-- were filed under, which is correct.
--
-- Brands and categories are resolved by name and code rather than by id so this
-- migration carries its own lookups and does not depend on a snapshot.

-- 1. Ensure all eleven categories exist. Eight are new: Woodpeckers holds its
-- other categories jointly with Boulevard Men, Boulevard Women or D Angelo, so
-- those cannot be renamed without changing another brand's reports.
--
-- Accessories, Premium T-Shirts and Streetwear Sets are listed too even though
-- the group already has them. They conflict and are skipped, keeping their
-- existing ids, names and history untouched — but listing them means this
-- migration produces the same eleven in any database rather than silently
-- producing ten where one happens to be missing.
INSERT INTO "categories" ("code", "name", "active", "sort_order")
VALUES
	('pants-shorts', 'Pants & Shorts', true, 0),
	('hoodies-sweatshirts', 'Hoodies & Sweatshirts', true, 0),
	('footwear', 'Footwear', true, 0),
	('bags-wallets', 'Bags & Wallets', true, 0),
	('jersey', 'Jersey', true, 0),
	('shirts', 'Shirts', true, 0),
	('tops-tees', 'Tops & Tees', true, 0),
	('headwear', 'Headwear', true, 0),
	('accessories', 'Accessories', true, 0),
	('premium-t-shirts', 'Premium T-Shirts', true, 0),
	('streetwear-sets', 'Tracksuits', true, 0)
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 2. Streetwear Sets is the one category Woodpeckers holds alone, so it is the
-- one safe rename. The code is deliberately left alone: category codes appear in
-- exports and in legacy entry payloads, and changing one is a separate migration
-- with a much wider blast radius than a display name.
UPDATE "categories" SET "name" = 'Tracksuits', "updated_at" = now()
WHERE lower("code") = 'streetwear-sets';
--> statement-breakpoint

-- 3. Map Woodpeckers to its new set. Accessories already exists group-wide, so it
-- is mapped rather than duplicated. Premium T-Shirts and Tracksuits are already
-- mapped and are left untouched.
INSERT INTO "brand_categories" ("brand_id", "category_id")
SELECT b."id", c."id"
FROM "brands" b
JOIN "categories" c ON lower(c."code") IN (
	'pants-shorts', 'hoodies-sweatshirts', 'footwear', 'bags-wallets',
	'jersey', 'shirts', 'tops-tees', 'headwear', 'accessories'
)
WHERE b."name" = 'Woodpeckers'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 4. Unmap everything else. Stated declaratively — keep exactly the eleven and
-- drop any other Woodpeckers mapping — rather than deleting a list captured from
-- a snapshot, so the end state is the agreed set whatever the mappings happen to
-- be when this runs.
--
-- The categories themselves stay exactly as they are for Boulevard Men, Boulevard
-- Women and D Angelo. Only the Woodpeckers mapping goes, which is what decides
-- the categories offered on the Woodpeckers daily report from this day forward.
--
--   Denim Jeans         -> Pants & Shorts
--   Polo Shirts         -> Shirts
--   Sneakers            -> Footwear
--   Sunglasses          -> Accessories
--   Wallets & Purses    -> Bags & Wallets
--   Watches             -> Accessories
--   Jackets & Outerwear -> Hoodies & Sweatshirts
DELETE FROM "brand_categories"
WHERE "brand_id" = (SELECT "id" FROM "brands" WHERE "name" = 'Woodpeckers')
	AND "category_id" NOT IN (
		SELECT "id" FROM "categories" WHERE lower("code") IN (
			'pants-shorts', 'hoodies-sweatshirts', 'footwear', 'bags-wallets',
			'jersey', 'premium-t-shirts', 'accessories', 'shirts', 'tops-tees',
			'headwear', 'streetwear-sets'
		)
	);
--> statement-breakpoint

-- 5. Knitwear is mapped to no brand and carries no sales. Deactivated rather than
-- deleted: categories are referenced with on delete restrict, and keeping the row
-- keeps the audit trail intact.
UPDATE "categories" SET "active" = false, "updated_at" = now()
WHERE lower("code") = 'knitwear'
	AND NOT EXISTS (SELECT 1 FROM "brand_categories" bc WHERE bc."category_id" = "categories"."id")
	AND NOT EXISTS (SELECT 1 FROM "daily_sales_lines" l WHERE l."category_id" = "categories"."id");
