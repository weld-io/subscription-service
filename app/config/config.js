const path = require('path');
const rootPath = path.normalize(__dirname + '/..');
const env = process.env.NODE_ENV || 'development';

const config = {

	development: {
		root: rootPath,
		app: {
			name: 'subscription-service'
		},
		port: 3034,
		db: 'mongodb://localhost/subscription-service-development'
		
	},

	test: {
		root: rootPath,
		app: {
			name: 'subscription-service'
		},
		port: 3000,
		db: 'mongodb://localhost/subscription-service-test'
		
	},

	production: {
		root: rootPath,
		app: {
			name: 'subscription-service'
		},
		port: 3000,
		db: process.env.MONGOLAB_URI || 'mongodb://localhost/subscription-service-production'

	}

};

module.exports = config[env];