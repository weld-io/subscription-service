'use strict'

const _ = require('lodash')
const test = require('tape')
const request = require('supertest')
const async = require('async')

// const helpers = require('../app/config/helpers')

let planId
let planReference
let userReference

test('Test the Subscriptions API', function (assert) {
  const app = require('../app/app')
  async.waterfall([
    // Get plans (GET)
    (cb) => request(app).get('/api/plans').expect(200, cb),
    // Verify the results
    (results, cb) => {
      planId = _.get(results, 'body.0._id')
      planReference = _.get(results, 'body.0.reference')
      assert.ok(planReference)
      cb(null, results)
    },

    // Get users (GET)
    (results, cb) => request(app).get('/api/users').expect(200, cb),
    // Verify the results
    (results, cb) => {
      userReference = _.get(results, 'body.0.reference')
      assert.ok(userReference)
      console.log(`Create subscription for:`, { userReference, planReference })
      cb(null, results)
    },

    // Create new subscription (POST)
    // Tokens etc: https://stripe.com/docs/testing#cards
    (results, cb) => request(app).post(`/api/users/${userReference}/subscriptions`).send({ plan: planReference, token: 'tok_mastercard' }).set('Accept', 'application/json').expect(200, cb),
    // Verify the results
    (results, cb) => {
      const lastSubscription = results.body[results.body.length - 1]
      assert.equal(lastSubscription.plan, planId, 'The new subscription has the right plan ID')
      assert.equal(lastSubscription.billing, 'month', 'The new subscription has billing=month if not else specified')
      cb(null, results)
    }

  ],
  (err, results) => {
    console.log(`DONE!`, { err })
    app.closeDatabase()
    assert.end()
  }
  )
})
