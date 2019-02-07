//
// Name:    accounts.js
// Purpose: Controller and routing for Account model
// Creator: Tom Söderlund
//

'use strict'

const _ = require('lodash')
const mongooseCrudify = require('mongoose-crudify')

const helpers = require('../../config/helpers')
const cacheProvider = helpers.getCacheProvider()
const Account = require('mongoose').model('Account')
const express = require('express')

// Private functions

const identifyingKey = 'reference'

const addCachingKey = function (req, res, next) {
  cacheProvider.setKeyOnResponse(res, _.get(req, 'crudify.account.reference'))
  next()
}

const updatePartialSubscription = async function (req, res, next) {
  helpers.processAndRespond(res, new Promise(async (resolve, reject) => {
    try {
      const query = { reference: req.params.accountReference }
      const results = Account.update(query, { $set: req.body }, { upsert: true })
      cacheProvider.purgeContentByKey(req.params.accountReference)
      resolve(results)
    } catch (err) {
      reject(err)
    }
  }))
}

// Public API

module.exports = function (app, config) {
  app.use(
    '/api/accounts',
    mongooseCrudify({
      Model: Account,
      identifyingKey: identifyingKey,
      endResponseInAction: false,
      afterActions: [
        { middlewares: [addCachingKey], only: ['read'] },
        { middlewares: [helpers.sendRequestResponse] }
      ]
    })
  )

  const router = express.Router()
  app.use('/', router)

  router.patch('/api/accounts/:accountReference', updatePartialSubscription)
}
