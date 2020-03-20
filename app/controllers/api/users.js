//
// Name:    users.js
// Purpose: Controller and routing for User model
// Creator: Tom Söderlund
//

'use strict'

const { clone, get, map } = require('lodash')
const async = require('async')
const mongooseCrudify = require('mongoose-crudify')

const { changeReferenceToId, checkIfAuthorizedUser, getCacheProvider, getDateExpires, populateProperties, sendRequestResponse, toJsonIfNeeded } = require('../../lib/helpers')
const User = require('mongoose').model('User')
const Account = require('mongoose').model('Account')
const Plan = require('mongoose').model('Plan')

const cacheProvider = getCacheProvider()

// Private functions

const identifyingKey = 'reference'

const addPlans = function (req, res, next) {
  req.crudify.user.getSubscriptionPlans({ includeAllSubscriptions: get(req, 'query.includeAllSubscriptions') }, (err, { subscriptions, subscriptionsWithPlan }) => {
    req.crudify.result = toJsonIfNeeded(req.crudify.result)
    req.crudify.result.account.subscriptions = subscriptionsWithPlan
    req.crudify.result.plans = map(subscriptionsWithPlan, subscriptionPlan => subscriptionPlan.plan.reference)
    next()
  })
}

const addServices = function (req, res, next) {
  req.crudify.user.getServices((err, services) => {
    req.crudify.result = toJsonIfNeeded(req.crudify.result)
    req.crudify.result.services = services
    next()
  })
}

const addCachingKey = function (req, res, next) {
  cacheProvider.setKeyOnResponse(res, get(req, 'crudify.user.account.reference'))
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
        if (!results.plan._id) next(new Error(`Plan not found: '${req.body.subscription.plan}'`))
        const subscription = clone(req.body.subscription)
        subscription.plan = results.plan._id
        subscription.dateExpires = getDateExpires(req.body.subscription)
        results.account.subscriptions.push(toJsonIfNeeded(subscription))
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
        { middlewares: [checkIfAuthorizedUser.bind(this, undefined)], except: ['create'] }, // Apply to all CRUD operations except Create
        { middlewares: [
          changeReferenceToId.bind(this, { modelName: 'Account', parentProperty: 'account', childIdentifier: 'reference' }),
          createSubscription
        ],
        only: ['create', 'update'] },
        { middlewares: [populateProperties.bind(this, { modelName: 'user', propertyName: 'account' })], only: ['read'] }
      ],
      endResponseInAction: false,
      afterActions: [
        { middlewares: [addPlans, addServices, addCachingKey], only: ['read'] },
        { middlewares: [sendRequestResponse] }
      ]
    })
  )
}
