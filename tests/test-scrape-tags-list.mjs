/* eslint-env mocha */
import { expect } from 'chai'
import nock from 'nock'
import { fileURLToPath } from 'url'
import { join, resolve, dirname } from 'path'
import sanitize from 'sanitize-filename'
import scrapeTagsList from '../library/scrape-tags-list.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function nockup (url) {
  const u = new URL(url)
  const filename = resolve(__dirname, join('sample-data', sanitize(url, { replacement: encodeURIComponent })))
  nock(u.origin).get(u.pathname + u.search).replyWithFile(200, `${filename}.html`)
}

describe('library/scrape-tags-list', () => {
  it('scrapes tags list', async () => {
    const config = { url: 'https://auslan.org.au/' }
    await nockup('https://auslan.org.au/dictionary/ajax/tags/')

    expect(await scrapeTagsList(config)).to.deep.ordered.equal([
      'SEMANTIC', 'b92:directional', 'b92:regional', 'corpus:attested', 'handed', 'iconicity:obscure', 'iconicity:opaque',
      'iconicity:translucent', 'iconicity:transparent', 'lexis:battinson', 'lexis:classifier', 'lexis:crude', 'lexis:doubtlex',
      'lexis:fingerspell', 'lexis:gensign', 'lexis:marginal', 'lexis:obsolete', 'lexis:proper name', 'lexis:regional',
      'lexis:restricted lexeme', 'lexis:signed english', 'lexis:signed english only', 'lexis:technical', 'lexis:varlex',
      'morph:begin directional sign', 'morph:body locating', 'morph:directional sign', 'morph:end directional sign',
      'morph:locational and directional', 'morph:orientating sign', 'phonology:alternating', 'phonology:dominant hand only',
      'phonology:double', 'phonology:double handed', 'phonology:forearm rotation', 'phonology:handshape change', 'phonology:onehand',
      'phonology:parallel', 'phonology:symmetrical', 'phonology:two', 'phonology:two handed', 'religion:catholic',
      'religion:catholic school', 'religion:jehovas witness', 'religion:other', 'religion:religion', 'school', 'school:state school',
      'semantic:animal', 'semantic:arithmetic', 'semantic:arts', 'semantic:bodypart', 'semantic:car', 'semantic:city',
      'semantic:clothing', 'semantic:color', 'semantic:cooking', 'semantic:day', 'semantic:deaf', 'semantic:drink',
      'semantic:education', 'semantic:family', 'semantic:feel', 'semantic:food', 'semantic:furniture', 'semantic:government',
      'semantic:groom', 'semantic:health', 'semantic:judge', 'semantic:language act', 'semantic:law', 'semantic:material',
      'semantic:metalg', 'semantic:mind', 'semantic:money', 'semantic:nature', 'semantic:number', 'semantic:order',
      'semantic:people', 'semantic:physical act', 'semantic:quality', 'semantic:quantity', 'semantic:question',
      'semantic:recreation', 'semantic:rooms', 'semantic:salutation', 'semantic:sensing', 'semantic:sexuality', 'semantic:shapes',
      'semantic:shopping', 'semantic:sport', 'semantic:telecommunications', 'semantic:time', 'semantic:travel', 'semantic:utensil',
      'semantic:weather', 'semantic:work', 'state', 'state school', 'workflow:needs video', 'workflow:problematic', 'workflow:redo video'
    ])
  })
})
