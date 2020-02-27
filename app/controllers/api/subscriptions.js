//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

'use strict'

const { chain, cloneDeep, find, findIndex, get, has, merge, pick } = require('lodash')
const async = require('async')
const express = require('express')
const fetch = require('node-fetch')

const { changeReferenceToId, checkIfAuthorizedUser, dateIn1Month, dateIn1Year, getCacheProvider, getChildObjects, getDateExpires, getPaymentProvider, isSubscriptionActive, processAndRespond, sendResponse, toJsonIfNeeded } = require('../../config/helpers')

const Account = require('mongoose').model('Account')
const User = require('mongoose').model('User')

const DEFAULT_BILLING = 'month'

const paymentProvider = getPaymentProvider()
const cacheProvider = getCacheProvider()

const getAccountThen = function (req, res, callback) {
  const query = { reference: req.params.accountReference || req.params.userReference }
  if (req.params.accountReference) {
    // accountReference provided
    Account.findOne(query).exec(callback)
  } else if (req.params.userReference) {
    // userReference provided
    User.findOne(query).exec((err, user) => {
      (!err && user)
        ? Account.findById(user.account).exec(callback)
        : callback(new Error('User not found'))
    })
  }
}

const getAccount = async params => {
  const query = { reference: params.accountReference || params.userReference }
  if (params.accountReference) {
    return Account.findOne(query).exec()
  } else {
    const user = await User.findOne(query).exec()
    return Account.findById(user.account).exec()
  }
}

const listSubscriptions = function (req, res, next) {
  processAndRespond(res, new Promise(async (resolve, reject) => {
    try {
      const account = await getAccount(req.params)
      resolve(account.subscriptions)
    } catch (err) {
      reject(err)
    }
  }))
}

const readSubscription = function (req, res, next) {
  processAndRespond(res, new Promise(async (resolve, reject) => {
    try {
      const account = await getAccount(req.params)
      resolve(account.subscriptions.filter(sub => sub._id === req.params.subscriptionId)[0])
    } catch (err) {
      reject(err)
    }
  }))
}

const createSubscription = function (req, res, next) {
  const createSubscriptionObject = function (account, cb) {
    const newSubscription = merge({ billing: DEFAULT_BILLING }, req.body)
    const user = { reference: req.params.userReference }
    account.email = req.body.email
    cb(null, { user, account, newSubscription })
  }

  const getPlanForNewSubscription = function ({ user, account, newSubscription }, cb) {
    const subscriptionCopy = cloneDeep(newSubscription)
    changeReferenceToId({ modelName: 'Plan', parentProperty: 'plan', childIdentifier: 'reference' }, { body: subscriptionCopy }, res, (err, plans) => cb(err, { user, account, newSubscription, newPlan: plans[0] }))
  }

  const getPlansForOldSubscriptions = function ({ user, account, newSubscription, newPlan }, cb) {
    getChildObjects(account.subscriptions, 'plan', 'Plan', (err, oldPlans) => {
      cb(err, { user, account, newSubscription, newPlan, oldPlans })
    })
  }

  const findCurrentActiveSubscriptions = ({ user, account, newSubscription, newPlan, oldPlans }, cb) => {
    const isSubscriptionWithoutAllowMultiple = sub => {
      const planForSubscription = find(oldPlans, plan => plan._id.toString() === sub.plan.toString())
      return planForSubscription && !planForSubscription.allowMultiple
    }
    const getActiveSubscriptionsWithoutAllowMultiple = () => chain(account.subscriptions).filter(isSubscriptionActive).filter(isSubscriptionWithoutAllowMultiple).value()

    let subscriptionToUpdate
    if (newPlan && !newPlan.allowMultiple) {
      // Find old active plan with allowMultiple=false, if any
      const allSubscriptionsToUpdate = getActiveSubscriptionsWithoutAllowMultiple()
      subscriptionToUpdate = allSubscriptionsToUpdate[0]
      // TODO: how to handle the rest of allSubscriptionsToUpdate?
    }

    cb(null, { user, account, newSubscription, subscriptionToUpdate, newPlan, oldPlans })
  }

  const createPaymentProviderSubscription = function ({ user, account, newSubscription, subscriptionToUpdate, newPlan, oldPlans }, cb) {
    // Use ?ignorePaymentProvider=true on URL to avoid Stripe subscriptions being created, e.g. for migration purposes
    if (has(req, 'query.ignorePaymentProvider')) {
      // TODO: make it actually save/create subscription in database
      cb(null, { user, account, newSubscription })
    } else {
      // If existing subscription
      // TODO: rewrite so no specific Stripe references here
      if (has(subscriptionToUpdate, 'metadata.stripeSubscription') && has(account, 'metadata.stripeCustomer')) {
        // Update existing
        const updatedSubscription = merge({}, subscriptionToUpdate, pick(newSubscription, ['plan', 'billing']))

        const updateSubscriptionOnAccount = function ({ account, subscriptionToUpdate, newPlan }, cbAfterSave) {
          subscriptionToUpdate.plan = newPlan._id
          subscriptionToUpdate.dateExpires = getDateExpires(req.body)
          account.save(cbAfterSave)
        }

        paymentProvider.updateSubscription(
          {
            user,
            account,
            subscription: updatedSubscription,
            payment: { token: req.body.token } // taxPercent
          },
          (err, result) => {
            err ? cb(err) : updateSubscriptionOnAccount({ account, subscriptionToUpdate, newPlan }, (saveErr, savedAccount) => cb(saveErr, { user, account: savedAccount, newSubscription: subscriptionToUpdate }))
          }
        )
      } else {
        // If NO existing subscription, create new
        const addSubscriptionToAccount = function ({ user, account, subscription }, cbAfterSave) {
          subscription.plan = newPlan._id
          subscription.dateExpires = getDateExpires(req.body)
          account.subscriptions.push(toJsonIfNeeded(subscription))
          account.save(cbAfterSave)
        }

        // Create new
        paymentProvider.createSubscription(
          {
            user,
            account,
            subscription: newSubscription,
            payment: { token: req.body.token } // taxPercent
          },
          (err, result) => {
            err ? cb(err) : addSubscriptionToAccount(result, (saveErr, savedAccount) => cb(saveErr, { user, account: savedAccount, newSubscription: result.subscription }))
          }
        )
      }
    }
  }

  const sendResponse = function (err, results) {
    sendResponse.call(res, err, get(results, 'account.subscriptions'))
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
}

const updateSubscription = function (req, res, next) {
  const getSubscriptionIndex = account => findIndex(get(account, 'subscriptions'), sub => sub._id.toString() === req.params.subscriptionId)

  const updatePaymentProviderSubscription = function (account, cb) {
    paymentProvider.updateSubscription(
      {
        user: { reference: req.params.userReference },
        account,
        subscription: { plan: req.body.plan, billing: req.body.billing || DEFAULT_BILLING },
        payment: { token: req.body.token } // taxPercent
      },
      cb
    )
  }

  const updateSubscription = function (user, account, subscription, cb) {
    const subscriptionIndex = getSubscriptionIndex(account)
    if (subscriptionIndex >= 0) {
      merge(account.subscriptions[subscriptionIndex], req.body)
    };
    account.save(cb)
  }

  const sendResponse = function (err, account) {
    cacheProvider.purgeContentByKey(account.reference)
    sendResponse.call(res, err, get(account, 'subscriptions.' + getSubscriptionIndex(account)))
  }

  async.waterfall([
    getAccountThen.bind(this, req, res),
    updatePaymentProviderSubscription,
    updateSubscription
  ],
  sendResponse
  )
}

// Stop one or all subscriptions
const deleteSubscription = function (req, res, next) {
  getAccountThen(req, res, (err, account) => {
    if (err) {
      res.status(400).json({ message: err.message })
      return
    }
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
        cacheProvider.purgeContentByKey(account.reference)
        account.save((err, results) => sendResponse.call(res, err, { message: `Stopped ${subsStopped} subscriptions` }))
      }
    )
  })
}

