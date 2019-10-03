const errors = require('http-errors');

// __Module Definition__
module.exports = function () {
  // Set the conditions used for finding/updating/removing documents.
  this.request((request, response, next) => {
    let conditions = request.query.conditions || {};
    if (typeof conditions === 'string')
      try { conditions = JSON.parse(conditions); }
      catch (exception) { return next(errors.BadRequest(`The conditions query string value was not valid JSON: "${exception.message}"`)); }

    if (conditions.$explain && !this.explain())
      return next(errors.BadRequest('Using $explain is disabled for this resource'));

    if (request.params.id !== undefined)
      conditions[this.findBy()] = request.params.id;

    request.rested.conditions = conditions;
    next();
  });
};
