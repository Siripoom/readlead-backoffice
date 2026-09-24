# Security Review Report — ReadLead Backoffice

อัปเดตล่าสุด: 2026-09-24
Review ID: `SR-2026-09-24-01`

## ขอบเขต

รีวิวการเปลี่ยนสถานะผู้ใช้, การมอบสิทธิ์ admin, การบังคับใช้ punishment และความปลอดภัยของ admin session secret

## ผลการแก้ไข

### 1. Status change ไม่มี audit log — แก้แล้ว

- `PATCH /api/users/[id]` เขียน `AuditLog` ทุกครั้งที่สถานะเปลี่ยนจริง
- ใช้ action `user.status_changed` พร้อม `adminId`, `entityId`, `previousStatus` และสถานะใหม่
- การอัปเดตสถานะกับการเขียน audit อยู่ใน Prisma transaction เดียวกัน ป้องกันสถานะเปลี่ยนแต่ audit หาย
- การส่งสถานะเดิมซ้ำไม่สร้าง audit ที่ทำให้เข้าใจผิดว่าเกิดการเปลี่ยนแปลง

### 2. Permission escalation — แก้แล้ว

- เพิ่ม allowlist กลาง `ALL_PERMISSIONS` และตรวจค่าจาก request ทุกตัว
- non-owner มอบได้เฉพาะสิทธิ์ที่ตัวเองมีอยู่แล้ว
- owner ยังมอบสิทธิ์ได้ทั้งหมด แต่ค่าต้องอยู่ใน allowlist
- ใช้ policy เดียวกันทั้งการแก้ admin (`PATCH /api/users/[id]`) และการสร้าง admin (`POST /api/users`) เพื่อปิดช่องทางอ้อมอีกจุดที่พบระหว่างตรวจ

### 3. Punishment record ไม่มีผลจริง — แก้แล้ว

- password login, social login และ existing member session ตรวจ punishment ที่ `status = active` และยังไม่หมดอายุ
- ระดับคำเตือนใช้สถานะ `recorded` และไม่บล็อกสมาชิก
- punishment ที่ถูกยกเลิกหรือหมดอายุไม่บล็อกสมาชิก
- หน้าจัดการผู้ใช้เปลี่ยนมาเรียก canonical route `POST /api/punishment/records` เพียงครั้งเดียว พร้อมบังคับกรอกเหตุผล
- ยกเลิก POST endpoint ซ้ำ `/api/users/[id]/punishments` ซึ่งเดิมสร้าง record โดยไม่มี audit และไม่มีข้อมูลระดับ/วันหมดอายุครบถ้วน; GET ประวัติยังใช้งานได้
- เพิ่ม data migration เพื่อเปลี่ยน warning records รุ่นเก่าที่เคยใช้ default `active` ให้เป็น `recorded`

### 4. Production SESSION_SECRET fallback — แก้แล้ว

- รวมการอ่าน secret ไว้ที่ `getSessionSecret()`
- development ยังมี local fallback เพื่อความสะดวก
- production จะ throw ตั้งแต่โหลดโมดูลเมื่อ `SESSION_SECRET` ไม่มีหรือเป็นค่าว่าง ทำให้ process/build หยุดก่อนรับ traffic

## Regression coverage

คำสั่งหลัก:

```sh
npm run test:security
```

ครอบคลุม:

- status update และ audit log เกิดใน transaction เดียวกัน
- non-owner ไม่สามารถมอบ permission ที่ตัวเองไม่มี
- permission นอก allowlist ถูกปฏิเสธ
- active punishment บล็อก social authentication
- production ที่ไม่มี `SESSION_SECRET` fail closed
- regression เดิมของ social auth ทุก provider

ผลล่าสุด: ผ่าน `46/46` tests

## Verification เพิ่มเติม

- `npm run build` — ผ่าน รวม TypeScript และการสร้าง production bundle
- `npm run lint` — ผ่านโดยไม่มี error; มี warning เดิม 2 จุดเรื่อง `<img>` ใน `components/monetization/AdsTab.tsx` ซึ่งไม่เกี่ยวกับ review นี้
- `git diff --check` — ผ่าน

## ขั้นตอน deploy

1. ตั้ง `SESSION_SECRET` เป็นค่าสุ่มยาวใน production ก่อน deploy
2. รัน Prisma migration `20260924090000_normalize_warning_punishments`
3. Deploy backoffice ก่อนหรือพร้อมกับ `readlead-web`

---

## Review 002 — Punishment enforcement และ expiry

วันที่: 2026-09-24
สถานะ: แก้แล้ว

รีวิวยืนยันว่า implementation เดิมมีแหล่งข้อมูลสองชุดที่ไม่เชื่อมกัน: punishment route สร้างเฉพาะ record ขณะที่ member auth ตรวจเฉพาะ `user.status` ทำให้การลงโทษจากหน้า Punishment ไม่บล็อกผู้ใช้จริง และ temporary punishment ไม่มี cron สำหรับคืนสถานะ

