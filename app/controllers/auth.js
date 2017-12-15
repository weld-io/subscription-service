'use strict';

const _ = require('lodash');
const express = require('express');

module.exports = function (app, config) {

	const router = express.Router();

	// Sets the JWT properties req.user.d.uid and req.user.d.role
	const jwt = require('express-jwt');

	if (_.isEmpty(process.env.DISABLE_JWT)) {
		app.use(
			jwt({ secret: process.env.JWT_SECRET })
				.unless({ path: [
					{ url: /\/api\/plans/i, methods: ['GET'] },
					'/api/subscriptions/renew',
				] })
		);
	}
	else {
		console.log('JWT authentication is disabled.');
	}

};