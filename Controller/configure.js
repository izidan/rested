// __Dependencies__
const mongoose = require('mongoose');
const semver = require('semver');
const Model = require('../Model');
const RestError = require('rest-error');

// __Module Definition__
module.exports = function (model, protect) {
  if (typeof model !== 'string' && (!model || !model.schema))
    throw RestError.Misconfigured('You must pass in a model or model name');
  // __Property Definitions__
  protect.property('comments', false);
  protect.property('explain', false);
  protect.property('hints', false);
  protect.property('select', '');
  protect.property('sort', '');

  protect.property('versions', '*', range => {
    if (!semver.validRange(range)) throw RestError.Misconfigured('Controller version range "%s" was not a valid semver range', range);
    return range;
  });

  protect.property('model', undefined, m => { // TODO readonly
    if (typeof m === 'string') return mongoose.model(m);
    return m;
  });

  protect.property('findBy', '_id', path => {
    this.model().findBy(path);
    return path;
  });

  protect.property('fragment', value => {
    if (value === undefined) return '/' + this.model().plural();
    if (value.indexOf('/') !== 0) return '/' + value;
    return value;
  });

  protect.multiproperty('operators', undefined, false);
  protect.multiproperty('methods', 'head get put post delete', true, enabled => enabled ? true : false);

  this.deselected = path => {
    let deselected = this.model().deselected();
    // Add deselected paths from the controller.
    this.select().split(/\s+/).forEach(path => {
      let match = /^(?:[-]((?:[\w]|[-])+)\b)$/.exec(path);
      if (match) deselected.push(match[1]);
    });
    let deduplicated = deselected.filter((path, position) => deselected.indexOf(path) === position);
    return !path ? deduplicated : (deduplicated.indexOf(path) !== -1);
  };

  // Set the controller model.
  this.model(model);
};
