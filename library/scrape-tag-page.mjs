import fetch from 'cross-fetch'
import { get } from 'pigeonmark-utils'
import { selectAll, selectOne } from 'pigeonmark-select'
import HTML from 'pigeonmark-html'
import * as urlRoutes from './url-routes.mjs'
import './array-at-polyfill.mjs'

// takes in the current page URL as a string, and a link url, and combines them, returning a new string url
// which accurately calculates any relative paths with path fragment hrefs
function relativeLink (base, relativePath) {
  const link = new URL(relativePath, base)
  link.hash = ''
  return link.toString()
}

// accepts a full absolute url (perhaps constructed with relativeLink())
// and returns a basename - the filename ignoring extension and directories
function filenameFromURL (url, extension = '.html') {
  const link = new URL(url)
  let file = link.pathname.split('/').at(-1)
  if (file.endsWith(extension)) file = file.slice(0, -extension.length)
  return decodeURIComponent(file)
}

/**
 * Scrape tag listing page, returns tag, page number, and all the IDGlosses on that page
 * @param {object} config
 * @param {string} tag
 * @param {number} pageNum
 * @returns {object} data from IDGloss public page
 */
export async function scrapeTagPage (config, tag, pageNum) {
  const pageURL = urlRoutes.tagPage(config, tag, pageNum)
  const response = await fetch(pageURL, { headers: { 'user-agent': '@auslan-find-sign/pigeon-signbank' } })
  if (!response.ok) return undefined
  const doc = HTML.decode(await response.text())

  const activeTag = selectOne(doc, '#activetag a')

  return {
    tag: decodeURIComponent(get.attribute(activeTag, 'href').match(/\/dictionary\/tag\/([^/]+)\//i)[1]),
    pageNum: parseInt(get.text(selectOne(doc, '#searchresults > p > strong') || '1')),
    totalPages: Math.max(1, ...selectAll(doc, '#searchresults > p > *').map(x => parseInt(get.text(x)))),
    publicGlosses: selectAll(doc, '#searchresults > table p:not(:contains("*")) > a').map(a =>
      decodeURIComponent(filenameFromURL(relativeLink(pageURL, get.attribute(a, 'href')), '.html'))
    ),
    privateGlosses: selectAll(doc, '#searchresults > table p:contains("*") > a').map(a =>
      decodeURIComponent(filenameFromURL(relativeLink(pageURL, get.attribute(a, 'href')), '.html'))
    )
  }
}

/**
 * Scrape a tag page, and continue scraping every pageNum available, merging results
 * @param {object} config
 * @param {string} tag
 * @returns {object}
 */
export default async function scrapeTag (config, tag) {
  let page = await scrapeTagPage(config, tag, 1)
  if (!page) return undefined
  const output = { tag: page.tag, publicGlosses: [...page.publicGlosses], privateGlosses: [...page.privateGlosses] }

  while (page.pageNum < page.totalPages) {
    page = await scrapeTagPage(config, tag, page.pageNum + 1)
    if (!page) return undefined
    output.publicGlosses.push(...page.publicGlosses)
    output.privateGlosses.push(...page.privateGlosses)
  }

  return output
}
