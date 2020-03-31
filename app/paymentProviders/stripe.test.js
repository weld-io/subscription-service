const {
  scaffoldStripeSubscription,
  scaffoldStripeCustomer
} = require('./stripe')

describe('stripe.js', function () {
  it('should scaffoldStripeCustomer', function () {
    const user = { reference: '5e15dd1d7279833485693544' }
    const account = {}
    const payment = {}
    const result = scaffoldStripeCustomer({ user, account, payment })
    expect(result).toEqual({
      description: undefined,
      email: undefined,
      metadata: Object({ user_id: '5e15dd1d7279833485693544' }),
      payment_method: undefined,
      invoice_settings: Object({ default_payment_method: undefined })
    })
  })

  it('should scaffoldStripeSubscription', function () {
    const stripeCustomerId = 'cus_78M9p0GSJymN8d'
    const subscription = { plan: 'enterprise' }
    const payment = { token: '12345' }
    const result = scaffoldStripeSubscription({ stripeCustomerId, subscription, payment })
    expect(result).toEqual({
      customer: 'cus_78M9p0GSJymN8d',
      items: [ Object({ plan: 'enterprise_month' }) ],
      expand: [ 'latest_invoice.payment_intent' ],
      source: '12345',
      // plan: 'enterprise_month',
      coupon: undefined,
      tax_percent: undefined
    })
  })
})
