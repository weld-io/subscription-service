//
// Name:    user.js
// Purpose: Database model for User
// Creator: Tom Söderlund
//

'use strict';

const _ = require('lodash');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const helpers = require('../config/helpers');
const Account = require('mongoose').model('Account');
const Plan = require('mongoose').model('Plan');

// Consumable: e.g. projects, documents
const UserConsumable = new Schema({
	name: { type: String, required: true },
	current: { type: Number, default: 0 },
});

const UserSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true }, // can be any string - use same ID as in your own app
	account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
	dateCreated: { type: Date, default: Date.now },
	consumables: [UserConsumable], // see above
},
{
	toJSON: {
		transform: function (doc, ret, options) {
			helpers.stripIdsFromRet(doc, ret, options);
		},
	}
});

UserSchema.methods.getAccounts = function (callback) {
	this.populate('account', '-_id -__v', callback);
};

UserSchema.methods.getServices = function (callback) {
	const planIds = _.map(this.account.subscriptions, 'plan');
	Plan.find({ '_id': { $in: planIds } }).populate('services').exec((err, plans) => {
		const allServices = _(plans).map('services').flatten().uniq().arrayToCollection();
		callback(null, allServices);
	});
};

mongoose.model('User', UserSchema);