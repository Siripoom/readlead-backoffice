import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
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
for (let index = 0; index < 12; index++) {
  const response = await fetch(new URL(`/seed/novel-design/cover-${index}.jpg`, origin), { method: 'HEAD', signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Deploy the novel preview assets before seeding')
}
const require = createRequire(join(backend, 'package.json'))
const { Client } = require('pg')
const client = new Client({ connectionString: database.toString(), ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined })
const image = index => new URL(`/seed/novel-design/cover-${index % 12}.jpg`, origin).toString()
const prefix = 'novel-design-preview-'
await client.connect()
try {
  await client.query('BEGIN')
  await client.query("SELECT pg_advisory_xact_lock(hashtext('readlead-novel-design-seed'))")
  const { rows: [page] } = await client.query('SELECT * FROM "CmsPage" WHERE slug=$1', ['novel'])
  if (!page) throw new Error('Open the Novel CMS once before seeding')
  const { rows: sections } = await client.query('SELECT * FROM "CmsSection" WHERE "pageId"=$1', [page.id])
  const { rows: beforeItems } = await client.query('SELECT * FROM "CmsItem" WHERE "sectionId"=ANY($1)', [sections.map(section => section.id)])
  const { rows: works } = await client.query(`SELECT w.id,w.title FROM "CreatorWork" w WHERE w.type='novel' AND w.status='published'
    AND w.id LIKE 'home-design-%' AND EXISTS (SELECT 1 FROM "CreatorEpisode" e WHERE e."workId"=w.id AND e.status='published')
    ORDER BY w.views DESC,w.id LIMIT 8`)
  if (works.length < 3) throw new Error('Run the home-design seed first to provide published sample novels')
  let backupPath = null
  if (values.apply) {
    const backupRoot = join(backend, '.seed-backups')
    await mkdir(backupRoot, { recursive: true, mode: 0o700 })
    const backup = await mkdtemp(join(backupRoot, 'novel-'))
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
  function elements(title, subtitle, button, href, color = '#3a3350', buttonColor = '#7355df') {
    return [
      { id: 'title', type: 'title', text: title, x: 4, y: 23, scale: 0.72, color, bold: true, shadow: false },
      { id: 'subtitle', type: 'text', text: subtitle, x: 4, y: 50, scale: 0.7, color, shadow: false },
      { id: 'button', type: 'button', text: button, x: 4, y: 73, scale: 0.65, color: '#ffffff', backgroundColor: buttonColor, link: href, shadow: false },
    ]
  }
  const banners = [
    ['hero', '0', 'โลกของนิยาย รอให้คุณออกเดินทาง', 'ค้นพบนิยายดี ๆ ในสไตล์ที่คุณชอบ ทุกวัน', 'อ่านเลย', '/discover', 'linear-gradient(120deg,#e6d5f4,#f9e6ed)'],
    ['hero', '1', 'เปิดโลกจินตนาการไม่รู้จบ', 'รวมเรื่องน่าอ่านจากนักเขียน ReadLead', 'ดูนิยายยอดนิยม', '/ranking', 'linear-gradient(120deg,#dbe8f5,#eee2f7)'],
    ['activity', '0', 'ส่งนิยายที่คุณรักขึ้นอันดับ', 'ร่วมโหวตและส่งกำลังใจให้เรื่องโปรด', 'ร่วมกิจกรรม', '/ranking', 'linear-gradient(120deg,#fbe2ec,#f5e8fb)'],
    ['activity', '1', 'อ่านทุกวัน สนุกได้ทุกแนว', 'ค้นพบเรื่องใหม่ที่ตรงกับสไตล์ของคุณ', 'ค้นหานิยาย', '/discover', 'linear-gradient(120deg,#e0e9ff,#ece2fb)'],
    ['act3', '0', 'นิยายเรื่องโปรด รอคุณอยู่', 'ทุกคะแนนโหวตมีความหมาย ร่วมเชียร์นักเขียนที่คุณรัก', 'ดูอันดับ', '/ranking', 'linear-gradient(120deg,#f9dbe9,#eadcff)'],
    ['writer-banner', '0', 'มาเป็นนักเขียนกับเรา', 'แบ่งปันจินตนาการ สร้างสรรค์ผลงาน ให้โลกของนิยายเป็นที่รู้จัก', 'เริ่มเขียนนิยายเลย', '/creator', 'linear-gradient(120deg,#fbeef5,#f0e8fb)'],
    ['category', '0', 'เติมเต็มทุกอารมณ์', 'คัดสรรนิยายคุณภาพ หลากหลายแนว ให้คุณสนุกได้ไม่รู้จบ', 'สำรวจทุกแนว', '/discover', 'linear-gradient(120deg,#e7d7fa,#f6e5f4)'],
    ['web-recommend', '0', 'เรื่องเด่นประจำสัปดาห์', 'คัดสรรโดยทีมงาน ReadLead', 'อ่านเลย', '/discover', 'linear-gradient(120deg,#dbe8fa,#e9def8)'],
    ['web-recommend', '1', 'เปิดโลกนิยายเรื่องใหม่', 'เริ่มอ่านเรื่องที่ใช่สำหรับคุณ', 'ดูเรื่องใหม่', '/discover', 'linear-gradient(120deg,#f9e1e9,#f4dcf7)'],
    ['launch', '0', 'เปิดตัวใหม่ยอดฮิต', 'พบกับนิยายเรื่องใหม่ที่กำลังมาแรง', 'ค้นพบเรื่องใหม่', '/discover', 'linear-gradient(120deg,#e6dcff,#fae8ee)'],
  ]
  for (const [section,key,title,subtitle,button,href,background] of banners) {
    await save(section, key, title, { column: ['activity', 'web-recommend'].includes(section) ? Number(key) : 0, background, elements: elements(title, subtitle, button, href) }, null, href)
  }
  await save('web-coverflow', 'main', 'นิยายน่าอ่านประจำสัปดาห์', { variant: 'main', background: 'linear-gradient(120deg,#8061d9,#b193ed)', elements: elements('นิยายน่าอ่านประจำสัปดาห์', 'รวมเรื่องเด่นที่ทีมงานคัดมาให้คุณโดยเฉพาะ', 'ดูทั้งหมด', '/discover', '#ffffff', '#443078') })
  for (const [index, work] of works.entries()) {
    const href = `/detail?bookId=${work.id}`
    for (const section of ['ranking-wide', 'ranking-compact']) {
      const duplicate = beforeItems.some(item => item.sectionId === sections.find(value => value.key === section)?.id && item.config?.bookId === work.id && !item.id.startsWith(prefix))
      if (!duplicate) await save(section, work.id, work.title, { bookId: work.id, workType: 'novel', elements: [] }, image(index), href)
    }
    await save('sale', work.id, work.title, { variant: 'book', bookId: work.id, workType: 'novel', discount: '-30%', countdownSeconds: 259200 + index * 86400 }, null, href)
    await save('web-books', work.id, work.title, { variant: 'book', source: 'manual', bookId: work.id, workType: 'novel' }, null, href)
    await save('web-coverflow', work.id, work.title, { variant: 'cover', caption: work.title }, image(index + 4), href)
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
