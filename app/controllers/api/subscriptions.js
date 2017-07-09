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
const User = require('mongoose').model('User');
const Plan = require('mongoose').model('Plan');

const getAccountThen = (req, res, callback) => {
	const query = { reference: req.params.accountReference || req.params.userReference };
	if (req.params.accountReference) {
		Account.findOne(query).exec((err, results) => helpers.sendResponse.call(res, err, results, callback));
	}
	else if (req.params.userReference) {
		User.findOne(query).exec((err, results) => helpers.sendResponse.call(res, err, results, user => {
			Account.findById(user.account).exec((err, results) => helpers.sendResponse.call(res, err, results, callback));
		}));
	}	
}

const subscriptions = {

	list: function (req, res, next) {
		getAccountThen(req, res, account => res.json(account.subscriptions));
	},

	read: function (req, res, next) {
		res.json({});
	},

	create: function (req, res, next) {
		getAccountThen(req, res, account => {
			helpers.changeReferenceToId({ modelName:'Plan', parentCollection:'plan', childIdentifier:'reference' }, req, res, (err, results) => {
				account.subscriptions.push(req.body);
				account.save(helpers.sendResponse.bind(res));
			})
		});
	},

	update: function (req, res, next) {
		getAccountThen(req, res, account => {
			const subscriptionIndex = _.findIndex(account.subscriptions, sub => sub._id.toString() === req.params.subscriptionId);
			if (subscriptionIndex >= 0) {
				_.merge(account.subscriptions[subscriptionIndex], req.body);
			}
			account.save((err, results) => helpers.sendResponse.call(res, err, account.subscriptions[subscriptionIndex]));
		});
	},

	delete: function (req, res, next) {
		getAccountThen(req, res, account => {
			const oldSubscriptionCount = account.subscriptions.length;
			if (req.params.subscriptionId === undefined) {
				// Delete all
				account.subscriptions = [];
			}
			else {
				// Delete one -> remove matching _id (note: toString - _id is object!)
				// Can't use _.reject, must use splice, due to Mongoose
				const subscriptionIndex = _.findIndex(account.subscriptions, sub => sub._id.toString() === req.params.subscriptionId);
				if (subscriptionIndex >= 0) {
					account.subscriptions.splice(subscriptionIndex, 1);
				}
			}
			account.save((err, results) => helpers.sendResponse.call(res, err, { message: `Deleted ${oldSubscriptionCount - results.subscriptions.length} subscriptions` }));
		});
	},

}

module.exports = function (app, config, authController) {

	const router = express.Router();
	app.use('/', router);

	// CRUD routes: Account
	router.get('/api/accounts/:accountReference/subscriptions', subscriptions.list);
	router.get('/api/accounts/:accountReference/subscriptions/:subscriptionId', subscriptions.read);
	router.post('/api/accounts/:accountReference/subscriptions', subscriptions.create);
	router.put('/api/accounts/:accountReference/subscriptions/:subscriptionId', subscriptions.update);
	router.delete('/api/accounts/:accountReference/subscriptions/:subscriptionId', subscriptions.delete);
	router.delete('/api/accounts/:accountReference/subscriptions', subscriptions.delete);

	// CRUD routes: User
	router.get('/api/users/:userReference/subscriptions', subscriptions.list);
	router.get('/api/users/:userReference/subscriptions/:subscriptionId', subscriptions.read);
	router.post('/api/users/:userReference/subscriptions', subscriptions.create);
	router.put('/api/users/:userReference/subscriptions/:subscriptionId', subscriptions.update);
	router.delete('/api/users/:userReference/subscriptions/:subscriptionId', subscriptions.delete);
	router.delete('/api/users/:userReference/subscriptions', subscriptions.delete);

};