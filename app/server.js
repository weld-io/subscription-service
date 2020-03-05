require('dotenv').config()

const app = require('./app')
const config = require('./config/config')

const portNumber = process.env.PORT || config.port
console.log(`[${new Date().getHours()}:${new Date().getMinutes()}] subscription-service running on http://localhost:${portNumber}`)
app.listen(portNumber)
