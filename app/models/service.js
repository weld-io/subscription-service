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
});

// Set reference/slug
ServiceSchema.pre('validate', function (next) {
	this.reference = helpers.toSlug(this.reference || this.name);
	next();
});

mongoose.model('Service', ServiceSchema);