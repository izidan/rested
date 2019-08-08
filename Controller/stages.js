// __Dependencies__
const express = require('express');

// __Module Definition__
module.exports = function (options, protect) {
  const initial = express.Router();
  const controllerForStage = protect.controllerForStage = {
    initial: initial,
    request: express.Router(),
    query: express.Router(),
    finalize: express.Router()
  };
  // __Stage Controllers__
  this.use(initial);
  this.use(controllerForStage.request);
  this.use(controllerForStage.query);
  this.use(controllerForStage.finalize);
  // Expose the original `use` function as a protected method.
  protect.use = this.use.bind(this);
  // Pass the method calls through to the "initial" stage middleware controller,
  // so that it precedes all other stages and middleware that might have been
  // already added.
  this.use = initial.use.bind(initial);
  this.all = initial.all.bind(initial);
  this.head = initial.head.bind(initial);
  this.get = initial.get.bind(initial);
  this.post = initial.post.bind(initial);
  this.put = initial.put.bind(initial);
  this.delete = initial.delete.bind(initial);
};
