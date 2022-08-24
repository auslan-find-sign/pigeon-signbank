import fetch from './fetch.mjs'
import { get } from 'pigeonmark-utils'
import { selectAll, selectOne } from 'pigeonmark-select'
import HTML from 'pigeonmark-html'
import unslice from './unslice.mjs'
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
 * Scrape IDGloss public page, returns everything useful extracted from the html
 * @param {object} config
 * @param {string} idgloss
 * @returns {object} data from IDGloss public page
 */
export default async function scrapeIDGloss (config, idgloss) {
  const pageURL = urlRoutes.idgloss(config, idgloss)
  const response = await fetch(pageURL)
  if (!response.ok) return undefined
  const doc = HTML.decode(await response.text())
  const main = selectOne(doc, 'div[role=main]')
  const signinfo = selectOne(main, 'div#signinfo')
  const defblock = selectOne(main, 'div#definitionblock')

  // get string list of keywords
  const keywordsString = unslice(get.text(selectOne(defblock, '#keywords')).replace(/[\n\t ]+/g, ' ').trim().split(': ')[1])
  const keywords = keywordsString.split(',').map(x => x.trim())

  // note down any region images
  const regionImages = selectAll(defblock, '#states img').map(image => relativeLink(pageURL, unslice(get.attribute(image, 'src'))))

  // extract video urls
  const videoURLs = selectAll(defblock, 'video source').map(source => relativeLink(pageURL, unslice(get.attribute(source, 'src'))))

  const videoInfos = await Promise.all(videoURLs.map(async url => {
    const response = await fetch(relativeLink(pageURL, url), { method: 'HEAD' })
    return {
      url,
      available: response.ok,
      lastModified: response.headers.get('Last-Modified'),
      etag: response.headers.get('ETag'),
      contentType: response.headers.get('Content-Type'),
      contentLength: parseInt(response.headers.get('Content-Length'))
    }
  }))

  const output = {
    signNumber: parseInt(get.text(selectOne(signinfo, 'button.btn.navbar-btn:contains("Sign"):contains("of")')).trim().slice(5)),
    idGloss: decodeURIComponent(filenameFromURL(pageURL, '.html')),
    pageURL: pageURL,
    keywords,
    regionImages,
    signDemonstrations: videoInfos.filter(({ url }) => !url.match(/Definition/)),
    signedDefinitions: videoInfos.filter(({ url }) => url.match(/Definition/)),
    writtenDefinitions: selectAll(defblock, 'div.definition-panel').map(panel => {
      const title = unslice(get.text(selectOne(panel, 'h3.panel-title')).trim())

      const entryDivs = selectAll(panel, 'div.definition-entry > div')
      const entries = entryDivs.map(div => get.childNodes(div).filter(x => get.type(x) === 'text').map(x => unslice(get.text(x).trim())).join(' ').trim())
      return { title, entries }
    }),
    previousSign: filenameFromURL(relativeLink(pageURL, unslice(get.attribute(selectOne(signinfo, 'a.btn:contains("Previous Sign")'), 'href'))), '.html'),
    nextSign: filenameFromURL(relativeLink(pageURL, unslice(get.attribute(selectOne(signinfo, 'a.btn:contains("Next Sign")'), 'href'))), '.html')
  }

  // discover timestamp from Last Modified header on video
  if (videoInfos.length > 0) {
    output.timestamp = Math.max(...videoInfos.map(x => Date.parse(x.lastModified)))
  }

  return output
}
