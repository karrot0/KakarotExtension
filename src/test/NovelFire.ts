import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { NovelFire } from '../NovelFire/main'
import sourceInfo from '../NovelFire/pbconfig'

export async function runTests() {
  const suite = new TestSuite('NovelFire tests')
  registerDefaultTests(suite, NovelFire, sourceInfo)

  await suite.run()
}
