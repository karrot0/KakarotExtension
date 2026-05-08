import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Elftoon } from '../Elftoon/main'
import sourceInfo from '../Elftoon/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Elftoon tests')
  registerDefaultTests(suite, Elftoon, sourceInfo)

  await suite.run()
}
