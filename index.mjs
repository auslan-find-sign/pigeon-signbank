import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import scrapeIDGloss from './library/scrape-idgloss.mjs'
import scrapeTagsList from './library/scrape-tags-list.mjs'
import scrapeTag from './library/scrape-tag-page.mjs'
import scrapeSiteInfo from './library/scrape-site-info.mjs'
import regionImagesMap from './library/region-images-map.mjs'
import XLSXWriteStream from 'xlsx-write-stream'
import fs from 'fs-extra'
import path from 'path'
import yaml from 'yaml'
import sanitize from 'sanitize-filename'
import parseDuration from 'parse-duration'
import './library/array-at-polyfill.mjs'
import { pipeline } from 'stream/promises'
import { read } from 'fs'

const { argv } = yargs(hideBin(process.argv))
  .option('url', {
    type: 'string',
    default: 'https://www.auslan.org.au',
    description: 'base url to SignBank service'
  })
  .option('tags-list', {
    type: 'boolean',
    description: 'spider the list of available tags, ignores expiry'
  })
  .option('tag', {
    type: 'array',
    description: 'specific tag or list of tags to spider, ignores expiry'
  })
  .option('id-gloss', {
    alias: 'g',
    type: 'array',
    description: 'spider a list of IDGlosses, ignores expiry'
  })
  .option('expiry', {
    alias: 'x',
    type: 'string',
    default: '7d',
    coerce: (str) => parseDuration(str),
    description: 'How old must information be, before it\'s old enough to be spidered again in autopilot mode'
  })
  .option('autopilot', {
    alias: 'a',
    type: 'boolean',
    description: 'Autopilot spiders any known information that is missing, and rechecks anything older than expiry'
  })
  .option('build-search-data', {
    alias: 'b',
    type: 'string',
    description: 'Build search data, write to specified path in find-sign search-data json format, takes a build config yaml file as input'
  })
  .option('build-flat-file', {
    alias: 'f',
    type: 'string',
    description: 'Path to build a flat json file at, which contains all the signs with tag data merged'
  })
  .option('export-spreadsheet', {
    type: 'string',
    description: 'Export an Excel .xlsx file to the specified path'
  })
  .option('storage', {
    alias: 's',
    type: 'string',
    default: './signbank-data',
    coerce: (basePath) => {
      const storagePath = path.resolve(basePath)
      return {
        base: storagePath,
        path (...args) {
          return path.join(storagePath, ...args.map(x => sanitize(`${x}`, { replacement: encodeURIComponent })))
        }
      }
    },
    description: 'filesystem location to store signbank spider output'
  })
  .option('cleanup', {
    type: 'boolean',
    description: 'Remove any unreferenced files in the storage path'
  })

async function shouldRefetch (config, ...path) {
  const filePath = config.storage.path(...path)
  try {
    const stats = await fs.stat(filePath)
    return (stats.mtimeMs < (Date.now() - config.expiry))
  } catch (err) {
    if (err.code === 'ENOENT') return true
    else throw err
  }
}

async function fetchTagsList (config) {
  const output = await scrapeTagsList(config)
  process.stdout.write(yaml.stringify({ type: 'tags-list', output }) + '...\n')
  await fs.ensureDir(config.storage.path())
  await fs.writeFile(config.storage.path('tags-list.yaml'), yaml.stringify(output))
  return output
}

async function fetchTagGraph (config, tag) {
  const output = await scrapeTag(config, tag)
  if (output) {
    process.stdout.write(yaml.stringify({ type: 'tag', output }) + '...\n')
    await fs.ensureDir(config.storage.path('tag'))
    await fs.writeFile(config.storage.path('tag', `${output.tag}.yaml`), yaml.stringify(output))
  } else {
    console.log('# tag results not available:', tag)
  }
  return output
}

async function fetchIDGloss (config, idGloss) {
  const output = await scrapeIDGloss(config, idGloss)
  if (output) {
    process.stdout.write(yaml.stringify({ type: 'id-gloss', output }) + '...\n')
    await fs.ensureDir(config.storage.path('id-gloss'))
    await fs.writeFile(config.storage.path('id-gloss', `${output.idGloss}.yaml`), yaml.stringify(output))
  } else {
    console.log('# id-gloss not available:', idGloss)
  }
  return output
}

async function fetchSiteInfo (config) {
  const output = await scrapeSiteInfo(config)
  if (output) {
    process.stdout.write(yaml.stringify({ type: 'site-info', output }) + '...\n')
    await fs.ensureDir(config.storage.path())
    await fs.writeFile(config.storage.path('site-info.yaml'), yaml.stringify(output))
  } else {
    console.log('# homepage not available')
  }
  return output
}

// take in a string, return an array of cleaned up words
function extractWords (text) {
  return `${text}`.split(/[^a-zA-Z0-9'’-]+/).map(x => x.trim()).filter(x => x.match(/^[a-zA-Z0-9'’-]+$/))
}

