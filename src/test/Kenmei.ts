import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Kenmei } from '../Kenmei/main'
import sourceInfo from '../Kenmei/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Kenmei tests')
  registerDefaultTests(suite, Kenmei, sourceInfo)

  await suite.run()
}
