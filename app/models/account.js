//
// Name:    account.js
// Purpose: Database model for Account: the company or person who will be billed for the Plan.
// Creator: Tom Söderlund
//

'use strict'

const _ = require('lodash')
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const helpers = require('../config/helpers')

// -----------

const showOnlyActiveSubscriptions = account => {
  account.subscriptions = _.filter(account.subscriptions, helpers.isSubscriptionActive)
}

// -----------

const Company = new Schema({
  name: { type: String },
  vatNumber: { type: String },
  metadata: {} // for extra data
})

// Subscription to a Plan
const Subscription = new Schema({
  reference: { type: String, unique: true, sparse: true }, // e.g. attached to certain consumable
  plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  billing: { type: String, default: 'month' },
  dateCreated: { type: Date, default: Date.now },
  dateExpires: { type: Date },
  dateStopped: { type: Date },
  discountCode: { type: String },
  metadata: {} // for Stripe IDs etc
})

const AccountSchema = new Schema({
  reference: { type: String, unique: true, required: true, sparse: true },
  name: { type: String },
  email: { type: String },
  company: Company,
  countryCode: { type: String },
  dateCreated: { type: Date, default: Date.now },
  subscriptions: [Subscription],
  metadata: {} // for Stripe IDs etc
},
{
  toJSON: {
    transform: function (doc, ret, options) {
      // showOnlyActiveSubscriptions(ret); // this is handled in User.getSubscriptionPlans now
      helpers.stripIdsFromRet(doc, ret, options)
    }
  }
})

// Set reference/slug
AccountSchema.pre('validate', function (next) {
  const slugSuggestion = this.reference || this.name || this.email
  helpers.getUniqueSlugFromCollection('Account', undefined, slugSuggestion, { documentId: this._id }, (err, uniqueSlug) => {
    this.reference = uniqueSlug
    next()
  })
})

mongoose.model('Account', AccountSchema)
