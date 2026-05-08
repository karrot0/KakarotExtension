import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { Projectsuki } from '../Projectsuki/main'
import sourceInfo from '../Projectsuki/pbconfig'

export async function runTests() {
  const suite = new TestSuite('Projectsuki tests')
  registerDefaultTests(suite, Projectsuki, sourceInfo)

  await suite.run()
}
