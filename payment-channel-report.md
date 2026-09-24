# Payment Channel Configuration Report

อัปเดต: 2026-09-24

## ผลลัพธ์

- เพิ่มแท็บ `การเงิน → ช่องทางชำระเงิน` สำหรับ admin ที่มีสิทธิ์ `finance`
- ตั้งค่าเปิด/ปิดแยกตาม `web`, `ios`, `android`; รุ่นแรกแก้ไขได้เฉพาะ web ส่วน mobile แสดงสถานะเตรียมไว้
- เก็บเฉพาะ availability ใน `PaymentChannelSetting`; ID, provider, label, order และ default ยังคงเป็น catalog ในโค้ด
- ทุก PATCH บันทึก Audit Log ใน transaction เดียวกับการเปลี่ยนสถานะ
- เปิดช่องทางไม่ได้ถ้า provider config ไม่ครบ โดย API คืน 409 และ UI แสดง env/config ที่ขาด
- bootstrap ครั้งแรกใช้ `defaultEnabled && readiness`; ถ้าไม่พร้อมจะถูกบันทึกเป็นปิดและไม่เปิดเองเมื่อเติม config ภายหลัง

## การบังคับใช้

- wallet snapshot คืนเฉพาะช่องทาง web ที่เปิดและพร้อมจริง
- gateway และอัปโหลดสลิปตรวจ availability ก่อนสร้างรายการใหม่และคืน 409 เมื่อปิด
- idempotent retry ถูกตรวจพบก่อน availability guard จึงไม่ตัดรายการเดิม
- polling, webhook, settlement, ประวัติ และ manual review เดิมไม่ได้ถูกปิดตาม toggle
- public payment identifiers ถูกส่งจาก backoffice ผ่าน wallet snapshot ให้ web ใช้ config แหล่งเดียวกับ readiness check

## ก่อน deploy

1. รัน migration `20260924150000_payment_channel_settings`
2. ตั้งค่า `WEB_OMISE_PUBLIC_KEY`; เพิ่ม `WEB_GOOGLE_PAY_MERCHANT_ID` เมื่อใช้ live Google Pay และ `WEB_APPLE_PAY_MERCHANT_ID` เมื่อใช้ Apple Pay
3. ตรวจ `OMISE_SECRET_KEY`, `WEB_APP_URL`, Backblaze และ Apple certificate ตามเหตุผล readiness ในหน้า Finance
4. เปิดแต่ละช่องทางจากหน้า Finance หลัง migration/config พร้อม

## การตรวจสอบ

- payment-channel tests: 8 ผ่าน
- security regression tests: 46 ผ่าน
- Prisma schema validation: ผ่าน
- lint: ผ่าน (เหลือ warning เดิมนอกขอบเขต 2 จุด)
- production build: ผ่าน
- code review รอบสุดท้าย: Spec ไม่เหลือ finding; Standards findings ที่เกี่ยวกับ fallback, enum, initialization side effect, duplicate error mapping และ config duplication ถูกแก้แล้ว
