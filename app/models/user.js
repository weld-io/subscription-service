//
// Name:    user.js
// Purpose: Database model for User
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
});

mongoose.model('User', UserSchema);