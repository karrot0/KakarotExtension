/* eslint-disable @typescript-eslint/no-unused-expressions */
import {
  implementsChapterProviding,
  implementsSearchResultsProviding,
  SourceIntents,
  type Chapter,
  type ChapterProviding,
  type Extension,
  type ExtensionInfo,
  type MangaProviding,
  type PagedResults,
  type SearchResultItem,
  type SearchResultsProviding,
  type SortingOption,
  type SourceManga,
  type TestLogger,
} from '@paperback/types'

import { expect } from 'chai'

export type TestCase = {
  name: string
  fn: (testLogger: TestLogger) => Promise<unknown>
}

export type TestResult = {
  name: string
  passed: boolean
  error?: Error
  duration: number
  returnValue?: unknown
}

export class TestSuite {
  readonly state: Record<string, unknown> = {}
  private testCases: TestCase[] = []
  private logger: TestLogger

  constructor(name: string, logger: TestLogger) {
    this.logger = logger
    this.logger.log("name", name)
  }

  test(name: string, fn: () => Promise<void>): void {
    this.testCases.push({ name, fn })
  }

  async run() {
    const startTime = Date.now()
    let passed = 0
    let failed = 0

    const tests = this.logger.list("tests")
    for (const testCase of this.testCases) {
      const testStartTime = Date.now()
      const testLogger = tests.scope(testCase.name)
      try {
        const returnValue = await testCase.fn(testLogger.scope("runner"))
        const duration = Date.now() - testStartTime
        passed++
        testLogger.log("status", "pass")
        testLogger.log("duration", duration)
        testLogger.log("returnValue", returnValue)
      } catch (error) {
        const duration = Date.now() - testStartTime
        failed++
        testLogger.log("status", "fail")
        testLogger.log("error", String(error))
        testLogger.log("duration", duration)
      }
    }

    const totalDuration = Date.now() - startTime
    this.logger.log("summary", {
      passed,
      failed,
      total: this.testCases.length,
      duration: totalDuration,
    })
  }
}

type ExtensionTestData = {
  searchResultsProviding?: {
    getSearchResults: Parameters<SearchResultsProviding['getSearchResults']> | false
    getSortingOptions?: Parameters<Exclude<SearchResultsProviding['getSortingOptions'], undefined>> | false
  } | false
  mangaProviding?: {
    getMangaDetails: Parameters<MangaProviding['getMangaDetails']> | false
  } | false
  chapterProviding?: {
    getChapters: Parameters<ChapterProviding['getChapters']> | false
    getChapterDetails: Parameters<ChapterProviding['getChapterDetails']> | false
  } | false
}

const STATE_KEY = {
  SearchResultsProviding: {
    getSearchResults: 'SearchResultsProviding.getSearchResults',
    getSortingOptions: 'SearchResultsProviding.getSortingOptions',
  },
  MangaProviding: {
    getMangaDetails: 'MangaProviding.getMangaDetails',
  },
  ChapterProviding: {
    getChapters: 'ChapterProviding.getChapters',
    getChapterDetails: 'ChapterProviding.getChapterDetails',
  },
}

