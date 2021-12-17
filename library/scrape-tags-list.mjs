import fetch from 'cross-fetch'
import * as urlRoutes from './url-routes.mjs'

/**
 * Query JSON AJAX interface of signbank for a list of available tags
 * @param {object} config
 * @returns {string[]} tags
 */
export default async function scrapeTagsList (config) {
  const response = await fetch(urlRoutes.tagsList(config))
  const json = await response.json()
  return json
}
