const path = require('path')
const sharp = require('sharp')
const jsonfile = require('jsonfile')

// Get config
const config = require('@config')

// Asset shortcode for saving hashed media
const saveMedia = require('./media'),
  { hashContent } = saveMedia

// Sizes for responsive image in intervals of 320 i.e. 320, ..., 1920
const SIZES = Array.from(new Array(6), (_, index) => (index + 1) * 320)

// File to save responsive image cache
const CACHE_FILE = path.resolve('.picture.cache')

// Quality of outputted images
const QUALITY = 75

// Get image path from src
function getImagePath(src) {
  const index = src.indexOf(config.dir.media)
  const position = index >= 0 ? index + config.dir.media.length : 0
  const imageFilename = src.substring(position)
  return path.join(
    process.cwd(),
    config.dir.input,
    config.dir.media,
    imageFilename
  )
}

// Load cache from file or create new cache
function loadCache() {
  try {
    return jsonfile.readFileSync(CACHE_FILE)
  } catch {
    return {}
  }
}

// Save image as the given size and format
async function saveImageFormat(image, origWidth, format) {
  // Resize image and format with given quality
  const formatted = image.clone().resize(origWidth)[format]({
    quality: QUALITY,
  })

  // Save buffer of formatted image
  const buffer = await formatted.toBuffer()
  return saveMedia(buffer, format)
}

// Get the average color from an image
async function getAverageColor(image) {
  // Resize to one pixel and get raw buffer
  const buffer = await image.clone().resize(1).raw().toBuffer()
  // Convert values to percentages
  const values = [...buffer].map(
    (value) => `${((value * 100) / 255).toFixed(0)}%`
  )
  // Output rgb or rgba color
  return `${values.length < 4 ? 'rgb' : 'rgba'}(${values.join(',')})`
}

module.exports = async (
  src,
  alt,
  width = null,
  height = null,
  sizes = '90vw, (min-origWidth: 1280px) 1152px',
  loading = 'lazy'
) => {
  if (alt === undefined) {
    throw new Error('Images should always have an alt tag')
  }

  const imagePath = getImagePath(src)

  // Original image in sharp
  const original = sharp(imagePath)

  // Hash the original image
  const imageHash = hashContent(await original.toBuffer())

  // Load cache of resized images
  const cache = loadCache()
  const cachePicture = cache.hasOwnProperty(imageHash) && cache[imageHash]

  // Get metadata from original image
  const { format, height: origHeight, width: origWidth } = await original.metadata()

  // Average color used for background while image loads
  const color = await getAverageColor(original)

  // Save responsive images in same format
  // We need to await all these promises
  const sameFormatEntries = await Promise.all(
    SIZES.map(async (size) => {
      if (cachePicture && cachePicture.same.hasOwnProperty(size))
        return [size, cachePicture.same[size]]
      return [size, await saveImageFormat(original, size, format)]
    })
  )
  const sameFormat = Object.fromEntries(sameFormatEntries)

  // Image descriptor with origWidth
  const sameFormatDesc = Object.keys(sameFormat).map((size) => {
    return `${sameFormat[size]} ${size}w`
  })

  // Save responsive images in webp format
  const webpFormatEntries = await Promise.all(
    SIZES.map(async (size) => {
      if (cachePicture && cachePicture.webp.hasOwnProperty(size))
        return [size, cachePicture.webp[size]]
      return [size, await saveImageFormat(original, size, 'webp')]
    })
  )
  const webpFormat = Object.fromEntries(webpFormatEntries)

  // Image descriptor with origWidth
  const webpFormatDesc = Object.keys(webpFormat).map((size) => {
    return `${webpFormat[size]} ${size}w`
  })

  // Use largest same format image as fallback
  const fallback = sameFormat[SIZES[SIZES.length - 1]]

  // Aspect ratio for padding-bottom
  const ratio = ((origHeight / origWidth) * 100).toFixed(3)

  // Responsive picture with srcset and native lazy loading
  const picture = `
    <picture style="background-color:${color};padding-bottom:${ratio}%">
      <source srcset="${webpFormatDesc.join(
        ','
      )}" sizes="${sizes}" type="image/webp">
      <source srcset="${sameFormatDesc.join(
        ','
      )}" sizes="${sizes}" type="image/${format}">
      <img src="${fallback}" alt="${alt}" ${width ? `width="${width}"` : ''} ${
    height ? `height="${height}"` : ''
  } loading="${loading}">
    </picture>
  `

  // Add picture to cache
  cache[imageHash] = {
    same: sameFormat,
    webp: webpFormat,
  }

  // Save cache file
  jsonfile.writeFileSync(CACHE_FILE, cache, { spaces: 2 })

  return picture
}
