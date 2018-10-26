'use strict'

const _ = require('lodash')
const test = require('tape')
const request = require('supertest')
const async = require('async')

// const helpers = require('../app/config/helpers')

test('Test the Users API', function (assert) {
  const app = require('../app/app')
  async.waterfall([
    // Get users (GET)
    (cb) => request(app).get('/api/users').expect(200, cb),
    // Verify the results
    (results, cb) => {
      assert.equal(_.get(results, 'body.0.account', '').length, 24, 'User.account is a 24 byte string')
      // console.log(helpers.specify(results.body[0].account))
      cb(null, results)
    },

    // Create new user and new account (POST)
    (results, cb) => request(app).post('/api/users').send({ 'reference': 'userId1', 'account': { 'name': 'My Test Company', 'email': 'testcompany@weld.io' } }).set('Accept', 'application/json').expect(200, cb),
    // Create new user, same account (POST)
    (results, cb) => request(app).post('/api/users').send({ 'reference': 'userId2', 'account': 'my-test-company' }).set('Accept', 'application/json').expect(200, cb),
    // Verify the results
    (results, cb) => {
      assert.equal(_.get(results, 'body.account', '').length, 24, 'User.account is a 24 byte string')
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
