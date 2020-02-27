//
// Name:    plans.js
// Purpose: Controller and routing for Plan model
// Creator: Tom Söderlund
//

'use strict'

const { forEach, isEmpty, round, sortBy } = require('lodash')
const express = require('express')
const mongooseCrudify = require('mongoose-crudify')

const { applyToAll, arrayToCollection, changeReferenceToId, populateProperties, sendRequestResponse, toJsonIfNeeded } = require('../../config/helpers')
const Plan = require('mongoose').model('Plan')

// Private functions

const identifyingKey = 'reference'

const listPlans = (req, res, next) => {
  let query = { isAvailable: { $ne: false } }
  if (!isEmpty(req.query.tag)) {
    query.tags = req.query.tag
  }
  const sorting = { position: 1 }
  Plan.find(query).sort(sorting).exec((err, result) => {
    req.crudify = req.crudify || {}
    req.crudify.err = err
    req.crudify.result = result
    next()
  })
}

const servicesAsCollection = function (req, res, next) {
  const convertServices = plan => {
    plan = toJsonIfNeeded(plan)
    plan.services = arrayToCollection(plan.services)
    return plan
  }

  req.crudify.result = applyToAll(convertServices, req.crudify.result)
  next()
}

const addUsersActivePlan = function (req, res, next) {
  const checkActivePlan = plan => {
    plan = toJsonIfNeeded(plan)
    plan.isActive = false // TODO: replace with user->account->subscriptions->plan check, using req.user.d.uid
    return plan
  }

  req.crudify.result = applyToAll(checkActivePlan, req.crudify.result)
  next()
}

const showCorrectVAT = function (req, res, next) {
  req.crudify.result = toJsonIfNeeded(req.crudify.result)

  const vatPercent = (parseFloat(process.env.VAT_PERCENT) || 20) / 100

  const calculateVatAmount = (amount, percent, isIncluded, userPaysVAT) => round(
    userPaysVAT
      ? isIncluded
        ? amount * percent /* Just % of AmountWith */
        : amount / (1 - percent) - amount /* AmountWith - AmountWithout */
      : 0 /* No VAT if user doesn't pay VAT */
    , 3)

  const calculatePriceAmount = (amount, percent, includedInPrice, userPaysVAT) => round(
    userPaysVAT
      ? includedInPrice
        ? amount /* Amount is included, and that's what User should see */
        : amount / (1 - percent)
      : includedInPrice
        ? amount * (1 - percent)
        : amount /* Amount is NOT included, and that's what User should see */
    , 3)

  const calculatePlanVAT = plan => {
    plan = toJsonIfNeeded(plan)
    plan.vat = {}
    forEach(plan.price, (amount, timeUnit) => {
      if (['year', 'month', 'once'].includes(timeUnit)) {
        plan.vat[timeUnit] = calculateVatAmount(amount, vatPercent, plan.price.vatIncluded, (req.query.includeVAT !== 'false'))
        plan.price[timeUnit] = calculatePriceAmount(amount, vatPercent, plan.price.vatIncluded, (req.query.includeVAT !== 'false'))
      }
    })
    if (plan.price) plan.price.currency = plan.price.currency || '$'
    return plan
  }

  req.crudify.result = applyToAll(calculatePlanVAT, req.crudify.result)
  next()
}

const sortByPosition = function (req, res, next) {
  req.crudify.result = toJsonIfNeeded(req.crudify.result)
  req.crudify.result = sortBy(req.crudify.result, ['position'])
  next()
}

// const updatePlanPartially = function (req, res, next) {
//   console.log(`updatePlanPartially`, req.params, req.body)
//   next()
// }

// Public API

module.exports = function (app, config) {
  const router = express.Router()
  app.use('/', router)

  // CRUD routes: Account
  // router.patch('/api/plans/:reference', updatePlanPartially);

  app.use(
    '/api/plans',
    mongooseCrudify({
      Model: Plan,
      identifyingKey: identifyingKey,
      beforeActions: [
        { middlewares: [changeReferenceToId.bind(this, { modelName: 'Service', parentProperty: 'services', childIdentifier: 'reference' })], only: ['create'] },
        { middlewares: [populateProperties.bind(this, { modelName: 'plan', propertyName: 'services' })], only: ['read'] }
      ],
      actions: {
        // override list
        list: listPlans
      },
      endResponseInAction: false,
      afterActions: [
        { middlewares: [sortByPosition], only: ['list'] },
        { middlewares: [showCorrectVAT, addUsersActivePlan], only: ['list', 'read'] },
        { middlewares: [servicesAsCollection], only: ['read'] }, // see also populateProperties above
        { middlewares: [sendRequestResponse] }
      ]
    })
  )
}
