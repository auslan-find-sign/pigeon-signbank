import fetch from './fetch.mjs'
import { get } from 'pigeonmark-utils'
import { selectOne } from 'pigeonmark-select'
import HTML from 'pigeonmark-html'
import unslice from './unslice.mjs'
import './array-at-polyfill.mjs'

/**
 * Scrape site hoempage and gather info about the target site
 * @param {object} config
 * @returns {object} info about the site
 */
export default async function scrapeSiteInfo (config) {
  const response = await fetch(config.url)
  if (!response.ok) return undefined
  const doc = HTML.decode(await response.text())

  const welcomeHeading = selectOne(doc, 'h1 > span:contains("Welcome to")')
  const title = unslice(get.text(welcomeHeading).trim().slice('Welcome to'.length).trim())

  return { title }
}
