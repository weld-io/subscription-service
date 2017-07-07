//
// Name:    account.js
// Purpose: Database model for Account: the company or person who will be billed for the Plan.
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const dateIn30Days = () => new Date((new Date()).getTime() + 30*24*60*60*1000).getTime();

const Company = new Schema({
	name: { type: String },
	vatNumber: { type: String },
});

// Subscription to a Plan
const Subscription = new Schema({
	reference: { type: String, unique: true, sparse: true }, // e.g. attached to certain consumable
	plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
	dateCreated: { type: Date, default: Date.now },
	dateExpires: { type: Date, default: dateIn30Days },
});

const AccountSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true },
	name: { type: String },
	company: Company,
	countryCode: { type: String },
	email: { type: String, unique: true, required: false, sparse: true },
	dateCreated: { type: Date, default: Date.now },
	subscriptions: [Subscription],
});

mongoose.model('Account', AccountSchema);