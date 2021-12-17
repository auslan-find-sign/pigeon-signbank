# Pigeon Signbank

Pigeon Signbank is a tool for spidering [Auslan Signbank](https://www.auslan.org.au/) (and possibly other signbanks in the future). It's a refactoring of code pulled from the [@Bluebie/sign-search](https://github.com/Bluebie/sign-search) Find Sign project.

Aims:

 - Be gentle, don't overwhelm signbank server (It cannot handle any concurrency!)
 - Produce clean human and machine readable text files as output (YAML)
 - Incremental gentle continuous updates (similar to a GoogleBot)
 - Fully capture data available on gloss pages.
 - Capture tag data, and reconstruct tags where possible
 - Index every publically available gloss, both via Next Sign / Previous Sign button links, and via tags, to navigate around broken links and site glitches and grab everything.
 - Forward thinking, well labeled, understandable, correct data structures.
 - Resillient to website outages.

Non-aims:

 - It doesn't fully capture keyword ordering, and doesn't look at keyword pages
 - It doesn't detect rude word filtering because it doesn't interact with the Signbank search system. Rude signs are included in output.
 - It's unable to access private researcher-only data like morphology information.

Aspirations:

 - Soon, this will power the SignBank data on [find.auslan.fyi](https://find.auslan.fyi/)
 - Output of spider will be published somewhere on the fyi site, so you can just download it instead of running this tool yourself. The output will also be available in other formats like JSON, and flat files, and possibly diffs, to better allow efficient syncing (i.e. to desktop/mobile apps)
 - Some archaic morphology data maybe accessible by combining this dataset with the [Signs of Australia CD ROM](https://github.com/Bluebie/auslan-cd-data) data extraction, which shares the same ID Gloss system and is an ancestor of SignBank's corpus.

This tool is currently a work in progress. Once it's done and Find Sign is transitioned over, I will update this readme with information about where the output and mirror data can be accessed. My server can take a fair bit of abuse, so you should be able to grab a copy of signbank for your own research and experiments very quickly without causing any trouble.
