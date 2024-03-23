const express = require('express');
const calc = require('./calculator.js');
var numeral = require('numeral');
var path = require('path');

const PORT = 8080;
const HOST = '0.0.0.0';

const app = express();
app.use(express.static('public'));

const USE_CACHE = process.env.USE_CACHE;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const createCache = () => {
  if (USE_CACHE) {
    var client = require('redis').createClient(
      REDIS_PORT,
      REDIS_HOST,
      {
        connect_timeout: 500,
      });

    client.on('error', (err) => {
      throw err;
    });

    var cache = require('express-redis-cache')({
      client: client,
      expire: 60
    });

    return cache;
  } else {
    return null;
  }
}
const cache = createCache();

const cacheRoute = () => {
  if (cache) {
    return cache.route();
  } else {
    // no-op
    return (req, res, next) => {
      next();
    }
  }
}

const parseA = req => numeral(req.query.a).value();

const parseB = req => numeral(req.query.b).value();

const sendResult = (value, res) => {
  const formattedValue = numeral(value).format('0,0[.]0[00000000000000000]');
  res.setHeader('content-type', 'text/plain');
  res.send(formattedValue);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
})

app.get('/add', cacheRoute(), (req, res) => {
  const a = parseA(req);
  const b = parseB(req);
  const value = calc.add(a, b);
  sendResult(value, res);
})

app.get('/subtract', cacheRoute(), (req, res) => {
  const a = parseA(req);
  const b = parseB(req);
  const value = calc.subtract(a, b);
  sendResult(value, res);
})

app.get('/multiply', cacheRoute(), (req, res) => {
  const a = parseA(req);
  const b = parseB(req);
  const value = calc.multiply(a, b);
  sendResult(value, res);
})

app.get('/divide', cacheRoute(), (req, res) => {
  const a = parseA(req);
  const b = parseB(req);
  const value = calc.divide(a, b);
  sendResult(value, res);
})

app.get('/exponent', cacheRoute(), (req, res) => {
  const a = parseA(req);
  const b = parseB(req);
  const value = calc.exponent(a, b);
  sendResult(value, res);
})

if (!module.parent) {
  var server = app.listen(PORT, HOST);
  server.on('close', () => {
    if (cache) {
      cache.client.end(true);
    }
  });
}
module.exports = { app, cache };
