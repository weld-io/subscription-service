//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

'use strict'

const _ = require('lodash')
const async = require('async')
const express = require('express')
const fetch = require('node-fetch')
const mongooseCrudify = require('mongoose-crudify')

const helpers = require('../../config/helpers')
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'stripe'
const DEFAULT_BILLING = 'month'
const paymentProvider = require('../../paymentProviders/' + PAYMENT_PROVIDER)

const Account = require('mongoose').model('Account')
const User = require('mongoose').model('User')

const getAccountThen = function (req, res, callback) {
  const query = { reference: req.params.accountReference || req.params.userReference }
  if (req.params.accountReference) {
    // accountReference provided
    Account.findOne(query).exec(callback)
  } else if (req.params.userReference) {
    // userReference provided
    User.findOne(query).exec((err, user) => {
      user
        ? Account.findById(user.account).exec(callback)
        : callback('User not found')
    })
  }
}

const subscriptions = {

  list: function (req, res, next) {
    getAccountThen(req, res, (err, account) => {
      account
        ? res.json(account.subscriptions)
        : res.status(404).json({ message: 'Account not found' })
    })
  },

  read: function (req, res, next) {
    res.json({})
  },

  create: function (req, res, next) {
    const createSubscriptionObject = function (account, cb) {
      const newSubscription = _.merge({ billing: DEFAULT_BILLING }, req.body)
      const user = { reference: req.params.userReference }
      cb(null, { user, account, newSubscription })
    }

    const getPlanForNewSubscription = function ({ user, account, newSubscription }, cb) {
      const subscriptionCopy = _.cloneDeep(newSubscription)
      helpers.changeReferenceToId({ modelName: 'Plan', parentProperty: 'plan', childIdentifier: 'reference' }, { body: subscriptionCopy }, res, (err, plans) => cb(err, { user, account, newSubscription, newPlan: plans[0] }))
    }

    const getPlansForOldSubscriptions = function ({ user, account, newSubscription, newPlan }, cb) {
      helpers.getChildObjects(account.subscriptions, 'plan', 'Plan', (err, oldPlans) => {
        cb(err, { user, account, newSubscription, newPlan, oldPlans })
      })
    }

    const findCurrentActiveSubscriptions = ({ user, account, newSubscription, newPlan, oldPlans }, cb) => {
      const isSubscriptionWithoutAllowMultiple = sub => {
        const planForSubscription = _.find(oldPlans, plan => plan._id.toString() === sub.plan.toString())
        return planForSubscription && !planForSubscription.allowMultiple
      }
      const getActiveSubscriptionsWithoutAllowMultiple = () => _.chain(account.subscriptions).filter(helpers.isSubscriptionActive).filter(isSubscriptionWithoutAllowMultiple).value()

      let subscriptionToUpdate
      if (!newPlan.allowMultiple) {
        // Find old active plan with allowMultiple=false, if any
        const allSubscriptionsToUpdate = getActiveSubscriptionsWithoutAllowMultiple()
        subscriptionToUpdate = allSubscriptionsToUpdate[0]
        // TODO: how to handle the rest of allSubscriptionsToUpdate?
      }

      cb(null, { user, account, newSubscription, subscriptionToUpdate, newPlan, oldPlans })
    }

    const createPaymentProviderSubscription = function ({ user, account, newSubscription, subscriptionToUpdate, newPlan, oldPlans }, cb) {
      // Use ?ignorePaymentProvider=true on URL to avoid Stripe subscriptions being created, e.g. for migration purposes
      if (_.has(req, 'query.ignorePaymentProvider')) {
        cb(null, { user, account, newSubscription })
      } else {
        // If existing subscription
        // TODO: rewrite so no specific Stripe references here
        if (_.has(subscriptionToUpdate, 'metadata.stripeSubscription') && _.has(account, 'metadata.stripeCustomer')) {
          // Update existing
          const updatedSubscription = _.merge({}, subscriptionToUpdate, _.pick(newSubscription, ['plan', 'billing']))

          const updateSubscriptionOnAccount = function ({ account, subscriptionToUpdate, newPlan }, cbAfterSave) {
            subscriptionToUpdate.plan = newPlan._id
            subscriptionToUpdate.dateExpires = helpers.getDateExpires(req.body)
            account.save(cbAfterSave)
          }

          paymentProvider.updateSubscription(
            {
              user,
              account,
              subscription: updatedSubscription,
              payment: { token: req.body.token /* taxPercent: */ }
            },
            (err, result) => {
              err ? cb(err) : updateSubscriptionOnAccount({ account, subscriptionToUpdate, newPlan }, (saveErr, savedAccount) => cb(saveErr, { user, account: savedAccount, newSubscription: subscriptionToUpdate }))
            }
          )
        } else {
          // If NO existing subscription, create new
          const addSubscriptionToAccount = function ({ user, account, subscription }, cbAfterSave) {
            subscription.plan = newPlan._id
            subscription.dateExpires = helpers.getDateExpires(req.body)
            account.subscriptions.push(helpers.toJsonIfNeeded(subscription))
            account.save(cbAfterSave)
          }

          // Create new
          paymentProvider.createSubscription(
            {
              user,
              account,
              subscription: newSubscription,
              payment: { token: req.body.token /* taxPercent: */ }
            },
            (err, result) => {
              err ? cb(err) : addSubscriptionToAccount(result, (saveErr, savedAccount) => cb(saveErr, { user, account: savedAccount, newSubscription: result.subscription }))
            }
          )
        }
      }
    }

    const sendResponse = function (err, results) {
      helpers.sendResponse.call(res, err, _.get(results, 'account.subscriptions'))
    }

    async.waterfall([
      getAccountThen.bind(this, req, res),
      createSubscriptionObject,
      getPlanForNewSubscription,
      getPlansForOldSubscriptions,
      findCurrentActiveSubscriptions,
      createPaymentProviderSubscription
    ],
    sendResponse
    )
  },

  update: function (req, res, next) {
    const getSubscriptionIndex = account => _.findIndex(_.get(account, 'subscriptions'), sub => sub._id.toString() === req.params.subscriptionId)

    const updatePaymentProviderSubscription = function (account, cb) {
      paymentProvider.updateSubscription(
        {
          user: { reference: req.params.userReference },
          account,
          subscription: { plan: req.body.plan, billing: req.body.billing || DEFAULT_BILLING },
          payment: { token: req.body.token /* taxPercent: */ }
        },
        cb
      )
    }

    const updateSubscription = function (user, account, subscription, cb) {
      const subscriptionIndex = getSubscriptionIndex(account)
      if (subscriptionIndex >= 0) {
        _.merge(account.subscriptions[subscriptionIndex], req.body)
      };
      account.save(cb)
    }

    const sendResponse = function (err, account) {
      helpers.sendResponse.call(res, err, _.get(account, 'subscriptions.' + getSubscriptionIndex(account)))
    }

    async.waterfall([
      getAccountThen.bind(this, req, res),
      updatePaymentProviderSubscription,
      updateSubscription
    ],
    sendResponse
    )
  },

  // Stop one or all subscriptions
  delete: function (req, res, next) {
    getAccountThen(req, res, (err, account) => {
      let subsStopped = 0
      async.eachSeries(
        account.subscriptions,
        (sub, cb) => {
          if ((req.params.subscriptionId === undefined || // Stop all
            req.params.subscriptionId === sub._id.toString()) && // Stop one
            !sub.dateStopped // Always: check that not already stopped
          ) {
            sub.dateStopped = Date.now()
            subsStopped++
            paymentProvider.deleteSubscription(sub, cb)
          } else {
            cb()
          }
        },
        // When done
        (err) => {
          account.save((err, results) => helpers.sendResponse.call(res, err, { message: `Stopped ${subsStopped} subscriptions` }))
        }
      )
    })
  },

  renew: function (req, res, next) {
    // This is the optional _outbound_ webhook to notify other webservices. It uses the WEBHOOK_RENEW_SUBSCRIPTION environment variable.
    const postOutboundRenewWebhook = function ({ account, users, subscriptions, interval, intervalCount }, callback) {
      if (process.env.WEBHOOK_RENEW_SUBSCRIPTION) {
        fetch(process.env.WEBHOOK_RENEW_SUBSCRIPTION,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'renew',
              account: account,
              users: users,
              subscriptions: subscriptions,
              interval: interval,
              intervalCount: intervalCount
            })
          }
        )
          .then(callback)
        if (callback) callback()
      } else {
        if (callback) callback()
      }
    }

    paymentProvider.receiveRenewSubscription(req, function (err, props) {
      if (!err) {
        const { account, subscriptions, interval, intervalCount } = props
        subscriptions.forEach(sub => {
          sub.dateExpires = interval === 'year' ? helpers.dateIn1Year() : helpers.dateIn1Month()
        })
        account.save()
        User.find({ account: account._id }).exec((err, users) => {
          postOutboundRenewWebhook({ account, users, subscriptions, interval, intervalCount })
        })
        res.json({ message: `Updated account and ${subscriptions.length} subscription(s)` })
      } else {
        console.log(`receiveRenewSubscription`, err)
        res.status(400).json({ message: err })
      }
    })
  }

}

