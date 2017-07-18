# Subscription Service

**Subscription Service** is a REST API service managing subscription pricing, services, consumables, VAT, etc. Built in Node.js.

It allows you to be more agile with your product offering, pricing, discounts, VAT, etc. Like [Segment](https://segment.com), but for payments.

This is **not a payment platform** - instead it’s a layer between your app and the payment platform ([Stripe](https://www.stripe.com) being the default).

----------

Made by the team at **Weld** ([www.weld.io](https://www.weld.io?utm_source=github-subscription-service)), the #codefree web/app creation tool:

[![Weld](https://s3-eu-west-1.amazonaws.com/weld-social-and-blog/gif/weld_explained.gif?v2)](https://www.weld.io?utm_source=github-subscription-service)


## How to Run

Set JWT auth secret:

	export JWT_SECRET=...

or no JWT:

	export DISABLE_JWT=true


Just start with:

	npm run-script dev # development

or

	npm start # production

Server will default to **http://localhost:3034**


## How to Test

	npm test


## Development Plan

- [x] Create a User and Account in one request
- [x] Subscriptions controller (by Account or User)
- [x] Stop Subscriptions by User (not Account)
- [x] Subscriptions should be deactivated (with timestamp), not deleted
- [x] See a User’s current Services
- [x] Authentication with JWT
- [ ] Set Subscription.dateExpires by "90d" or similar (`ms` NPM)
- [ ] Find-or-create User (by reference)
- [ ] Stripe integration
- [ ] VAT support: see prices with(out) VAT based on location/company

v2:

- [ ] Discount coupons - via [coupon-service](https://github.com/weld-io/coupon-service)
- [ ] Consumables controller - counting, routes
- [ ] See a User's current Consumables
- [ ] Validations
- [ ] Tests


## Entities

For B2C apps, one Account has only one User.
For B2B apps, there can be multiple Users on each Account.

- **Accounts**
	- name
	- reference (slug)
	- email
	- company
		- name
		- vatNumber
	- countryCode
	- discountCoupon
	- paymentPlatforms
		- stripe
			- customerId
			- subscriptionId
	- subscriptions (array of Subscriptions)
- **Users** (on an Account)
	- reference (e.g. user ID in another app)
	- account (reference to Account)
	- consumables
		- projects: 2
- **Plans**
	- name
	- reference (slug)
	- description
	- isAvailable: true/false
	- services (Array)
	- price
		- monthly
		- yearly
		- once
		- vatIncluded
	- consumables: { projects: 10 }
	- trialDays: 30
- **Subscriptions** (an Account subscribes to one or more Plans)
	- plan (reference to Plan)
	- reference (e.g. domains, User can’t have multiple subscriptions with same Reference)
	- dateExpires
- **Services** (e.g. access to something, included in Plan)
	- name
	- reference (slug)
	- description
- **Consumables** (e.g. projects, users - limited by Plan)


## API

### Accounts

#### Create new account

	curl -X POST http://localhost:3034/api/accounts -H "Content-Type: application/json" -d '{ "name": "My Company" }'

### Users

#### Create new user

Note: `reference` is where you use your main permanent user ID, e.g. from another app.

	curl -X POST http://localhost:3034/api/users -H "Content-Type: application/json" -d '{ "reference": "userId1", "account": "my-company" }'

#### Create new user and account

	curl -X POST http://localhost:3034/api/users -H "Content-Type: application/json" -d '{ "reference": "userId2", "account": { "name": "My Company 2", "email": "invoices@mycompany2.com" } }'

#### Get user

	curl -X GET http://localhost:3034/api/users/:reference

Returns:

	{
		reference: xxx,
		account: { reference: ... },
		activePlan: {
			reference: 'b2b_small',
			dateExpires: '2017-12-31',
		},
		plans: ['b2b_small'],
		services: ['remove-watermark', 'unlimited-projects'],
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

	curl -X GET http://localhost:3034/api/plans/:reference

Returns:

	{
		reference: 'standard-package',
		name: 'Standard Package',
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

#### Update plan

Partial update:

	curl -X PUT http://localhost:3034/api/accounts/my-company/plans/:reference -H "Content-Type: application/json" -d '{ "services": ["video-hosting"] }'

#### Stop plan

Note: when you stop a plan, it’s not deleted but a `dateStopped` is set and the plan won’t be listed in Account/User.plans.

	curl -X DELETE http://localhost:3034/api/accounts/my-company/plans/:reference


### Subscriptions

#### Start subscription

	curl -X POST http://localhost:3034/api/accounts/my-company/subscriptions -H "Content-Type: application/json" -d '{ "plan": "standard-package" }'

#### Update subscription

Partial update:

	curl -X PUT http://localhost:3034/api/accounts/my-company/subscriptions/:id -H "Content-Type: application/json" -d '{ "reference": "ref1" }'

#### Stop subscription

Note: when you stop a subscription, it’s not deleted but a `dateStopped` is set and the subscription won’t be listed in Account/User.subscriptions.

	curl -X DELETE http://localhost:3034/api/accounts/my-company/subscriptions/:id

Stop all subscriptions:

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
