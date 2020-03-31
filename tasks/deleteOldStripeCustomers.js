/**
 * deleteOldStripeCustomers command-line task
 * @description Delete old customers from Stripe
 * @module deleteOldStripeCustomers
 * @author Tom Söderlund
 */

require('dotenv').config()

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function deleteOldStripeCustomers () {
  const customerIds = ['cus_78M9p0GSJymN8d']
  for (var i = 0; i < customerIds.length; i++) {
    try {
      const confirmation = await stripe.customerIds.del(customerIds[i])
      console.log(customerIds[i], confirmation)
    } catch (err) {
      console.warn(customerIds[i], err.toString())
    }
    await timeout(100)
  }
}

const ARGUMENTS = []

if ((process.argv.length - 2) < ARGUMENTS.length) {
  console.log('Usage: node tasks/deleteOldStripeCustomers ' + ARGUMENTS.map(str => `[')[0]]`).join(' '))
  console.log('  E.g: node tasks/deleteOldStripeCustomers ' + ARGUMENTS.map(str => str.split(':')[1] || '“something”').join(' '))
} else {
  const argumentObj = process.argv.slice(2).reduce((result, value, index) => ({ ...result, [ARGUMENTS[index] ? ARGUMENTS[index].split(':')[0] : `arg`]: value }), {})
  deleteOldStripeCustomers(argumentObj)
}
