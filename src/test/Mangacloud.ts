import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Mangacloud } from '../Mangacloud/main'
import sourceInfo from '../Mangacloud/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Mangacloud tests')
  registerDefaultTests(suite, Mangacloud, sourceInfo)

  await suite.run()
}
