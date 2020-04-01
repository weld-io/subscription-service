//
// Name:    stripe.js
// Purpose: Payment provider configuration for Stripe
// Creator: Tom Söderlund
//

'use strict'

const { chain, get, merge, pick, set, some } = require('lodash')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const { isHexString } = require('../lib/helpers')

// ----- Private functions -----

const getStripeCustomerID = account => get(account, 'metadata.stripeCustomer')
const getStripeSubscriptionID = sub => get(sub, 'metadata.stripeSubscription')

// ----- Scaffolding -----

const scaffoldStripeCustomer = ({ user, account, payment }) => ({
  name: account.name,
  description: account.reference,
  email: account.email,
  address: {
    country: account.countryCode,
    line1: account.name
  },
  metadata: {
    user_id: user.reference
  },
  ...(payment.paymentMethod && {
    payment_method: payment.paymentMethod,
    invoice_settings: {
      default_payment_method: payment.paymentMethod
    }
  })
})

const scaffoldStripeSubscription = ({ stripeCustomerId, subscription, payment }) => {
  // e.g. "enterprise_small_monthly"
  // TODO: Fix ugly hack with isHexString to determine if it's a new plan reference, or a plan._id
  const stripePlanName = isHexString(subscription.plan) ? undefined : `${subscription.plan}_${subscription.billing || 'month'}`
  return {
    ...(stripeCustomerId && {
      customer: stripeCustomerId
    }),
    ...(stripePlanName && {
      // plan: stripePlanName,
      items: [{ plan: stripePlanName }] // includes 'billing' in plan name
    }),
    expand: ['latest_invoice.payment_intent'],
    coupon: subscription.discountCode,
    // quantity: subscription.quantity,
    tax_percent: payment.taxPercent,
    ...(payment.token && {
      source: payment.token
    })
  }
}

// ----- Calling Stripe -----

const createStripeCustomerAndSubscription = async ({ user, account, subscription, payment }) => {
  // if (!payment.paymentMethod) throw new Error(`No paymentMethod provided`)
  const stripeCustomerObj = scaffoldStripeCustomer({ user, account, payment })
  // Call Stripe API
  const { id } = await stripe.customers.create(stripeCustomerObj)
  set(account, 'metadata.stripeCustomer', id)
  account.markModified('metadata')
  // Tax ID
  if (account.vatNumber) {
    try {
      await stripe.customers.createTaxId(id, { value: account.vatNumber, type: account.vatType || 'eu_vat' })
    } catch (err) {
      console.warn(`Tax/VAT ID not correct: ${err.message || err}`, account.name, account.vatNumber)
    }
  }
  // Subscription
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
  set(subscription, 'metadata.stripeSubscription', get(subscriptionResults, 'id'))
  return { user, account, subscription }
}

const replacePaymentMethod = async (stripeCustomerId, newPaymentMethod) => {
  // Optional: Get current paymentMethods
  // Optional: Cancel them all
  // Attach new
  await stripe.paymentMethods.attach(
    newPaymentMethod,
    { customer: stripeCustomerId }
  )
  // Set the new as default
  await stripe.customers.update(
    stripeCustomerId,
    {
      invoice_settings: {
        default_payment_method: newPaymentMethod
      }
    }
  )
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
const updateSubscription = async ({ account, subscription, payment }) => {
  const stripeCustomerId = getStripeCustomerID(account)
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)

  // Update paymentMethod
  if (payment.paymentMethod) {
    await replacePaymentMethod(stripeCustomerId, payment.paymentMethod)
  }

  // Call Stripe API
  const stripeSubscriptionObj = scaffoldStripeSubscription({ stripeCustomerId, subscription, payment })
  if (stripeSubscriptionObj.items) {
    // 'items' exist = update plan & billing
    if (stripeSubscriptionId) {
      const currentStripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
      await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: false,
        items: [{
          id: currentStripeSubscription.items.data[0].id,
          plan: stripeSubscriptionObj.items[0].plan // includes 'billing' in plan name
        }]
      })
    } else {
      const subscriptionResults = await stripe.subscriptions.create(stripeSubscriptionObj)
      set(subscription, 'metadata.stripeSubscription', get(subscriptionResults, 'id'))
    }
  }
  return { account, subscription }
}

const createOrUpdateSubscription = async ({ user, account, existingSubscription, newSubscription, payment }) => {
  // If existing subscription
  // Note: has() doesn’t work on Mongoose objects, but get() does.
  if (get(existingSubscription, 'metadata.stripeSubscription') && get(account, 'metadata.stripeCustomer')) {
    // Update existing
    const updatedSubscription = merge({}, existingSubscription, pick(newSubscription, ['plan', 'billing']))
    return updateSubscription({ account, subscription: updatedSubscription, payment }) // payment.taxPercent
  } else {
    // If NO existing subscription, create new
    const paymentResults = await createSubscription({ user, account, subscription: newSubscription, payment }) // payment.taxPercent
    return { ...paymentResults, isNew: true }
  }
}

// DELETE
const deleteSubscription = async (subscription) => {
  const stripeSubscriptionId = getStripeSubscriptionID(subscription)
  if (!stripeSubscriptionId) throw new Error(`No stripeSubscriptionId`)
  const stripeSubscription = await stripe.subscriptions.del(stripeSubscriptionId)
  return stripeSubscription
}

// Webhook for renewal
const receiveRenewSubscription = async function (requestBody) {
  const webhookType = requestBody.type
  const stripeCustomerId = get(requestBody, 'data.object.customer')
  const stripeSubscriptionId = get(requestBody, 'data.object.subscription')
  console.log(`Stripe "${webhookType}" webhook received`)
  if (webhookType === 'invoice.payment_succeeded' && stripeCustomerId) {
    const lineItems = get(requestBody, 'data.object.lines.data')
    // If contains 'year', then extend a year etc
    const interval = some(lineItems, { plan: { interval: 'year' } }) ? 'year' : 'month'
    // TODO: use interval_count from Stripe
    const intervalCount = 1
    console.log(`Stripe "invoice.payment_succeeded" webhook for customer ${stripeCustomerId}, subscription ${stripeSubscriptionId}, extend ${intervalCount} ${interval}(s)`)
    // Look up Account and Subscriptions in database
    const query = { 'metadata.stripeCustomer': stripeCustomerId }
    const Account = require('mongoose').model('Account')
    const account = await Account.findOne(query).exec()
    if (!account) throw new Error(`Account not found: ${stripeCustomerId}`)
    const subscriptions = chain(account.subscriptions).filter(sub => get(sub, 'metadata.stripeSubscription') === stripeSubscriptionId).value()
    return { account, subscriptions, interval, intervalCount }
  } else {
    throw new Error('No valid Stripe webhook')
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
