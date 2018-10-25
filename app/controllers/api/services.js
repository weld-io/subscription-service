//
// Name:    services.js
// Purpose: Controller and routing for Service model
// Creator: Tom Söderlund
//

'use strict'

const mongooseCrudify = require('mongoose-crudify')
const helpers = require('../../config/helpers')
const Service = require('mongoose').model('Service')

// Private functions

const identifyingKey = 'reference'

// Public API

module.exports = function (app, config) {
  app.use(
    '/api/services',
    mongooseCrudify({
      Model: Service,
      identifyingKey: identifyingKey,
      beforeActions: [
      ],
      endResponseInAction: false,
      afterActions: [
        { middlewares: [helpers.sendRequestResponse] }
      ]
    })
  )
}