แนวทางแก้ใช้ `PunishmentRecord` เป็น authority ของโทษโดยตรง แทนการ copy สถานะไปยัง `user.status`:

- member password login, social login และ existing session query เฉพาะ record ที่ `status = active`
- record แบบถาวร (`expiresAt = null`) ยังบล็อกต่อเนื่อง
- record ชั่วคราวบล็อกเฉพาะเมื่อ `expiresAt > now`
- record ที่หมดอายุหรือเปลี่ยนเป็น `cancelled` หลุดจาก query อัตโนมัติ จึงไม่ต้องมี punishment expiry cron
- `user.status` ยังคงเป็นกลไกแบน/ปิดบัญชีโดยตรงของ admin และไม่ถูก punishment flow เขียนทับ
- หน้า Users เรียก canonical punishment API ครั้งเดียว จึงไม่มี partial state ระหว่าง “สร้าง record” กับ “เปลี่ยน user status” อีก

เพิ่ม regression test สำหรับ active/permanent/future-expiry filter และผลลัพธ์เมื่อไม่มี active punishment ไว้ใน `npm run test:security`

---

## Review 003 — Endpoint สร้าง punishment ซ้ำซ้อน

วันที่: 2026-09-24
สถานะ: แก้แล้วและเพิ่ม regression guard

ยืนยันว่า endpoint เดิม `POST /api/users/[id]/punishments` มี validation และ side effects ไม่ครบเทียบกับ canonical `POST /api/punishment/records` ตามรีวิวจริง

สถานะหลังแก้:

- route `/api/users/[id]/punishments` เหลือเฉพาะ `GET` สำหรับอ่านประวัติ; ไม่มี `POST` export อีกต่อไป
- Next.js จึงตอบ `405 Method Not Allowed` เมื่อพยายาม POST ไป URL เก่า
- `PunishmentDialog`/`UsersPanel` เปลี่ยนมาใช้ `/api/punishment/records`
- caller ฝั่ง backoffice ที่สร้าง punishment ทั้งหมดส่ง `userId`, `levelId` และ `note` ผ่าน canonical route
- canonical route เป็นจุดเดียวที่ตรวจ user type, resolve level จาก DB, คำนวณ `expiresAt`, กำหนด `recorded/active` และเขียน audit log
- เพิ่ม regression test `legacy user punishment route cannot create punishment records` ป้องกันไม่ให้ POST ตัวเก่าถูกนำกลับมาโดยไม่ตั้งใจ

ข้อสังเกตเรื่อง `user.status` จากรีวิวไม่คงเป็นช่องโหว่แล้ว: ตาม Review 002 ระบบ auth ตรวจ active punishment โดยตรง จึงไม่ต้องเขียน `user.status` และไม่เกิดปัญหาปลด direct ban ผิดบัญชีเมื่อโทษหมดอายุ

---

## Review 004 — Validation และ audit ของ punishment levels

วันที่: 2026-09-24
สถานะ: แก้แล้ว

### Runtime validation

- ยกเลิกการเชื่อ payload ด้วย TypeScript cast และเพิ่ม validator กลางสำหรับ create/update
- `level` และ `threshold` ต้องเป็นจำนวนเต็มตั้งแต่ 1
- `duration` ต้องเป็นจำนวนเต็มตั้งแต่ 0 จึงไม่สามารถสร้าง expiry ย้อนหลังด้วยค่าติดลบ
- `name` ต้องเป็น string ที่ไม่ว่างหลัง trim และยาวไม่เกิน 100 ตัวอักษร
- PATCH ต้องมี `id` ที่ไม่ว่างและมีอย่างน้อยหนึ่ง field ที่แก้ได้
- malformed JSON หรือ payload ผิดรูปแบบคืน `400` พร้อมข้อความที่สื่อความหมาย

### Duplicate และ missing record

- schema มี `PunishmentLevel.level @unique` อยู่แล้ว จึงป้องกันข้อมูลซ้ำระดับฐานข้อมูล
- route ตรวจ level ซ้ำล่วงหน้าและคืน `409 Conflict`
- ยังคง catch Prisma `P2002` เพื่อปิด race ระหว่าง concurrent requests
- PATCH query หา record ก่อน; id ที่ไม่มีคืน `404` แทน unhandled `P2025/500`

### Audit

- create เขียน action `punishment_level.created`
- update เขียน action `punishment_level.updated` พร้อมค่าเดิมและ changes
- mutation กับ audit อยู่ใน Prisma transaction เดียวกัน
- ลบ DB mutation helpers เก่าที่ไม่มี validation/audit และไม่มี caller แล้ว เพื่อลดทาง bypass policy

เพิ่ม route-level regression tests 5 เคสสำหรับ invalid input, negative duration, duplicate level, missing id และ transactional audit แล้ว
