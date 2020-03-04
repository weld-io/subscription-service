//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

const { has } = require('lodash')
const express = require('express')

const {
  checkIfAuthorizedUser,
  getDateExpires,
  handleRequest,
  processAndRespond,
  sendResponse
} = require('../../lib/helpers')

const {
  getAccountThen,
  getAccount,
  createSubscriptionObject,
  getPlanForNewSubscription,
  getPlansForOldSubscriptions,
  findCurrentActiveSubscriptions,
  createOrUpdatePaymentProviderSubscription,
  updatePaymentProviderSubscription,
  updateSubscriptionOnAccount,
  mergeAndUpdateSubscription,
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
    const subscriptionToUpdate = findCurrentActiveSubscriptions({ account, oldPlans, newPlan })
    // Use ?ignorePaymentProvider=true on URL to avoid Stripe subscriptions being created, e.g. for migration purposes
    const paymentResults = !has(req, 'query.ignorePaymentProvider')
      ? await createOrUpdatePaymentProviderSubscription({ user, account, subscriptionToUpdate, newSubscription, token: req.body.token })
      : {}
    const newSubscriptions = await updateSubscriptionOnAccount({ account, subscription: subscriptionToUpdate, newPlan, dateExpires: getDateExpires(req.body), isNew: paymentResults.isNew })
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
  paymentProvider.receiveRenewSubscription(req, renewSubscriptionAndAccount)
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
