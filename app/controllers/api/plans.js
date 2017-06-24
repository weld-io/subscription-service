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

// Public API

module.exports = function (app, config, authController) {

	app.use(
		'/api/plans',
		mongooseCrudify({
			Model: Plan,
			identifyingKey: 'reference',
			beforeActions: [
				{ middlewares: [helpers.generateReferenceFromNameOrEmail, helpers.lookupChildIDs.bind(this, 'Service', 'reference', 'services')], only: ['create'] },
				{ middlewares: [helpers.populateProperties.bind(this, 'plan', 'services')], only: ['read'] },
				{ middlewares: [helpers.stripIds.bind(this, 'plan')], only: ['read'] },
			],
		})
	);

};