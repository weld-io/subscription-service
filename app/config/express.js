var glob = require('glob')
var logger = require('morgan')
var bodyParser = require('body-parser')
var compress = require('compression')
// var cookieParser = require('cookie-parser');
// var methodOverride = require('method-override');
var cors = require('cors')

module.exports = function (app, config) {
  app.use(logger('dev'))
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({
    extended: true
  }))
  app.use(compress())
  // app.use(cookieParser());
  // app.use(methodOverride());
  app.use(cors())

  // Routing

  // Require in Auth controller
  const authController = require(config.root + '/controllers/auth')
  authController(app, config)

  // Require in all API controllers
  glob.sync(config.root + '/controllers/api/*.js').forEach(controllerPath => require(controllerPath)(app, config))

  // Error: If no matching route found -> 404
  app.use(function (req, res, next) {
    var err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  // Error: others
  app.use(function (err, req, res, next) {
    const reference = `E${Math.round(1000 * Math.random())}`
    const { status = 500, message, request } = err
    if (request.method === 'GET' && request.path.search(/api\/users\/(.+)/) !== -1) {
      res.json({ message: 'user not found' })
    } else {
      console.error(`[${reference}] Error ${status}: “${message}” –`, err)
      res.status(status)
      res.json({ status, message, request, reference })
    }
  })
}
