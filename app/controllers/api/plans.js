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

// Public API

module.exports = function (app, config, authController) {

	app.use(
		'/api/plans',
		mongooseCrudify({
			Model: Plan,
			identifyingKey: identifyingKey,
			beforeActions: [
				{ middlewares: [helpers.generateReferenceFromNameOrEmail, helpers.lookupChildIDs.bind(this, 'Service', 'reference', 'services')], only: ['create'] },
				{ middlewares: [helpers.populateProperties.bind(this, { modelName:'plan', propertyName:'services' })], only: ['read'] },
			],
			endResponseInAction: false,
			afterActions: [
				{ middlewares: [helpers.stripAndSend.bind(this, { identifyingKey: identifyingKey })] },
			],
		})
	);

};