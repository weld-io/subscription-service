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

const servicesAsCollection = function (req, res, next) {
	if (req.crudify.result.toJSON) req.crudify.result = req.crudify.result.toJSON();
	req.crudify.result.services = helpers.arrayToCollection(req.crudify.result.services);
	next();
};

const showCorrectVAT = function (req, res, next) {
	if (req.crudify.result.toJSON) req.crudify.result = req.crudify.result.toJSON();

	// TODO: make these not hardcoded
	const vatPercent = 0.25;
	const shouldUserPayVAT = false;
	const vatIncludedInPrice = true;

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
		if (plan.toJSON) plan = plan.toJSON();
		plan.vat = {};
		_.forEach(plan.price, (amount, timeUnit) => {
			plan.vat[timeUnit] = calculateVatAmount(amount, vatPercent, vatIncludedInPrice, shouldUserPayVAT);
			plan.price[timeUnit] = calculatePriceAmount(amount, vatPercent, vatIncludedInPrice, shouldUserPayVAT);
		})
		return plan;
	};

	req.crudify.result = helpers.applyToAll(calculatePlanVAT, req.crudify.result);
	next();
};

const sortByPosition = function (req, res, next) {
	if (req.crudify.result.toJSON) req.crudify.result = req.crudify.result.toJSON();
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
				{ middlewares: [helpers.changeReferenceToId.bind(this, { modelName:'Service', parentCollection:'services', childIdentifier:'reference' })], only: ['create'] },
				{ middlewares: [helpers.populateProperties.bind(this, { modelName:'plan', propertyName:'services' })], only: ['read'] },
			],
			endResponseInAction: false,
			afterActions: [
				{ middlewares: [servicesAsCollection], only: ['read'] },
				{ middlewares: [showCorrectVAT], only: ['read', 'list'] },
				{ middlewares: [sortByPosition], only: ['list'] },
				{ middlewares: [helpers.sendRequestResponse] },
			],
		})
	);

};