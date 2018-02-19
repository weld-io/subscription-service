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

// Consumable: e.g. projects, documents, domains
// on User, not Account, to support e.g. projects per user
const UserConsumable = new Schema({
	name: { type: String, required: true },
	current: { type: Number, default: 0 },
	metadata: {}, // for extra data
});

const UserSchema = new Schema({
	reference: { type: String, unique: true, required: true, sparse: true }, // can be any string - use same ID as in your own app
	account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
	dateCreated: { type: Date, default: Date.now },
	consumables: [UserConsumable], // see above
	metadata: {}, // for extra data
},
{
	toJSON: {
		transform: function (doc, ret, options) {
			helpers.stripIdsFromRet(doc, ret, options);
		},
	}
});

// Set reference/slug
UserSchema.pre('validate', function (next) {
	const slugSuggestion = this.reference;
	helpers.getUniqueSlugFromCollection('Account', undefined, slugSuggestion, { documentId: this._id }, (err, uniqueSlug) => {
		this.reference = uniqueSlug;
		next();
	});
});

UserSchema.methods.getAccounts = function (callback) {
	this.populate('account', '-_id -__v', callback);
};

// TODO: move this so 'includeAllSubscriptions' filter is used on Account too
UserSchema.methods.getSubscriptionPlans = function (options, callback) {
	const filterFunction = options.includeAllSubscriptions ? () => true : helpers.isSubscriptionActive;
	const selectedSubscriptions = _(this.account.subscriptions).filter(filterFunction).value();
	const planIds = _.map(selectedSubscriptions, 'plan');
	Plan.find({ '_id': { $in: planIds } }).exec((err, plans) => {
		const subscriptionsWithPlan = _.map(selectedSubscriptions, subscription => {
			subscription = helpers.toJsonIfNeeded(subscription);
			const planCompleteInfo = _.find(plans, { _id: subscription.plan });
			subscription.plan = _.pick(planCompleteInfo, ['name', 'reference', 'price', 'isAvailable']);
			return subscription;
		})
		callback(null, { subscriptions: selectedSubscriptions, subscriptionsWithPlan });
	});
};

UserSchema.methods.getServices = function (callback) {
	const planIds = _.chain(this.account.subscriptions).filter(helpers.isSubscriptionActive).map('plan').value();
	Plan.find({ '_id': { $in: planIds } }).populate('services').exec((err, plans) => {
		const allServices = _(plans).map('services').flatten().uniq().arrayToCollection().value();
		callback(null, allServices);
	});
};

mongoose.model('User', UserSchema);