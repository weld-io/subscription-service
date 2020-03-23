//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

const { has } = require('lodash')
const express = require('express')
const async = require('async')

const {
  checkIfAuthorizedUser,
  getDateExpires,
  handleRequest,
  processAndRespond,
  getPaymentProvider,
  getCacheProvider,
  sendResponse
} = require('../../lib/helpers')

const {
  getAccountThen,
  getAccount,
  createSubscriptionObject,
  getPlanForNewSubscription,
  getPlansForOldSubscriptions,
  findCurrentActiveSubscriptions,
  updatePaymentProviderSubscription,
  updateSubscriptionOnAccount,
  mergeAndUpdateSubscription,
  isThisTheSubscriptionToCancel,
  cancelSubscription,
  renewSubscriptionAndAccount
} = require('../../lib/subscriptions')

// ----- List/Get Subscription -----

const listSubscriptions = function (req, res, next) {
  handleRequest(async () => {
    const account = await getAccount(req.params)
    if (!account) throw new Error(`Account not found:404`)
    res.json(account.subscriptions)
  }, { req, res })
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
  handleRequest(async () => {
    const account = await getAccount(req.params)
    if (!account) throw new Error(`Account not found:404`)

    const { newSubscription, user } = createSubscriptionObject(account, req)
    const newPlan = await getPlanForNewSubscription(newSubscription)
    const oldPlans = await getPlansForOldSubscriptions(account)
    const existingSubscription = findCurrentActiveSubscriptions({ account, oldPlans, newPlan })

    // Use ?ignorePaymentProvider=true on URL to avoid Stripe subscriptions being created, e.g. for migration purposes
    const usePaymentProvider = !has(req, 'query.ignorePaymentProvider')
    const payment = { token: req.body.token, paymentMethod: req.body.paymentMethod }
    const paymentResults = usePaymentProvider
      ? await getPaymentProvider().createOrUpdateSubscription({ user, account, existingSubscription, newSubscription, payment })
      : {}
    const isNew = usePaymentProvider ? paymentResults.isNew : true
    const newSubscriptions = await updateSubscriptionOnAccount({ account, subscription: (existingSubscription || newSubscription), newPlan, dateExpires: getDateExpires(req.body), isNew })
    // cb(saveErr, { user, account: savedAccount, newSubscription: result.subscription })
    res.json(newSubscriptions)
  }, { req, res })
}

const updateSubscription = function (req, res, next) {
  // getAccountThen.bind(this, req, res),
  // updatePaymentProviderSubscription,
  // mergeAndUpdateSubscription
  // sendTheResponse
}

// Stop one or all subscriptions
const deleteSubscription = function (req, res, next) {
  handleRequest(async () => {
    const account = await getAccount(req.params)
    if (!account) throw new Error(`Account not found:404`)
    // Cancel all subscriptions or with matching ID
    const { subscriptionId } = req.params
    const cancellationPromises = account.subscriptions.map(subscription => cancelSubscription(subscriptionId, subscription))
    const cancellationsResult = await Promise.all(cancellationPromises)
    const subsStopped = cancellationsResult.reduce((result, value) => result + value, 0)
    // Purge cache
    getCacheProvider().purgeContentByKey(account.reference)
    // Save account
    const results = await account.save()
    res.json({ message: `Stopped ${subsStopped} subscriptions` })
  }, { req, res })
}

const renewSubscription = function (req, res, next) {
  getPaymentProvider().receiveRenewSubscription(req, renewSubscriptionAndAccount)
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
