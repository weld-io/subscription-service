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


## Development Plan

- [x] Create user + account in one request
- [ ] Authentication with JWT
- [ ] Stripe integration
- [ ] Discount coupons - via [coupon-service](https://github.com/weld-io/coupon-service)
- [ ] VAT support
- [ ] Consumables - counting, routes
- [ ] Stop subscriptions by User (not Account)
- [ ] See a User's current Services
- [ ] See a User's current Consumables
- [ ] Validations

## Entities

- **Accounts**
	- email
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
	- reference (e.g. Weld ID)
	- consumables
		- projects: 2
- **Plans**
	- name
	- isAvailable: true/false
	- services (Array)
	- pricePerMonth
	- pricePerYear
	- consumables: { projects: 10 }
	- trialDays: 30
- **Subscriptions** (an Account subscribes to one or more Plans)
	- planId
	- expiryDate
	- reference (e.g. domains, User can’t have multiple subscriptions with same Reference)
- **Services** (e.g. access to something, included in Plan)
	- name
	- description
- **Consumables** (e.g. projects, users - limited by Plan)


## API

### Accounts

#### Create new account

	curl -X POST http://localhost:3034/api/accounts -H "Content-Type: application/json" -d '{ "name": "My Company", "email": "invoices@mycompany.com" }'

### Users

#### Create new user

	curl -X POST http://localhost:3034/api/users -H "Content-Type: application/json" -d '{ "reference": "user1", "account": "my-company" }'

#### Create new user and account

	curl -X POST http://localhost:3034/api/users -H "Content-Type: application/json" -d '{ "reference": "user2", "account": { "name": "My Company 2", "email": "invoices@mycompany2.com" } }'

#### Get user

	GET /api/users/:reference

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

#### Update user

	curl -X PUT http://localhost:3034/api/users/12345 -H "Content-Type: application/json" -d '{ "account": "my-company" }'

### Services

#### Create new service

	curl -X POST http://localhost:3034/api/services -H "Content-Type: application/json" -d '{ "name": "Image hosting", "description": "Store unlimited images in our cloud service." }'

### Plans

#### Create new plan

	curl -X POST http://localhost:3034/api/plans -H "Content-Type: application/json" -d '{ "name": "Standard package", "price": { "monthly": 9.99 }, "services": ["image-hosting"] }'

#### List plans

	curl -X GET http://localhost:3034/api/plans

#### Get plan info

	curl -X GET http://localhost:3034/api/plans/:planId

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

### Subscriptions

#### Start subscription

	curl -X POST http://localhost:3034/api/accounts/my-company/subscriptions -H "Content-Type: application/json" -d '{ ... }'

#### Update subscription

	curl -X PUT http://localhost:3034/api/accounts/my-company/subscriptions/:subId -H "Content-Type: application/json" -d '{ ... }'

#### Stop subscription

	curl -X DELETE http://localhost:3034/api/accounts/my-company/subscriptions/:subId 

#### Stop all subscriptions

	curl -X DELETE http://localhost:3034/api/accounts/my-company/subscriptions 


## Old API

	Create subscription: post('/users/:id/subscriptions/:subscription', sub.createSubscription);
	Create/update subscription: post('/subscriptions', sub.createOrUpdate);
	Webhook, extend subscription: post('/subscriptions-stripe-webhook-super-secret', sub.receiveWebhook);
	
	get('/users/:id/discounts/:code', sub.checkAvailableDiscount);
	post('/users/:id/discounts/:code', sub.applyDiscount);


## Implementation

Built on Node.js, Express, MongoDB, [mongoose-crudify](https://github.com/ryo718/mongoose-crudify).


## Deploying on Heroku

	# Set up and configure app
	heroku create MYAPPNAME
	heroku addons:add mongolab
	heroku config:set NODE_ENV=production
