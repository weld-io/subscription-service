const { chain, cloneDeep, find, findIndex, get, merge } = require('lodash')
const fetch = require('node-fetch')

const {
  changeReferenceToId,
  dateIn1Month,
  dateIn1Year,
  getCacheProvider,
  getChildObjects,
  getPaymentProvider,
  isSubscriptionActive,
  toJsonIfNeeded,
  CustomError
} = require('./helpers')

const DEFAULT_BILLING = 'month'

// ----- getAccount -----

// getAccountThen = old version
const getAccountThen = function (req, res, callback) {
  const Account = require('mongoose').model('Account')
  const query = { reference: req.params.accountReference || req.params.userReference }
  if (req.params.accountReference) {
    // accountReference provided
    Account.findOne(query).exec(callback)
  } else if (req.params.userReference) {
    // userReference provided
    const User = require('mongoose').model('User')
    User.findOne(query).exec((err, user) => {
      (!err && user)
        ? Account.findById(user.account).exec(callback)
        : callback(new Error('User not found'))
    })
  }
}

const getAccount = async (params) => {
  const Account = require('mongoose').model('Account')
  const query = { reference: params.accountReference || params.userReference }
  let account
  if (params.accountReference) {
    account = await Account.findOne(query).exec()
  } else {
    const User = require('mongoose').model('User')
    const user = await User.findOne(query).exec()
    account = await Account.findById(user.account).exec()
  }
  if (!account) throw new CustomError(`Account not found: ${JSON.stringify(params)}`, 404)
  return account
}

// ----- createSubscription -----

const createSubscriptionObject = function (account, { params, body }, useDefaults = true) {
  const newSubscription = merge({ billing: (useDefaults ? DEFAULT_BILLING : undefined) }, body)
  const user = { reference: params.userReference }
  account.email = body.email
  return { user, account, newSubscription }
}

const getPlanForSubscription = (subscription) => new Promise(async (resolve, reject) => {
  const subscriptionCopy = cloneDeep(subscription)
  changeReferenceToId(
    { modelName: 'Plan', parentProperty: 'plan', childIdentifier: 'reference' },
    { body: subscriptionCopy },
    undefined,
    (err, plans) => {
      if (err) reject(err)
      else if (!plans) resolve({})
      else resolve(plans[0])
    }
  )
})

const getPlansForOldSubscriptions = (account) => new Promise(async (resolve, reject) => {
  await getChildObjects(account.subscriptions, 'plan', 'Plan', (err, oldPlans) => err ? reject(err) : resolve(oldPlans))
})

const isSubscriptionWithoutAllowMultiple = (sub, oldPlans) => {
  const planForSubscription = find(oldPlans, (plan) => plan._id.toString() === sub.plan.toString())
  return planForSubscription && !planForSubscription.allowMultiple
}

const getActiveSubscriptionsWithoutAllowMultiple = (account, oldPlans) => chain(account.subscriptions).filter(isSubscriptionActive).filter(sub => isSubscriptionWithoutAllowMultiple(sub, oldPlans)).value()

const findCurrentActiveSubscriptions = ({ account, oldPlans, newPlan }) => {
  if (newPlan && !newPlan.allowMultiple) {
    // Find old active plan with allowMultiple=false, if any
    const allSubscriptionsToUpdate = getActiveSubscriptionsWithoutAllowMultiple(account, oldPlans)
    return allSubscriptionsToUpdate[0]
    // TODO: how to handle the rest of allSubscriptionsToUpdate?
  }
}

const findCurrentActiveSubscriptionsFromRequest = async (account, { params, body }, useDefaults) => {
  const { newSubscription, user } = createSubscriptionObject(account, { params, body }, useDefaults)
  const newPlan = await getPlanForSubscription(newSubscription)
  const oldPlans = await getPlansForOldSubscriptions(account)
  const existingSubscription = toJsonIfNeeded(findCurrentActiveSubscriptions({ account, oldPlans, newPlan }))
  return { existingSubscription, newSubscription, user, newPlan, oldPlans }
}

const updateSubscriptionOnAccount = async function ({ account, subscription, newPlan, dateExpires, isNew }) {
  subscription.plan = newPlan._id
  subscription.dateExpires = dateExpires
  if (isNew) account.subscriptions.push(toJsonIfNeeded(subscription))
  await account.save()
  return account.subscriptions
}

// ----- updateSubscription -----

const updatePaymentProviderSubscription = async function ({ account, subscription, payment }) {
  return getPaymentProvider().updateSubscription({ account, subscription, payment }) // taxPercent
}

const getSubscription = (account, subscriptionId) => account.subscriptions.filter(subscription => subscription._id.toString() === subscriptionId)[0]

const getSubscriptionIndex = (account, subscriptionId) => findIndex(get(account, 'subscriptions'), subscription => subscription._id.toString() === subscriptionId)

const mergeAndUpdateSubscription = async function ({ subscriptionId, account, subscription }) {
  if (!subscriptionId) throw new Error(`subscriptionId not specified`)
  const subscriptionIndex = getSubscriptionIndex(account, subscriptionId)
  subscription.plan = (await getPlanForSubscription(subscription))._id
  if (subscriptionIndex >= 0) merge(account.subscriptions[subscriptionIndex], subscription)
  return account.save()
}

// ----- deleteSubscription -----

const isThisTheSubscriptionToCancel = (subscriptionId, subscription) => (subscriptionId === undefined || // Stop all
  subscriptionId === subscription._id.toString()) && // Stop one
  !subscription.dateStopped // Always: check that not already stopped

const cancelSubscription = async (subscriptionId, subscription) => {
  if (isThisTheSubscriptionToCancel(subscriptionId, subscription)) {
    subscription.dateStopped = Date.now()
    if (get(subscription, 'metadata.stripeSubscriptionId')) await getPaymentProvider().deleteSubscription(subscription)
    return 1
  } else {
    return 0
  }
}

// ----- Renew -----

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

const renewSubscriptionAndAccount = function (err, { account, subscriptions, interval, intervalCount }) {
  if (!err) {
    subscriptions.forEach(sub => {
      sub.dateExpires = interval === 'year' ? dateIn1Year() : dateIn1Month()
    })
    account.save()
    getCacheProvider().purgeContentByKey(account.reference)
    const User = require('mongoose').model('User')
    User.find({ account: account._id }).exec((err, users) => {
      postOutboundRenewWebhook({ account, users, subscriptions, interval, intervalCount })
    })
    res.json({ message: `Updated account and ${subscriptions.length} subscription(s)` })
  } else {
    console.error(`receiveRenewSubscription`, err)
    res.status(400).json({ message: err })
  }
}

// ----- Public API -----

module.exports = {
  DEFAULT_BILLING,
  getAccountThen,
  getAccount,
  createSubscriptionObject,
  getPlanForSubscription,
  getPlansForOldSubscriptions,
  isSubscriptionWithoutAllowMultiple,
  getActiveSubscriptionsWithoutAllowMultiple,
  findCurrentActiveSubscriptions,
  findCurrentActiveSubscriptionsFromRequest,
  updateSubscriptionOnAccount,
  updatePaymentProviderSubscription,
  getSubscription,
  getSubscriptionIndex,
  mergeAndUpdateSubscription,
  isThisTheSubscriptionToCancel,
  cancelSubscription,
  postOutboundRenewWebhook,
  renewSubscriptionAndAccount
}