export const registerDefaultTests = function (
  suite: TestSuite,
  extension: Extension,
  extensionInfo: ExtensionInfo,
  testData: ExtensionTestData = {}
) {
  suite.test('initialisation', async () => {
    await extension.initialise()
  })

  let sourceCapabilities: SourceIntents = 0
  if (Array.isArray(extensionInfo.capabilities)) {
    sourceCapabilities = extensionInfo.capabilities.reduce((a, b) => a | b, sourceCapabilities)
  } else {
    sourceCapabilities = extensionInfo.capabilities
  }

  if (sourceCapabilities & SourceIntents.SEARCH_RESULT_PROVIDING && testData.searchResultsProviding !== false) {
    if (implementsSearchResultsProviding(extension)) {
      if ('getSortingOptions' in extension && testData.searchResultsProviding?.getSortingOptions !== false) {
        suite.test('getSortingOptions', async () => {
          let params = testData.searchResultsProviding && testData.searchResultsProviding !== false
            ? testData.searchResultsProviding.getSortingOptions
            : undefined
          if (!params) params = [{ title: '' }]
          const sortingOptions = await extension.getSortingOptions!(...params)
          expect(sortingOptions).not.empty
          suite.state[STATE_KEY.SearchResultsProviding.getSortingOptions] = sortingOptions
        })
      }

      if (testData.searchResultsProviding !== false && testData.searchResultsProviding?.getSearchResults !== false) {
        suite.test('getSearchResults', async () => {
          let params = testData.searchResultsProviding && testData.searchResultsProviding !== false
            ? testData.searchResultsProviding.getSearchResults
            : undefined
          if (!params) {
            const sortingOptions = suite.state[STATE_KEY.SearchResultsProviding.getSortingOptions] as SortingOption[] | undefined
            params = [{ title: '' }, undefined, sortingOptions?.[0]]
          }
          const searchResults = await extension.getSearchResults(...params)
          expect(searchResults).not.empty
          expect(searchResults.items).not.be.empty
          suite.state[STATE_KEY.SearchResultsProviding.getSearchResults] = searchResults
        })
      }
    }
  }

  if (testData.mangaProviding !== false) {
    suite.test('getMangaDetails', async () => {
      expect(extension).to.have.property('getMangaDetails')
      let params = testData.mangaProviding && testData.mangaProviding !== false
        ? testData.mangaProviding.getMangaDetails
        : undefined
      if (!params) {
        const searchResults = suite.state[STATE_KEY.SearchResultsProviding.getSearchResults] as PagedResults<SearchResultItem> | undefined
        if (searchResults?.items[0]?.mangaId) {
          params = [searchResults.items[0].mangaId]
        } else {
          throw new Error('No `mangaId` provided in test data. Unable to infer from getSearchResults')
        }
      }
      const mangaDetails = await (extension as unknown as MangaProviding).getMangaDetails(...params)
      expect(mangaDetails).to.not.be.undefined
      expect(mangaDetails.mangaInfo).to.not.be.undefined
      suite.state[STATE_KEY.MangaProviding.getMangaDetails] = mangaDetails
    })
  }

  if (sourceCapabilities & SourceIntents.CHAPTER_PROVIDING && testData.chapterProviding !== false) {
    if (implementsChapterProviding(extension)) {
      if (testData.chapterProviding?.getChapters !== false) {
        suite.test('getChapters', async () => {
          let params = testData.chapterProviding && testData.chapterProviding !== false
            ? testData.chapterProviding.getChapters
            : undefined
          if (!params) {
            const sourceManga = suite.state[STATE_KEY.MangaProviding.getMangaDetails] as SourceManga | undefined
            if (sourceManga) {
              params = [sourceManga]
            } else {
              throw new Error('No `sourceManga` provided in test data. Unable to infer from getMangaDetails')
            }
          }
          const chapters = await extension.getChapters(...params)
          expect(chapters).to.not.be.empty
          suite.state[STATE_KEY.ChapterProviding.getChapters] = chapters
        })
      }

      if (testData.chapterProviding?.getChapterDetails !== false) {
        suite.test('getChapterDetails', async () => {
          let params = testData.chapterProviding && testData.chapterProviding !== false
            ? testData.chapterProviding.getChapterDetails
            : undefined
          if (!params) {
            const chapters = suite.state[STATE_KEY.ChapterProviding.getChapters] as Chapter[] | undefined
            if (chapters?.[0]) {
              params = [chapters[0]]
            } else {
              throw new Error('No chapter provided. Unable to infer from getChapters')
            }
          }
          const chapterDetails = await extension.getChapterDetails(...params)
          expect(chapterDetails).to.not.be.undefined
          suite.state[STATE_KEY.ChapterProviding.getChapterDetails] = chapterDetails
        })
      }
    }
  }
}
