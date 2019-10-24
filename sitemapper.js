'use strict'

const http = require("hittp")
const stream = require("stream")
const robots = require("./robots")
const url2date = require("./url2date")
const URLStream = require("./urlstream")

class SiteMapper {

  constructor() {
    this.outcount = 0
  }

  map = async (url, since) => {
    return new Promise((resolve, reject) => {
      let date = null
      if (typeof(since) === "string") {
        date = Date.parse(since)
        if (!date || isNaN(date)) throw new Error("Invalid date for 'since' parameter")
      } else {
        date = since
      }
      robots.getSitemaps(url).then((sitemapurls) => {
        if (sitemapurls.length === 0) {
          if (typeof(url) === "string") {
            sitemapurls.push(`${url}/sitemap.xml`)
            sitemapurls.push(`${url}/sitemap_index.xml`)
          } else if (url.origin) {
            sitemapurls.push(`${url.origin}/sitemap.xml`)
            sitemapurls.push(`${url.origin}/sitemap_index.xml`)
          }
        }
        const outstream = stream.PassThrough({autoDestroy: true})
        resolve(outstream)
        for (const sitemapurl of sitemapurls) {
          this.get(sitemapurl, date).then((sitemapstream) =>  {
            sitemapstream.pipe(outstream)
            // console.log(sitemapstream)
          }).catch((err) => {
            console.error(err.message, sitemapurl)
          })
        }
      }).catch((err) => {
        reject(err)
      })
    })
  }

  get = async (url, since) => {
    return new Promise((resolve, reject) => {
      if (typeof(url) === "string") url = http.str2url(url)
      if (!url) reject(new Error("Invalid URL"))
      if (url.pathname.endsWith(".gz")) {
        url.pathname = url.pathname.slice(0, -3)
      }
      this._getRecursive(url, since).then((sitemapstream) => {
        resolve(sitemapstream)
      }).catch((err) => {
        reject(err)
      })
    })
  }

  _getRecursive = async (url, since, outstream=null) => {
    this.outcount += 1
    return new Promise((resolve, reject) => {
      this._get(url, since).then((urlstream) => {
        if (!outstream) {
          outstream = new stream.PassThrough()
          resolve(outstream)
        }
        urlstream.on("sitemap", (sitemapurl) => {
          this._getRecursive(sitemapurl, since, outstream).catch((err) => {})
        })
        urlstream.pipe(outstream, {end:false})
      }).catch((err) => {
        // console.log("urlstream error", this.outcount)
        this.outcount -= 1
        if (this.outcount == 0) {
          if (outstream) outstream.end()
        }
        reject(err)
      })
    })
  }

  _get = async (url, since) => {
    return new Promise((resolve, reject) => {
      http.stream(url, {timeout_ms: 10000}).then((httpstream) => {
        const urlstream = new URLStream(since)
        resolve(httpstream.pipe(urlstream))
      }).catch((err) => {
        reject(err)
      })
    })
  }

  configure = (options) => {
    http.configure(options)
  }
}

module.exports = {
  SiteMapper
}