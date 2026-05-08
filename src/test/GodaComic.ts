import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { GodaComic } from '../GodaComic/main'
import sourceInfo from '../GodaComic/pbconfig'

export async function runTests() {
  const suite = new TestSuite('GodaComic tests')
  registerDefaultTests(suite, GodaComic, sourceInfo)

  await suite.run()
}
