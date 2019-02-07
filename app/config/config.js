const rootPath = require('path').join(__dirname, '/..')
const env = process.env.NODE_ENV || 'development'
console.log(`Environment is "${env}"`)

const config = {

  development: {
    root: rootPath,
    app: {
      name: 'subscription-service'
    },
    port: 3034,
    db: 'mongodb://localhost/subscription-service-development'

  },

  test: {
    root: rootPath,
    app: {
      name: 'subscription-service'
    },
    port: 3000,
    db: process.env.MONGODB_URI || 'mongodb://localhost/subscription-service-test'

  },

  production: {
    root: rootPath,
    app: {
      name: 'subscription-service'
    },
    port: process.env.PORT || 3000,
    db: process.env.MONGODB_URI || 'mongodb://localhost/subscription-service-production'

  }

}

module.exports = config[env]
