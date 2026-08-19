-- Carbon Shoes sells accessories alongside its five shoe categories.
--
-- Only Accessories is added: Carbon and D Angelo are separate brands with their
-- own category sets, and the rest of D Angelo's list stays with D Angelo.
INSERT INTO "brand_categories" ("brand_id", "category_id")
SELECT b."id", c."id"
FROM "brands" b
JOIN "categories" c ON lower(c."code") = 'accessories'
WHERE b."name" = 'Carbon Shoes'
ON CONFLICT DO NOTHING;
