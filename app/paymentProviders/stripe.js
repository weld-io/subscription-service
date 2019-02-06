//
// Name:    stripe.js
// Purpose: Payment provider configuration for Stripe
// Creator: Tom Söderlund
//

'use strict'

const _ = require('lodash')

var STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
var stripe = require('stripe')(STRIPE_SECRET_KEY)

const helpers = require('../config/helpers')
const Account = require('mongoose').model('Account')

// ----- Private functions -----

const getStripeCustomerID = account => _.get(account, 'metadata.stripeCustomer')
const getStripeSubscriptionID = sub => _.get(sub, 'metadata.stripeSubscription')

const createStripeOptions = ({ user, account, subscription, payment }) => {
  // e.g. "enterprise_small_monthly"
  // TODO: Fix ugly hack with isHexString to determine if it's a new plan reference, or a plan._id
  const stripePlanName = helpers.isHexString(subscription.plan) ? undefined : `${subscription.plan}_${subscription.billing}`
  return {
    source: payment.token,
    plan: stripePlanName,
    coupon: subscription.discountCode,
    // quantity: subscription.quantity,
    tax_percent: payment.taxPercent
  }
}

const createStripeUserAndSubscription = function ({ user, account, subscription, payment }, callback) {
  let stripeCustomerObj = createStripeOptions({ user, account, subscription, payment })
  // Extra options for Create
  _.merge(stripeCustomerObj, {
    description: account.reference,
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
        _.set(account, 'metadata.stripeCustomer', _.get(stripeCustomer, 'id'))
        _.set(subscription, 'metadata.stripeSubscription', _.get(stripeCustomer, 'subscriptions.data.0.id'))
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
      _.set(subscription, 'metadata.stripeSubscription', _.get(stripeSubscription, 'id'))
      callback(null, { user, account, subscription })
    }
  }

  // Call Stripe API
  stripe.customers.createSubscription(stripeCustomerId, stripeSubscriptionObj, whenDone)
}

const updateStripeSubscription = function ({ user, account, subscription, payment }, callback) {
  const stripeCustomerId = getStripeCustomerID(account)
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)
  const stripeSubscriptionObj = createStripeOptions({ user, account, subscription, payment })

  const whenDone = function (stripeErr, stripeSubscription) {
    if (stripeErr) {
      callback(stripeErr)
    } else {
      _.set(subscription, 'metadata.stripeSubscription', _.get(stripeSubscription, 'id'))
      callback(null, { user, account, subscription })
    }
  }

  // Call Stripe API
  if (stripeSubscriptionId) { stripe.customers.updateSubscription(stripeCustomerId, stripeSubscriptionId, stripeSubscriptionObj, whenDone) } else { stripe.customers.createSubscription(stripeCustomerId, stripeSubscriptionObj, whenDone) }
}

// API methods

// CREATE
const createSubscription = function ({ user, account, subscription, payment }, callback) {
  // NOTE: _.has() doesn't work on Mongoose objects, but _.get() does.
  if (_.get(account, 'metadata.stripeCustomer')) {
    createStripeSubscription({ user, account, subscription, payment }, callback)
  } else {
    createStripeUserAndSubscription({ user, account, subscription, payment }, callback)
  }
}

// DELETE
const deleteSubscription = function (subscription, callback) {
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)
  if (stripeSubscriptionId) {
    stripe.subscriptions.del(stripeSubscriptionId, (stripeErr, stripeSubscription) => {
      if (stripeErr) console.log(`deleteSubscription: ${stripeErr}`)
      if (callback) callback(stripeErr, { subscription: stripeSubscription })
    })
  } else {
    if (callback) callback()
  }
}

// Webhook for renewal
const receiveRenewSubscription = function (req, callback) {
  const webhookType = _.get(req, 'body.type')
  const stripeCustomerId = _.get(req, 'body.data.object.customer')
  const stripeSubscriptionId = _.get(req, 'body.data.object.subscription')
  console.log(`Stripe "${webhookType}" webhook received`)
  if (webhookType === 'invoice.payment_succeeded' && stripeCustomerId) {
    const lineItems = _.get(req, 'body.data.object.lines.data')
    // If contains 'year', then extend a year etc
    const interval = _.some(lineItems, { plan: { interval: 'year' } }) ? 'year' : 'month'
    // TODO: use interval_count from Stripe
    const intervalCount = 1
    console.log(`Stripe "invoice.payment_succeeded" webhook for customer ${stripeCustomerId}, subscription ${stripeSubscriptionId}, extend ${intervalCount} ${interval}(s)`)
    // Look up Account and Subscriptions in database
    const query = { 'metadata.stripeCustomer': stripeCustomerId }
    Account.findOne(query).exec((accountErr, account) => {
      if (!accountErr && account) {
        const subscriptions = _.chain(account.subscriptions).filter(sub => _.get(sub, 'metadata.stripeSubscription') === stripeSubscriptionId).value()
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
  createSubscription: createSubscription,
  updateSubscription: updateStripeSubscription,
  deleteSubscription: deleteSubscription,

  // receiveRenewSubscription(req, callback)
  //   callback(err, { account, subscriptions, interval, intervalCount })
  //   Payload in req: https://stripe.com/docs/api#invoice_object
  receiveRenewSubscription: receiveRenewSubscription

}
