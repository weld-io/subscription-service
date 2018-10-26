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

Optional:

	export STRIPE_SECRET_KEY=...
	export WEBHOOK_RENEW_SUBSCRIPTION=...


Then, just start with:

	npm run dev # development

or

	npm start # production

Server will default to **http://localhost:3034**


## How to Test

	npm test


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
	- metadata (free form data)
		- stripeCustomer
	- subscriptions (array of Subscriptions)
- **Users** (on an Account)
	- reference (e.g. user ID in another app)
	- account (reference to Account)
	- consumables
		- projects: 2
	- metadata (free form data)
- **Plans**
	- name
	- reference (slug)
	- description
	- featureDescriptions (string array)
	- tags (string array)
	- position (order in a list)
	- isAvailable: true/false
	- allowMultiple: true/false (false = disable all other subscriptions unless they are allowMultiple=true)
	- services (array of Services)
	- price
		- month
		- year
		- once
		- vatIncluded
	- consumables: { projects: 10 }
	- trialDays: 30
	- metadata (free form data)
- **Subscriptions** (an Account subscribes to one or more Plans)
	- plan (reference to Plan)
	- reference (e.g. domains, User can’t have multiple subscriptions with same Reference)
	- dateExpires
	- metadata (free form data)
		- stripeSubscription
- **Services** (e.g. access to a feature, included in Plan)
	- name
	- reference (slug)
	- description
	- metadata (free form data)
- **Consumables** (e.g. projects, users - limited by Plan, consumed by Users not Accounts)


## Environment variables

