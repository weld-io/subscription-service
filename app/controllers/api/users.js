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

const lookupAccountID = function (req, res, next) {
	Account.findOne({ slug: req.body.account }, function (err, account) {
		if (!err) {
			if (account) {
				req.body.account = account._id;
			}
			else {
				res.status(404);
				err = 'Account not found: ' + req.body.account
			}
		}
		next(err);
	});
};

const populateAccount = function (req, res, next) {
	req.crudify.user.populate('account', next);
}

const stripIds = function (req, res, next) {
	req.crudify.user = req.crudify.user.toObject();
	delete req.crudify.user._id;
	delete req.crudify.user.__v;
	next();
}

// Public API

module.exports = function (app, config, authController) {

	app.use(
		'/api/users',
		mongooseCrudify({
			Model: User,
			identifyingKey: 'externalId',
			beforeActions: [
				{ middlewares: [lookupAccountID], only: ['create'] },
				{ middlewares: [populateAccount], only: ['read'] },
				{ middlewares: [stripIds], only: ['read'] },
			],
			afterActions: [
				{ middlewares: [stripIds] },
			],
		})
	);

};