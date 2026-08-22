ALTER TABLE "ExpAccount" ALTER COLUMN "level" SET DEFAULT 0;

UPDATE "ExpAccount"
SET "level" = CASE
  WHEN "balance" >= 158000 THEN 8
  WHEN "balance" >= 118000 THEN 7
  WHEN "balance" >= 78000 THEN 6
  WHEN "balance" >= 54000 THEN 5
  WHEN "balance" >= 30000 THEN 4
  WHEN "balance" >= 6000 THEN 3
  WHEN "balance" >= 1000 THEN 2
  WHEN "balance" >= 200 THEN 1
  ELSE 0
END;

DELETE FROM "ExpTitle" WHERE "id" IN ('e1', 'e2', 'e3', 'e4', 'e5');

INSERT INTO "ExpTitle" ("id", "minExp", "title", "badge", "color", "createdAt", "updatedAt") VALUES
  ('exp-lv0', 0,      'นักอ่านขาจร',    'Lv0', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv1', 200,    'นักอ่านฝึกหัด',  'Lv1', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv2', 1000,   'นักอ่านทั่วไป',  'Lv2', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv3', 6000,   'นักอ่านตัวจริง', 'Lv3', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv4', 30000,  'ขาประจำ',       'Lv4', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv5', 54000,  'ติ่งนิยาย',     'Lv5', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv6', 78000,  'นกฮูก',         'Lv6', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv7', 118000, 'หนอนหนังสือ',   'Lv7', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp-lv8', 158000, 'ผู้หยั่งรู้',    'Lv8', 'teal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "minExp" = EXCLUDED."minExp",
  "title" = EXCLUDED."title",
  "badge" = EXCLUDED."badge",
  "color" = EXCLUDED."color",
  "updatedAt" = CURRENT_TIMESTAMP;
