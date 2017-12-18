//
// Name:    users.js
// Purpose: Controller and routing for User model
// Creator: Tom Söderlund
//

'use strict';

const _ = require('lodash');
const mongooseCrudify = require('mongoose-crudify');
const helpers = require('../../config/helpers');
const User = require('mongoose').model('User');
const Account = require('mongoose').model('Account');

// Private functions

const identifyingKey = 'reference';

const addPlans = function (req, res, next) {
	req.crudify.user.getSubscriptionPlans({ includeAllSubscriptions: _.get(req, 'query.includeAllSubscriptions') }, (err, { subscriptions, subscriptionsWithPlan }) => {
		req.crudify.result = helpers.toJsonIfNeeded(req.crudify.result);
		req.crudify.result.account.subscriptions = subscriptions;
		req.crudify.result.plans = _(subscriptionsWithPlan).map(subscriptionPlan => subscriptionPlan.plan.reference);
		next();
	})
};

const addServices = function (req, res, next) {
	req.crudify.user.getServices((err, services) => {
		req.crudify.result = helpers.toJsonIfNeeded(req.crudify.result);
		req.crudify.result.services = services;
		next();
	})
};

// Public API

module.exports = function (app, config) {

	app.use(
		'/api/users',
		mongooseCrudify({
			Model: User,
			identifyingKey: identifyingKey,
			beforeActions: [
				{ middlewares: [helpers.changeReferenceToId.bind(this, { modelName:'Account', parentCollection:'account', childIdentifier:'reference' })], only: ['create', 'update'] },
				{ middlewares: [helpers.populateProperties.bind(this, { modelName:'user', propertyName:'account' })], only: ['read'] },
			],
			endResponseInAction: false,
			afterActions: [
				{ middlewares: [addPlans, addServices], only: ['read'] },
				{ middlewares: [helpers.sendRequestResponse] },
			],
		})
	);

};