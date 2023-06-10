// __Dependencies__
const rested = require('rested');
const deco = require.cache[require.resolve('rested')].require('deco');
const decorators = deco.require(__dirname, ['Controller', 'Api']).hash;

rested.Controller.decorators(decorators.Controller);
rested.Api.decorators(decorators.Api);
