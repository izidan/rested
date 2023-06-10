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
};