// __Dependencies__
const deco = require('deco');
const express = require('express');

// __Module Definition__
const Controller = module.exports = deco();

Controller.factory(express.Router);
Controller.decorators(__dirname, [
  'configure',
  'stages',
  'activation',
  'request',
  'query',
  'errors',
  'send'
]);