module.exports = function (app, config) {
  const router = express.Router()
  app.use('/', router)

  // CRUD routes: Account
  router.get('/api/accounts/:accountReference/subscriptions', subscriptions.list)
  router.get('/api/accounts/:accountReference/subscriptions/:subscriptionId', subscriptions.read)
  router.post('/api/accounts/:accountReference/subscriptions', subscriptions.create)
  router.put('/api/accounts/:accountReference/subscriptions/:subscriptionId', subscriptions.update)
  router.delete('/api/accounts/:accountReference/subscriptions/:subscriptionId', subscriptions.delete)
  router.delete('/api/accounts/:accountReference/subscriptions', subscriptions.delete)

  // CRUD routes: User
  router.get('/api/users/:userReference/subscriptions', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.list)
  router.get('/api/users/:userReference/subscriptions/:subscriptionId', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.read)
  router.post('/api/users/:userReference/subscriptions', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.create)
  router.put('/api/users/:userReference/subscriptions/:subscriptionId', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.update)
  router.delete('/api/users/:userReference/subscriptions/:subscriptionId', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.delete)
  router.delete('/api/users/:userReference/subscriptions', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.delete)

  // Receive webhook from e.g. Stripe
  router.post('/api/subscriptions/renew', subscriptions.renew)
}