/**
 * Build's search-data.yaml file inside signbank-data directory, suitable for sign-search import
 * @param {object} config
 */
async function buildSearchData (config) {
  const read = async (...p) => yaml.parse((await fs.readFile(config.storage.path(...p))).toString('utf-8'))
  const siteInfo = await read('site-info.yaml')
  const idGlossList = await read('id-gloss-list.yaml')
  const tagGraph = await read('tag-graph.yaml')

  const searchData = {}
  for (const idGloss of idGlossList) {
    let doc
    try {
      doc = await read('id-gloss', `${idGloss}.yaml`)
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.info(`Omiting ${idGloss} due to missing id-gloss file`)
        continue
      } else {
        throw err
      }
    }

    searchData[idGloss] = {
      title: doc.keywords.join(', '),
      words: extractWords(doc.keywords.join(' ')),
      link: doc.pageURL,
      nav: [
        [siteInfo.title, config.url],
        ['Dictionary', (new URL('/dictionary/', config.url))],
        [`#${doc.signNumber} ${doc.idGloss}`, doc.pageURL]
      ],
      tags: [
        siteInfo.title.toLowerCase().replace(/[^a-z0-9]+/gmi, '-'),
        ...doc.regionImages.flatMap(imgUrl => regionImagesMap[imgUrl] || []),
        ...(doc.signedDefinitions.length > 0) ? ['described'] : [],
        ...tagGraph[idGloss]
      ].map(x => x.replace(/:/gmi, '.').replace(/[^a-zA-Z0-9.]+/gmi, '-')),
      body: doc.writtenDefinitions.flatMap(def =>
        `${def.title}:\n` + def.entries.map((x, i) => ` ${i + 1}. ${x}`).join('\n')
      ).slice(0, 6).join('\n'),
      media: [
        ...doc.signDemonstrations,
        ...doc.signedDefinitions
      ].map(media => ({
        method: 'fetch', ...(typeof media === 'string' ? { url: media } : { url: media.url, version: media.etag })
      })),
      provider: {
        id: siteInfo.title.toLowerCase().replace(/[^a-z0-9]+/gmi, '-'),
        name: siteInfo.title,
        verb: 'documented',
        link: config.url
      },
      timestamp: doc.timestamp
    }
  }

  await fs.writeFile(config['build-search-data'], JSON.stringify(searchData))
}

async function buildFlatFile (config) {
  const read = async (...p) => yaml.parse((await fs.readFile(config.storage.path(...p))).toString('utf-8'))
  const siteInfo = await read('site-info.yaml')
  const idGlossList = await read('id-gloss-list.yaml')
  const tagGraph = await read('tag-graph.yaml')

  const output = {}
  for (const idGloss of idGlossList) {
    const doc = await read('id-gloss', `${idGloss}.yaml`)

    output[idGloss] = {
      ...doc,
      regions: doc.regionImages.flatMap(imgUrl => regionImagesMap[imgUrl] || []),
      tags: tagGraph[idGloss] || [],
    }
  }

  await fs.writeFile(config['build-flat-file'], JSON.stringify(output))
}

/**
 * Reads IDGlosses from storage, outputs data that can be transformed in to an XLSX spreadsheet using xlsx-write-stream
 * @param {*} config
 */
async function * toXLSXData (config) {
  const read = async (...p) => yaml.parse((await fs.readFile(config.storage.path(...p))).toString('utf-8'))
  const idGlossList = await read('id-gloss-list.yaml')
  const tagGraph = await read('tag-graph.yaml')

  yield [
    'id gloss',
    'sign number',
    'keywords',
    'link',
    'region',
    'previous sign',
    'next sign',
    'tags',
    'updated date',
    'definitions text'
  ]

  for (const idGloss of idGlossList) {
    const doc = await read('id-gloss', `${idGloss}.yaml`)

    yield [
      doc.idGloss,
      doc.signNumber,
      doc.keywords.join(', '),
      doc.pageURL,
      doc.regionImages.filter(url =>
        url.includes('/static/img/maps/Auslan/')
      ).map(url =>
        url.split('/').at(-1).split('.')[0].replace('-traditional', '')
      ).join(', '),
      doc.previousSign,
      doc.nextSign,
      (tagGraph[doc.idGloss] || []).join(', '),
      new Date(doc.timestamp),
      doc.writtenDefinitions.flatMap(def =>
        `${def.title}:\n` + def.entries.map((x, i) => ` ${i + 1}. ${x}`).join('\n')
      ).join('\n\n')
    ]
  }
}

