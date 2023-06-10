require('dotenv').config();
require('module-alias/register');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const express = require('express');
const utils = require('./utils');
let request = require('request');
const async = require('async');
const http = require('http');
const fs = require('fs');

moment.tz.setDefault("Europe/London");

const app = express();
const server = http.createServer(app);
request = request.defaults({ jar: true });

process.on('unhandledRejection', err => console.error(err) && process.exit(1));

server.listen(process.env.PORT || 80, '0.0.0.0');

let MONGODB_URI = process.env.MONGODB || "mongodb://localhost/local";

mongoose.Promise = global.Promise;
mongoose.set('autoIndex', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
//mongoose.set('bufferCommands', false);
mongoose.set('useUnifiedTopology', true);
mongoose.set('debug', (process.env.DEBUG || '').match(/mongoose/));

const dberror = err => `${err.stack || err.type || err}`.error('db', err)
const dbthen = db => `Connected to database [${db.name || (db.connections ? db.connections[0].name : '')}] successfully`.info()

mongoose.connect(MONGODB_URI).then(dbthen).catch(dberror);
mongoose.attach = (connection, name, schema, collection) => {
  let db = mongoose.connections.filter(c => c.client && c.client.s && c.client.s.url === connection)[0];
  if (!db) (db = mongoose.createConnection(connection)).then(dbthen).catch(dberror);
  return mongoose.model(name, schema, collection, { connection: db });
};

//app.use rewrite()
require('./logger')(app);
require('./bootstrap')(app);
require('./baucis');

express.static.mime.define({
  'text/html': ['tmpl'],
  'text/less': ['less'],
  'text/x-scss': ['scss'],
  'text/stylus': ['styl'],
  'text/coffeescript': ['coffee'],
  'text/cache-manifest': ['manifest']
});

// enable cors
app.use(require('cors')());
// compress all responses
app.use(require('compression')());


//app.use rewrite()
app.use(express.static(__dirname + '/public', { maxAge: 3600000 }));

fs.readdir('./public/coffee', (err, files) => async.each(files, (file, cb) => ''.coffee(file.split('.coffee')[0].coffee(cb))))

fs.readdir('./public/js', (err, files) => async.each(files, (file, cb) => file.match(/\.min\.js/) ? cb() : ''.minify(file.split('.js')[0], cb)))