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

const temporaryLogProperties = function (req, res, next) {
	console.log('temporaryLogProperties:');
	// Get types for all properties for the arguments object
	let result = {};
	for (let key in arguments) {
		result[key] = typeof(arguments[key]);
	}
	console.log(result);
	next();
};

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
				{ middlewares: [temporaryLogProperties] },
			],
		})
	);

};