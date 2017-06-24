# Subscription Service

REST API service managing subscription pricing, services, consumables, VAT, etc. Built in Node.js.

**Subscription Service** allows you to be more agile with your product offering, pricing, discounts, VAT, etc. Like [Segment](https://segment.com), but for payments.

This is **not a payment platform** - instead it’s a layer between your app and the payments platform ([Stripe](https://www.stripe.com) being the default).

----------

Made by the team at **Weld** ([www.weld.io](https://www.weld.io?utm_source=github-subscription-service)), the #codefree app and web creation tool:

[![Weld](https://s3-eu-west-1.amazonaws.com/weld-social-and-blog/gif/weld_explained.gif)](https://www.weld.io?utm_source=github-subscription-service)


## How to Run

Just start with:

	npm run-script dev # development

or

	npm start # production

Server will default to **http://localhost:3034**


## How to Test

	npm test


## Entities

- **Accounts**
	- (email? later)
	- company
		- name
		- vatNumber
	- countryCode
	- discountCoupon
	- paymentPlatforms
		- Stripe
			- customerId
			- subscriptionId
- **Users** (on an Account)
	- accountId
	- externalId (e.g. Weld ID)
	- consumables
		- projects: 2
- **Plans**
	- name
	- available: true/false
	- services (Array)
	- pricePerMonth
	- pricePerYear
	- consumables: { projects: 10 }
	- trialDays: 30
- **Subscriptions** (a User subscribes on a Plan)
	- planId
	- expiryDate
	- reference (e.g. domains, User can’t have multiple subscriptions with same Reference)
- **Services** (e.g. access to something, included in Plan)
	- name
	- description
- **Consumables** (e.g. projects, users - limited by Plan)

## API

### Create new account

	curl -X POST -H "Content-Type: application/json" -d '{ "name": "My Company", "email": "invoices@mycompany.com" }' http://localhost:3034/api/accounts

### Create new user

	curl -X POST -H "Content-Type: application/json" -d '{ "externalId": "12345", "account": "my-company" }' http://localhost:3034/api/users

### Get user

	GET /api/users/:externalId

Returns:

	{
		id: xxx,
		account: xxx,
		plans: ['b2b_small'], *
		expiryDate: '2017-12-31',
		services: {
			remove_watermark: {
				name: 'Remove watermark'
			}
		},
		consumables: {
			projects: {
				max: 10,
				current: 8,
				remaining: 2
			}
		},
		subscriptions: [
			…
		]
	}

*Support multiple active plans? Or just show the “best” active plan?


### List plans
### Get plan info

	GET /api/plans/:planId

Returns:

	{
		id: 'b2b_small',
		name: 'Enterprise: Small',
		price: {
			monthly: 149,
			yearly: 1490,
			once: 150000,
			vatIncluded: true,
		},
		services: {
			remove_watermark: {
				name: 'Remove watermark'
			}
		},
		consumables: {
			projects: {
				max: 10,
				per: 'user'***,
			},
			users: {
				max: 2,
				per: 'account',
			}
		},
	}

***Support consumables over time? E.g 10 projects/month.

### Start subscription
### Update subscription
### Stop subscription



## API

Read (list) all things:

	curl http://localhost:3034/api/things

Read one thing:

	curl http://localhost:3034/api/things/591fb7a2c491b353765e60a3

Create new thing:

	curl -X POST -H "Content-Type: application/json" -d '{ "name": "My Thing" }' http://localhost:3034/api/things

Update thing:

	curl -X PUT -H "Content-Type: application/json" -d '{ "name": "My Updated Thing" }' http://localhost:3034/api/things/548cbb2b1ad50708212193d8

Delete thing:

	curl -X DELETE http://localhost:3034/api/things/5477a6f88906b9fc766c843e

Delete all things:

	curl -X DELETE http://localhost:3034/api/things/ALL


## Implementation

Built on Node.js, Express, MongoDB.


## Deploying on Heroku

	# Set up and configure app
	heroku create MYAPPNAME
	heroku addons:add mongolab
	heroku config:set NODE_ENV=production
