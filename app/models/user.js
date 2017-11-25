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

UserSchema.methods.getSubscriptionPlans = function (callback) {
	const activeSubscriptions = _(this.account.subscriptions).filter(helpers.isSubscriptionActive).value();
	const planIds = _.map(activeSubscriptions, 'plan');
	Plan.find({ '_id': { $in: planIds } }).exec((err, plans) => {
		const subscriptionPlans = _.map(activeSubscriptions, subscription => {
			subscription = helpers.convertToJsonIfNeeded(subscription);
			subscription.plan = _.chain(plans).find({ _id: subscription.plan }).pick(['name', 'reference', 'price', 'isAvailable']).value();
			return subscription;
		})
		callback(null, subscriptionPlans);
	});
};

UserSchema.methods.getServices = function (callback) {
	const planIds = _(this.account.subscriptions).filter(helpers.isSubscriptionActive).map('plan');
	Plan.find({ '_id': { $in: planIds } }).populate('services').exec((err, plans) => {
		const allServices = _(plans).map('services').flatten().uniq().arrayToCollection();
		callback(null, allServices);
	});
};

mongoose.model('User', UserSchema);