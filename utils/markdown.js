const path = require('path')
const markdownIt = require('markdown-it')

// Get config
const config = require('@config')

module.exports = markdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
})
  .use(require('markdown-it-imsize'))
