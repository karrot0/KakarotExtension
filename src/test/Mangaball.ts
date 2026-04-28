import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Mangaball } from '../Mangaball/main'
import sourceInfo from '../Mangaball/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Mangaball tests')
  registerDefaultTests(suite, Mangaball, sourceInfo)

  await suite.run()
}