async function cleanup (config) {
  const read = async (...p) => yaml.parse((await fs.readFile(config.storage.path(...p))).toString('utf-8'))
  const idGlossList = (await read('id-gloss-list.yaml')).map(x => path.resolve(config.storage.path('id-gloss', `${x}.yaml`)))
  const tagsList = (await read('tags-list.yaml')).map(x => path.resolve(config.storage.path('tag', `${x}.yaml`)))

  let count = 0
  for (const file of await fs.readdir(config.storage.path('id-gloss'))) {
    const filePath = path.resolve(config.storage.path('id-gloss'), file)
    if (!idGlossList.includes(filePath)) {
      console.log(`# Removing id-gloss/${file}`)
      await fs.remove(filePath)
    }
  }

  for (const file of await fs.readdir(config.storage.path('tag'))) {
    const filePath = path.resolve(config.storage.path('tag'), file)
    if (!tagsList.includes(filePath)) {
      console.log(`# Removing tag/${file}`)
      await fs.remove(filePath)
    }
  }
}

async function run () {
  // scrape list of available known tags
  if (argv['tags-list']) {
    await fetchTagsList(argv)
  }

  // scrape specific tag as requested
  for (const tagName of (argv.tag || [])) {
    await fetchTagGraph(argv, tagName)
  }

  // scrape any individual id-glosses specified
  for (const idGloss of (argv['id-gloss'] || [])) {
    await fetchIDGloss(argv, idGloss)
  }

  if (argv.autopilot) {
    // get site info
    if (await shouldRefetch(argv, 'site-info.yaml')) {
      console.log('# Loading site info')
      await fetchSiteInfo(argv)
    }

    // get tags list
    if (await shouldRefetch(argv, 'tags-list.yaml')) {
      console.log('# Loading list of tags')
      await fetchTagsList(argv)
    }

    const tagFileData = await fs.readFile(argv.storage.path('tags-list.yaml'))
    const tags = yaml.parse(tagFileData.toString('utf-8'))

    // update tag graph
    for (const tag of tags) {
      if (await shouldRefetch(argv, 'tag', `${tag}.yaml`)) {
        console.log(`# Loading tag graph for tag "${tag}"`)
        await fetchTagGraph(argv, tag)
      }
    }

    // discover all known, published, public id-glosses... this could take a moment...
    console.log('# Analysing data for every known IDGloss. This could take a moment...')
    const idGlossSet = new Set()
    const tagGraph = {}
    // first scan through all of the tag listings
    for (const tag of tags) {
      let fileData
      try {
        fileData = await fs.readFile(argv.storage.path('tag', `${tag}.yaml`))
      } catch (err) {
        if (err.code === 'ENOENT') continue
        else throw err
      }
      const doc = yaml.parse(fileData.toString('utf-8'))
      for (const gloss of doc.publicGlosses) {
        idGlossSet.add(gloss)
        if (!tagGraph[gloss]) tagGraph[gloss] = []
        if (!tagGraph[gloss].includes(doc.tag)) tagGraph[gloss].push(doc.tag)
      }
    }

    // read through every id-gloss and check for nextGloss and previousGloss values too, to
    // discover untagged entries
    await fs.ensureDir(argv.storage.path('id-gloss'))
    for (const idGloss of idGlossSet) {
      const glossPath = argv.storage.path('id-gloss', `${idGloss}.yaml`)
      if (await fs.pathExists(glossPath)) {
        const fileData = await fs.readFile(glossPath)
        const doc = yaml.parse(fileData.toString('utf-8'))
        if (doc.nextGloss) idGlossSet.add(doc.nextGloss)
        if (doc.previousGloss) idGlossSet.add(doc.previousGloss)
      }
    }

    console.log('# Analysis complete, spidering any missing or out of date IDGlosses...')

    let allDone = false
    while (!allDone) {
      allDone = true // optimistic...
      for (const idGloss of idGlossSet) {
        if (await shouldRefetch(argv, 'id-gloss', `${idGloss}.yaml`)) {
          console.log(`# Fetching IDGloss "${idGloss}"`)
          const doc = await fetchIDGloss(argv, idGloss)
          if (doc) {
            if (doc.nextGloss) idGlossSet.add(doc.nextGloss)
            if (doc.previousGloss) idGlossSet.add(doc.previousGloss)
            allDone = false // dirty, need to recheck at the end to see if we're finished
          }
        }
      }
    }

    // save out a list of IDGlosses that are still present, so we know which files are still included in the dataset
    await fs.writeFile(argv.storage.path('id-gloss-list.yaml'), yaml.stringify([...idGlossSet]))

    // ensure tag graph has entries for every current id-gloss, even if they're empty
    for (const idGloss of idGlossSet) {
      if (!tagGraph[idGloss]) tagGraph[idGloss] = []
    }

    // save tag graph
    await fs.writeFile(argv.storage.path('tag-graph.yaml'), yaml.stringify(tagGraph))

    console.log('# All done! Should have everything now!')
  }

  if (argv['build-search-data']) {
    await buildSearchData(argv)
  }

  if (argv['build-flat-file']) {
    await buildFlatFile(argv)
  }

  if (argv['export-spreadsheet']) {
    console.log('# Exporting spreadsheet...')
    await pipeline([
      toXLSXData(argv),
      new XLSXWriteStream(),
      fs.createWriteStream(argv['export-spreadsheet'])
    ])
  }

  if (argv['cleanup']) {
    await cleanup(argv)
  }
}

run()
