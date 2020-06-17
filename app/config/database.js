const glob = require('glob')
const mongoose = require('mongoose')

const config = require('./config')

mongoose.Promise = Promise
console.log(`Connecting to database: ${config.db}`)
mongoose.connect(config.db, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })

module.exports.db = mongoose.connection

module.exports.db.on('error', function (error) {
  console.error(`Mongoose error:`, error)
  throw new Error('unable to connect to database at ' + config.db)
})

// Require in all models
glob.sync(config.root + '/models/*.js').forEach(require)

module.exports.closeDatabase = function () {
  mongoose.connection.close()
}
