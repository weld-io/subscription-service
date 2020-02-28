//
// Name:    accounts.js
// Purpose: Controller and routing for Account model
// Creator: Tom Söderlund
//

'use strict'

const { get } = require('lodash')
const mongooseCrudify = require('mongoose-crudify')

const { getCacheProvider, processAndRespond, sendRequestResponse } = require('../../lib/helpers')
const Account = require('mongoose').model('Account')
const express = require('express')

// Private functions

const identifyingKey = 'reference'

const addCachingKey = function (req, res, next) {
  getCacheProvider().setKeyOnResponse(res, get(req, 'crudify.account.reference'))
  next()
}

const updatePartialSubscription = async function (req, res, next) {
  processAndRespond(res, new Promise(async (resolve, reject) => {
    try {
      const query = { reference: req.params.accountReference }
      const results = Account.update(query, { $set: req.body }, { upsert: true })
      getCacheProvider().purgeContentByKey(req.params.accountReference)
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
        { middlewares: [sendRequestResponse] }
      ]
    })
  )

  const router = express.Router()
  app.use('/', router)

  router.patch('/api/accounts/:accountReference', updatePartialSubscription)
}
