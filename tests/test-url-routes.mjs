/* eslint-env mocha */
import { expect } from 'chai'
import * as routes from '../library/url-routes.mjs'

describe('library/url-routes', () => {
  it('generates correct URLs', async () => {
    const config = { url: 'https://example.com/' }
    expect(routes.idgloss(config, 'foo has a bean?')).to.equal('https://example.com/dictionary/gloss/foo%20has%20a%20bean%3F.html')
    expect(routes.tagsList(config)).to.equal('https://example.com/dictionary/ajax/tags/')
    expect(routes.tagPage(config, 'foo', 3)).to.equal('https://example.com/dictionary/tag/foo/?query=&page=3')
  })
})
