# คู่มือ Setup ReadLead Backoffice สำหรับ Local Development

คู่มือนี้อธิบายการรัน ReadLead Backoffice บนเครื่องสำหรับการพัฒนา โดยรันแอป Next.js บนเครื่องและใช้ PostgreSQL ผ่าน Docker Compose

## สิ่งที่ต้องติดตั้ง

- [Node.js 22 LTS](https://nodejs.org/) และ npm
  - Next.js 16 ต้องการ Node.js อย่างน้อย 20.9 แต่แนะนำ Node.js 22 เพื่อให้ตรงกับ `Dockerfile`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) หรือ Docker Engine ที่รองรับ Docker Compose
- OpenSSL สำหรับสร้าง secret (macOS และ Linux ส่วนใหญ่มีติดตั้งมาแล้ว)

ตรวจสอบเวอร์ชันก่อนเริ่ม:

```bash
node --version
npm --version
docker --version
docker compose version
```

## ขั้นตอนการติดตั้ง

### 1. เข้าไปที่โฟลเดอร์โปรเจกต์

```bash
cd readlead-backoffice
```

### 2. ติดตั้ง dependencies

ใช้ `npm ci` เพื่อให้ได้ dependency versions ตรงกับ `package-lock.json`:

```bash
npm ci
```

คำสั่งนี้จะรัน `prisma generate` ให้อัตโนมัติผ่าน `postinstall` ด้วย

### 3. ตั้งค่า environment variables

คัดลอกไฟล์ตัวอย่างเป็น `.env`:

```bash
cp .env.example .env
```

สร้างค่า secret สำหรับ session:

```bash
openssl rand -hex 32
```

สร้าง encryption key สำหรับเอกสารใบสมัครนักเขียนและ creator media:

```bash
openssl rand -base64 32
```

เปิดไฟล์ `.env` แล้วกำหนดค่าพื้นฐานดังนี้ โดยนำผลลัพธ์จากสองคำสั่งด้านบนไปแทนค่าที่ระบุ:

```dotenv
# Database and authentication
DATABASE_URL=postgresql://readlead:readlead@localhost:5432/readlead_backoffice
DATABASE_SSL=false
SESSION_SECRET=<ผลลัพธ์จาก openssl rand -hex 32>

# Encryption key (base64 ของข้อมูลขนาด 32 bytes)
WRITER_APPLICATION_ENCRYPTION_KEY=<ผลลัพธ์จาก openssl rand -base64 32>
```

ค่าที่เหลือใน `.env.example` สามารถเว้นว่างระหว่าง setup พื้นฐานได้:

- ตัวแปร `B2_*` ใช้กับ Backblaze B2 สำหรับฟีเจอร์อัปโหลดรูป, หลักฐานการเติมเงิน, รายงาน, เอกสารนักเขียน และ creator media
- `CRON_SECRET` ใช้ยืนยัน request ที่เรียก creator cron endpoints

หน้า backoffice และฟีเจอร์ทั่วไปเปิดใช้งานได้โดยไม่ต้องตั้งค่าสองส่วนนี้ แต่ฟีเจอร์ที่อัปโหลดหรืออ่านไฟล์จาก B2 จะยังใช้งานไม่ได้

> ห้าม commit ไฟล์ `.env` หรือเผยแพร่ค่า secret จริง ไฟล์ environment ถูกกำหนดให้ Git ignore ไว้แล้ว

### 4. เปิด PostgreSQL และ pgAdmin

```bash
docker compose up -d
```

ตรวจสอบว่า containers ทำงานอยู่:

```bash
docker compose ps
```

บริการที่เปิดขึ้นมามีดังนี้:

