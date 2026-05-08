import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Batcave } from '../Batcave/main'
import sourceInfo from '../Batcave/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Batcave tests')
  registerDefaultTests(suite, Batcave, sourceInfo)

  await suite.run()
}
