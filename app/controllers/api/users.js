//
// Name:    users.js
// Purpose: Controller and routing for User model
// Creator: Tom Söderlund
//

'use strict';

const mongooseCrudify = require('mongoose-crudify');
const helpers = require('../../config/helpers');
const User = require('mongoose').model('User');
const Account = require('mongoose').model('Account');

// Private functions

// Public API

module.exports = function (app, config, authController) {

	app.use(
		'/api/users',
		mongooseCrudify({
			Model: User,
			identifyingKey: 'externalId',
			beforeActions: [
				{ middlewares: [helpers.lookupChildIDs.bind(this, 'Account', 'reference', 'account')], only: ['create'] },
				{ middlewares: [helpers.populateProperties.bind(this, 'user', 'account')], only: ['read'] },
				{ middlewares: [helpers.stripIds.bind(this, 'user')], only: ['read'] },
			],
			afterActions: [
				//{ middlewares: [helpers.stripIds.bind(this, 'user')] },
			],
		})
	);

};