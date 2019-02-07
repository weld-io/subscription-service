/**
 * fastly module
 * @description Fastly CDN module
 * @module cacheProviders/fastly
 *
 * All cacheProviders need: setKeyOnResponse, purgeContentByKey
 * Set env variables: FASTLY_API_TOKEN, FASTLY_ZONE_ID
 *
 */

'use strict'

const fastly = process.env.FASTLY_API_TOKEN
  ? require('fastly')(process.env.FASTLY_API_TOKEN)
  : { purgeKey: (zone, key) => console.log(`Dummy purge of ${zone}/${key}`) }

module.exports.setKeyOnResponse = (res, accountReference) => {
  res.header('Surrogate-Key', `Account:${accountReference}`)
}

module.exports.purgeContentByKey = async (accountReference) => new Promise(async (resolve, reject) => {
  fastly.purgeKey(process.env.FASTLY_ZONE_ID, `Account:${accountReference}`, (err, results) => {
    if (err) {
      console.error('Fastly purgeKey error: ', err)
      reject(err)
    } else {
      resolve(results)
    }
  })
})
