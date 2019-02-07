//
// Name:    accounts.js
// Purpose: Controller and routing for Account model
// Creator: Tom Söderlund
//

'use strict'

const mongooseCrudify = require('mongoose-crudify')
const helpers = require('../../config/helpers')
const Account = require('mongoose').model('Account')
const express = require('express')

// Private functions

const identifyingKey = 'reference'

const updatePartialSubscription = async function (req, res, next) {
  helpers.processAndRespond(res, new Promise(async (resolve, reject) => {
    try {
      const query = { reference: req.params.accountReference }
      const account = Account.update(query, { $set: req.body }, { upsert: true })
      resolve(account)
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
      beforeActions: [
      ],
      endResponseInAction: false,
      afterActions: [
        { middlewares: [helpers.sendRequestResponse] }
      ]
    })
  )

  const router = express.Router()
  app.use('/', router)

  router.patch('/api/accounts/:accountReference', updatePartialSubscription)
}
