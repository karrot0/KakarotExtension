import { TestSuite, registerDefaultTests } from '@paperback/types/lib/impl/TestDefinition.js'
import { LeagueOfComicGeeks } from '../LeagueOfComicGeeks/main'
import sourceInfo from '../LeagueOfComicGeeks/pbconfig'

export async function runTests() {
  const suite = new TestSuite('LeagueOfComicGeeks tests')
  registerDefaultTests(suite, LeagueOfComicGeeks, sourceInfo)

  await suite.run()
}
