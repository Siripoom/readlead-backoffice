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
      novel: ['hero', 'activity', 'sale', 'act3', 'web-coverflow', 'web-books', 'writer-banner', 'category'],
      manga: ['hero', 'activity', 'sale', 'row-3', 'web-sides', 'web-books', 'category', 'bottom-cta'],
      audio: ['hero', 'activity', 'sale', 'row-3', 'narrator', 'web-sides', 'web-books', 'category', 'bottom-cta'],
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
