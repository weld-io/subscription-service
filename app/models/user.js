//
// Name:    user.js
// Purpose: Database model for User
// Creator: Tom Söderlund
//

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
	externalId: { type: String, unique: true, required: true, sparse: true }, // can be any string - use same ID as in your own app
	account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
	dateCreated: { type: Date, default: Date.now },
});

mongoose.model('User', UserSchema);