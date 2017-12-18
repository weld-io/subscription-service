//
// Name:    service.js
// Purpose: Database model for Service, features included in a Plan
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const helpers = require('../config/helpers');

const ServiceSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true },
	name: { type: String },
	description: { type: String },
	dateCreated: { type: Date, default: Date.now },
	metadata: {}, // for extra data
},
{
	toJSON: {
		transform: helpers.stripIdsFromRet,
	}
});

// Set reference/slug
ServiceSchema.pre('validate', function (next) {
	const slugSuggestion = this.reference || this.name;
	helpers.getUniqueSlugFromCollection('Service', undefined, slugSuggestion, undefined, (err, uniqueSlug) => {
		this.reference = uniqueSlug;
		next();
	});
});

mongoose.model('Service', ServiceSchema);