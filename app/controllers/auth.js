'use strict';

//var API_PASSWORD = process.env.MYAPPNAME_PASSWORD;

module.exports = {

	isAuthenticated: function (req, res, next) {
		if (true) {
		//if (API_PASSWORD && req.query.password === API_PASSWORD) {
			return next();
		}
		else {
			return res.json(401, 'Unauthorized');
		}
	}

}