| บริการ | URL/Port | ข้อมูลเข้าใช้ |
| --- | --- | --- |
| PostgreSQL | `localhost:5432` | Database: `readlead_backoffice`, User: `readlead`, Password: `readlead` |
| pgAdmin | [http://localhost:5050](http://localhost:5050) | Email: `admin@readlead.com`, Password: `readlead` |

หากเพิ่ม PostgreSQL server ใน pgAdmin ให้ใช้ค่าต่อไปนี้:

- Host: `postgres`
- Port: `5432`
- Maintenance database: `readlead_backoffice`
- Username: `readlead`
- Password: `readlead`

`postgres` เป็นชื่อ service ภายใน Docker network จึงต้องใช้ชื่อนี้แทน `localhost` เมื่อเชื่อมต่อจาก pgAdmin container

### 5. สร้างโครงสร้างฐานข้อมูลและข้อมูลตัวอย่าง

รัน migrations ที่มีอยู่ใน repository:

```bash
npx prisma migrate deploy
```

เพิ่มข้อมูลตัวอย่างและบัญชีสำหรับ development:

```bash
npm run db:seed
```

Seed สามารถรันซ้ำได้ โดยข้อมูลหลักใช้การ upsert

### 6. รัน development server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) แล้วเข้าสู่ระบบด้วยบัญชี owner จาก seed:

```text
Email: superadmin@readlead.com
Password: ReadLead@123
```

บัญชีนี้ใช้สำหรับ development เท่านั้น ต้องเปลี่ยนรหัสผ่านก่อนนำระบบไปใช้งานจริง

## คำสั่งที่ใช้บ่อย

| คำสั่ง | การทำงาน |
| --- | --- |
| `npm run dev` | รัน development server ที่ port 3000 |
| `npm run lint` | ตรวจโค้ดด้วย ESLint |
| `npm run build` | สร้าง production build |
| `npm run start` | รัน production server หลังจาก build แล้ว |
| `npm run db:generate` | สร้าง Prisma Client ใหม่หลังแก้ schema |
| `npm run db:migrate` | สร้างและใช้ migration ใหม่ระหว่าง development |
| `npm run db:seed` | เพิ่มหรืออัปเดตข้อมูลตัวอย่าง |
| `npm run db:studio` | เปิด Prisma Studio เพื่อดูข้อมูลในฐานข้อมูล |
| `docker compose stop` | หยุด containers โดยเก็บข้อมูลฐานข้อมูลไว้ |
| `docker compose down` | หยุดและลบ containers/network โดยยังเก็บ named volume ไว้ |

> `npm run db:reset` จะล้างข้อมูลทั้งหมดในฐานข้อมูล, รัน migrations ใหม่ และเรียก seed อีกครั้ง ใช้เฉพาะเมื่อยอมรับการสูญเสียข้อมูลได้เท่านั้น

## Troubleshooting

### Port 3000, 5050 หรือ 5432 ถูกใช้งานอยู่

ตรวจสอบ process หรือ container ที่ใช้ port ก่อน:

```bash
docker compose ps
```

- Port `3000`: หยุด Next.js process เดิม หรือรันด้วย port อื่น เช่น `npm run dev -- --port 3001`
- Port `5050` หรือ `5432`: หยุด service เดิม หรือแก้ port ฝั่งซ้ายใน `docker-compose.yml` และปรับ `DATABASE_URL` ให้ตรงกัน

### เชื่อมต่อฐานข้อมูลไม่ได้

ตรวจสอบสถานะและ logs ของ PostgreSQL:

```bash
docker compose ps
docker compose logs postgres
```

ตรวจสอบว่า `.env` ใช้ค่าต่อไปนี้สำหรับ Docker Compose ในเครื่อง:

```dotenv
DATABASE_URL=postgresql://readlead:readlead@localhost:5432/readlead_backoffice
DATABASE_SSL=false
```

จากนั้นลองรัน migration อีกครั้ง:

```bash
npx prisma migrate deploy
```

### พบข้อผิดพลาดเกี่ยวกับ Prisma Client

สร้าง Prisma Client ใหม่ แล้ว restart development server:

```bash
npm run db:generate
npm run dev
```

หากเพิ่งแก้ `prisma/schema.prisma` ให้สร้าง migration ด้วย:

```bash
npm run db:migrate
```

### ต้องการเริ่มฐานข้อมูลใหม่ทั้งหมด

คำสั่งต่อไปนี้ลบ named volume และข้อมูล PostgreSQL ทั้งหมดของ Compose ชุดนี้ จึงควรใช้เฉพาะข้อมูล local ที่ไม่ต้องการเก็บ:

```bash
docker compose down -v
docker compose up -d
npx prisma migrate deploy
npm run db:seed
```

## ตรวจสอบว่า Setup สำเร็จ

Setup พร้อมใช้งานเมื่อ:

- `docker compose ps` แสดง PostgreSQL และ pgAdmin ทำงานอยู่
- `npx prisma migrate deploy` และ `npm run db:seed` จบโดยไม่มี error
- `npm run dev` เปิด [http://localhost:3000](http://localhost:3000) ได้
- เข้าสู่ระบบด้วยบัญชี `superadmin@readlead.com` ได้

