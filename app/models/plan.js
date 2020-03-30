//
// Name:    plan.js
// Purpose: Database model for Plan, something an Account can Subscribe to.
// Creator: Tom Söderlund
//

'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { getUniqueSlugFromCollection } = require('../lib/helpers')

// Consumable: e.g. projects, documents
const Consumable = new Schema({
  name: { type: String, required: true },
  max: { type: Number, required: true },
  per: { type: String }
})

const PlanSchema = new Schema({
  reference: { type: String, unique: true, required: true, sparse: true },
  name: { type: String },
  description: { type: String },
  featureDescriptions: [String],
  tags: [String],
  position: Number, // index in lists, lower comes first
  dateCreated: { type: Date, default: Date.now },
  isAvailable: { type: Boolean, default: true }, // false = a retired plan
  allowMultiple: { type: Boolean, default: false }, // true = you can have multiple Subscriptions with the same Plan reference
  price: {
    month: Number,
    year: Number,
    once: Number,
    vatIncluded: Boolean,
    currency: String
  },
  trialDays: { type: Number },
  consumables: [Consumable], // see above
  services: [{ type: Schema.Types.ObjectId, ref: 'Service' }], // see service.js
  metadata: {} // for extra data
},
{
  toJSON: {
    // transform: stripIdsFromRet,
  }
})

// Set reference/slug
PlanSchema.pre('validate', function (next) {
  const slugSuggestion = this.reference || this.name
  getUniqueSlugFromCollection('Plan', undefined, slugSuggestion, { documentId: this._id }, (err, uniqueSlug) => {
    if (err) return next(err)
    this.reference = uniqueSlug
    next()
  })
})

// findByReference
PlanSchema.statics.findByReference = (reference, callback) => PlanSchema.findOne({ reference: reference }).exec(callback)

mongoose.model('Plan', PlanSchema)
