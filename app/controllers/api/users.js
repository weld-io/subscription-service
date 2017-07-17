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

const identifyingKey = 'reference';

const addServices = function (req, res, next) {
	req.crudify.user.getServices((err, services) => {
		req.crudify.result = req.crudify.result.toJSON();
		req.crudify.result.services = services;
		next();
	})
};

// Public API

module.exports = function (app, config, authController) {

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
				{ middlewares: [addServices], only: ['read'] },
				{ middlewares: [helpers.sendRequestResponse] },
			],
		})
	);

};