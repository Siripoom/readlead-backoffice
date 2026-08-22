import { asItemConfig, type CmsAutoMode, type CmsPageSlug } from '@/lib/cms-config'

export type CmsWorkType = 'novel' | 'manga' | 'audiobook'

export function cmsGenerationWorkType(page: CmsPageSlug, sectionKey: string, group?: string): CmsWorkType | undefined {
  if (sectionKey === 'recommend-columns') {
    if (group === 'novel') return 'novel'
    if (group === 'manga') return 'manga'
    if (group === 'audio') return 'audiobook'
    return undefined
  }
  if (page === 'novel') return 'novel'
  if (page === 'manga') return 'manga'
  if (page === 'audio') return 'audiobook'
  return undefined
}

export function cmsGenerationSort(mode: Exclude<CmsAutoMode, 'manual'>) {
  if (mode === 'votes') return 'dailyVotes' as const
  if (mode === 'random') return 'random' as const
  return 'views' as const
}

export function generatedItemMatchesGroup(configValue: unknown, group?: string) {
  const config = asItemConfig(configValue)
  return config.source === 'generated' && (group ? config.group === group : config.group === undefined)
}
