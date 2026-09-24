-- Legacy warning records created through /api/users/[id]/punishments used the
-- default "active" status. They must be informational before active
-- punishments are enforced by member authentication.
UPDATE "PunishmentRecord" AS record
SET "status" = 'recorded'
FROM "PunishmentLevel" AS level
WHERE record."levelName" = level."name"
  AND level."level" = 1
  AND record."status" = 'active';
