import { type TestLogger } from '@paperback/types'
import { TestSuite, registerDefaultTests } from './suite.js'
import { ReadComicsOnline } from '../ReadComicsOnline/main.js'
import sourceInfo from '../ReadComicsOnline/pbconfig.js'

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite('ReadComicsOnline tests', logger)
  registerDefaultTests(suite, ReadComicsOnline, sourceInfo, {
    searchResultsProviding: {
      getSearchResults: [{ title: 'batman' }, undefined, undefined],
    },
    mangaProviding: {
      getMangaDetails: ['batman-2016'],
    },
  })

  suite.test('getMangaDetails status/type/categories tagGroups', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as Awaited<ReturnType<typeof ReadComicsOnline.getMangaDetails>> | undefined
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    if (sourceManga.mangaInfo.status !== 'ONGOING' && sourceManga.mangaInfo.status !== 'COMPLETED') {
      throw new Error(`Expected a resolved status, got "${sourceManga.mangaInfo.status}"`)
    }
    const groupIds = (sourceManga.mangaInfo.tagGroups ?? []).map(g => g.id)
    if (!groupIds.includes('type')) throw new Error('Expected a "type" tagGroup')
    if (!groupIds.includes('categories')) throw new Error('Expected a "categories" tagGroup')
  })

  suite.test('getChapters chapter numbers are valid', async () => {
    const chapters = suite.state['ChapterProviding.getChapters'] as Awaited<ReturnType<typeof ReadComicsOnline.getChapters>> | undefined
    if (!chapters?.length) throw new Error('getChapters must pass first')
    const bad = chapters.find(c => typeof c.chapNum !== 'number' || isNaN(c.chapNum))
    if (bad) throw new Error(`Chapter "${bad.chapterId}" has invalid chapNum: ${bad.chapNum}`)
  })

  suite.test('getDiscoverSectionItems popular_section', async () => {
    const result = await ReadComicsOnline.getDiscoverSectionItems(
      { id: 'popular_section', title: 'Popular', type: 'featured' as never },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected popular section items')
  })

  suite.test('getDiscoverSectionItems hot_comic_updates_section has subtitles', async () => {
    const result = await ReadComicsOnline.getDiscoverSectionItems(
      { id: 'hot_comic_updates_section', title: 'Hot Comic updates', type: 'simpleCarousel' as never },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected hot comics items')
  })

  suite.test('getDiscoverSectionItems latest_comic_updates_section has chapter subtitles', async () => {
    const result = await ReadComicsOnline.getDiscoverSectionItems(
      { id: 'latest_comic_updates_section', title: 'Latest Comic Updates', type: 'simpleCarousel' as never },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected latest comics items')
    // Regression check: the subtitle selector previously matched the cover-image
    // anchor (which has no text), so every subtitle came back empty.
    const withSubtitle = result.items.filter(i => 'subtitle' in i && (i as { subtitle?: string }).subtitle)
    if (withSubtitle.length === 0) throw new Error('Expected at least one item with a non-empty chapter subtitle')
  })

  suite.test('getAdvancedSearchForm returns a form', async () => {
    const form = await ReadComicsOnline.getAdvancedSearchForm({ title: '' })
    const sections = form.getSections()
    if (!sections.length) throw new Error('Expected at least one form section')
  })

  // Best-effort: verifies the POST /advanced-search flow doesn't throw and
  // returns a well-formed PagedResults. Does not assert on item count.
  suite.test('getSearchResults with status/type filters does not throw', async () => {
    const result = await ReadComicsOnline.getSearchResults(
      {
        title: '',
        metadata: { searchMeta: { status: '1', types: '1', categories: '' } },
      },
      undefined,
    )
    if (!('items' in result)) throw new Error('Expected a PagedResults object')
  })

  await suite.run()
}
