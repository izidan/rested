const mongoose = require('mongoose');
const colors = require('colors');
const moment = require('moment');
const os = require('os');

// dummy init of logger config
const config = {};

mongoose.set('debug', process.env.DEBUG === 'mongoose');

String.prototype.log = () => null;
String.prototype.info = () => null;
String.prototype.warn = () => null;
String.prototype.error = () => null;
String.prototype.debug = () => null;
String.prototype.verbose = () => null;

module.exports = app => {
  if (process.env.NODE_ENV === 'test' || process.env.LOG === 'false' || process.env.LOG === false) return;
  String.prototype.log = function () { console.log(colors.gray('LOG', moment().format('DD/MM HH:mm:ss'), (this || '').toString())) };
  String.prototype.info = function () { console.info(colors.cyan('NFO', moment().format('DD/MM HH:mm:ss'), (this || '').toString())) };
  String.prototype.warn = function () { console.error(colors.yellow('WRN', moment().format('DD/MM HH:mm:ss'), (this || '').toString())) };
  String.prototype.error = function () { console.error(colors.red('ERR', moment().format('DD/MM HH:mm:ss'), (this || '').toString())) };
  String.prototype.debug = function () { console.log(colors.yellow('DBG', moment().format('DD/MM HH:mm:ss'), (this || '').toString())) };
  String.prototype.verbose = function () { console.log(colors.yellow('VRB', moment().format('DD/MM HH:mm:ss'), (this || '').toString())) };
  if (process.env.LOG === 'true' || process.env.LOG === true || config.logging === null) return;
  // optional logging dependencies
  const winston = require('winston');
  const morgan = require('morgan');

  let sharedTransports = {};
  let loggerTransports = [];
  let container = new winston.Container();
  let serverLabel = { host: os.hostname() };
  serverLabel.port = process.env.PORT || config.port;
  // use Winston's default logger and console transport as the logger of last resort
  winston.remove(winston.transports.Console);
  // don't colorize as this will make a mess of the logs piped from the workers' consoles to the monitor process
  winston.handleExceptions(new winston.transports.Console({ colorize: false, handleExceptions: true, prettyPrint: true }));
  winston.exitOnError = false;

  /* 
   for (var transportName in config.logging.sharedTransports) {
     var transport = config.logging.sharedTransports[transportName];
     transport.type = winston.transports[transport.type];
     sharedTransports[transportName] = new transport.type(Object.assign({ name: transportName }, transport.options));
   }
 
   for (var loggerName in config.logging.loggers) {
     var logger = config.logging.loggers[loggerName];
     if (logger.transports.shared != null)
       for (var sharedName in logger.transports.shared)
         loggerTransports.push(sharedTransports[sharedName]);
 
     for (var transportName in logger.transports.private) {
       var transport = logger.transports.private[transportName];
       transport.type = winston.transports[transport.type];
       var options = Object.assign({ name: transportName }, transport.options);
       if (transport.autoLabel)
         options = Object.assign({ label: { category: loggerName, server: serverLabel } }, options);
       transport = new transport.type(options);
       loggerTransports.push(transport);
     }
     container.add(loggerName, { transports: loggerTransports });
     container.get(loggerName).on('error', err => winston.error('Logger %s encountered an error', loggerName, err));
   }
 */
  String.prototype.log = (category, data) => container.get(category).log(moment().format('DD/MM HH:mm:ss'), this.toString(), data);
  String.prototype.info = (category, data) => container.get(category).info(moment().format('DD/MM HH:mm:ss'), this.toString(), data);
  String.prototype.warn = (category, data) => container.get(category).warn(moment().format('DD/MM HH:mm:ss'), this.toString(), data);
  String.prototype.error = (category, data) => container.get(category).error(moment().format('DD/MM HH:mm:ss'), this.toString(), data);
  String.prototype.debug = (category, data) => container.get(category).debug(moment().format('DD/MM HH:mm:ss'), this.toString(), data);
  String.prototype.verbose = (category, data) => container.get(category).verbose(moment().format('DD/MM HH:mm:ss'), this.toString(), data);

  let winstonStream = {
    write: (message, encoding) => {
      try {
        var meta = JSON.parse(message.replace(/":\s*-/g, '": null'));
        if (meta != null && meta.address != null && meta.address.indexOf('127.0.0.1') < 0)
          return `HTTP ${meta.method} ${meta.url}`.verbose('http', meta);
      } catch (error) {
        return "Could not parse JSON formatted HTTP request log message".warn('http', { message: message, error: error });
      }
    }
  };
  let morganLogFormat = '{ "address": ":remote-addr", "user": ":remote-user", "method": ":method", "url": ":url", "secure": :secure, "accept": ":req[accept]", "http": ":http-version", "api": ":req[api-version]", "status": ":status", "responseTime": :response-time, "bytesSent": :bytesSent, "userAgent": ":user-agent" }';
  morgan.token('secure', (req, res) => req.secure);
  morgan.token('bytesSent', (req, res) => req.connection._bytesDispatched);
  if (app != null) {
    app.use(morgan(morganLogFormat, { stream: winstonStream }));
    app.logExceptions = () => app.use((err, req, res, next) => {
      var loggedReq = {
        url: req.url,
        secure: req.secure,
        method: req.method,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        remoteAddress: req._remoteAddress,
        httpVersion: req.httpVersion,
        headers: req.headers,
        params: req.params,
        query: req.query,
        routePath: (req.route || {}).path,
        bytesSent: req.connection._bytesDispatched
      };
      if (typeof err === 'number')
        `Express error caught. HTTP status ${err}`.error('http', { message: `HTTP status ${err}`, request: loggedReq });
      else if (typeof err === 'string')
        `Express error caught: ${err}`.error('http', { message: err, request: loggedReq });
      else if (err instanceof Error)
        `Express error caught: ${err.message}`.error('http', { message: err.message, stack: err.stack, request: loggedReq });
      else
        "Unknown error caught".error('http', { request: loggedReq });
      return next(err);
    });
  }
  return container;
};