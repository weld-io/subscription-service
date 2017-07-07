//
// Name:    accounts.js
// Purpose: Controller and routing for Account model
// Creator: Tom Söderlund
//

'use strict';

const mongooseCrudify = require('mongoose-crudify');
const helpers = require('../../config/helpers');
const Account = require('mongoose').model('Account');

// Private functions

const identifyingKey = 'reference';

// Public API

module.exports = function (app, config, authController) {

	app.use(
		'/api/accounts',
		mongooseCrudify({
			Model: Account,
			identifyingKey: identifyingKey,
			beforeActions: [
				{ middlewares: [helpers.generateReferenceFromNameOrEmail], only: ['create'] },
			],
			endResponseInAction: false,
			afterActions: [
				{ middlewares: [helpers.stripAndSend.bind(this, { identifyingKey: identifyingKey })] },
			],
		})
	);

};