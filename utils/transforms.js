const htmlmin = require('html-minifier')
const { JSDOM } = require('jsdom')
const picture = require('./picture')

module.exports = {
  htmlmin: (content, outputPath) => {
    // bail if not production env
    if (process.env.ELEVENTY_ENV !== 'production') {
      return content
    }

    // returned minified content from html files
    if (outputPath && outputPath.endsWith('.html')) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      })

      return minified
    }

    return content
  },

  picture: async (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith('.html')) {
      return content
    }

    const dom = new JSDOM(content)
    const document = dom.window.document
    const images = [...document.querySelectorAll('img:not(picture img)')]

    if (images.length === 0) {
      return content
    }

    await Promise.all(images.map(async (img) => {
      const src = img.getAttribute('src')
      const alt = img.getAttribute('alt')
      
      // Skip if no src or absolute url or gif
      if (!src || src.match(/^([A-Za-z]+:\/\/|\/\/)/) || src.endsWith('.gif')) {
        return
      }

      try {
        const width = img.getAttribute('width') || null
        const height = img.getAttribute('height') || null
        const sizes = img.getAttribute('sizes') || undefined
        const loading = img.getAttribute('loading') || undefined

        const pictureTag = await picture(src, alt, width, height, sizes, loading)
        img.outerHTML = pictureTag
      } catch (e) {
        console.error(`Error classifying image ${src}:`, e)
      }
    }))

    return dom.serialize()
  },
}
