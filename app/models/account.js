'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var AccountSchema = new Schema({
	id: { type: String, unique: true, required: true, sparse: true },
	name: { type: String },
	email: { type: String, unique: true, required: true, sparse: true },
	dateCreated: { type: Date, default: Date.now },
});

mongoose.model('Account', AccountSchema);