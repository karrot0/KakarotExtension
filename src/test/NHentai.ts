import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { NHentai } from '../NHentai/main'
import sourceInfo from '../NHentai/pbconfig'

export async function runTests() {
  const suite = new TestSuite('NHentai tests')
  registerDefaultTests(suite, NHentai, sourceInfo)

  await suite.run()
}
