const { omit } = require('lodash')

const {
  getAccount,
  createSubscriptionObject,
  getPlanForSubscription,
  getPlansForOldSubscriptions,
  isSubscriptionWithoutAllowMultiple,
  getActiveSubscriptionsWithoutAllowMultiple,
  findCurrentActiveSubscriptions,
  updateSubscriptionOnAccount
  // updatePaymentProviderSubscription,
  // createOrUpdatePaymentProviderSubscription,
  // getSubscriptionIndex,
  // mergeAndUpdateSubscription,
  // postOutboundRenewWebhook,
  // renewSubscriptionAndAccount
} = require('./subscriptions')

const { closeDatabase } = require('../config/database')

const IN_THE_FUTURE = new Date('2040-01-01')

process.env.PAYMENT_PROVIDER = 'test'
process.env.CACHE_PROVIDER = 'test'

const DUMMY_USER = {
  account: {
    reference: 'tomorroworld',
    metadata: {
      userId: '534fd70294b7ec0b2',
      stripeCustomer: 'cus_6XFdsNoloLDHwv'
    },
    email: 'tom@weld.io',
    subscriptions: [
      {
        metadata: {
          stripeSubscription: 'sub_EUCgT0g68O6dB'
        },
        dateExpires: IN_THE_FUTURE,
        _id: '5c5c46d6b47b43001772aa9',
        dateCreated: '2019-02-07T14:55:18.185Z',
        billing: 'month',
        plan: {
          name: 'Single Website',
          reference: 'single-website-2018',
          price: {
            vatIncluded: true,
            year: 55,
            month: 5
          },
          isAvailable: false
        }
      },
      {
        metadata: {
          stripeSubscription: 'sub_GoQ9jdE7z5yHB'
        },
        dateExpires: IN_THE_FUTURE,
        _id: '5e57d170d521ed00176b605',
        dateCreated: '2020-02-27T14:25:52.744Z',
        billing: 'month',
        plan: {
          name: 'Single Website',
          reference: 'single-website-2020',
          price: {
            vatIncluded: true,
            year: 110,
            month: 10
          },
          isAvailable: true
        }
      }
    ],
    dateCreated: '2018-01-31T09:28:24.900Z'
  },
  reference: '534fd70294b7ec0b2',
  consumables: [],
  dateCreated: '2018-01-31T09:28:24.905Z',
  plans: [
    'single-website-2018',
    'single-website-2020'
  ],
  services: {
    'watermark-removal': {
      reference: 'watermark-removal',
      name: 'Remove watermark',
      description: 'Remove the Weld watermark.',
      dateCreated: '2020-03-04T21:01:42.694Z'
    },
    'domain-renewal': {
      reference: 'domain-renewal',
      name: 'Automatic domain renewal',
      description: 'Renew your domains (.COM, etc) automatically.',
      dateCreated: '2020-03-04T21:01:42.694Z'
    }
  }
}

const DUMMY_PLANS = [
  {
    _id: '5a6999c823543200141f0382',
    metadata: {
      comment: 'From user: 534fd70294b7ec0b00000002'
    },
    name: 'Enterprise',
    reference: 'enterprise',
    description: 'Weld for Enterprise',
    features: [],
    __v: 0,
    services: [
      '5a6a4d44734d1d630317c30b',
      '5a6a4d91734d1d630317c3f8',
      '5a6a4d9a734d1d630317c44f',
      '5a6a4da8734d1d630317c476'
    ],
    consumables: [],
    allowMultiple: false,
    isAvailable: true,
    dateCreated: '2018-01-25T08:48:08.771Z',
    tags: [
      'migrated_from_weld-angular-node',
      'enterprise'
    ],
    featureDescriptions: [
      'Embedded content and standalone websites',
      'Real-time collaboration in teams',
      'User access rights',
      'Custom fonts and Google fonts',
      'Custom objects with HTML/CSS/JavaScript',
      'Native integrations with CMS/e-commerce platforms',
      'High performance servers using global CDN',
      'Premium support (chat, phone)',
      'Workshop: Creating your first campaign',
      'Customer success manager'
    ],
    vat: {},
    isActive: false
  },
  {
    _id: '5bf4066ce7179a56e21360d2',
    name: 'Personal',
    reference: 'personal-2019',
    features: [],
    services: [
      '5a6a4d44734d1d630317c30b',
      '5a6a4d91734d1d630317c3f8',
      '5a6a4da8734d1d630317c476'
    ],
    consumables: [],
    price: {
      month: 125,
      year: 1375,
      vatIncluded: false,
      currency: '€'
    },
    allowMultiple: false,
    isAvailable: true,
    dateCreated: '2018-11-20T14:00:00.000Z',
    tags: [
      'personal'
    ],
    featureDescriptions: [
      'Embedded content and standalone websites',
      'Single user',
      'Google fonts',
      'Chat support during office hours'
    ],
    vat: {
      month: 25,
      year: 275
    },
    isActive: false
  }
]

