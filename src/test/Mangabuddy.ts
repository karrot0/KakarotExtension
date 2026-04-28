import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Mangabuddy } from '../Mangabuddy/main'
import sourceInfo from '../Mangabuddy/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Mangabuddy tests')
  registerDefaultTests(suite, Mangabuddy, sourceInfo)

  await suite.run()
}
