//
// Name:    stripe.js
// Purpose: Payment provider configuration for Stripe
// Creator: Tom Söderlund
//

'use strict';

const _ = require('lodash');

module.exports = {

	// https://stripe.com/docs/api#invoice_object

	// callback(err, externalCustomerId, externalSubscriptionId, periodToExtend)
	receiveExtendSubscription: function (req, callback) {
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
			callback('No valid webhook');
		}
	},

};