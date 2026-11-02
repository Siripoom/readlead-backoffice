import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const { values } = parseArgs({ options: {
  production: { type: 'boolean', default: false },
  'web-origin': { type: 'string', default: 'http://localhost:3100' },
  apply: { type: 'boolean', default: false },
} })
const backend = fileURLToPath(new URL('..', import.meta.url))
let fileEnv = {}
try { fileEnv = parseEnv(await readFile(join(backend, '.env'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const env = { ...fileEnv, ...process.env }
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const database = new URL(env.DATABASE_URL)
const local = ['localhost', '127.0.0.1', '[::1]']
if (!values.production) {
  if (!local.includes(database.hostname) || database.pathname !== '/readlead_backoffice') throw new Error('Remote databases require --production')
  database.hostname = '127.0.0.1'
  database.port = '5434'
}
const origin = new URL(values['web-origin'])
if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Pass a web origin without credentials, path, query, or fragment')
if (values.production ? origin.protocol !== 'https:' || local.includes(origin.hostname) : origin.protocol !== 'http:' || !local.includes(origin.hostname)) throw new Error('Production requires a deployed HTTPS web origin; local seeding requires a local HTTP origin')
const image = index => new URL(`/seed/audio-design/${index === 0 ? 'reference.jpg' : `rank-${index}.svg`}`, origin).toString()
for (let index = 0; index < 8; index++) {
  const response = await fetch(image(index), { method: 'HEAD', signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Deploy the audiobook preview assets before seeding')
}
const require = createRequire(join(backend, 'package.json'))
const { Client } = require('pg')
const client = new Client({ connectionString: database.toString(), ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined })
const prefix = 'audio-design-preview-'
await client.connect()
try {
  await client.query('BEGIN')
  await client.query("SELECT pg_advisory_xact_lock(hashtext('readlead-audio-design-seed'))")
  const { rows: [page] } = await client.query('SELECT * FROM "CmsPage" WHERE slug=$1', ['audio'])
  if (!page) throw new Error('Open the Audio CMS once before seeding')
  const { rows: sections } = await client.query('SELECT * FROM "CmsSection" WHERE "pageId"=$1', [page.id])
  const { rows: beforeItems } = await client.query('SELECT * FROM "CmsItem" WHERE "sectionId"=ANY($1)', [sections.map(section => section.id)])
  const { rows: works } = await client.query(`SELECT w.id,w.title FROM "CreatorWork" w WHERE w.type='audiobook' AND w.status='published'
    AND w.id LIKE 'home-design-%' AND EXISTS (SELECT 1 FROM "CreatorEpisode" e WHERE e."workId"=w.id AND e.status='published')
    ORDER BY w.views DESC,w.id LIMIT 8`)
  if (works.length < 3) throw new Error('Run the home-design seed first to provide published sample audiobooks')
  let backupPath = null
  if (values.apply) {
    const backupRoot = join(backend, '.seed-backups')
    await mkdir(backupRoot, { recursive: true, mode: 0o700 })
    const backup = await mkdtemp(join(backupRoot, 'audio-'))
    backupPath = join(backup, 'cms-before.json')
    await writeFile(backupPath, JSON.stringify({ page, sections, items: beforeItems }, null, 2), { mode: 0o600 })
  }
  let count = 0
  async function save(sectionKey, key, title, config, imageUrl = null, linkUrl = '/discover') {
    const section = sections.find(value => value.key === sectionKey)
    if (!section) throw new Error(`Missing CMS section ${sectionKey}`)
    const id = `${prefix}${sectionKey}-${key}`
    await client.query(`INSERT INTO "CmsItem" (id,"sectionId",title,"imageUrl","linkUrl",enabled,"sortOrder",config,"updatedAt")
      VALUES ($1,$2,$3,$4,$5,true,$6,$7::jsonb,now()) ON CONFLICT (id) DO UPDATE SET
      title=EXCLUDED.title,"imageUrl"=EXCLUDED."imageUrl","linkUrl"=EXCLUDED."linkUrl",enabled=true,config=EXCLUDED.config,"sortOrder"=EXCLUDED."sortOrder","updatedAt"=now()`,
    [id, section.id, title, imageUrl, linkUrl, -100 + count, JSON.stringify({ variant: 'default', column: 0, focal: { x: 50, y: 35, zoom: 100 }, ...config })])
    count++
  }
  function elements(title, subtitle, button, href, layout = 'card') {
    const positions = {
      hero: { titleY: 24, textY: 50, buttonY: 74, scale: .75 },
      card: { titleY: 23, textY: 50, buttonY: 76, scale: 1 },
      ribbon: { titleY: 17, textY: 49, buttonY: 76, scale: .55 },
      category: { titleY: 25, textY: 64, buttonY: 82, scale: .85 },
      cta: { titleY: 17, textY: 51, buttonY: 76, scale: 1.65 },
    }[layout]
    return [
      { id: 'title', type: 'title', text: title, x: 4, y: positions.titleY, scale: positions.scale, color: '#3a3350', bold: true, shadow: false },
      { id: 'subtitle', type: 'text', text: subtitle, x: 4, y: positions.textY, scale: positions.scale * .9, color: '#6b6580', shadow: false },
      ...(button ? [{ id: 'button', type: 'button', text: button, x: 4, y: positions.buttonY, scale: positions.scale * .8, color: '#ffffff', backgroundColor: '#7355df', link: href, bold: true, shadow: false }] : []),
    ]
  }
  const banners = [
    ['hero', '0', 'โลกของหนังสือเสียง รอให้คุณออกเดินทาง', 'ฟังหนังสือเสียงคุณภาพ ทุกที่ทุกเวลา', 'เริ่มฟังเลย', '/discover', 'linear-gradient(120deg,#e6d5f4,#f9e6ed)', 'hero'],
    ['hero', '1', 'เสียงพากย์และเสียงเอไอ ครบทุกอารมณ์', 'เลือกฟังเรื่องโปรดในสไตล์ที่คุณชอบ', 'ค้นพบเรื่องใหม่', '/discover', 'linear-gradient(120deg,#dbe8f5,#eee2f7)', 'hero'],
    ['activity', '0', 'ฟังทุกวัน สนุกได้ทุกแนว', 'ค้นพบเรื่องเล่าที่ตรงกับใจคุณ', 'ค้นหาหนังสือเสียง', '/discover', 'linear-gradient(120deg,#fbe2ec,#f5e8fb)', 'card'],
    ['activity', '1', 'ส่งเรื่องโปรดขึ้นอันดับ', 'ทุกคะแนนโหวตมีความหมาย', 'ดูอันดับ', '/ranking', 'linear-gradient(120deg,#e0e9ff,#ece2fb)', 'card'],
    ['row-3', '0', 'เรื่องดัง เสียงดี ที่ผู้ฟังเลือกแล้ว', 'เริ่มฟังเรื่องฮิตได้ทุกที่ทุกเวลา', 'ฟังเลย', '/discover', 'linear-gradient(120deg,#f9dbe9,#eadcff)', 'ribbon'],
    ['narrator', '0', 'เปลี่ยนเสียงของคุณให้เป็นเรื่องราว', 'ร่วมสร้างประสบการณ์การฟังกับ ReadLead', 'เริ่มสร้างผลงาน', '/creator', 'linear-gradient(120deg,#fbeef5,#f0e8fb)', 'ribbon'],
    ['category', '0', 'เติมเต็มทุกอารมณ์', 'คัดสรรหนังสือเสียงคุณภาพ หลากหลายแนว ให้คุณสนุกได้ไม่รู้จบ', '', '/discover', 'linear-gradient(120deg,#e7d7fa,#f6e5f4)', 'category'],
    ['web-sides', '0', 'เสียงพากย์คุณภาพประจำสัปดาห์', 'รวมเรื่องเด่นที่ทีมงานอยากแนะนำ', 'ฟังเลย', '/discover', 'linear-gradient(120deg,#dbe8fa,#e9def8)', 'card'],
    ['web-sides', '1', 'เปิดโลกเรื่องเล่าผ่านเสียง', 'ค้นพบหนังสือเสียงเรื่องใหม่ก่อนใคร', 'ดูทั้งหมด', '/discover', 'linear-gradient(120deg,#f9e1e9,#f4dcf7)', 'card'],
    ['bottom-cta', '0', 'เริ่มฟังเรื่องโปรด', 'ค้นหาเรื่องที่ใช่สำหรับคุณ', 'ค้นหา', '/discover', 'linear-gradient(120deg,#e6dcff,#fae8ee)', 'cta'],
    ['bottom-cta', '1', 'มีเรื่องอยากเล่าไหม', 'เริ่มสร้างผลงานของคุณ', 'เริ่มเลย', '/creator', 'linear-gradient(120deg,#dbe8fa,#e9def8)', 'cta'],
    ['bottom-cta', '2', 'เรื่องฮิตติดอันดับ', 'เรื่องดังที่ผู้ฟังเลือก', 'ดูอันดับ', '/ranking', 'linear-gradient(120deg,#f9e1e9,#f4dcf7)', 'cta'],
    ['bottom-cta', '3', 'เก็บเรื่องโปรดไว้ฟัง', 'กลับมาฟังต่อได้ทุกเวลา', 'เข้าชั้น', '/dashboard', 'linear-gradient(120deg,#e7f1ef,#ece8f8)', 'cta'],
  ]
  for (const [section,key,title,subtitle,button,href,background,layout] of banners) {
    const column = ['activity', 'web-sides', 'bottom-cta'].includes(section) ? Number(key) : 0
    await save(section, key, title, { column, ...(section === 'bottom-cta' ? { slot: column } : {}), background, elements: elements(title, subtitle, button, href, layout) }, null, href)
  }
  for (const [index, work] of works.entries()) {
    const href = `/detail?bookId=${work.id}`
    for (const section of ['ranking-artwork']) {
      const duplicate = beforeItems.some(item => item.sectionId === sections.find(value => value.key === section)?.id && item.config?.bookId === work.id && !item.id.startsWith(prefix))
      if (!duplicate) await save(section, work.id, work.title, { bookId: work.id, workType: 'audiobook', elements: [] }, image(index), href)
    }
    await save('sale', work.id, work.title, { variant: 'book', bookId: work.id, workType: 'audiobook', discount: '-30%', countdownSeconds: 259200 + index * 86400 }, null, href)
    await save('web-books', work.id, work.title, { variant: 'book', source: 'manual', bookId: work.id, workType: 'audiobook' }, null, href)
  }
  const { rows: [result] } = await client.query('SELECT count(*)::int AS count FROM "CmsItem" WHERE id LIKE $1', [`${prefix}%`])
  if (result.count !== count) throw new Error('Seed count did not converge')
  await client.query(values.apply ? 'COMMIT' : 'ROLLBACK')
  console.log(JSON.stringify({ mode: values.apply ? 'applied' : 'dry-run', cmsItems: count, sections: sections.length, publishedSampleWorks: works.length, backupPath, web: origin.origin }))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
