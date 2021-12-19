/* eslint-env mocha */
import { expect } from 'chai'
import nock from 'nock'
import { fileURLToPath } from 'url'
import { join, resolve, dirname } from 'path'
import sanitize from 'sanitize-filename'
import scrapeSiteInfo from '../library/scrape-site-info.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function nockup (url) {
  const u = new URL(url)
  const filename = resolve(__dirname, join('sample-data', sanitize(url, { replacement: encodeURIComponent })))
  nock(u.origin).get(u.pathname + u.search).replyWithFile(200, `${filename}.html`)
}

describe('library/scrape-site-info', () => {
  const config = { url: 'https://auslan.org.au/' }

  it('has correct output', async () => {
    await nockup('https://auslan.org.au/')

    expect(await scrapeSiteInfo(config)).to.deep.equal({
      title: 'Auslan Signbank'
    })
  })
})
