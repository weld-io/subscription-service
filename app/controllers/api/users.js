//
// Name:    users.js
// Purpose: Controller and routing for User model
// Creator: Tom Söderlund
//

'use strict'

const _ = require('lodash')
const async = require('async')
const mongooseCrudify = require('mongoose-crudify')

const helpers = require('../../config/helpers')
const cacheProvider = helpers.getCacheProvider()
const User = require('mongoose').model('User')
const Account = require('mongoose').model('Account')
const Plan = require('mongoose').model('Plan')

// Private functions

const identifyingKey = 'reference'

const addPlans = function (req, res, next) {
  req.crudify.user.getSubscriptionPlans({ includeAllSubscriptions: _.get(req, 'query.includeAllSubscriptions') }, (err, { subscriptions, subscriptionsWithPlan }) => {
    req.crudify.result = helpers.toJsonIfNeeded(req.crudify.result)
    req.crudify.result.account.subscriptions = subscriptionsWithPlan
    req.crudify.result.plans = _.map(subscriptionsWithPlan, subscriptionPlan => subscriptionPlan.plan.reference)
    next()
  })
}

const addServices = function (req, res, next) {
  req.crudify.user.getServices((err, services) => {
    req.crudify.result = helpers.toJsonIfNeeded(req.crudify.result)
    req.crudify.result.services = services
    next()
  })
}

const addCachingKey = function (req, res, next) {
  cacheProvider.setKeyOnResponse(res, _.get(req, 'crudify.user.account.reference'))
  next()
}

const createSubscription = function (req, res, next) {
  if (req.body.subscription) {
    async.parallel({
      account: Account.findById.bind(Account, req.body.account),
      plan: Plan.findOne.bind(Plan, { reference: req.body.subscription.plan })
    },
    // When all done
    function (err, results) {
      if (!err) {
        const subscription = _.clone(req.body.subscription)
        subscription.plan = results.plan._id
        subscription.dateExpires = helpers.getDateExpires(req.body.subscription)
        results.account.subscriptions.push(helpers.toJsonIfNeeded(subscription))
        results.account.save(next)
      } else {
        next(err)
      }
    }
    )
  } else {
    next()
  }
}

// Public API

module.exports = function (app, config) {
  app.use(
    '/api/users',
    mongooseCrudify({
      Model: User,
      identifyingKey: identifyingKey,
      beforeActions: [
        { middlewares: [helpers.checkIfAuthorizedUser.bind(this, undefined)], except: ['create'] }, // Apply to all CRUD operations except Create
        { middlewares: [
          helpers.changeReferenceToId.bind(this, { modelName: 'Account', parentProperty: 'account', childIdentifier: 'reference' }),
          createSubscription
        ],
        only: ['create', 'update'] },
        { middlewares: [helpers.populateProperties.bind(this, { modelName: 'user', propertyName: 'account' })], only: ['read'] }
      ],
      endResponseInAction: false,
      afterActions: [
        { middlewares: [addPlans, addServices, addCachingKey], only: ['read'] },
        { middlewares: [helpers.sendRequestResponse] }
      ]
    })
  )
}
