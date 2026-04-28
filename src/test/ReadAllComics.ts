import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { ReadAllComics } from '../ReadAllComics/main'
import sourceInfo from '../ReadAllComics/pbconfig'

export async function runTests() {
  const suite = new TestSuite('ReadAllComics tests')
  registerDefaultTests(suite, ReadAllComics, sourceInfo)

  await suite.run()
}
