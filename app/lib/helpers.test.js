const {
  isSubscriptionActive
} = require('./helpers')

describe('helpers.js', function () {
  it('should isSubscriptionActive', function () {
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const subscription = {
      dateExpires: oneYearFromNow
    }
    const result = isSubscriptionActive(subscription)
    console.log('isSubscriptionActive:', result)
    expect(result).toEqual(true)
  })
})