* `DISABLE_JWT`: set to "true" if you don’t want JWT authentication.
* `JWT_SECRET`: secret key for [JSON Web Token authentication](https://jwt.io).
* `PAYMENT_PROVIDER`: defaults to 'stripe'. Add new Payment Providers in folder `/app/paymentProviders`.
* `STRIPE_SECRET_KEY`: secret key from [Stripe dashboard](https://dashboard.stripe.com/account/apikeys).
* `VAT_PERCENT`: defaults to "20" (%), as in if the price incl. VAT is $10, VAT is $2.
* `WEBHOOK_RENEW_SUBSCRIPTION`: a complete URL that will receive a POST request whenever a subscription is renewed.


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

#### Create new user and account and subscription

	curl -X POST http://localhost:3034/api/users -H "Content-Type: application/json" -d '{ "reference": "userId2", "account": { "name": "My Company 2", "email": "invoices@mycompany2.com" }, "subscription": { "plan": "trial", "dateExpires": "2018-04-01" } }'

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

#### Update user

	curl -X PUT http://localhost:3034/api/users/12345 -H "Content-Type: application/json" -d '{ "account": "my-company" }'


### Services

#### Create new service

	curl -X POST http://localhost:3034/api/services -H "Content-Type: application/json" -d '{ "name": "Image hosting", "description": "Store unlimited images in our cloud service." }'


### Plans

#### Create new plan

	curl -X POST http://localhost:3034/api/plans -H "Content-Type: application/json" -d '{ "name": "Standard package", "price": { "month": 9.99 }, "services": ["image-hosting"] }'

#### List plans

	curl -X GET http://localhost:3034/api/plans

#### Get plan info

	curl -X GET http://localhost:3034/api/plans/:reference

Returns:

	{
		reference: 'standard-package',
		name: 'Standard Package',
		price: {
			month: 149,
			year: 1490,
			once: 150000
		},
		vat: {
			vatIncluded: true,
			month: 15,
			year: 149,
			once: 15000,
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

#### Delete plan

	curl -X DELETE http://localhost:3034/api/accounts/my-company/plans/:reference


### Subscriptions

#### Start subscription

By Account:

	curl -X POST http://localhost:3034/api/accounts/:accountReference/subscriptions -H "Content-Type: application/json" -d '{ "plan": "standard-package", "billing": "year" }'

or by User:

	curl -X POST http://localhost:3034/api/users/:userReference/subscriptions -H "Content-Type: application/json" -d '{ "plan": "standard-package" }'

Note: `billing` defaults to "month".


#### Update subscription

Partial update:

	curl -X PUT http://localhost:3034/api/accounts/:accountReference/subscriptions/:id -H "Content-Type: application/json" -d '{ "reference": "ref1" }'

or:

	curl -X PUT http://localhost:3034/api/users/:userReference/subscriptions/:id -H "Content-Type: application/json" -d '{ "reference": "ref1" }'


#### Stop subscription

Note: when you stop a subscription, it’s not deleted but a `dateStopped` is set and the subscription won’t be listed in Account/User.subscriptions.

	curl -X DELETE http://localhost:3034/api/accounts/:accountReference/subscriptions/:id

or:

	curl -X DELETE http://localhost:3034/api/users/:userReference/subscriptions/:id


Stop all subscriptions:

	curl -X DELETE http://localhost:3034/api/accounts/:accountReference/subscriptions

or:

	curl -X DELETE http://localhost:3034/api/users/:userReference/subscriptions


## Implementation

Built on Node.js, Express, MongoDB, [mongoose-crudify](https://github.com/ryo718/mongoose-crudify).


## Deploying on Heroku

	# Set up and configure app
	heroku create MYAPPNAME
	heroku addons:add mongolab
	heroku config:set JWT_SECRET=...
	heroku config:set STRIPE_SECRET_KEY=...
	heroku config:set WEBHOOK_RENEW_SUBSCRIPTION=...


## Payment providers (including Stripe)

Stripe is currently the only payment provider supported, but the idea is that it should be easy to add more payment provider integrations to `/app/paymentProviders` and change the `PAYMENT_PROVIDER` environment variable.

* Stripe plan references are currently derived from Plan reference + billing period, e.g. `basicplan_month`.
* Stripe customer ID is saved in Accounts `metadata.stripeCustomer`.
* Stripe subscription ID is saved in Subscriptions `metadata.stripeSubscription`.


### Stripe example webhook

See https://stripe.com/docs/api#invoice_object

Smaller version with only the fields needed for Subscription Service:

	{
		"type": "invoice.payment_succeeded",
		"data": {
			"object": {
				"customer": "cus_BpmeYvqhVnkuY9",
				"subscription": "sub_9PpDkJFsxRMEg5",
				"lines": {
					"data": [
						{
							"plan": {
								"interval": "year",
								"interval_count": 1
							}
						}
					]
				}
			}
		}
	}

Complete:

	{
		"type": "invoice.payment_succeeded",
		"data": {
			"object": {
				"id": "in_196zZUCjkwdpPaFTm8GgPYth",
				"object": "invoice",
				"amount_due": 11880,
				"application_fee": null,
				"attempt_count": 1,
				"attempted": true,
				"billing": "charge_automatically",
				"charge": "ch_196zZUCjkwdpPaFTCG1T4BZX",
				"closed": true,
				"currency": "sek",
				"customer": "cus_BpmeYvqhVnkuY9",
				"date": 1477043056,
				"description": null,
				"discount": null,
				"ending_balance": 0,
				"forgiven": false,
				"lines": {
					"data": [
						{
							"id": "sub_BpmewCPihjSysf",
							"object": "line_item",
							"amount": 2000,
							"currency": "sek",
							"description": null,
							"discountable": true,
							"livemode": true,
							"metadata": {

							},
							"period": {
								"start": 1514221509,
								"end": 1516899909
							},
							"plan": {
								"id": "professional_yearly_10",
								"object": "plan",
								"amount": 9504,
								"created": 1473759356,
								"currency": "sek",
								"interval": "year",
								"interval_count": 1,
								"livemode": false,
								"metadata": {

								},
								"name": "Weld professional website (yearly)",
								"statement_descriptor": null,
								"trial_period_days": null
							},
							"proration": false,
							"quantity": 1,
							"subscription": null,
							"subscription_item": "si_BpmejWAFkv1rLv",
							"type": "subscription"
						}
					],
					"has_more": false,
					"object": "list",
					"url": "/v1/invoices/in_196zZUCjkwdpPaFTm8GgPYth/lines"
				},
				"livemode": false,
				"metadata": {

				},
				"next_payment_attempt": null,
				"paid": true,
				"period_end": 1477043056,
				"period_start": 1477043056,
				"receipt_number": null,
				"starting_balance": 0,
				"statement_descriptor": null,
				"subscription": "sub_9PpDkJFsxRMEg5",
				"subtotal": 9504,
				"tax": 2376,
				"tax_percent": 25.0,
				"total": 11880,
				"webhooks_delivered_at": 1477043069
			}
		}
	}
