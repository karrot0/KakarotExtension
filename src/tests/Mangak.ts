import { type TestLogger } from '@paperback/types'
import { TestSuite, registerDefaultTests } from './suite.js'
import { Mangak } from '../Mangak/main.js'
import sourceInfo from '../Mangak/pbconfig.js'

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite('Mangak tests', logger)
  registerDefaultTests(suite, Mangak, sourceInfo, {
    searchResultsProviding: {
      getSearchResults: [{ title: 'solo leveling' }, undefined],
    },
    mangaProviding: {
      getMangaDetails: ['eternally-regressing-knight'],
    },
    chapterProviding: {
      getChapters: false,
      getChapterDetails: false,
    },
  })

  suite.test('getChapters', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as Awaited<ReturnType<typeof Mangak.getMangaDetails>> | undefined
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const chapters = await Mangak.getChapters(sourceManga)
    if (!chapters.length) throw new Error('Expected at least one chapter')
    const bad = chapters.find(c => typeof c.chapNum !== 'number' || isNaN(c.chapNum))
    if (bad) throw new Error(`Chapter "${bad.chapterId}" has invalid chapNum: ${bad.chapNum}`)
    suite.state['ChapterProviding.getChapters'] = chapters
  })

  suite.test('getChapterDetails', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as Awaited<ReturnType<typeof Mangak.getMangaDetails>> | undefined
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const mockChapter = {
      chapterId: 'chapter-34',
      sourceManga: { mangaId: 'the-10th-class-lout-of-the-knight-family', mangaInfo: sourceManga.mangaInfo },
      chapNum: 34,
      langCode: '🇬🇧',
    }
    const details = await Mangak.getChapterDetails(mockChapter as never)
    if (!details.pages.length) throw new Error('Expected at least one page')
    if (!details.pages[0].startsWith('http')) throw new Error(`Invalid page URL: ${details.pages[0]}`)
  })

  suite.test('getUpdatedSectionItems page 1', async () => {
    const result = await Mangak.getDiscoverSectionItems(
      { id: 'updated_section', title: 'Recently Updated', type: 'chapterUpdates' as never },
    )
    if (!result.items.length) throw new Error('Expected items on page 1')
    suite.state['updatedPage1'] = result
  })

  suite.test('getUpdatedSectionItems page 2', async () => {
    const p1 = suite.state['updatedPage1'] as { metadata?: { page?: number } } | undefined
    if (!p1?.metadata) throw new Error('Page 1 should have next-page metadata')
    const result = await Mangak.getDiscoverSectionItems(
      { id: 'updated_section', title: 'Recently Updated', type: 'chapterUpdates' as never },
      p1.metadata,
    )
    if (!result.items.length) throw new Error('Expected items on page 2')
    const p1Ids = new Set((suite.state['updatedPage1'] as { items: { mangaId: string }[] }).items.map(i => i.mangaId))
    const overlap = result.items.filter(i => p1Ids.has((i as { mangaId: string }).mangaId))
    if (overlap.length === result.items.length) throw new Error('Page 2 returned identical items to page 1')
  })

  suite.test('getSearchResults with exclude', async () => {
    const result = await Mangak.getSearchResults(
      { title: '', metadata: { searchMeta: { genreIncluded: [], genreExcluded: ['yaoi'], status: 'all', orderby: 'views' } } },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  await suite.run()
}
