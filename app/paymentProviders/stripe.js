//
// Name:    stripe.js
// Purpose: Payment provider configuration for Stripe
// Creator: Tom Söderlund
//

'use strict'

const { chain, get, merge, set, some } = require('lodash')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const { isHexString } = require('../lib/helpers')

// ----- Private functions -----

const getStripeCustomerID = account => get(account, 'metadata.stripeCustomer')
const getStripeSubscriptionID = sub => get(sub, 'metadata.stripeSubscription')

const createStripeOptions = ({ user, account, subscription, payment }) => {
  // e.g. "enterprise_small_monthly"
  // TODO: Fix ugly hack with isHexString to determine if it's a new plan reference, or a plan._id
  const stripePlanName = isHexString(subscription.plan) ? undefined : `${subscription.plan}_${subscription.billing}`
  return {
    source: payment.token,
    plan: stripePlanName,
    coupon: subscription.discountCode,
    // quantity: subscription.quantity,
    tax_percent: payment.taxPercent
  }
}

const createStripeUserAndSubscription = ({ user, account, subscription, payment }, callback) => {
  let stripeCustomerObj = createStripeOptions({ user, account, subscription, payment })
  // Extra options for Create
  merge(stripeCustomerObj, {
    description: account.reference,
    email: account.email,
    metadata: {
      user_id: user.reference
    }
  })

  // Call Stripe API
  stripe.customers.create(
    stripeCustomerObj,
    function (stripeErr, stripeCustomer) {
      if (stripeErr) {
        callback(stripeErr)
      } else {
        set(account, 'metadata.stripeCustomer', get(stripeCustomer, 'id'))
        account.markModified('metadata')
        set(subscription, 'metadata.stripeSubscription', get(stripeCustomer, 'subscriptions.data.0.id'))
        callback(null, { user, account, subscription })
      }
    }
  )
}

const createStripeSubscription = function ({ user, account, subscription, payment }, callback) {
  const stripeCustomerId = getStripeCustomerID(account)
  const stripeSubscriptionObj = createStripeOptions({ user, account, subscription, payment })

  const whenDone = function (stripeErr, stripeSubscription) {
    if (stripeErr) {
      callback(stripeErr)
    } else {
      set(subscription, 'metadata.stripeSubscription', get(stripeSubscription, 'id'))
      callback(null, { user, account, subscription })
    }
  }

  // Call Stripe API
  stripe.customers.createSubscription(stripeCustomerId, stripeSubscriptionObj, whenDone)
}

// ----- API methods -----

// CREATE
const createSubscription = ({ user, account, subscription, payment }) => new Promise(async (resolve, reject) => {
  // NOTE: has() doesn't work on Mongoose objects, but get() does.
  if (get(account, 'metadata.stripeCustomer')) {
    createStripeSubscription({ user, account, subscription, payment }, (err, data) => err ? reject(err) : resolve(data))
  } else {
    createStripeUserAndSubscription({ user, account, subscription, payment }, (err, data) => err ? reject(err) : resolve(data))
  }
})

const updateSubscription = async ({ user, account, subscription, payment }) => new Promise(async (resolve, reject) => {
  const stripeCustomerId = getStripeCustomerID(account)
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)
  const stripeSubscriptionObj = createStripeOptions({ user, account, subscription, payment })

  const whenDone = function (stripeErr, stripeSubscription) {
    if (stripeErr) {
      reject(stripeErr)
    } else {
      set(subscription, 'metadata.stripeSubscription', get(stripeSubscription, 'id'))
      resolve({ user, account, subscription })
    }
  }

  // Call Stripe API
  if (stripeSubscriptionId) {
    stripe.customers.updateSubscription(stripeCustomerId, stripeSubscriptionId, stripeSubscriptionObj, whenDone)
  } else {
    stripe.customers.createSubscription(stripeCustomerId, stripeSubscriptionObj, whenDone)
  }
})

// DELETE
const deleteSubscription = (subscription) => new Promise(async (resolve, reject) => {
  resolve('a value')
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)
  if (stripeSubscriptionId) {
    stripe.subscriptions.del(stripeSubscriptionId, (err, stripeSubscription) => err ? reject(err) : resolve(stripeSubscription))
  } else {
    reject(new Error('No stripeSubscriptionId'))
  }
})

// Webhook for renewal
const receiveRenewSubscription = function (req, callback) {
  const webhookType = get(req, 'body.type')
  const stripeCustomerId = get(req, 'body.data.object.customer')
  const stripeSubscriptionId = get(req, 'body.data.object.subscription')
  console.log(`Stripe "${webhookType}" webhook received`)
  if (webhookType === 'invoice.payment_succeeded' && stripeCustomerId) {
    const lineItems = get(req, 'body.data.object.lines.data')
    // If contains 'year', then extend a year etc
    const interval = some(lineItems, { plan: { interval: 'year' } }) ? 'year' : 'month'
    // TODO: use interval_count from Stripe
    const intervalCount = 1
    console.log(`Stripe "invoice.payment_succeeded" webhook for customer ${stripeCustomerId}, subscription ${stripeSubscriptionId}, extend ${intervalCount} ${interval}(s)`)
    // Look up Account and Subscriptions in database
    const query = { 'metadata.stripeCustomer': stripeCustomerId }
    const Account = require('mongoose').model('Account')
    Account.findOne(query).exec((accountErr, account) => {
      if (!accountErr && account) {
        const subscriptions = chain(account.subscriptions).filter(sub => get(sub, 'metadata.stripeSubscription') === stripeSubscriptionId).value()
        callback(null, { account, subscriptions, interval, intervalCount })
      } else {
        callback(new Error(`Account not found: ${stripeCustomerId}`))
      }
    })
  } else {
    callback(new Error('No valid Stripe webhook'))
  }
}

// ----- Public API -----

module.exports = {

  // All methods should have signature `function({ payload1, ... }, callback)`
  // and callbacks have signature `callback(error, { payload1, ... })`

  // CRUD operations
  createSubscription,
  updateSubscription,
  deleteSubscription,

  // receiveRenewSubscription(req, callback)
  //   callback(err, { account, subscriptions, interval, intervalCount })
  //   Payload in req: https://stripe.com/docs/api#invoice_object
  receiveRenewSubscription

}
