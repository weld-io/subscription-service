//
// Name:    service.js
// Purpose: Database model for Service, features included in a Plan
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true },
	name: { type: String },
	description: { type: String },
	dateCreated: { type: Date, default: Date.now },
});

mongoose.model('Service', ServiceSchema);