import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Rawkuma } from '../Rawkuma/main'
import sourceInfo from '../Rawkuma/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Rawkuma tests')
  registerDefaultTests(suite, Rawkuma, sourceInfo)

  await suite.run()
}
