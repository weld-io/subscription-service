//
// Name:    account.js
// Purpose: Database model for Account
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AccountSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true },
	name: { type: String },
	email: { type: String, unique: true, required: true, sparse: true },
	dateCreated: { type: Date, default: Date.now },
});

mongoose.model('Account', AccountSchema);