//
// Name:    subscriptions.js
// Purpose: Controller and routing for subscriptions (Account has Plans)
// Creator: Tom Söderlund
//

'use strict';

const _ = require('lodash');
const async = require('async');
const express = require('express');
const fetch = require('node-fetch');
const mongooseCrudify = require('mongoose-crudify');

const helpers = require('../../config/helpers');
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'stripe';
const paymentProvider = require('../../paymentProviders/' + PAYMENT_PROVIDER);

const Account = require('mongoose').model('Account');
const User = require('mongoose').model('User');
const Plan = require('mongoose').model('Plan');

const getAccountThen = function (req, res, callback) {
	const query = { reference: req.params.accountReference || req.params.userReference };
	// accountReference provided
	if (req.params.accountReference) {
		Account.findOne(query).exec(callback);
	}
	// userReference provided
	else if (req.params.userReference) {
		User.findOne(query).exec((err, user) => {
			Account.findById(user.account).exec(callback);
		});
	}	
};

const subscriptions = {

	list: function (req, res, next) {
		getAccountThen(req, res, (err, account) => res.json(account.subscriptions));
	},

	read: function (req, res, next) {
		res.json({});
	},

	create: function (req, res, next) {

		// TODO: update to use Plan.allowMultiple instead (e.g. multiple domains)
		const stopOtherSubscriptions = (account, cb) => {

			const stopOneSubscription = sub => {
				sub.dateStopped = Date.now();
				paymentProvider.deleteSubscription(sub);
			};

			if (process.env.MULTIPLE_SUBSCRIPTIONS !== 'yes') {
				_.forEach(account.subscriptions, stopOneSubscription);
			};

			cb(null, account);
		};

		const createSubscriptionObject = function (account, cb) {
			const subscription = _.merge({}, req.body);
			const user = { reference: req.params.userReference };
			cb(null, user, account, subscription);
		};

		const createPaymentProviderSubscription = function (user, account, subscription, cb) {
			// Use ?ignorePaymentProvider=true on URL to avoid Stripe subscriptions being created, e.g. for migration purposes
			_.has(req, 'query.ignorePaymentProvider')
				? cb(null, user, account, subscription)
				: paymentProvider.createSubscription(
						/* user */ user,
						/* account */ account,
						/* subscription */ subscription,
						/* payment */ { token: req.body.token, /* taxPercent: */ },
						cb
					);
		};

		const getPlanId = function (user, account, subscription, cb) {
			helpers.changeReferenceToId({ modelName:'Plan', parentCollection:'plan', childIdentifier:'reference' }, { body: subscription }, res, (err, plan) => cb(err, account, subscription));
		};

		const addSubscriptionToUser = function (account, subscription, cb) {
			subscription.dateExpires = req.body.dateExpires
				? req.body.dateExpires
				: req.body.billing === 'year'
					? helpers.dateIn1Year()
					: helpers.dateIn1Month();
			account.subscriptions.push(helpers.toJsonIfNeeded(subscription));
			account.save(cb);
		};

		const sendResponse = function (err, account) {
			helpers.sendResponse.call(res, err, _.get(account, 'subscriptions'));
		};

		async.waterfall([
				getAccountThen.bind(this, req, res),
				stopOtherSubscriptions,
				createSubscriptionObject,
				createPaymentProviderSubscription,
				getPlanId,
				addSubscriptionToUser,
			],
			sendResponse
		);

	},

	update: function (req, res, next) {

		const getSubscriptionIndex = account => _.findIndex(_.get(account, 'subscriptions'), sub => sub._id.toString() === req.params.subscriptionId);

		const updatePaymentProviderSubscription = function (account, cb) {
			paymentProvider.updateSubscription(
				/* user */ { reference: req.params.userReference },
				/* account */ account,
				/* subscription */ { plan: req.body.plan, billing: req.body.billing },
				/* payment */ { token: req.body.token, /* taxPercent: */ },
				cb
			);
		};

		const updateSubscription = function (user, account, subscription, cb) {
			const subscriptionIndex = getSubscriptionIndex(account);
			if (subscriptionIndex >= 0) {
				_.merge(account.subscriptions[subscriptionIndex], req.body);
			};
			account.save(cb);
		};

		const sendResponse = function (err, account) {
			helpers.sendResponse.call(res, err, _.get(account, 'subscriptions.' + getSubscriptionIndex(account)));
		};

		async.waterfall([
				getAccountThen.bind(this, req, res),
				updatePaymentProviderSubscription,
				updateSubscription,
			],
			sendResponse
		);

	},

	delete: function (req, res, next) {
		getAccountThen(req, res, (err, account) => {
			let subsStopped = 0;
			_.forEach(account.subscriptions, sub => {
				if (req.params.subscriptionId === undefined // stop all
					|| sub._id.toString() === req.params.subscriptionId) // stop one
				{
					sub.dateStopped = Date.now();
					subsStopped++;
				}
			});
			account.save((err, results) => helpers.sendResponse.call(res, err, { message: `Stopped ${subsStopped} subscriptions` }));
		});
	},

	renew: function (req, res, next) {

		// This is the optional _outbound_ webhook to notify other webservices. It uses the WEBHOOK_RENEW_SUBSCRIPTION environment variable.
		const postOutboundRenewWebhook = function ({ account, users, subscriptions, interval, intervalCount }, callback) {
			if (process.env.WEBHOOK_RENEW_SUBSCRIPTION) {
				fetch(process.env.WEBHOOK_RENEW_SUBSCRIPTION,
						{
							method: 'POST',
							headers: {
								'Accept': 'application/json',
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								type: 'renew',
								account: account,
								users: users,
								subscriptions: subscriptions,
								interval: interval,
								intervalCount: intervalCount,
							}),
						}
					)
					.then(callback);
				if (callback) callback();
			}
			else {
				if (callback) callback();
			}
		};

		paymentProvider.receiveRenewSubscription(req, function (err, { account, subscriptions, interval, intervalCount }) {
			if (!err) {
				subscriptions.forEach(sub => {
					sub.dateExpires = interval === 'year' ? helpers.dateIn1Year() : helpers.dateIn1Month();
				});
				account.save();
				User.find({ account: account._id }).exec((err, users) => {
					postOutboundRenewWebhook({ account, users, subscriptions, interval, intervalCount });
				});
				res.send({ message: `Updated account and ${subscriptions.length} subscription(s)` });
			}
			else {
				res.setStatus(400).send({ message: err });
			}
		})
	},

}

module.exports = function (app, config) {

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
	router.get('/api/users/:userReference/subscriptions', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.list);
	router.get('/api/users/:userReference/subscriptions/:subscriptionId', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.read);
	router.post('/api/users/:userReference/subscriptions', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.create);
	router.put('/api/users/:userReference/subscriptions/:subscriptionId', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.update);
	router.delete('/api/users/:userReference/subscriptions/:subscriptionId', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.delete);
	router.delete('/api/users/:userReference/subscriptions', helpers.checkIfAuthorizedUser.bind(this, 'params.userReference'), subscriptions.delete);

	// Receive webhook from e.g. Stripe
	router.post('/api/subscriptions/renew', subscriptions.renew);

};