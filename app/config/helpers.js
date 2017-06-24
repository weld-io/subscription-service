'use strict';

var _ = require('lodash');

module.exports.toSlug = function (str, removeInternationalChars) {
	// Abort if not a proper string value
	if (!str || typeof(str) !== 'string')
		return str;
	if (removeInternationalChars) {
		return str
			.trim()
			.replace(/ /g,'-') // space to dash
			.replace(/[^\w-]+/g,'') // remove all other characters incl. ÅÄÖ
			.toLowerCase();
	}
	else {
		return str
			.trim()
			.replace(/ /g,'-') // space to dash
			.replace(/[\t.,?;:‘’“”"'`!@#$€%^&§°*<>()\[\]\{\}_\+=\/\|\\]/g,'') // remove invalid characters
			.replace(/---/g,'-') // fix for the ' - ' case
			.toLowerCase();
	}
};

// Simple JSON response, usage e.g. helpers.sendResponse.bind(res) - err, results will be appended to end
module.exports.sendResponse = function (err, results, customErrorCode) {
	if (err) {
		return this.status(customErrorCode || 400).send(err);
	}
	else {
		return this.json(results);
	}
};

module.exports.generateReferenceFromNameOrEmail = function (req, res, next) {
	req.body.reference = module.exports.toSlug(req.body.reference || req.body.name || req.body.email);
	next();
};

module.exports.stripIds = function (propertyName, req, res, next) {
	req.crudify[propertyName] = req.crudify[propertyName].toObject();
	delete req.crudify[propertyName]._id;
	delete req.crudify[propertyName].__v;
	next();
};

// E.g. populate user.account with full Account structure
// helpers.populateProperties.bind(this, 'user', 'account')
module.exports.populateProperties = function (modelName, propertyName, req, res, next) {
	req.crudify[modelName].populate(propertyName, next);
};

// From reference to MongoDB _id (or multiple _id's)
// E.g. user.account = 'my-company' --> user.account = '594e6f880ca23b37a4090fe0'
// helpers.lookupChildIDs.bind(this, 'Service', 'reference', 'services')
module.exports.lookupChildIDs = function (modelName, searchKey, searchValue, req, res, next) {
	let searchQuery = {};
	if (typeof(req.body[searchValue]) === 'string') {
		// One value
		searchQuery[searchKey] = req.body[searchValue];
	}
	else {
		// Array
		searchQuery[searchKey] = { $in: req.body[searchValue] };
	}
	const modelObj = require('mongoose').model(modelName);
	modelObj.find(searchQuery, function (err, results) {
		if (!err) {
			if (results) {
				req.body[searchValue] = (typeof(req.body[searchValue]) === 'string') ? results[0]._id : _.map(results, '_id');
			}
			else {
				res.status(404);
				err = modelName + '(s) not found: ' + req.body[searchValue];
			}
		}
		next(err);
	});
};
