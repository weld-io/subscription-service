const { chain, cloneDeep, find, findIndex, get, has, merge, pick } = require('lodash')
const fetch = require('node-fetch')

const {
  changeReferenceToId,
  dateIn1Month,
  dateIn1Year,
  getCacheProvider,
  getChildObjects,
  getPaymentProvider,
  isSubscriptionActive,
  sendResponse,
  toJsonIfNeeded
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
  if (params.accountReference) {
    return Account.findOne(query).exec()
  } else {
    const User = require('mongoose').model('User')
    const user = await User.findOne(query).exec()
    return Account.findById(user.account).exec()
  }
}

// ----- createSubscription -----

const createSubscriptionObject = function (account, { params, body }) {
  const newSubscription = merge({ billing: DEFAULT_BILLING }, body)
  const user = { reference: params.userReference }
  account.email = body.email
  return { user, account, newSubscription }
}

const getPlanForNewSubscription = (newSubscription) => new Promise(async (resolve, reject) => {
  const subscriptionCopy = cloneDeep(newSubscription)
  changeReferenceToId(
    { modelName: 'Plan', parentProperty: 'plan', childIdentifier: 'reference' },
    { body: subscriptionCopy },
    undefined,
    (err, plans) => {
      if (err) reject(err)
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

const updateSubscriptionOnAccount = async function ({ account, subscription, newPlan, dateExpires, isNew }) {
  subscription.plan = newPlan._id
  subscription.dateExpires = dateExpires
  if (isNew) account.subscriptions.push(toJsonIfNeeded(subscription))
  await account.save()
  return account.subscriptions
}

/*
const updatePaymentProviderSubscription = function (account, cb) {
  getPaymentProvider().updateSubscription(
    {
      user: { reference: req.params.userReference },
      account,
      subscription: { plan: req.body.plan, billing: req.body.billing || DEFAULT_BILLING },
      payment: { token: req.body.token } // taxPercent
    },
    cb
  )
}
*/

// ----- updateSubscription -----

const getSubscriptionIndex = (account, subscriptionId) => findIndex(get(account, 'subscriptions'), sub => sub._id.toString() === subscriptionId)

const mergeAndUpdateSubscription = function (user, account, subscription, cb) {
  const subscriptionIndex = getSubscriptionIndex(account, req.params.subscriptionId)
  if (subscriptionIndex >= 0) {
    merge(account.subscriptions[subscriptionIndex], req.body)
  };
  account.save(cb)
}

const sendTheResponse2 = function (err, account) {
  getCacheProvider().purgeContentByKey(account.reference)
  sendResponse.call(res, err, get(account, 'subscriptions.' + getSubscriptionIndex(account)))
}

// ----- deleteSubscription -----

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
  getAccountThen,
  getAccount,
  createSubscriptionObject,
  getPlanForNewSubscription,
  getPlansForOldSubscriptions,
  isSubscriptionWithoutAllowMultiple,
  getActiveSubscriptionsWithoutAllowMultiple,
  findCurrentActiveSubscriptions,
  updateSubscriptionOnAccount,
  getSubscriptionIndex,
  mergeAndUpdateSubscription,
  postOutboundRenewWebhook,
  renewSubscriptionAndAccount
}
