/* eslint-env mocha */
import { expect } from 'chai'
import nock from 'nock'
import { fileURLToPath } from 'url'
import { join, resolve, dirname } from 'path'
import sanitize from 'sanitize-filename'
import scrapeTagPage from '../library/scrape-tag-page.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function nockup (url) {
  const u = new URL(url)
  const filename = resolve(__dirname, join('sample-data', sanitize(url, { replacement: encodeURIComponent })))
  nock(u.origin).get(u.pathname + u.search).replyWithFile(200, `${filename}.html`)
}

describe('library/scrape-tag-page', () => {
  const config = { url: 'https://auslan.org.au/' }

  it('scrapes a single page tag results well', async () => {
    await nockup('https://auslan.org.au/dictionary/tag/semantic%3Asensing/?query=&page=1')

    expect(await scrapeTagPage(config, 'semantic:sensing')).to.deep.equal({
      tag: 'semantic:sensing',
      publicGlosses: ['deaf-and-dumb1a', 'explore', 'feel1a', 'fragrance1a', 'hear-of1a', 'hear.cup', 'look1a', 'notice-see', 'observe', 'pong', 'search', 'see1a', 'sense1a', 'sight1a', 'smell.WA', 'smell1a', 'sound', 'taste', 'taste-bad', 'touch1a', 'view1a', 'vision'],
      privateGlosses: ['flavour.SE', 'fragrance1b', 'smell-bad']
    })
  })

  it('scrapes multiple page tag results well', async () => {
    nockup('https://auslan.org.au/dictionary/tag/semantic%3Ajudge/?query=&page=1')
    nockup('https://auslan.org.au/dictionary/tag/semantic%3Ajudge/?query=&page=2')

    expect(await scrapeTagPage(config, 'semantic:judge')).to.deep.equal({
      tag: 'semantic:judge',
      publicGlosses: ['agree1a', 'awful-dismiss1a', 'awful-shameful', 'awful.NTH', 'bad', 'bad-luck', 'best', 'better', 'boring', 'choosy', 'common', 'cruel.STH', 'danger.sorry', 'different1a', 'difficult.hard', 'difficult1a', 'disagree', 'disapprove-of', 'disgusting', 'dislike', 'distinguished', 'easy1a', 'enough1a', 'excellent', 'expert1a', 'exquisite', 'fair', 'false1a', 'fond', 'funny-strange', 'good1a', 'hopeless', 'horrible1a', 'idiotic', 'important1a', 'impossible1a', 'impress1a', 'isolated', 'lazy', 'lousy', 'lucky1a', 'mental', 'mistake.NTH', 'natural1a', 'naughty', 'naughty.risque', 'no-harm', 'not-mind.QLD', 'not-my-responsibility', 'outstanding', 'parsimonious', 'peculiar', 'perhaps1a', 'possible', 'precise1a', 'proper', 'real', 'reasonable', 'regret', 'respect1b', 'ridiculous', 'right.correct1a', 'risky', 'rude.SA', 'rude1a', 'same1a', 'seem', 'serious1a', 'silly', 'silly-you', 'silly.WA', 'smart1a', 'specific', 'sticky-beak1a', 'stubborn', 'stupid', 'superb', 'terrible', 'trivial', 'unimportant', 'unusual', 'useless', 'weird', 'wild1b', 'wonderful1a', 'wrong'],
      privateGlosses: ['awful.SA', 'clever1c', 'guess.SE', 'guess1b', 'honest.SE', 'oppose1b', 'smell-bad', 'sycophant1b', 'wonderful.ASL', 'would.SE']
    })
  })

  it('returns undefined when server 404s or 500s', async () => {
    nock(config.url).get('/dictionary/tag/fake/?query=&page=1').reply(404)
    expect(await scrapeTagPage(config, 'fake')).to.equal(undefined)
    nock(config.url).get('/dictionary/tag/error/?query=&page=1').reply(500)
    expect(await scrapeTagPage(config, 'error')).to.equal(undefined)
  })

  it('returns undefined for non-existant 200 status tag pages', async () => {
    nockup('https://auslan.org.au/dictionary/tag/SEMANTIC/?query=&page=1')
    expect(await scrapeTagPage(config, 'SEMANTIC')).to.equal(undefined)
  })
})