const DUMMY_SUBSCRIPTIONS = [
  { plan: '5a6999c823543200141f0382' },
  { plan: '5bf4066ce7179a56e21360d2', allowMultiple: true }
]

describe('subscriptions.js', function () {
  afterAll(() => { closeDatabase() })

  it('should getAccount', async function () {
    const account = await getAccount({ accountReference: 'tomorroworld' })
    expect(
      typeof account.dateCreated
    ).toEqual(
      'object'
    )
  })

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

  it('should getPlanForSubscription', async function () {
    const result = await getPlanForSubscription({ plan: 'enterprise' })
    const resultsExclDateAndID = omit(result, ['_id', 'dateCreated', '__v'])
    expect(
      resultsExclDateAndID
    ).toEqual(
      {
        // _id: '5e581a4c1d92134abd0b4fb',
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

  it('should getPlansForOldSubscriptions', async function () {
    const account = await getAccount({ accountReference: 'tomorroworld' })
    const result = await getPlansForOldSubscriptions(account)
    expect(Array.isArray(result)).toEqual(true)
  })

  it('should isSubscriptionWithoutAllowMultiple', function () {
    const result = isSubscriptionWithoutAllowMultiple(DUMMY_SUBSCRIPTIONS[0], DUMMY_PLANS)
    // console.log(`isSubscriptionWithoutAllowMultiple:`, result)
    expect(result).toEqual(true)
  })

  it('should getActiveSubscriptionsWithoutAllowMultiple', function () {
    const result = getActiveSubscriptionsWithoutAllowMultiple({ subscriptions: DUMMY_SUBSCRIPTIONS }, DUMMY_PLANS)
    // console.log(`getActiveSubscriptionsWithoutAllowMultiple:`, result)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should findCurrentActiveSubscriptions', function () {
    const result = findCurrentActiveSubscriptions({ account: DUMMY_USER.account, oldPlans: DUMMY_PLANS, newPlan: DUMMY_PLANS[0] })
    // console.log(`findCurrentActiveSubscriptions:`, result)
    expect(result).toBeDefined()
  })

  it('should updateSubscriptionOnAccount', async function () {
    const account = {
      subscriptions: [],
      save: () => console.log('account.save')
    }
    const result = await updateSubscriptionOnAccount({ account, subscription: DUMMY_USER.account.subscriptions[0], newPlan: DUMMY_PLANS[0], dateExpires: IN_THE_FUTURE, isNew: true })
    // console.log(`updateSubscriptionOnAccount:`, result)
    expect(Object.keys(result[0])).toEqual(['metadata', 'dateExpires', '_id', 'dateCreated', 'billing', 'plan'])
  })

  // it('should getSubscriptionIndex', async function () {
  //   const result = await getSubscriptionIndex()
  //   console.log(`getSubscriptionIndex:`, result)
  //   expect(result).toEqual(true)
  // })

  // it('should mergeAndUpdateSubscription', async function () {
  //   const result = await mergeAndUpdateSubscription()
  //   console.log(`mergeAndUpdateSubscription:`, result)
  //   expect(result).toEqual(true)
  // })

  // it('should postOutboundRenewWebhook', async function () {
  //   const result = await postOutboundRenewWebhook()
  //   console.log(`postOutboundRenewWebhook:`, result)
  //   expect(result).toEqual(true)
  // })

  // it('should renewSubscriptionAndAccount', async function () {
  //   const result = await renewSubscriptionAndAccount()
  //   console.log(`renewSubscriptionAndAccount:`, result)
  //   expect(result).toEqual(true)
  // })
})
