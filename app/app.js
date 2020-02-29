const express = require('express')

const config = require('./config/config')
const { closeDatabase } = require('./config/database')

var app = express()
require('./config/express')(app, config)

module.exports = app
module.exports.closeDatabase = closeDatabase
