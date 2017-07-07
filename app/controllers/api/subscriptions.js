//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

'use strict';

const express = require('express');
const _ = require('lodash');
const mongooseCrudify = require('mongoose-crudify');

const helpers = require('../../config/helpers');

const Account = require('mongoose').model('Account');

module.exports = function (app, config, authController) {

	const router = express.Router();
	app.use('/', router);

	// CRUD routes
	router.get('/api/accounts/:accountId/subscriptions',
		function (req, res, next) {
			res.json([{}]);
		}
	);

	router.get('/api/accounts/:accountId/subscriptions/:id',
		function (req, res, next) {
			res.json({});
		}
	);
	
	router.post('/api/accounts/:accountId/subscriptions',
		function (req, res, next) {
			res.json({});
		}
	);
	
	router.put('/api/accounts/:accountId/subscriptions/:id',
		function (req, res, next) {
			res.json({});
		}
	);
	
	router.delete('/api/accounts/:accountId/subscriptions/:id',
		function (req, res, next) {
			res.json({});
		}
	);

};