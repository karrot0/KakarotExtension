import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Hentai2read } from '../Hentai2read/main'
import sourceInfo from '../Hentai2read/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Hentai2read tests')
  registerDefaultTests(suite, Hentai2read, sourceInfo)

  await suite.run()
}
