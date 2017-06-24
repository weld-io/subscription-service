const express = require('express');
const glob = require('glob');
const mongoose = require('mongoose');

const config = require('./config/config');

mongoose.connect(config.db);
var db = mongoose.connection;
db.on('error', function () {
	throw new Error('unable to connect to database at ' + config.db);
});

// Require in all models
glob.sync(config.root + '/models/*.js').forEach(require);

var app = express();
require('./config/express')(app, config);

module.exports = app;
module.exports.closeDatabase = function () {
	mongoose.connection.close();
};
