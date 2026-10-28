import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const { values } = parseArgs({ options: {
  reference: { type: 'string' },
  'web-root': { type: 'string', default: '../readlead-web' },
  'web-origin': { type: 'string' },
  'db-port': { type: 'string' },
  'env-file': { type: 'string' },
  'backup-dir': { type: 'string', default: join(root, '.seed-backups') },
  production: { type: 'boolean', default: false },
  apply: { type: 'boolean', default: false },
} })
const envPath = values['env-file'] ? resolve(values['env-file']) : join(root, '.env')
let fileEnv = {}
try { fileEnv = parseEnv(await readFile(envPath, 'utf8')) } catch (error) {
  if (values['env-file'] || error.code !== 'ENOENT') throw error
}
const env = values['env-file'] ? fileEnv : { ...fileEnv, ...process.env }
if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL or pass --env-file')
const database = new URL(env.DATABASE_URL)
const localHosts = ['localhost', '127.0.0.1', '[::1]']
if (!values.production) {
  if (!localHosts.includes(database.hostname) || database.pathname !== '/readlead_backoffice') {
    throw new Error('Remote databases require --production')
  }
  database.port = values['db-port'] ?? '5434'
} else if (values['db-port']) {
  throw new Error('Production uses the port in DATABASE_URL')
}
const webOrigin = new URL(values['web-origin'] ?? env.WEB_APP_URL ?? 'http://localhost:3100')
if (webOrigin.username || webOrigin.password || webOrigin.search || webOrigin.hash || webOrigin.pathname !== '/') throw new Error('Pass a web origin without credentials, path, query, or fragment')
if (values.production && (webOrigin.protocol !== 'https:' || localHosts.includes(webOrigin.hostname))) throw new Error('Production requires the deployed HTTPS web origin')
if (!values.production && !localHosts.includes(webOrigin.hostname)) throw new Error('Use --production with a deployed web origin')
const require = createRequire(join(root, 'package.json'))
const { Client } = require('pg')
const client = new Client({ connectionString: database.toString(), ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined })
let cms
if (values.reference) {
  const source = await readFile(resolve(values.reference), 'utf8')
  const seed = source.match(/<script id="rlCmsSeed">([\s\S]*?)<\/script>/)?.[1]
  if (!seed) throw new Error('The reference does not contain rlCmsSeed')
  const context = { window: {} }
  runInNewContext(seed, context, { timeout: 1000 })
  cms = context.window.RL_CMS
} else {
  cms = JSON.parse(await readFile(new URL('./data/home-design.json', import.meta.url), 'utf8'))
}
if (!cms?.hero?.length || !cms?.reccols || !cms?.picks) throw new Error('Incomplete reference seed')
if (values.production) {
  const assets = Object.values(cms.picks).flatMap(collection => collection.items.flatMap((item) => {
    if (item.cover.assetPath) return [item.cover.assetPath]
    if (item.cover.img) throw new Error('Use the bundled data for production')
    return []
  }))
  for (const asset of new Set(assets)) {
    if (!asset.startsWith('/seed/home-design/')) throw new Error('Unexpected preview asset path')
    const response = await fetch(new URL(asset, webOrigin), { method: 'HEAD', signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Deploy the web preview assets before seeding production')
  }
}

const creatorId = 'home-design-preview-creator'
const sectionKeys = ['hero', 'side', 'recommend-columns', 'editors-choice', 'curated-picks', 'promo-4']
const works = new Map()
const assets = resolve(values['web-root'], 'public/seed/home-design')
const genreKeys = {
  'โรแมนซ์': 'romance', 'แฟนตาซี': 'fantasy', 'แอ็กชัน': 'action', 'ชีวิต': 'slice-of-life',
  'กำลังภายใน': 'fantasy', 'ผจญภัย': 'action', 'สยองขวัญ': 'horror', 'โรงเรียน': 'slice-of-life',
  'ตลก': 'comedy', 'เกม': 'fantasy', 'สืบสวน': 'mystery', 'ครอบครัว': 'slice-of-life',
  'ประวัติศาสตร์': 'historical', 'เมือง': 'slice-of-life',
}
const types = { novel: 'novel', webtoon: 'manga', audio: 'audiobook' }
for (const [type, column] of Object.entries(cms.reccols)) {
  for (const item of column.items) {
    const key = `${type}:${item.title}`
    works.set(key, { ...item, type, id: `home-design-${createHash('sha256').update(key).digest('hex').slice(0, 18)}` })
  }
}

await client.connect()
try {
  await client.query('BEGIN')
  await client.query("SELECT pg_advisory_xact_lock(hashtext('readlead-home-design-seed'))")
  const { rows: pages } = await client.query('SELECT * FROM "CmsPage" WHERE slug = $1', ['home'])
  const beforePage = pages[0] ?? null
  const pageId = beforePage?.id ?? 'home-design-cms-home'
  const { rows: sections } = await client.query('SELECT * FROM "CmsSection" WHERE "pageId" = $1 AND key = ANY($2)', [pageId, sectionKeys])
  const { rows: items } = await client.query('SELECT * FROM "CmsItem" WHERE "sectionId" = ANY($1)', [sections.map(section => section.id)])
  await mkdir(resolve(values['backup-dir']), { recursive: true, mode: 0o700 })
  const backupDirectory = await mkdtemp(join(resolve(values['backup-dir']), 'home-'))
  const backupPath = join(backupDirectory, 'cms.json')
  await writeFile(backupPath, JSON.stringify({ page: beforePage, sections, items }, null, 2), { mode: 0o600 })

  await client.query('INSERT INTO "CmsPage" (id,slug,label,"slideSeconds","updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT (slug) DO NOTHING', [pageId, 'home', 'หน้าหลัก', cms.slideSec])
  const labels = ['แบนเนอร์ใหญ่ (Hero)', 'แบนเนอร์ข้าง Hero', 'แนะนำ 3 คอลัมน์', "Editor's Choice", 'คัดสรรพิเศษสำหรับคุณ', 'แบนเนอร์โปรโมชัน 4 ช่อง']
  for (const [index, key] of sectionKeys.entries()) {
    await client.query('INSERT INTO "CmsSection" (id,"pageId",key,title,"sortOrder") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("pageId",key) DO NOTHING', [`home-design-section-${key}`, pageId, key, labels[index], index])
  }
  const { rows: targetSections } = await client.query('SELECT * FROM "CmsSection" WHERE "pageId"=$1 AND key=ANY($2)', [pageId, sectionKeys])

  await client.query(`INSERT INTO "User" (id,name,email,"userType","updatedAt") VALUES ($1,$2,$3,'creator',now())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`, [creatorId, 'ReadLead Design Preview', 'home-design-preview@readlead.local'])
  for (const work of works.values()) {
    const [genre, origin] = work.cat.split(' · ')
    const narration = work.type === 'audio' ? origin === 'เอไอ' ? 'ai' : 'human' : null
    await client.query(`INSERT INTO "CreatorWork" (id,"creatorId",type,origin,status,title,category,tagline,synopsis,"narrationType",views,"dailyVotes","monthlyVotes","approvedAt","publishedAt","updatedAt")
      VALUES ($1,$2,$3,$4,'published',$5,$6,$7,$8,$9,$10,$11,$11,now(),now(),now())
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,category=EXCLUDED.category,origin=EXCLUDED.origin,
      "narrationType"=EXCLUDED."narrationType",views=EXCLUDED.views,"dailyVotes"=EXCLUDED."dailyVotes","monthlyVotes"=EXCLUDED."monthlyVotes","updatedAt"=now()`,
    [work.id, creatorId, types[work.type], origin === 'แปล' || work.type === 'webtoon' ? 'translated' : 'original', work.title,
      genreKeys[genre] ?? genre, work.cat, 'ผลงานตัวอย่างสำหรับตรวจดีไซน์หน้าหลัก ReadLead', narration, work.views ?? 0, work.votes ?? 0])
    await client.query(`INSERT INTO "CreatorEpisode" (id,"workId","episodeNumber",title,type,status,content,"publishedAt","updatedAt")
      VALUES ($1,$2,1,$3,$4,'published',$5,now(),now()) ON CONFLICT ("workId","episodeNumber") DO NOTHING`,
    [`${work.id}-episode`, work.id, 'ตอนตัวอย่าง', work.type === 'novel' ? 'text' : work.type === 'webtoon' ? 'image' : 'audio', '<p>เนื้อหาตัวอย่างสำหรับตรวจดีไซน์</p>'])
  }

  const sectionIds = new Map(targetSections.map(section => [section.key, section.id]))
  for (const section of targetSections) {
    await client.query(`UPDATE "CmsSection" SET enabled=true,config=COALESCE(config,'{}'::jsonb) || $2::jsonb WHERE id=$1`,
      [section.id, JSON.stringify({ mode: 'manual', groupModes: { novel: 'manual', manga: 'manual', audio: 'manual', top: 'manual', bottom: 'manual' } })])
    await client.query('UPDATE "CmsItem" SET enabled=false WHERE "sectionId"=$1', [section.id])
  }
  let itemCount = 0
  async function saveItem(section, key, title, subtitle, imageUrl, href, config, sortOrder) {
    await client.query(`INSERT INTO "CmsItem" (id,"sectionId",title,subtitle,"imageUrl","linkUrl",enabled,"sortOrder",config,"updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8::jsonb,now()) ON CONFLICT (id) DO UPDATE SET
      title=EXCLUDED.title,subtitle=EXCLUDED.subtitle,"imageUrl"=EXCLUDED."imageUrl","linkUrl"=EXCLUDED."linkUrl",
      enabled=true,"sortOrder"=EXCLUDED."sortOrder",config=EXCLUDED.config,"updatedAt"=now()`,
    [`home-design-cms-${section}-${key}`, sectionIds.get(section), title, subtitle, imageUrl, href, sortOrder, JSON.stringify(config)])
    itemCount++
  }
  async function saveBanner(section, item, index, href, column = 0) {
    const title = item.els.find(element => element.type === 'title')?.text ?? 'แบนเนอร์'
    const elements = item.els.map((element, position) => ({
      id: `element-${position}`, type: element.type, text: element.text, x: element.x, y: element.y,
      scale: element.s ?? 1, color: element.c ?? '#ffffff', backgroundColor: element.bgc,
      bold: element.type !== 'text', shadow: false, link: element.type === 'button' ? href : undefined,
      width: element.w, height: element.h,
    }))
    await saveItem(section, `${column}-${index}`, title, item.els.find(element => element.type === 'text')?.text ?? '', null, href,
      { variant: 'default', column, background: item.bg, focal: { x: 50, y: 50, zoom: 100 }, elements }, index)
  }
  async function saveBook(section, group, item, index, type = item.type) {
    const work = works.get(`${type}:${item.title}`)
    if (!work) throw new Error(`Missing preview work ${item.title}`)
    let imageUrl = item.cover.assetPath ? new URL(item.cover.assetPath, webOrigin).toString() : null
    if (item.cover.img) {
      const match = item.cover.img.match(/^data:image\/jpeg;base64,(.+)$/)
      if (!match) throw new Error('Expected embedded JPEG reference cover')
      const filename = `${section}-${group}-${index}.jpg`
      if (values.apply) {
        await mkdir(assets, { recursive: true })
        await writeFile(join(assets, filename), Buffer.from(match[1], 'base64'))
      }
      imageUrl = new URL(`/seed/home-design/${filename}`, webOrigin).toString()
    }
    await saveItem(section, `${group}-${index}`, item.title, item.cat, imageUrl, `/detail?bookId=${work.id}`, {
      variant: 'book', group, column: 0, source: 'manual', bookId: work.id, workType: types[type],
      caption: item.cat,
      background: `linear-gradient(160deg,${item.cover.c[0]},${item.cover.c[0]}dd)`,
      elements: [{ id: 'cover-monogram', type: 'title', text: item.cover.g, x: 50, y: 50, scale: 1, color: item.cover.c[1], bold: true }],
    }, index)
  }

  for (const [index, item] of cms.hero.entries()) await saveBanner('hero', item, index, ['/novel', '/ranking', '/dashboard?tab=wallet'][index])
  for (const [index, item] of cms.side.entries()) await saveBanner('side', item, index, ['/writer', '/audiobook'][index])
  for (const [type, column] of Object.entries(cms.reccols)) {
    const group = type === 'webtoon' ? 'manga' : type
    for (const [index, item] of column.items.entries()) await saveBook('recommend-columns', group, item, index, type)
  }
  for (const [index, item] of cms.edchoice.entries()) await saveBanner('editors-choice', item, index, '/discover')
  for (const [group, collection] of Object.entries(cms.picks)) {
    for (const [index, item] of collection.items.entries()) await saveBook('curated-picks', group, item, index)
  }
  for (const [column, banners] of cms.promo4.cols.entries()) {
    for (const [index, item] of banners.entries()) await saveBanner('promo-4', item, index, ['/discover', '/dashboard', '/ranking', '/register'][column], column)
  }
  await client.query('UPDATE "CmsPage" SET "slideSeconds"=$2,"updatedAt"=now() WHERE id=$1', [pageId, cms.slideSec])
  const { rows: [counts] } = await client.query('SELECT count(*)::int AS total, count(DISTINCT id)::int AS unique FROM "CmsItem" WHERE enabled=true AND "sectionId"=ANY($1)', [targetSections.map(section => section.id)])
  if (counts.total !== itemCount || counts.unique !== itemCount) throw new Error('Seed counts did not converge')
  await client.query(values.apply ? 'COMMIT' : 'ROLLBACK')
  console.log(JSON.stringify({ mode: values.apply ? 'applied' : 'dry-run', production: values.production, seededWorks: works.size, seededCmsItems: itemCount, backupPath, web: webOrigin.origin }))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