const renewSubscription = function (req, res, next) {
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
        sub.dateExpires = interval === 'year' ? dateIn1Year() : dateIn1Month()
      })
      account.save()
      cacheProvider.purgeContentByKey(account.reference)
      User.find({ account: account._id }).exec((err, users) => {
        postOutboundRenewWebhook({ account, users, subscriptions, interval, intervalCount })
      })
      res.json({ message: `Updated account and ${subscriptions.length} subscription(s)` })
    } else {
      console.error(`receiveRenewSubscription`, err)
      res.status(400).json({ message: err })
    }
  })
}

module.exports = function (app, config) {
  const router = express.Router()
  app.use('/', router)

  // CRUD routes: Account
  router.get('/api/accounts/:accountReference/subscriptions', listSubscriptions)
  router.get('/api/accounts/:accountReference/subscriptions/:subscriptionId', readSubscription)
  router.post('/api/accounts/:accountReference/subscriptions', createSubscription)
  router.put('/api/accounts/:accountReference/subscriptions/:subscriptionId', updateSubscription)
  router.delete('/api/accounts/:accountReference/subscriptions/:subscriptionId', deleteSubscription)
  router.delete('/api/accounts/:accountReference/subscriptions', deleteSubscription)

  // CRUD routes: User
  router.get('/api/users/:userReference/subscriptions', checkIfAuthorizedUser.bind(this, 'params.userReference'), listSubscriptions)
  router.get('/api/users/:userReference/subscriptions/:subscriptionId', checkIfAuthorizedUser.bind(this, 'params.userReference'), readSubscription)
  router.post('/api/users/:userReference/subscriptions', checkIfAuthorizedUser.bind(this, 'params.userReference'), createSubscription)
  router.put('/api/users/:userReference/subscriptions/:subscriptionId', checkIfAuthorizedUser.bind(this, 'params.userReference'), updateSubscription)
  router.delete('/api/users/:userReference/subscriptions/:subscriptionId', checkIfAuthorizedUser.bind(this, 'params.userReference'), deleteSubscription)
  router.delete('/api/users/:userReference/subscriptions', checkIfAuthorizedUser.bind(this, 'params.userReference'), deleteSubscription)

  // Receive webhook from e.g. Stripe
  router.post('/api/subscriptions/renew', renewSubscription)
}
