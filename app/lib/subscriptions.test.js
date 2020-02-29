const {
  createSubscriptionObject
} = require('./subscriptions')

const { closeDatabase } = require('../config/database')

describe('subscriptions.js', function () {
  afterAll(() => { closeDatabase() })

  it('should createSubscriptionObject', function () {
    const account = {}
    const req = {
      params: {
        userReference: 'jane'
      },
      body: {
        email: 'jane@doe.com'
      }
    }

    expect(
      createSubscriptionObject(account, req)
    ).toEqual(
      {
        user: {
          reference: 'jane'
        },
        account: {
          email: 'jane@doe.com'
        },
        newSubscription: {
          billing: 'month',
          email: 'jane@doe.com'
        }
      }
    )
  })
})
