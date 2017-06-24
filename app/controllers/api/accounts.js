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

const generateIdFromNameOrEmail = function (req, res, next) {
	req.body.reference = helpers.toSlug(req.body.name || req.body.email);
	next();
};

// Public API

module.exports = function (app, config, authController) {

	app.use(
		'/api/accounts',
		mongooseCrudify({
			Model: Account,
			identifyingKey: 'reference',
			beforeActions: [
				{ middlewares: [generateIdFromNameOrEmail], only: ['create'] },
			],
		})
	);

	/*
	app.use(
		'/api/accounts',
		mongooseCrudify({
			Model: Account, // mongoose model, required
			identifyingKey: 'id', // route param name, defaults to '_id' 
			selectFields: 'pub1 pub2 -secret', // http://mongoosejs.com/docs/api.html#query_Query-select 

			// reuse your existing express.Router() object 
			router: existingRouter

			// load model on update and read actions, defaults to true 
			// store the found model instance in req, eg: req.crudify.account 
			// if changed to false, you must override the update and read middlewares 
			loadModel: true,

			beforeActions: [
				{ middlewares: [ensureLogin], except: ['list', 'read'] // list, create, read, update, delete }
			],
			actions: {
				// default actions: list, create, read, update, delete 
				// any non-overridden action will be in functional 

				//override update 
				update: function (req, res, next) {}
			},
			afterActions: [
				{ middlewares: [updateViewCount], only: ['read'] },
				{ middlewares: [redirectToAccount], only: ['update'] }
			],

			options: {
				// https://expressjs.com/en/api.html#express.router 
				// if no existing router passed in, new one will be created with these options 
				// all default to false 
				caseSensitive: false,
				mergeParams: false,
				strict: false
			}
		})
	);
	*/

};