'use strict';

var _ = require('lodash');

// Get types for all properties for the arguments object
module.exports.logArguments = function () {
	console.log('logArguments:');
	for (let key in arguments)
		console.log(`  ${key}: ${typeof(arguments[key])}`);
};

// Get types for all properties for the arguments object
module.exports.logProperties = function (obj) {
	console.log('logProperties:');
	for (let key in obj)
		console.log(`  ${key}: ${typeof(obj[key])}`);
};

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

const stripIds = (options, obj) => {
	let newObj = obj.toObject();
	delete newObj._id;
	delete newObj.__v;
	if (options.identifyingKey) {
		newObj.id = newObj[options.identifyingKey];
		delete newObj[options.identifyingKey];
	}
	return newObj;
}

module.exports.stripAndSend = function (options, req, res, next) {
	if (req.crudify.result.length !== undefined)
		// Array
		res.json(_.map(req.crudify.result, stripIds.bind(this, options)));
	else
		// One object
		res.json(stripIds(options, req.crudify.result));
};

// E.g. populate user.account with full Account structure
// helpers.populateProperties.bind(this, 'user', 'account')
module.exports.populateProperties = function ({modelName, propertyName, afterPopulate}, req, res, next) {
	req.crudify[modelName].populate(propertyName, (err, result) => {
		console.log('populateProperties', result);
		result.hello = 1;
		next();
	});
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
