//
// Name:    stripe.js
// Purpose: Payment provider configuration for Stripe
// Creator: Tom Söderlund
//

'use strict'

const { chain, get, has, merge, pick, set, some } = require('lodash')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const { isHexString } = require('../lib/helpers')

// ----- Private functions -----

const getStripeCustomerID = account => get(account, 'metadata.stripeCustomer')
const getStripeSubscriptionID = sub => get(sub, 'metadata.stripeSubscription')

// ----- Scaffolding -----

const scaffoldStripeCustomer = ({ user, account, payment }) => ({
  description: account.reference,
  email: account.email,
  metadata: {
    user_id: user.reference
  },
  payment_method: payment.paymentMethod,
  invoice_settings: {
    default_payment_method: payment.paymentMethod
  }
})

const scaffoldStripeSubscription = ({ stripeCustomerId, subscription, payment }) => {
  // e.g. "enterprise_small_monthly"
  // TODO: Fix ugly hack with isHexString to determine if it's a new plan reference, or a plan._id
  const stripePlanName = isHexString(subscription.plan) ? undefined : `${subscription.plan}_${subscription.billing || 'month'}`
  return {
    customer: stripeCustomerId,
    // plan: stripePlanName,
    items: [{ plan: stripePlanName }],
    expand: ['latest_invoice.payment_intent'],
    source: payment.token,
    coupon: subscription.discountCode,
    // quantity: subscription.quantity,
    tax_percent: payment.taxPercent
  }
}

// ----- Calling Stripe -----

const createStripeCustomerAndSubscription = async ({ user, account, subscription, payment }) => {
  const stripeCustomerObj = scaffoldStripeCustomer({ user, account, payment })
  console.log(`stripeCustomerObj:`, stripeCustomerObj)
  // Call Stripe API
  const customerResults = await stripe.customers.create(stripeCustomerObj)
  console.log(`stripe.customers.create:`, customerResults)
  set(account, 'metadata.stripeCustomer', get(customerResults, 'id'))
  account.markModified('metadata')
  try {
    await createStripeSubscription({ user, account, subscription, payment })
    return { user, account, subscription }
  } catch (error) {
    console.warn(`Warning: ${error.message || error}`)
    return { error, user, account, subscription }
  }
}

const createStripeSubscription = async ({ user, account, subscription, payment }) => {
  const stripeCustomerId = getStripeCustomerID(account)
  const stripeSubscriptionObj = scaffoldStripeSubscription({ stripeCustomerId, subscription, payment })
  // Call Stripe API
  const subscriptionResults = await stripe.subscriptions.create(stripeSubscriptionObj)
  console.log(`stripe.subscriptions.create:`, subscriptionResults)
  set(subscription, 'metadata.stripeSubscription', get(subscriptionResults, 'id'))
  return { user, account, subscription }
}

// ----- API methods -----

// CREATE
const createSubscription = ({ user, account, subscription, payment }) => {
  // Note: has() doesn’t work on Mongoose objects, but get() does.
  if (get(account, 'metadata.stripeCustomer')) {
    return createStripeSubscription({ user, account, subscription, payment })
  } else {
    return createStripeCustomerAndSubscription({ user, account, subscription, payment })
  }
}

// UPDATE
const updateSubscription = async ({ user, account, subscription, payment }) => new Promise(async (resolve, reject) => {
  const stripeCustomerId = getStripeCustomerID(account)
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)
  const stripeSubscriptionObj = scaffoldStripeSubscription({ subscription, payment })

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

const createOrUpdateSubscription = async ({ user, account, existingSubscription, newSubscription, payment }) => {
  console.log(`createOrUpdateSubscription:`, { user, account, existingSubscription, newSubscription, payment })
  if (!payment.paymentMethod) throw new Error(`No paymentMethod provided`)
  // If existing subscription
  if (has(existingSubscription, 'metadata.stripeSubscription') && has(account, 'metadata.stripeCustomer')) {
    // Update existing
    const updatedSubscription = merge({}, existingSubscription, pick(newSubscription, ['plan', 'billing']))
    return updateSubscription({ user, account, subscription: updatedSubscription, payment }) // payment.taxPercent
  } else {
    // If NO existing subscription, create new
    const paymentResults = await createSubscription({ user, account, subscription: newSubscription, payment }) // payment.taxPercent
    return { ...paymentResults, isNew: true }
  }
}

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
  createOrUpdateSubscription,
  deleteSubscription,

  // receiveRenewSubscription(req, callback)
  //   callback(err, { account, subscriptions, interval, intervalCount })
  //   Payload in req: https://stripe.com/docs/api#invoice_object
  receiveRenewSubscription,

  // Internal methods for testing
  scaffoldStripeCustomer,
  scaffoldStripeSubscription

}
