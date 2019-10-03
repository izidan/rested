const deco = require('deco');
const mongoose = require('mongoose');

const Model = module.exports = deco(function (options, protect) {

  protect.property('plural');
  protect.property('singular');
  protect.property('select', '');
  protect.property('locking', false);
  protect.property('lastModified', null, key =>
    key ? Object.keys(this.translateAliases({ [key]: key })).pop() : key);
  protect.property('findBy', '_id', key =>
    key ? Object.keys(this.translateAliases({ [key]: key })).pop() : key);

  this.deselected = path => {
    let deselected = [];
    // Store naming, model, and schema.
    // Find deselected paths in the schema.
    this.schema.eachPath((name, path) => path.options.select === false ? deselected.push(name) : null);
    return !path ? deselected : (deselected.indexOf(path) !== -1);
  };

  this.singular(this.modelName);
  this.plural(this.collection.collectionName);
});

// Wrap the mongoose model function to add this mixin to all registered models.
const originalMongooseModel = mongoose.model;
mongoose.model = (...args) => {
  let m = originalMongooseModel.apply(mongoose, args);
  if (!m.singular) Model.apply(m);
  return m;
};
