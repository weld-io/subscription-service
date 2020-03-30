//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

const { has, get, merge } = require('lodash')
const express = require('express')

const {
  checkIfAuthorizedUser,
  getDateExpires,
  handleRequest,
  CustomError,
  processAndRespond,
  getPaymentProvider,
  getCacheProvider
} = require('../../lib/helpers')

const {
  DEFAULT_BILLING,
  getAccount,
  createSubscriptionObject,
  getPlanForSubscription,
  getPlansForOldSubscriptions,
  findCurrentActiveSubscriptions,
  findCurrentActiveSubscriptionsFromRequest,
  getSubscription,
  getSubscriptionIndex,
  updatePaymentProviderSubscription,
  updateSubscriptionOnAccount,
  mergeAndUpdateSubscription,
  cancelSubscription,
  renewSubscriptionAndAccount
} = require('../../lib/subscriptions')

// ----- List/Get Subscription -----

const listSubscriptions = function (req, res, next) {
  handleRequest(async () => {
    const account = await getAccount(req.params)
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

const createOrUpdateSubscription = function (req, res, next) {
  handleRequest(async () => {
    const account = await getAccount(req.params)

    const { existingSubscription, newSubscription, user, newPlan, oldPlans } = await findCurrentActiveSubscriptionsFromRequest(account, req)

    // Use ?ignorePaymentProvider=true on URL to avoid Stripe subscriptions being created, e.g. for migration purposes
    const usePaymentProvider = !has(req, 'query.ignorePaymentProvider')
    const payment = { token: req.body.token, paymentMethod: req.body.paymentMethod }
    const paymentResults = usePaymentProvider
      ? await getPaymentProvider().createOrUpdateSubscription({ user, account, existingSubscription, newSubscription, payment })
      : {}
    const isNew = usePaymentProvider ? paymentResults.isNew : true
    const newSubscriptions = await updateSubscriptionOnAccount({ account, subscription: (existingSubscription || newSubscription), newPlan, dateExpires: getDateExpires(req.body), isNew })
    res.json(newSubscriptions)
  }, { req, res })
}

const updateSubscription = function (req, res, next) {
  handleRequest(async () => {
    const account = await getAccount(req.params)
    const { subscriptionId } = req.params
    const { plan, billing, token, paymentMethod } = req.body
    const existingSubscription = getSubscription(account, subscriptionId)
    if (existingSubscription.dateStopped) throw new Error(`Subscription '${existingSubscription._id}' is stopped and can’t be updated`)
    const subscription = merge({}, existingSubscription, { plan, billing })
    const results = await updatePaymentProviderSubscription({ account, subscription, payment: { token, paymentMethod } })
    await mergeAndUpdateSubscription({ subscriptionId, account: results.account, subscription: results.subscription })
    await getCacheProvider().purgeContentByKey(account.reference)
    const updatedSubscription = get(account, 'subscriptions.' + getSubscriptionIndex(account, subscriptionId))
    res.json(updatedSubscription)
  }, { req, res })
}

// Stop one or all subscriptions
const deleteSubscription = function (req, res, next) {
  handleRequest(async () => {
    const account = await getAccount(req.params)
    // Cancel all subscriptions or with matching ID
    const { subscriptionId } = req.params
    const cancellationPromises = account.subscriptions.map(subscription => cancelSubscription(subscriptionId, subscription))
    const cancellationsResult = await Promise.all(cancellationPromises)
    const subsStopped = cancellationsResult.reduce((result, value) => result + value, 0)
    // Purge cache
    getCacheProvider().purgeContentByKey(account.reference)
    // Save account
    await account.save()
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
  router.post('/api/accounts/:accountReference/subscriptions', createOrUpdateSubscription)
  router.put('/api/accounts/:accountReference/subscriptions/:subscriptionId', updateSubscription)
  router.delete('/api/accounts/:accountReference/subscriptions/:subscriptionId', deleteSubscription)
  router.delete('/api/accounts/:accountReference/subscriptions', deleteSubscription)

  // CRUD routes: User
  router.get('/api/users/:userReference/subscriptions', checkIfAuthorizedUser.bind(this, 'params.userReference'), listSubscriptions)
  router.get('/api/users/:userReference/subscriptions/:subscriptionId', checkIfAuthorizedUser.bind(this, 'params.userReference'), readSubscription)
  router.post('/api/users/:userReference/subscriptions', checkIfAuthorizedUser.bind(this, 'params.userReference'), createOrUpdateSubscription)
  router.put('/api/users/:userReference/subscriptions/:subscriptionId', checkIfAuthorizedUser.bind(this, 'params.userReference'), updateSubscription)
  router.delete('/api/users/:userReference/subscriptions/:subscriptionId', checkIfAuthorizedUser.bind(this, 'params.userReference'), deleteSubscription)
  router.delete('/api/users/:userReference/subscriptions', checkIfAuthorizedUser.bind(this, 'params.userReference'), deleteSubscription)

  // Receive webhook from e.g. Stripe
  router.post('/api/subscriptions/renew', renewSubscription)
}
