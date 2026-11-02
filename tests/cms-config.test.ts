import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CMS_PAGE_SECTIONS,
  CMS_PAGE_SLUGS,
  cmsItemLimit,
  getSectionDefinition,
  modernizeItemConfig,
  normalizeElements,
} from '../lib/cms-config'
import { cmsGenerationSort, cmsGenerationWorkType, generatedItemMatchesGroup } from '../lib/cms-generation'

test('CMS exposes all six pages and the target home panels', () => {
  assert.deepEqual(CMS_PAGE_SLUGS, ['home', 'novel', 'manga', 'audio', 'rank', 'search'])
  const visible = CMS_PAGE_SECTIONS.home.filter((section) => section.adminVisible !== false).map((section) => section.key)
  assert.deepEqual(visible, ['hero', 'side', 'recommend-columns', 'editors-choice', 'curated-picks', 'promo-4'])
})

test('CMS presentation metadata mirrors the admin reference', () => {
  assert.equal(getSectionDefinition('home', 'hero')?.toggleable, undefined)
  assert.equal(getSectionDefinition('home', 'side')?.toggleLabel, false)
  assert.deepEqual(getSectionDefinition('novel', 'web-books')?.modeOptions, ['manual', 'popular', 'random'])
  assert.equal(getSectionDefinition('novel', 'act3')?.clearable, true)
  assert.deepEqual(
    Object.fromEntries(CMS_PAGE_SLUGS.map((slug) => [slug, CMS_PAGE_SECTIONS[slug].filter((section) => section.adminVisible !== false).map((section) => section.key)])),
    {
      home: ['hero', 'side', 'recommend-columns', 'editors-choice', 'curated-picks', 'promo-4'],
      novel: ['hero', 'activity', 'sale', 'ranking-wide', 'ranking-compact', 'act3', 'web-coverflow', 'web-books', 'writer-banner', 'category', 'web-recommend', 'launch'],
      manga: ['hero', 'activity', 'sale', 'row-3', 'web-sides', 'web-books', 'category', 'bottom-cta'],
      audio: ['hero', 'activity', 'sale', 'ranking-artwork', 'row-3', 'narrator', 'web-sides', 'web-books', 'category', 'bottom-cta'],
      rank: ['hero', 'side'],
      search: ['hero', 'search-categories'],
    },
  )
})

test('section-specific limits are resolved per group', () => {
  const recommendations = getSectionDefinition('home', 'recommend-columns')!
  const picks = getSectionDefinition('home', 'curated-picks')!
  const editor = getSectionDefinition('home', 'editors-choice')!
  assert.equal(cmsItemLimit(recommendations, { variant: 'book', group: 'novel' }), 15)
  assert.equal(cmsItemLimit(picks, { variant: 'book', group: 'top' }), 15)
  assert.equal(cmsItemLimit(picks, { variant: 'book', group: 'bottom' }), 30)
  assert.equal(cmsItemLimit(editor, { variant: 'default' }), 5)
  assert.equal(getSectionDefinition('search', 'hero')?.maxItems, 1)
})

test('legacy visual config remains readable and normalized', () => {
  const config = modernizeItemConfig({ x: 12, y: 40, size: 125, color: '#ffffff', badge: 'ใหม่', ctaLabel: 'อ่านเลย' }, { title: 'เรื่องเดิม', subtitle: 'คำโปรยเดิม', linkUrl: '/works/old' })
  assert.equal(config.elements?.find((element) => element.type === 'title')?.text, 'เรื่องเดิม')
  assert.equal(config.elements?.find((element) => element.type === 'title')?.scale, 1.25)
  assert.equal(config.elements?.find((element) => element.type === 'button')?.link, '/works/old')
  assert.equal(normalizeElements(Array.from({ length: 20 }, (_, index) => ({ id: `title-${index}`, type: 'title', text: 'x', x: 0, y: 0, scale: 1, color: '#ffffff' }))).length, 14)
})

test('generation modes and groups remain isolated', () => {
  assert.equal(cmsGenerationSort('views'), 'views')
  assert.equal(cmsGenerationSort('popular'), 'views')
  assert.equal(cmsGenerationSort('votes'), 'dailyVotes')
  assert.equal(cmsGenerationSort('random'), 'random')
  assert.equal(cmsGenerationWorkType('home', 'recommend-columns', 'audio'), 'audiobook')
  assert.equal(cmsGenerationWorkType('novel', 'web-books'), 'novel')
  assert.equal(cmsGenerationWorkType('home', 'curated-picks', 'top'), undefined)
  assert.equal(generatedItemMatchesGroup({ source: 'generated', group: 'top' }, 'top'), true)
  assert.equal(generatedItemMatchesGroup({ source: 'manual', group: 'top' }, 'top'), false)
  assert.equal(generatedItemMatchesGroup({ source: 'generated', group: 'bottom' }, 'top'), false)
})


test('reference banners retain alpha colors and intrinsic button sizing', () => {
  const elements = normalizeElements([
    { id: 'description', type: 'text', text: 'คำโปรย', color: '#ffffffcc' },
    { id: 'action', type: 'button', text: 'อ่านเลย', color: '#ffffff', backgroundColor: '#cc4452' },
  ])
  assert.equal(elements[0].color, '#ffffffcc')
  assert.equal(elements[1].width, undefined)
  assert.equal(elements[1].height, undefined)
  const restored = modernizeItemConfig({ elements }, { title: 'ตัวอย่าง' }).elements
  assert.equal(restored?.[1].width, undefined)
  assert.equal(restored?.[0].color, '#ffffffcc')
})

test('explicit banner button dimensions remain constrained', () => {
  const [button] = normalizeElements([{ type: 'button', text: 'อ่านเลย', width: 24, height: 16 }])
  assert.equal(button.width, 24)
  assert.equal(button.height, 16)
  const [bounded] = normalizeElements([{ type: 'button', width: 140, height: -2 }])
  assert.equal(bounded.width, 100)
  assert.equal(bounded.height, 4)
})


test('novel artwork follows published works and keeps other page layouts unchanged', () => {
  assert.equal(getSectionDefinition('novel', 'ranking-wide')?.bookLinked, true)
  assert.equal(getSectionDefinition('novel', 'ranking-wide')?.aspect, '1216 / 287')
  assert.equal(getSectionDefinition('novel', 'ranking-compact')?.aspect, '600 / 226')
  assert.equal(getSectionDefinition('novel', 'launch')?.columns, 1)
  assert.equal(getSectionDefinition('novel', 'launch')?.aspect, '1180 / 247')
  assert.equal(getSectionDefinition('novel', 'web-recommend')?.aspect, '1180 / 247')
  assert.equal(getSectionDefinition('manga', 'launch')?.columns, 2)
  assert.equal(getSectionDefinition('audio', 'web-recommend')?.adminVisible, false)
})

test('audio ranking artwork and recommendation canvases match their page without changing manga', () => {
  const artwork = getSectionDefinition('audio', 'ranking-artwork')
  assert.equal(artwork?.bookLinked, true)
  assert.equal(artwork?.kind, 'visual')
  assert.equal(artwork?.aspect, '441 / 229')
  assert.equal(cmsGenerationWorkType('audio', 'ranking-artwork'), 'audiobook')
  assert.equal(getSectionDefinition('audio', 'web-sides')?.aspect, '566 / 169')
  assert.equal(getSectionDefinition('manga', 'web-sides')?.aspect, '567 / 135')
  assert.equal(getSectionDefinition('audio', 'launch')?.adminVisible, false)
  assert.equal(getSectionDefinition('novel', 'ranking-wide')?.aspect, '1216 / 287')
})
