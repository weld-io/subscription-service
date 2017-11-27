//
// Name:    stripe.js
// Purpose: Payment provider configuration for Stripe
// Creator: Tom Söderlund
//

'use strict';

const _ = require('lodash');

var STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
var stripe = require('stripe')(STRIPE_SECRET_KEY);

// ----- Private functions -----

const createStripeOptions = (user, account, subscription, payment) => {
	// e.g. "enterprise_small_monthly"
	const stripePlanName = `${subscription.plan}_${subscription.billing}`;
	return {
		description: account.reference,
		plan: stripePlanName,
		coupon: subscription.discountCode,
		//quantity: subscription.quantity,
		source: payment.token,
		tax_percent: payment.taxPercent, 
		metadata: {
			user_id: user.reference,
		}
	};
};

const createStripeUser = function (user, account, subscription, payment, callback) {

	const stripeCustomerObj = createStripeOptions(user, account, subscription, payment);

	// Call Stripe API
	stripe.customers.create(
		stripeCustomerObj,
		function (stripeErr, customer) {
			if (stripeErr) {
				callback(stripeErr);
			}
			else {
				_.set(account, 'metadata.stripeCustomer', _.get(customer, 'id'));
				_.set(subscription, 'metadata.stripeSubscription', _.get(customer, 'subscriptions.data.0.id'));
				callback(null, user, account, subscription);
			}
		}
	);
};


/*


*/
const updateStripeSubscription = function (user, account, subscription, payment, callback) {

	var stripeSubscriptionObj = createStripeOptions(user, account, subscription, payment);

	// Call Stripe API
	stripe.customers.updateSubscription(
		account.metadata.stripeCustomer,
		subscription.metadata.stripeSubscription,
		stripeSubscriptionObj,
		function (stripeErr, subscription) {
			if (stripeErr) {
				callback(stripeErr);
			}
			else {
				subscription.metadata.stripeSubscription = subscription.id;
				callback(null, user, account, subscription);
			}
		}
	);

};

// API methods

const createSubscription = function (user, account, subscription, payment, callback) {
	if (_.has(account, 'metadata.stripeCustomer') && _.has(subscription, 'metadata.stripeSubscription')) {
		updateStripeSubscription(user, account, subscription, payment, callback);
	}
	else {
		createStripeUser(user, account, subscription, payment, callback);
	}
};

const updateSubscription = function (user, account, subscription, callback) {
};

const deleteSubscription = function (user, account, subscription, callback) {
};

const receiveExtendSubscription = function (req, callback) {
	const webhookType = _.get(req, 'body.type');
	const externalCustomerId = _.get(req, 'body.data.object.customer');
	const externalSubscriptionId = _.get(req, 'body.data.object.subscription');
	console.log('Stripe "%s" webhook received', webhookType);
	if (webhookType === 'invoice.payment_succeeded' && externalCustomerId) {
		console.log('Stripe "invoice.payment_succeeded" webhook for customer %s', externalCustomerId);
		const lineItems = _.get(req, 'body.data.object.lines.data');
		// If contains 'year', then extend a year etc
		const periodToExtend = _.some(lineItems, { plan: { interval: 'year' } }) ? 'year' : 'month';
		callback(null, externalCustomerId, externalSubscriptionId, periodToExtend);
	}
	else {
		callback('No valid Stripe webhook');
	}
};

// ----- Public API -----

module.exports = {

	// CRUD operations
	createSubscription: createSubscription,
	updateSubscription: updateSubscription,
	deleteSubscription: deleteSubscription,

	// https://stripe.com/docs/api#invoice_object

	// callback(err, externalCustomerId, externalSubscriptionId, periodToExtend)
	receiveExtendSubscription: receiveExtendSubscription,

};