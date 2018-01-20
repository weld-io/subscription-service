//
// Name:    plans.js
// Purpose: Controller and routing for Plan model
// Creator: Tom Söderlund
//

'use strict';

const _ = require('lodash');
const mongooseCrudify = require('mongoose-crudify');
const helpers = require('../../config/helpers');
const Plan = require('mongoose').model('Plan');

// Private functions

const identifyingKey = 'reference';

const listPlans = (req, res, next) => {
	let query = { isAvailable: { $ne: false } };
	if (!_.isEmpty(req.query.tag)) {
		query.tags = req.query.tag;
	}
	const sorting = { position: 1 };
	Plan.find(query).sort(sorting).exec((err, result) => {
		req.crudify = req.crudify || {};
		req.crudify.err = err;
		req.crudify.result = result;
		next();
	});
}

const servicesAsCollection = function (req, res, next) {
	const convertServices = plan => {
		plan = helpers.toJsonIfNeeded(plan);
		plan.services = helpers.arrayToCollection(plan.services);
		return plan;
	};

	req.crudify.result = helpers.applyToAll(convertServices, req.crudify.result);
	next();
};

const addUsersActivePlan = function (req, res, next) {
	const checkActivePlan = plan => {
		plan = helpers.toJsonIfNeeded(plan);
		plan.isActive = false; // TODO: replace with user->account->subscriptions->plan check, using req.user.d.uid
		return plan;
	};

	req.crudify.result = helpers.applyToAll(checkActivePlan, req.crudify.result);
	next();
};

const showCorrectVAT = function (req, res, next) {
	helpers.toJsonIfNeeded(req.crudify.result);

	const vatPercent = (parseFloat(process.env.VAT_PERCENT) || 20) / 100;

	const calculateVatAmount = (amount, percent, isIncluded, userPaysVAT) => _.round(
			userPaysVAT
				? isIncluded
					? amount * percent /* Just % of AmountWith */
					: amount / (1-percent) - amount /* AmountWith - AmountWithout */
				: 0 /* No VAT if user doesn't pay VAT */
		, 3);

	const calculatePriceAmount = (amount, percent, includedInPrice, userPaysVAT) => _.round(
			userPaysVAT
				? includedInPrice
					? amount /* Amount is included, and that's what User should see */
					: amount / (1-percent)
				: includedInPrice
					? amount * (1-percent)
					: amount /* Amount is NOT included, and that's what User should see */
		, 3);

	const calculatePlanVAT = plan => {
		helpers.toJsonIfNeeded(plan);
		plan.vat = {};
		_.forEach(plan.price, (amount, timeUnit) => {
			if (timeUnit !== 'vatIncluded') {
				plan.vat[timeUnit] = calculateVatAmount(amount, vatPercent, plan.price.vatIncluded, (req.query.includeVAT !== 'false'));
				plan.price[timeUnit] = calculatePriceAmount(amount, vatPercent, plan.price.vatIncluded, (req.query.includeVAT !== 'false'));
			}
		})
		return plan;
	};

	req.crudify.result = helpers.applyToAll(calculatePlanVAT, req.crudify.result);
	next();
};

const sortByPosition = function (req, res, next) {
	helpers.toJsonIfNeeded(req.crudify.result);
	req.crudify.result = _.sortBy(req.crudify.result, ['position']);
	next();
};

// Public API

module.exports = function (app, config) {

	app.use(
		'/api/plans',
		mongooseCrudify({
			Model: Plan,
			identifyingKey: identifyingKey,
			beforeActions: [
				{ middlewares: [helpers.changeReferenceToId.bind(this, { modelName:'Service', parentProperty:'services', childIdentifier:'reference' })], only: ['create'] },
				{ middlewares: [helpers.populateProperties.bind(this, { modelName:'plan', propertyName:'services' })], only: ['read'] },
			],
			actions: {
				// override list
				list: listPlans,
			},
			endResponseInAction: false,
			afterActions: [
				{ middlewares: [sortByPosition], only: ['list'] },
				{ middlewares: [showCorrectVAT, addUsersActivePlan], only: ['list', 'read'] },
				{ middlewares: [servicesAsCollection], only: ['read'] }, // see also populateProperties above
				{ middlewares: [helpers.sendRequestResponse] },
			],
		})
	);

};