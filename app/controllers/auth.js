'use strict'

const jwt = require('express-jwt')

module.exports = function (app, config) {
  // Sets the JWT properties req.user.d.uid and req.user.d.role
  if (process.env.DISABLE_JWT !== 'true') {
    console.log('JWT authentication is enabled.')
    app.use(
      jwt({ secret: process.env.JWT_SECRET })
      // When not to use JWT:
        .unless({ path: [
          // Root page for uptime checks
          { url: '/', methods: ['GET'] },
          // Everything with Plans
          { url: /\/api\/plans/i, methods: ['GET'] },
          // Create new User
          { url: '/api/users', methods: ['POST'] },
          // Stripe renewal
          '/api/subscriptions/renew'
        ] })
    )
  } else {
    console.log('JWT authentication is disabled.')
  }
}
