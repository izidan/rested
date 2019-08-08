const RestError = require('rest-error');

// __Module Definition__
module.exports = function () {
  // Set the conditions used for finding/updating/removing documents.
  this.request((request, response, next) => {
    let conditions = request.query.conditions || {};
    if (typeof conditions === 'string')
      try { conditions = JSON.parse(conditions); }
      catch (exception) { return next(RestError.BadRequest('The conditions query string value was not valid JSON: "%s"', exception.message)); }

    if (conditions.$explain && !this.explain())
      return next(RestError.BadRequest('Using $explain is disabled for this resource'));

    if (request.params.id !== undefined)
      conditions[this.findBy()] = request.params.id;

    request.baucis.conditions = conditions;
    next();
  });
};
