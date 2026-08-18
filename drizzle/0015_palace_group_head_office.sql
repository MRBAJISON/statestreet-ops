-- Carbon Shoes Palace and D Angelo Palace trade from one building under one
-- manager and report as a single unit. Both keep their own store record, history
-- and target; the group only decides what a combined report is produced for.
--
-- Note this is the Palace pair only. D Angelo Stanbic is a separate store and is
-- deliberately not a member.
INSERT INTO "store_groups" ("code", "name", "active")
VALUES ('carbon-dangelo-palace', 'Carbon & D''Angelo Palace', true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "store_group_members" ("store_group_id", "store_id")
SELECT g."id", s."id"
FROM "store_groups" g
JOIN "stores" s ON lower(s."code") IN ('c', 'dangelo')
WHERE g."code" = 'carbon-dangelo-palace'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Head Office is the administration office, not a trading store. It is typed as
-- 'store' in production, which means it can be assigned to a store manager and
-- appears anywhere the app lists stores — including the public feedback survey.
-- Roughly fifteen queries already filter on type = 'store', so retyping it is the
-- whole fix and no code changes.
--
-- Guarded: if anything has actually been filed against Head Office, retyping it
-- would put those records out of reach of the normal store lookups, which all
-- require type = 'store'. In that case this is left alone deliberately and the
-- records need moving first.
UPDATE "stores" SET "type" = 'office', "updated_at" = now()
WHERE lower("code") = 'head-office'
	AND "type" <> 'office'
	AND NOT EXISTS (SELECT 1 FROM "daily_reports" r WHERE r."store_id" = "stores"."id")
	AND NOT EXISTS (SELECT 1 FROM "weekly_reviews" w WHERE w."store_id" = "stores"."id");
