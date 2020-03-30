'use strict'

const { findIndex, get, isObjectLike, keys, map, mapValues, mixin, reduce } = require('lodash')
const async = require('async')
const mongoose = require('mongoose')

module.exports.getPaymentProvider = () => require('../paymentProviders/' + (process.env.PAYMENT_PROVIDER || 'stripe'))
module.exports.getCacheProvider = () => require('../cacheProviders/' + (process.env.CACHE_PROVIDER || 'fastly'))

// Specify v2: Get all properties for an object (console.dir):
module.exports.specify = function (obj) {
  const getValueDescription = function (val) {
    const objectType = Object.prototype.toString.call(val).replace('[object ', '').replace(']', '')
    switch (objectType) {
      case 'Object': return '{' + keys(val).slice(0, 7).join() + '}'
      case 'String': return val.slice(0, 50)
      case 'Array': return 'Array[' + val.length + ']'
      case 'Function':
      case 'Null':
        return objectType.toLowerCase()
      default: return objectType + (':' + val).slice(0, 50)
    }
  }
  return isObjectLike(obj) ? mapValues(obj, val => getValueDescription(val)) : getValueDescription(obj)
}

module.exports.toSlug = function (str, removeInternationalChars) {
  // Abort if not a proper string value
  if (!str || typeof (str) !== 'string') { return str }
  // For both
  var newStr = str.trim()
    .toLowerCase()
    .replace(/ /g, '-') // space to dash
    .replace(/_/g, '-') // underscore to dash
  // Remove ÅÄÖ etc?
  if (removeInternationalChars) {
    // remove all other characters incl. ÅÄÖ
    newStr = newStr.replace(/[^\w-]+/g, '')
  } else {
    // remove invalid characters but keep ÅÄÖ etc
    newStr = newStr.replace(/[\t.,?;:‘’“”"'`!@#$€%^&§°*<>()\[\]{}_\+=\/\|\\]/g, '') // eslint-disable-line no-useless-escape
  }
  // For both
  newStr = newStr.replace(/---/g, '-') // fix for the ' - ' case
    .replace(/--/g, '-') // fix for the '- ' case
    .replace(/--/g, '-') // fix for the '- ' case
  return newStr
}

module.exports.getUniqueSlug = function (existingSlugsArray, newWord, options = {}) {
  const { removeInternationalChars, newWordsPositionInArray } = options
  const slugBase = module.exports.toSlug(newWord, removeInternationalChars)
  var attemptNr = 0
  var slugSuggestion
  do {
    attemptNr += 1
    slugSuggestion = slugBase + (attemptNr > 1 ? '-' + attemptNr : '')
  }
  // Find a slug that either 1) is not found in existingSlugsArray, or 2) already has a specified position in existingSlugsArray
  while (existingSlugsArray.indexOf(slugSuggestion) !== -1 && existingSlugsArray.indexOf(slugSuggestion) !== newWordsPositionInArray)
  return slugSuggestion
}

module.exports.getUniqueSlugFromCollection = function (collectionName, keyField = 'reference', newWord, options = {}, cb) {
  const collection = mongoose.model(collectionName)
  const newWordSlug = module.exports.toSlug(newWord, true)
  let searchQuery = {}
  searchQuery[keyField] = new RegExp('^' + newWordSlug) // begins with
  collection.find(searchQuery).exec((err, docs) => {
    const existingSlugsArray = map(docs, keyField)
    const { documentId } = options
    if (documentId) options.newWordsPositionInArray = findIndex(docs, doc => doc._id.toString() === documentId.toString())
    const uniqueSlug = module.exports.getUniqueSlug(existingSlugsArray, newWordSlug, options)
    cb(err, uniqueSlug)
  })
}

module.exports.toJsonIfNeeded = obj => {
  obj = obj.toJSON ? obj.toJSON() : obj
  return obj
}

// [{ reference: foo, ... }, { reference: bar, ... }] -> { foo: ..., bar: ... }
module.exports.arrayToCollection = (array, keyField = 'reference') => reduce(array, (collection, obj) => { collection[obj[keyField]] = obj; return collection }, {})
mixin({ 'arrayToCollection': module.exports.arrayToCollection })

// applyToAll(func, obj1) or applyToAll(func, [obj1, obj2, ...])
module.exports.applyToAll = (func, objectOrArray) => objectOrArray.constructor === Array ? map(objectOrArray, func) : func(objectOrArray)
mixin({ 'applyToAll': module.exports.applyToAll })
module.exports.applyToAllAsync = (func, objectOrArray, cbWhenDone) => async.eachOfSeries((objectOrArray.constructor === Array ? objectOrArray : [objectOrArray]), func, cbWhenDone)

// ----- REST return -----

// handleRequest is the new way

/** handleRequest(async () => {...}, { req, res }) */
module.exports.handleRequest = async (actionFunction, { req, res }) => {
  try {
    await actionFunction(req, res)
  } catch (error) {
    const reference = `E${Math.round(1000 * Math.random())}`
    const { message, status = 400 } = error
    console.error(`[${reference}] Error ${status}: “${message}” –`, error)
    if (!isNaN(status)) res.status(status)
    res.json({ status, message, reference })
  }
}

/** throw new CustomError(`Account not found`, 404) */
module.exports.CustomError = class CustomError extends Error {
  constructor (message, status) {
    super(message)
    if (Error.captureStackTrace) Error.captureStackTrace(this, CustomError)
    this.status = status
  }
}

const getErrorCode = (err, results) => err
  ? err.statusCode || 400
  : (results === undefined || results === null)
    ? 404
    : 200

// Simple JSON response, usage e.g.
// 1. helpers.sendResponse.bind(res) - err, results will be appended to end
// 2. .find((err, results) => helpers.sendResponse.call(res, err, results))
module.exports.sendResponse = function (err, results, callback) {
  const errorCode = getErrorCode(err, results)
  // console.log('sendResponse', errorCode, err, results, typeof(callback));
  if (errorCode !== 200) {
    return this.status(errorCode).send({ code: errorCode, message: get(err, 'message'), error: err })
  } else {
    if (typeof (callback) === 'function') {
      callback(results)
    } else if (results.toJSON) {
      return this.json(results.toJSON())
    } else {
      return this.json(results)
    }
  }
}

module.exports.sendRequestResponse = function (req, res, next) {
  module.exports.sendResponse.call(res, null, req.crudify.result)
}

module.exports.processAndRespond = async (res, promise) => {
  let err, results
  try {
    results = await promise
  } catch (thisErr) {
    err = thisErr
  } finally {
    const statusCode = getErrorCode(err, results)
    const message = (statusCode === 404) ? 'Not found' : err && err.message
    const response = (statusCode === 200) ? results : { statusCode, message }
    res.status(statusCode)
    res.json(response)
  }
}

// ----- Authorization -----

module.exports.checkIfAuthorizedUser = function (reqPropertyName = 'params.reference', req, res, next) {
  const userReference = get(req, reqPropertyName)
  const jwtUserId = get(req, 'user.d.uid')
  const isAdmin = get(req, 'user.d.role') === 'admin'
  if (userReference === jwtUserId || isAdmin || process.env.DISABLE_JWT === 'true') {
    next()
  } else {
    res.status(401).json({ message: 'Only the authorized user or an admin can access this' })
  };
}

module.exports.stripIdsFromRet = function (doc, ret, options) {
  delete ret._id
  delete ret.__v
}

// E.g. populate user.account with full Account structure
// helpers.populateProperties.bind(this, { modelName:'plan', propertyName:'services' })
module.exports.populateProperties = function ({ modelName, propertyName }, req, res, next) {
  req.crudify[modelName].populate(propertyName, '-_id -__v', next)
}

// From reference to MongoDB _id (or multiple _id's)
// E.g. user.account = 'my-company' --> user.account = '594e6f880ca23b37a4090fe0'
// helpers.changeReferenceToId.bind(this, { modelName:'Service', parentProperty:'services', childIdentifier:'reference' })
module.exports.changeReferenceToId = function ({ modelName, parentProperty, childIdentifier }, { body }, res, next) {
  // Set up different behavior for different data types
  const propertyTypes = {
    // String: one identifier
    '[object String]': {
      lookupAction: 'find',
      setSearchQuery: ({ searchQuery, childIdentifier, body }) => { searchQuery[childIdentifier] = body[parentProperty]; return searchQuery },
      setResults: ({ results, parentProperty, body }) => { body[parentProperty] = get(results, '0._id'); return body }
    },
    // Array: array of identifiers
    '[object Array]': {
      lookupAction: 'find',
      setSearchQuery: ({ searchQuery, childIdentifier, body }) => { searchQuery[childIdentifier] = { $in: body[parentProperty] }; return searchQuery },
      setResults: ({ results, parentProperty, body }) => { body[parentProperty] = map(results, '_id'); return body }
    },
    // Object: create new child object, e.g. create User and Account in one request
    '[object Object]': {
      lookupAction: 'create',
      setSearchQuery: ({ searchQuery, childIdentifier, body }) => { Object.assign(searchQuery, body[parentProperty]); return searchQuery },
      setResults: ({ results, parentProperty, body }) => { body[parentProperty] = get(results, '_id'); return body }
    }
  }
  const parentPropertyType = Object.prototype.toString.call(body[parentProperty])
  if (propertyTypes[parentPropertyType]) {
    // Make query
    let searchQuery = {}
    propertyTypes[parentPropertyType].setSearchQuery({ searchQuery, childIdentifier, body })
    // Do the find or create, depending on lookupAction
    const modelObj = mongoose.model(modelName)
    const cbAfterFindOrCreate = function (err, results) {
      if (!err && results) {
        propertyTypes[parentPropertyType].setResults({ results, parentProperty, body })
      } else if (!err) {
        res && res.status(404)
        err = modelName + '(s) not found: ' + body[parentProperty]
      }
      next && next(err, results)
    }
    propertyTypes[parentPropertyType].lookupAction === 'find'
      ? modelObj.find(searchQuery).lean().exec(cbAfterFindOrCreate)
      : modelObj.create(searchQuery, cbAfterFindOrCreate)
  } else {
    // next && next(new Error(`Property '${parentProperty}' not found or unknown type (${parentPropertyType})`))
    next && next()
  }
}

// Object(s) has only an ID, change to sub-document
module.exports.getChildObjects = function (objects, propertyName, modelName, callback) {
  let newObjects = []
  module.exports.applyToAllAsync(
    (obj, key, cb) => {
      mongoose.model(modelName).findById(obj[propertyName]).exec((err, childObj) => {
        newObjects[key] = childObj
        cb(err)
      })
    },
    objects,
    (err, items) => {
      callback(err, newObjects)
    }
  )
}

module.exports.dateInDays = days => new Date((new Date()).getTime() + days * 24 * 60 * 60 * 1000).getTime()
module.exports.dateIn1Month = () => module.exports.dateInDays(31)
module.exports.dateIn1Year = () => module.exports.dateInDays(366)
module.exports.getDateExpires = sub => sub.dateExpires || (sub.billing === 'year' ? module.exports.dateIn1Year() : module.exports.dateIn1Month())

module.exports.isSubscriptionActive = sub => sub.dateExpires > Date.now() && sub.dateStopped === undefined

module.exports.isHexString = str => /[0-9A-Fa-f]{6}/g.test(str)
