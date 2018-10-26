'use strict'

const _ = require('lodash')
const test = require('tape')
const request = require('supertest')
const async = require('async')

// const helpers = require('../app/config/helpers')

let planReference
let userReference

test('Test the Subscriptions API', function (assert) {
  const app = require('../app/app')
  async.waterfall([
    // Get plans (GET)
    (cb) => request(app).get('/api/plans').expect(200, cb),
    // Verify the results
    (results, cb) => {
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
    }

    /*
    // Create new subscription (POST)
    (results, cb) => request(app).post(`/api/users/${userReference}/subscriptions`).send({ "plan": planReference }).set('Accept', 'application/json').expect(200, cb),
    // Verify the results
    (results, cb) => {
      //assert.equal(_.get(results, 'body.account', '').length, 24, 'User.account is a 24 byte string')
      cb(null, results)
    }
  */

  ],
  (err, results) => {
    console.log(`DONE!`, { err })
    app.closeDatabase()
    assert.end()
  }
  )
})
