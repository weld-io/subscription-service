const { omit } = require('lodash')

const {
  createSubscriptionObject,
  getPlanForNewSubscription
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

  it('should getPlanForNewSubscription', async function () {
    const rawResult = await getPlanForNewSubscription({ plan: 'enterprise' })
    const resultsExclDateAndID = omit(rawResult, ['_id', 'dateCreated', '__v'])
    expect(
      resultsExclDateAndID
    ).toEqual(
      {
        // _id: '5e581a4c1d92134abd0b4fb2',
        // dateCreated: '2020-02-27T19:36:44.926Z',
        // __v: 0,
        reference: 'enterprise',
        name: 'Enterprise',
        services: [],
        consumables: [],
        price: {
          month: 9.99
        },
        allowMultiple: false,
        isAvailable: true,
        tags: [],
        featureDescriptions: []
      }
    )
  })
})
