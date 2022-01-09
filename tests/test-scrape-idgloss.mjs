/* eslint-env mocha */
import { expect } from 'chai'
import nock from 'nock'
import { fileURLToPath } from 'url'
import { join, resolve, dirname } from 'path'
import sanitize from 'sanitize-filename'
import scrapeIDGloss from '../library/scrape-idgloss.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function nockup (url) {
  const u = new URL(url)
  const filename = resolve(__dirname, join('sample-data', sanitize(url, { replacement: encodeURIComponent })))
  nock(u.origin).get(u.pathname + u.search).replyWithFile(200, `${filename}.html`)
}

describe('library/scrape-idgloss', () => {
  const config = { url: 'https://auslan.org.au/' }

  it('scrapes a single id-gloss page', async () => {
    await nockup('https://auslan.org.au/dictionary/gloss/anything1a.html')
    // mockup the video head request too
    nock('https://media.auslan.org.au/').head('/mp4video/28/28000_1.mp4').reply(200, '', {
      'Last-Modified': 'Tue, 08 Dec 2020 06:23:52 GMT',
      'ETag': '"5fcf1bf8-b5622"',
      'Content-Length': '742946',
      'Content-Type': 'video/mp4'
    })

    expect(await scrapeIDGloss(config, 'anything1a')).to.deep.equal({
      signNumber: 1877,
      idGloss: 'anything1a',
      pageURL: 'https://auslan.org.au/dictionary/gloss/anything1a.html',
      keywords: ['whatever', 'any', 'anything', 'anyway', 'anywhere', 'anytime', 'anyone', 'anything'],
      regionImages: [
        'https://auslan.org.au/static/img/maps/Auslan.1b91048fff02.png',
        'https://auslan.org.au/static/img/maps/Auslan/AustraliaWide-traditional.1c3fd2ba0f52.png'
      ],
      signDemonstrations: [
        {
          url: 'https://media.auslan.org.au/mp4video/28/28000_1.mp4',
          available: true,
          lastModified: 'Tue, 08 Dec 2020 06:23:52 GMT',
          etag: '"5fcf1bf8-b5622"',
          contentType: 'video/mp4',
          contentLength: 742946
        }
      ],
      signedDefinitions: [],
      writtenDefinitions: [
        {
          title: 'As a Noun',
          entries: ['A thing, an event, or an idea which is not a particular one of its kind. English = anything.']
        },
        {
          title: 'As a Verb or Adjective',
          entries: [
            'To be a thing, event, or idea which is not particular or special in ' +
            'some way. You use it immediately before a noun to mean one (or more) ' +
            'of that thing, but not necessarily a particular one or particular ' +
            'ones. That is, you use it when referring to something or someone ' +
            'without saying exactly when, where, what, who, or which kind you mean. ' +
            'English = any, (be) any; anywhere, anytime, anyone, anything.',

            'That is, you use it when referring to something or someone without ' +
            'saying exactly what, who, or which kind you mean. English = any, (be) ' +
            'any; anywhere, anytime, anyone, anything.'
          ]
        },
        {
          title: 'Interactive',
          entries: [
            'Used alone to say that something is the case in all possible ' +
            'circumstances. You think that this is very obvious and that the person ' +
            'you are talking to should have known this already. English = ' +
            "'Whatever!', 'Absolutely!'",

            'Used alone to mean that you completely agree with someone, more ' +
            'because you want to end the conversation than that you are convinced ' +
            "the facts. English = 'Whatever!', 'Have it your way!' and so on."
          ]
        }
      ],
      previousSign: 'lot-heavy',
      nextSign: 'lonely1a',
      timestamp: 1607408632000
    })
  })

  it('returns undefined when server 404s or 500s', async () => {
    nock(config.url).get('/dictionary/gloss/fake.html').reply(404)
    expect(await scrapeIDGloss(config, 'fake')).to.equal(undefined)
    nock(config.url).get('/dictionary/gloss/error.html').reply(500)
    expect(await scrapeIDGloss(config, 'error')).to.equal(undefined)
  })
})
