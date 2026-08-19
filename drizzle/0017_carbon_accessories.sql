-- Carbon Shoes sells accessories alongside its shoe and belt categories.
--
-- Only Accessories is added: Carbon and D Angelo are separate brands with their
-- own category sets, and the rest of D Angelo's list stays with D Angelo.
--
-- The brand is matched case-insensitively. Production spells it "Carbon shoes"
-- with a lowercase s while other environments use "Carbon Shoes", and an exact
-- match silently inserts nothing rather than failing, which is the worst way for
-- a migration to be wrong.
INSERT INTO "brand_categories" ("brand_id", "category_id")
SELECT b."id", c."id"
FROM "brands" b
JOIN "categories" c ON lower(c."code") = 'accessories'
WHERE lower(b."name") = 'carbon shoes'
ON CONFLICT DO NOTHING;
