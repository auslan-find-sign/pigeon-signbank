import fetch from 'cross-fetch'
import { get } from 'pigeonmark-utils'
import { selectAll, selectOne } from 'pigeonmark-select'
import HTML from 'pigeonmark-html'
import * as urlRoutes from './url-routes.mjs'
import './array-at-polyfill.mjs'

// polyfill Array#at() on old platforms
// if (!Array.prototype.at) {
//   // eslint-disable-next-line no-extend-native
//   Object.defineProperty(Array.prototype, 'at', {
//     value: function (index) {
//       const O = Object(this)
//       return (index < 0) ? O[O.length + index] : O[index]
//     }
//   })
// }

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

// take in a string, return an array of cleaned up words
function extractWords (text) {
  return `${text}`.split(/[^a-zA-Z0-9'’-]+/).map(x => x.trim()).filter(x => x.match(/^[a-zA-Z0-9'’-]+$/))
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
  const keywordsString = get.text(selectOne(defblock, '#keywords')).replace(/[\n\t ]+/g, ' ').trim().split(': ')[1]
  const keywords = extractWords(keywordsString)

  // note down any region images
  const regionImages = selectAll(defblock, '#states img').map(image => relativeLink(pageURL, get.attribute(image, 'src')))

  // extract video urls
  const videoURLs = selectAll(defblock, 'video source').map(source => relativeLink(pageURL, get.attribute(source, 'src')))

  const output = {
    signNumber: parseInt(get.text(selectOne(signinfo, 'button.btn.navbar-btn:contains("Sign"):contains("of")')).trim().slice(5)),
    idGloss: decodeURIComponent(filenameFromURL(pageURL, '.html')),
    pageURL: pageURL,
    keywords,
    regionImages,
    signDemonstrations: videoURLs.filter(obj => !obj.match(/Definition/)),
    signedDefinitions: videoURLs.filter(obj => obj.match(/Definition/)),
    writtenDefinitions: selectAll(defblock, 'div.definition-panel').map(panel => {
      const title = get.text(selectOne(panel, 'h3.panel-title')).trim()

      const entryDivs = selectAll(panel, 'div.definition-entry > div')
      const entries = entryDivs.map(div => get.childNodes(div).filter(x => get.type(x) === 'text').map(x => get.text(x).trim()).join(' ').trim())
      return { title, entries }
    }),
    previousSign: filenameFromURL(relativeLink(pageURL, get.attribute(selectOne(signinfo, 'a.btn:contains("Previous Sign")'), 'href')), '.html'),
    nextSign: filenameFromURL(relativeLink(pageURL, get.attribute(selectOne(signinfo, 'a.btn:contains("Next Sign")'), 'href')), '.html')
  }

  // discover timestamp from Last Modified header on video
  if (output.signDemonstrations.length > 0) {
    const videoResponse = await fetch(output.signDemonstrations[0], { method: 'HEAD' })
    if (videoResponse.ok && videoResponse.headers.has('last-modified')) {
      output.timestamp = Date.parse(videoResponse.headers.get('last-modified'))
    }
  }

  return output
}
