import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { ReadComicsOnline } from '../ReadComicsOnline/main'
import sourceInfo from '../ReadComicsOnline/pbconfig'

export async function runTests() {
  const suite = new TestSuite('ReadComicsOnline tests')
  registerDefaultTests(suite, ReadComicsOnline, sourceInfo)

  await suite.run()
}
