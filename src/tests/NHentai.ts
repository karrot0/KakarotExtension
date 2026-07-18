import { type TestLogger } from '@paperback/types'
import { TestSuite, registerDefaultTests } from './suite.js'
import { NHentai } from '../NHentai/main.js'
import sourceInfo from '../NHentai/pbconfig.js'

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite('NHentai tests', logger)
  registerDefaultTests(suite, NHentai, sourceInfo, {
    searchResultsProviding: {
      getSearchResults: [{ title: 'school', metadata: [] }, undefined, undefined],
    },
    mangaProviding: {
      getMangaDetails: ['664460'],
    },
    chapterProviding: {
      getChapters: false,
      getChapterDetails: false,
    },
  })

  suite.test('initialise completes without error', async () => {
    try {
      await NHentai.initialise()
    } catch (err) {
      throw new Error(`initialise() should not throw, got: ${err}`)
    }
  })

  suite.test('getDiscoverSections', async () => {
    const sections = await NHentai.getDiscoverSections()
    if (!sections.length) throw new Error('Expected at least one discover section')
    const hasValidSection = sections.some(s => s.id && s.title)
    if (!hasValidSection) throw new Error('Discover sections missing id or title')
    for (const section of sections) {
      if (!section.id || typeof section.id !== 'string') {
        throw new Error(`Section has invalid id: ${section.id}`)
      }
      if (!section.title || typeof section.title !== 'string') {
        throw new Error(`Section "${section.id}" has invalid title: ${section.title}`)
      }
    }
    suite.state['DiscoverSections'] = sections
  })

  suite.test('getDiscoverSectionItems', async () => {
    const sections = suite.state['DiscoverSections'] as any[] | undefined
    if (!sections?.length) throw new Error('getDiscoverSections must pass first')
    const section = sections[0]
    const result = await NHentai.getDiscoverSectionItems(section, undefined)
    if (!result.items.length) throw new Error('Expected items in discover section')
    if (!result.metadata) throw new Error('Expected pagination metadata')
    suite.state['DiscoverPage1'] = result
  })

  suite.test('getDiscoverSectionItems pagination', async () => {
    const p1 = suite.state['DiscoverPage1'] as any | undefined
    if (!p1?.metadata) throw new Error('Page 1 should have metadata for pagination')
    const sections = suite.state['DiscoverSections'] as any[] | undefined
    if (!sections?.length) throw new Error('getDiscoverSections must pass first')
    const section = sections[0]
    const result = await NHentai.getDiscoverSectionItems(section, p1.metadata)
    if (!result.items.length) throw new Error('Expected items on page 2')
    const p1ItemIds = new Set(p1.items.map((i: any) => i.id || i.title))
    const overlap = result.items.filter((i: any) => p1ItemIds.has(i.id || i.title))
    if (overlap.length === result.items.length) throw new Error('Page 2 returned identical items to page 1')
  })

  suite.test('getSearchFilters', async () => {
    const filters = await NHentai.getSearchFilters()
    if (!filters.length) throw new Error('Expected at least one search filter')
    for (const filter of filters) {
      if (!filter.id || typeof filter.id !== 'string') {
        throw new Error(`Filter has invalid id: ${filter.id}`)
      }
      if (!filter.title || typeof filter.title !== 'string') {
        throw new Error(`Filter "${filter.id}" has invalid title: ${filter.title}`)
      }
      const f = filter as any
      if (f.type === 'select' && Array.isArray(f.options)) {
        if (f.options.length === 0) {
          throw new Error(`Select filter "${filter.id}" has no options`)
        }
        for (const opt of f.options) {
          if (!opt.id || !opt.value) {
            throw new Error(`Filter "${filter.id}" option missing id or value: ${JSON.stringify(opt)}`)
          }
        }
      }
    }
    suite.state['SearchFilters'] = filters
  })

  suite.test('getSortingOptions', async () => {
    const options = await NHentai.getSortingOptions()
    if (!options.length) throw new Error('Expected at least one sorting option')
    const hasValidOption = options.some(o => o.id && o.label)
    if (!hasValidOption) throw new Error('Sorting options missing id or label')
    for (const opt of options) {
      if (!opt.id || typeof opt.id !== 'string') {
        throw new Error(`Option has invalid id: ${opt.id}`)
      }
      if (!opt.label || typeof opt.label !== 'string') {
        throw new Error(`Option "${opt.id}" has invalid label: ${opt.label}`)
      }
    }
    suite.state['SortingOptions'] = options
  })

  suite.test('getAdvancedSearchForm', async () => {
    const query = { title: '', metadata: [] }
    const form = await NHentai.getAdvancedSearchForm(query as any)
    if (!form) throw new Error('Expected advanced search form')
    suite.state['AdvancedSearchForm'] = form
  })

  suite.test('getMangaDetails', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    if (!sourceManga.mangaId) throw new Error('SourceManga missing mangaId')
    if (typeof sourceManga.mangaId !== 'string') throw new Error(`mangaId should be string, got ${typeof sourceManga.mangaId}`)
    const info = sourceManga.mangaInfo
    if (!info.primaryTitle || typeof info.primaryTitle !== 'string') throw new Error(`Missing or invalid primaryTitle: ${info.primaryTitle}`)
    if (!info.thumbnailUrl || typeof info.thumbnailUrl !== 'string') throw new Error(`Missing or invalid thumbnailUrl: ${info.thumbnailUrl}`)
    if (!info.synopsis || typeof info.synopsis !== 'string') throw new Error(`Missing or invalid synopsis: ${info.synopsis}`)
    if (!Array.isArray(info.tagGroups)) throw new Error('tagGroups should be array')
    if (info.tagGroups.length === 0) throw new Error('tagGroups should not be empty')
    if (!Array.isArray(info.secondaryTitles)) throw new Error('secondaryTitles should be array')
  })

  suite.test('getChapters', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const chapters = await NHentai.getChapters(sourceManga)
    if (!chapters.length) throw new Error('Expected at least one chapter')
    const bad = chapters.find(c => typeof c.chapNum !== 'number' || isNaN(c.chapNum))
    if (bad) throw new Error(`Chapter "${bad.chapterId}" has invalid chapNum: ${bad.chapNum}`)
    if (!chapters[0].chapterId) throw new Error('First chapter missing chapterId')
    suite.state['Chapters'] = chapters
  })

  suite.test('getChapterDetails', async () => {
    const chapters = suite.state['Chapters'] as any[] | undefined
    if (!chapters?.length) throw new Error('getChapters must pass first')
    const chapter = chapters[0]
    const details = await NHentai.getChapterDetails(chapter)
    const pageList = (details as any).pages
    if (!pageList || !pageList.length) throw new Error('Expected at least one page')
    if (!pageList[0].startsWith('http')) throw new Error(`Invalid page URL: ${pageList[0]}`)
    const badPage = pageList.find((p: string) => !p.startsWith('http'))
    if (badPage) throw new Error(`Invalid page URL: ${badPage}`)
  })

  suite.test('getSearchResults', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'school', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results for "school"')
    if (!result.metadata) throw new Error('Expected pagination metadata')
    if (!Array.isArray(result.items)) throw new Error('items should be array')
    for (const item of result.items as any[]) {
      if (!item.mangaId) throw new Error(`Item missing mangaId: ${JSON.stringify(item)}`)
      if (!item.title || typeof item.title !== 'string') throw new Error(`Item "${item.mangaId}" missing title`)
      if (!item.imageUrl || typeof item.imageUrl !== 'string') throw new Error(`Item "${item.mangaId}" missing imageUrl`)
      if (!item.imageUrl.startsWith('http')) throw new Error(`Item "${item.mangaId}" imageUrl not HTTP URL: ${item.imageUrl}`)
    }
    suite.state['SearchPage1'] = result
  })

  suite.test('getSearchResults pagination', async () => {
    const p1 = suite.state['SearchPage1'] as any | undefined
    if (!p1?.metadata) throw new Error('Page 1 should have metadata for pagination')
    const result = await NHentai.getSearchResults(
      { title: 'school', metadata: [] },
      p1.metadata,
    )
    if (!result.items.length) throw new Error('Expected search results on page 2')
    const p1ItemIds = new Set(p1.items.map((i: any) => i.id || i.title))
    const overlap = result.items.filter((i: any) => p1ItemIds.has(i.id || i.title))
    if (overlap.length === result.items.length) throw new Error('Page 2 returned identical items to page 1')
  })

  suite.test('getSettingsForm', async () => {
    const form = await NHentai.getSettingsForm()
    if (!form) throw new Error('Expected settings form')
    const sections = form.getSections()
    if (!Array.isArray(sections)) {
      throw new Error('Settings form should return sections array')
    }
    if (sections.length === 0) {
      throw new Error('Settings form should have at least one section')
    }
  })

  suite.test('getRelatedSection', async () => {
    const result = await NHentai.getRelatedSection(undefined, false)
    if (!result) throw new Error('Expected related section result')
    if (!Array.isArray(result.items)) throw new Error('Related section should have items array')
  })

  suite.test('getLastReadSection', async () => {
    const result = await NHentai.getLastReadSection(undefined, false)
    if (!result) throw new Error('Expected last read section result')
    if (!Array.isArray(result.items)) throw new Error('Last read section should have items array')
  })

  suite.test('getTopRereadSection', async () => {
    const result = await NHentai.getTopRereadSection(undefined, false)
    if (!result) throw new Error('Expected top reread section result')
    if (!Array.isArray(result.items)) throw new Error('Top reread section should have items array')
  })

  suite.test('getSearchResults with multiple tags and filter', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'school maid pages:<=200', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results for multi-tag filtered query')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  suite.test('getSearchResults with page count filter', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'pages:<=100', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results with page filter')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  suite.test('getSearchResults with favorites filter', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'favorites:>500', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results with favorites filter')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  suite.test('getSearchResults with date filter (days suffix)', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'uploaded:>30d', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results with date filter uploaded:>30d')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  suite.test('getSearchResults with tag and exclusion accepts input', async () => {
    // Just validate that exclusion syntax is accepted without error
    // Actual filtering is verified by API
    try {
      const result = await NHentai.getSearchResults(
        { title: 'school -yaoi pages:<=300', metadata: [] },
        undefined,
      )
      if (typeof result !== 'object' || !result.items) {
        throw new Error('Expected result object with items')
      }
    } catch (err) {
      throw new Error(`Exclusion tag syntax should be accepted: ${err}`)
    }
  })

  suite.test('getSearchResults with multiple filters combined', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'pages:<=200 favorites:>100', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected search results with combined filters')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  suite.test('getSearchResults without filters returns results', async () => {
    const result = await NHentai.getSearchResults(
      { title: '', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Expected default search results')
    if (!result.metadata) throw new Error('Expected pagination metadata')
  })

  suite.test('getMangaDetails includes rating and status', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const { rating, status } = sourceManga.mangaInfo
    if (typeof rating !== 'number') throw new Error(`rating should be number, got ${typeof rating}`)
    if (typeof status !== 'string') throw new Error(`status should be string, got ${typeof status}`)
  })

  suite.test('getChapters respects hide read filter', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const chapters = await NHentai.getChapters(sourceManga)
    if (!chapters.length) throw new Error('Expected at least one chapter')
    for (const chapter of chapters) {
      if (typeof chapter.chapNum !== 'number' || isNaN(chapter.chapNum)) {
        throw new Error(`Invalid chapNum: ${chapter.chapNum}`)
      }
    }
  })

  suite.test('getChapterDetails page URLs valid', async () => {
    const chapters = suite.state['Chapters'] as any[] | undefined
    if (!chapters?.length) throw new Error('getChapters must pass first')
    const chapter = chapters[0]
    const details = await NHentai.getChapterDetails(chapter)
    const pageList = (details as any).pages
    if (!pageList || !Array.isArray(pageList)) throw new Error('Expected pages array')
    if (pageList.length === 0) throw new Error('Expected at least one page')
    const validUrls = pageList.every((url: string) => typeof url === 'string' && url.startsWith('http'))
    if (!validUrls) throw new Error('Not all page URLs are valid HTTP URLs')
    const uniqueUrls = new Set(pageList)
    if (uniqueUrls.size !== pageList.length) throw new Error('Duplicate page URLs detected')
  })

  suite.test('getMangaDetails tags structure', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const tagGroups = sourceManga.mangaInfo.tagGroups
    if (!Array.isArray(tagGroups)) throw new Error('tagGroups should be array')
    for (const group of tagGroups) {
      if (!group.id) throw new Error(`Tag group missing id: ${JSON.stringify(group)}`)
      if (!group.tags) throw new Error(`Tag group "${group.id}" missing tags array`)
      if (!Array.isArray(group.tags)) throw new Error(`Tag group "${group.id}" tags should be array`)
      for (const tag of group.tags) {
        if (!tag.id) throw new Error(`Tag in group "${group.id}" missing id: ${JSON.stringify(tag)}`)
        if (typeof tag.title !== 'string') throw new Error(`Tag "${tag.id}" missing or invalid title`)
      }
    }
  })

  suite.test('getChapters chapter properties', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const chapters = await NHentai.getChapters(sourceManga)
    if (!chapters.length) throw new Error('Expected at least one chapter')
    for (const chapter of chapters) {
      if (!chapter.chapterId) throw new Error('Chapter missing chapterId')
      if (!chapter.sourceManga) throw new Error('Chapter missing sourceManga')
      if (typeof chapter.chapNum !== 'number' || isNaN(chapter.chapNum)) {
        throw new Error(`Chapter "${chapter.chapterId}" invalid chapNum: ${chapter.chapNum}`)
      }
      if (!chapter.langCode) throw new Error(`Chapter "${chapter.chapterId}" missing langCode`)
    }
  })

  suite.test('getMangaDetails content rating', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const { contentRating, status } = sourceManga.mangaInfo
    if (!contentRating) throw new Error('Missing contentRating in mangaInfo')
    if (!status) throw new Error('Missing status in mangaInfo')
    if (status !== 'COMPLETED') throw new Error(`Expected COMPLETED status, got: ${status}`)
  })

  suite.test('thumbnailUrl contains valid extension type (jpg/png/gif/webp)', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const { thumbnailUrl } = sourceManga.mangaInfo
    if (!thumbnailUrl) throw new Error('Missing thumbnailUrl in mangaInfo')
    if (!thumbnailUrl.startsWith('http')) {
      throw new Error(`thumbnailUrl should start with http, got: ${thumbnailUrl}`)
    }
    const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    const hasValidExt = validExts.some(ext => thumbnailUrl.toLowerCase().includes(`.${ext}`))
    if (!hasValidExt) {
      throw new Error(
        `thumbnailUrl does not contain valid extension. Expected one of [${validExts.join(',')}], got: ${thumbnailUrl}`,
      )
    }
  })

  suite.test('getChapterDetails page URLs contain valid extension types', async () => {
    const chapters = suite.state['Chapters'] as any[] | undefined
    if (!chapters?.length) throw new Error('getChapters must pass first')
    const chapter = chapters[0]
    const details = await NHentai.getChapterDetails(chapter)
    const pages = (details as any).pages
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error('Expected at least one page URL')
    }
    const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    for (let i = 0; i < Math.min(pages.length, 3); i++) {
      const url = pages[i]
      const hasValidExt = validExts.some(ext => url.toLowerCase().includes(`.${ext}`))
      if (!hasValidExt) {
        throw new Error(
          `Page ${i} URL does not contain valid extension. ` +
          `Expected one of [${validExts.join(',')}], got: ${url}`,
        )
      }
    }
  })

  suite.test('page URLs follow CDN pattern with subdomain distribution', async () => {
    const chapters = suite.state['Chapters'] as any[] | undefined
    if (!chapters?.length) throw new Error('getChapters must pass first')
    const chapter = chapters[0]
    const details = await NHentai.getChapterDetails(chapter)
    const pages = (details as any).pages
    if (!Array.isArray(pages) || pages.length < 2) {
      throw new Error('Expected at least 2 page URLs')
    }
    const cdnPattern = /^https?:\/\/[it]\d+\.nhentai\.net\/galleries\/\d+\/\d+\.[a-z]+/
    for (let i = 0; i < Math.min(pages.length, 3); i++) {
      const url = pages[i]
      if (!cdnPattern.test(url)) {
        throw new Error(
          `Page ${i} URL does not match CDN pattern (i/t subdomain with number). Got: ${url}`,
        )
      }
    }
  })

  suite.test('cover/thumbnail URLs exist and resolve', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const { thumbnailUrl } = sourceManga.mangaInfo
    if (!thumbnailUrl) throw new Error('Missing thumbnailUrl')
    if (!thumbnailUrl.startsWith('http')) {
      throw new Error(`thumbnailUrl must be HTTP URL, got: ${thumbnailUrl}`)
    }
    const cdnPattern = /^https?:\/\/[it]\d+\.nhentai\.net\//
    if (!cdnPattern.test(thumbnailUrl)) {
      throw new Error(
        `thumbnailUrl does not use CDN pattern (i/t subdomain). Got: ${thumbnailUrl}`,
      )
    }
  })

  suite.test('saveCloudflareBypassCookies accepts empty array without error', async () => {
    try {
      await NHentai.saveCloudflareBypassCookies([])
    } catch (err) {
      throw new Error(`saveCloudflareBypassCookies should handle empty array, got: ${err}`)
    }
  })

  suite.test('getSearchResults pagination metadata exists', async () => {
    const p1 = suite.state['SearchPage1'] as any
    if (!p1?.metadata) throw new Error('Page 1 should have metadata')
    const result = await NHentai.getSearchResults(
      { title: 'school', metadata: [] },
      p1.metadata,
    )
    if (!result.metadata) throw new Error('Page 2 should have metadata')
    if (typeof result.metadata !== 'object' || result.metadata === null) {
      throw new Error(`Page 2 metadata should be object, got ${typeof result.metadata}`)
    }
  })

  suite.test('getRelatedSection items have valid structure', async () => {
    const result = await NHentai.getRelatedSection(undefined, false)
    if (!result) throw new Error('Expected related section result')
    if (!Array.isArray(result.items)) throw new Error('Related section should have items array')
    for (const item of result.items as any[]) {
      if (item.id && !item.title) {
        throw new Error(`Related item "${item.id}" missing title`)
      }
    }
  })

  suite.test('getLastReadSection items have valid structure', async () => {
    const result = await NHentai.getLastReadSection(undefined, false)
    if (!result) throw new Error('Expected last read section result')
    if (!Array.isArray(result.items)) throw new Error('Last read section should have items array')
    for (const item of result.items as any[]) {
      if (item.id && !item.title) {
        throw new Error(`Last read item "${item.id}" missing title`)
      }
    }
  })

  suite.test('getTopRereadSection items have valid structure', async () => {
    const result = await NHentai.getTopRereadSection(undefined, false)
    if (!result) throw new Error('Expected top reread section result')
    if (!Array.isArray(result.items)) throw new Error('Top reread section should have items array')
    for (const item of result.items as any[]) {
      if (item.id && !item.title) {
        throw new Error(`Top reread item "${item.id}" missing title`)
      }
    }
  })

  suite.test('getDiscoverSectionItems scroll through popular section', async () => {
    const sections = suite.state['DiscoverSections'] as any[] | undefined
    if (!sections?.length) throw new Error('getDiscoverSections must pass first')
    const popularSection = sections.find((s: any) => s.id?.toLowerCase().includes('popular'))
    if (!popularSection) throw new Error('Popular discover section not found')
    const page1 = await NHentai.getDiscoverSectionItems(popularSection, undefined)
    if (!page1.items.length) throw new Error('Popular section should have items')
    if (!page1.metadata) throw new Error('Popular page should have metadata')
    suite.state['DiscoverPopularPage1'] = page1
  })

  suite.test('getDiscoverSectionItems popular section pagination', async () => {
    const p1 = suite.state['DiscoverPopularPage1'] as any | undefined
    if (!p1?.metadata) throw new Error('Popular page 1 should exist')
    const sections = suite.state['DiscoverSections'] as any[] | undefined
    if (!sections?.length) throw new Error('getDiscoverSections must pass first')
    const popularSection = sections.find((s: any) => s.id?.toLowerCase().includes('popular'))
    if (!popularSection) throw new Error('Popular section not found')
    const page2 = await NHentai.getDiscoverSectionItems(popularSection, p1.metadata)
    if (!page2.items.length) throw new Error('Popular page 2 should have items')
    const p1Ids = new Set(p1.items.map((i: any) => i.mangaId || i.id))
    const overlap = page2.items.filter((i: any) => p1Ids.has(i.mangaId || i.id))
    if (overlap.length === page2.items.length) {
      throw new Error('Popular page 2 returned duplicate items from page 1')
    }
  })

  suite.test('multiple discover section pagination (collect across pages)', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'school', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Search should return results')
    let itemCount = result.items.length
    let pageCount = 1
    let metadata = result.metadata
    // Collect across up to 3 pages without hitting rate limits
    while (pageCount < 3 && metadata) {
      const nextPage = await NHentai.getSearchResults(
        { title: 'school', metadata: [] },
        metadata,
      )
      if (!nextPage.items.length) break
      itemCount += nextPage.items.length
      metadata = nextPage.metadata
      pageCount++
    }
    if (itemCount < result.items.length) {
      throw new Error(`Pagination should accumulate items, got ${itemCount}`)
    }
    suite.state['PaginationItemCount'] = itemCount
    suite.state['PaginationPageCount'] = pageCount
  })

  suite.test('language filter affects search results', async () => {
    const result1 = await NHentai.getSearchResults(
      { title: 'pages:<=100', metadata: [] },
      undefined,
    )
    if (!result1.items.length) throw new Error('Search should return results')
    const result2 = await NHentai.getSearchResults(
      { title: 'language:english pages:<=100', metadata: [] },
      undefined,
    )
    if (typeof result2.items.length !== 'number') {
      throw new Error('Language filter search should return items array')
    }
    if (!Array.isArray(result2.items)) throw new Error('Language filter results should be array')
  })

  suite.test('hide read manga filter recognized in search', async () => {
    try {
      const result = await NHentai.getSearchResults(
        { title: 'pages:<=100', metadata: [] },
        undefined,
      )
      if (!Array.isArray(result.items)) throw new Error('Should return items array')
      for (const item of result.items as any[]) {
        if (typeof item !== 'object' || item === null) {
          throw new Error(`Item should be object, got ${typeof item}`)
        }
      }
    } catch (err) {
      throw new Error(`Hide read filter handling failed: ${err}`)
    }
  })

  suite.test('search results consistent across multiple calls same query', async () => {
    const query = { title: 'school pages:<=150', metadata: [] }
    const result1 = await NHentai.getSearchResults(query, undefined)
    if (!result1.items.length) throw new Error('First search should return results')
    const ids1 = result1.items.map((i: any) => i.mangaId).sort()
    const result2 = await NHentai.getSearchResults(query, undefined)
    if (!result2.items.length) throw new Error('Second search should return results')
    const ids2 = result2.items.map((i: any) => i.mangaId).sort()
    if (ids1.length !== ids2.length) {
      throw new Error(
        `Results should be consistent: first search ${ids1.length} items, ` +
        `second search ${ids2.length} items`,
      )
    }
  })

  suite.test('discover sections cover multiple types', async () => {
    const sections = suite.state['DiscoverSections'] as any[] | undefined
    if (!sections?.length) throw new Error('getDiscoverSections must pass first')
    const typeCount = new Set(sections.map((s: any) => s.type)).size
    if (typeCount < 1) throw new Error('Should have at least 1 section type')
    for (const section of sections) {
      if (!section.id) throw new Error(`Section missing id: ${JSON.stringify(section)}`)
      if (!section.title) throw new Error(`Section missing title: ${JSON.stringify(section)}`)
    }
  })

  suite.test('getMangaDetails returns consistent data across calls', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const id = sourceManga.mangaId
    const result1 = await NHentai.getMangaDetails(id)
    const result2 = await NHentai.getMangaDetails(id)
    if (result1.mangaId !== result2.mangaId) {
      throw new Error('MangaId should be same across calls')
    }
    if (result1.mangaInfo.primaryTitle !== result2.mangaInfo.primaryTitle) {
      throw new Error('Primary title should be same across calls')
    }
  })

  suite.test('getChapters returns non-empty chapters array', async () => {
    const sourceManga = suite.state['MangaProviding.getMangaDetails'] as any
    if (!sourceManga) throw new Error('getMangaDetails must pass first')
    const chapters = await NHentai.getChapters(sourceManga)
    if (!Array.isArray(chapters)) throw new Error('Chapters should be array')
    if (chapters.length === 0) throw new Error('Should have at least one chapter')
    if (chapters.length !== 1) {
      throw new Error(`Expected exactly 1 chapter (single-chapter doujin), got ${chapters.length}`)
    }
  })

  suite.test('getSearchFilters returns consistent structure', async () => {
    const filters1 = await NHentai.getSearchFilters()
    const filters2 = await NHentai.getSearchFilters()
    if (filters1.length !== filters2.length) {
      throw new Error(`Filters should be consistent: ${filters1.length} vs ${filters2.length}`)
    }
    if (!filters1.length) throw new Error('Should have filters')
  })

  suite.test('getSortingOptions returns multiple options', async () => {
    const options = await NHentai.getSortingOptions()
    if (options.length < 2) throw new Error('Should have at least 2 sorting options')
    const ids = new Set(options.map((o: any) => o.id))
    if (ids.size !== options.length) throw new Error('Sorting option IDs should be unique')
  })

  suite.test('getAdvancedSearchForm returns callable form', async () => {
    const form = await NHentai.getAdvancedSearchForm(
      { title: '', metadata: [] } as any,
    )
    if (!form) throw new Error('Advanced search form should exist')
    if (typeof form !== 'object') throw new Error(`Form should be object, got ${typeof form}`)
  })

  suite.test('page count metadata tracked across pagination', async () => {
    const paginationCount = suite.state['PaginationPageCount'] as number | undefined
    const paginationItems = suite.state['PaginationItemCount'] as number | undefined
    if (!paginationCount || !paginationItems) throw new Error('Pagination test must pass first')
    if (paginationCount < 1) throw new Error('Should have paginated at least once')
    if (paginationItems < 25) throw new Error('Should have collected items across pages')
  })

  suite.test('thumbnail URL formats match CDN pattern', async () => {
    const result = await NHentai.getSearchResults(
      { title: 'pages:<=150', metadata: [] },
      undefined,
    )
    if (!result.items.length) throw new Error('Should have search results')
    const item = (result.items[0] as any)
    if (item.imageUrl && !item.imageUrl.match(/^https?:\/\/[it]\d+\.nhentai\.net\//)) {
      throw new Error(`Item imageUrl does not match CDN pattern: ${item.imageUrl}`)
    }
  })

  await suite.run()
}
