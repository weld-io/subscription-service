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
