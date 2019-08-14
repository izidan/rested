const RestError = require('rest-error');

const isDefinedAndNotNull = n => {
  if (n === null) return false;
  if (n === undefined) return false;
  return true;
};

const isPositiveInteger = n => {
  if (!isDefinedAndNotNull(n)) return false;
  n = Number(n);
  if (n < 1) return false;
  return n === Math.ceil(n);
};

const getAsInt = n => Math.ceil(Number(n));

const isNonNegativeInteger = n => {
  if (!isDefinedAndNotNull(n)) return false;
  n = Number(n);
  if (n < 0) return false;
  return n === Math.ceil(n);
};

module.exports = function () {
  // Check for bad selection
  const checkBadSelection = select => this.deselected().some(path => new RegExp('[+]?' + path + '\\b', 'i').exec(select))
  // Perform distinct query.
  this.query((request, response, next) => {
    let distinct = request.query.distinct;
    if (!distinct) return next();
    if (this.deselected(distinct))
      return next(RestError.Forbidden('You may not find distinct values for the requested path'));
    if (!this.model().schema.path(distinct))
      distinct = Object.keys(this.model().translateAliases({ [distinct]: distinct }))[0];
    this.model().distinct(distinct, request.baucis.conditions, (error, values) => {
      if (!error)
        request.baucis.documents = values;
      next(error);
    });
  });
  // Apply controller sort options to the query.
  this.query((request, response, next) => {
    let sort = this.sort();
    if (sort) request.baucis.query.sort(sort);
    next();
  });
  // Apply incoming request sort.
  this.query((request, response, next) => {
    let sort = request.query.sort;
    if (sort) request.baucis.query.sort(sort);
    next();
  });
  // Apply controller select options to the query.
  this.query((request, response, next) => {
    let select = this.select();
    if (select && !request.query.select) request.baucis.query.select(select);
    next();
  });
  // Apply incoming request select to the query.
  this.query((request, response, next) => {
    let select = request.query.select;
    if (!select) return next();
    if (typeof select === 'string' && select.indexOf('+') !== -1)
      return next(RestError.Forbidden('Including excluded fields is not permitted'));
    if (typeof select === 'string' && checkBadSelection(select))
      return next(RestError.Forbidden('Including excluded fields is not permitted'));
    // handle aliases, first translate the string into an object
    if (typeof select === 'string')
      select = select.split(' ').reduce((obj, key) => ({ ...obj, [key.substr(Number(key[0] === '-'))]: key[0] !== '-' }), {});
    // translate the select to adjust for any aliased fields
    select = this.model().translateAliases(select);
    // correctly parse select nuerical values into valid ones
    select = JSON.parse(JSON.stringify(select).replace(/:"(\d|true|false)"/gi, ':$1'));
    // set the query select
    request.baucis.query.select(select);
    next();
  });
  // Apply incoming request populate.
  this.query((request, response, next) => {
    let populate = request.query.populate;
    let allowPopulateSelect = request.baucis.allowPopulateSelect;
    let error = null;
    if (populate) {
      if (typeof populate === 'string') {
        if (populate.indexOf('{') !== -1) populate = JSON.parse(populate);
        else if (populate.indexOf('[') !== -1) populate = JSON.parse(populate);
      }
      if (!Array.isArray(populate)) populate = [populate];
      populate.forEach(field => {
        if (error) return;
        if (checkBadSelection(field.path || field))
          return error = RestError.Forbidden('Including excluded fields is not permitted');
        // Don't allow selecting fields from client when populating
        if (field.select) {
          if (!allowPopulateSelect) return error = RestError.Forbidden('Selecting fields of populated documents is not permitted');
          //console.warn('WARNING: Allowing populate with select is experimental and bypasses security.');
        }
        request.baucis.query.populate(field);
      });
    }
    next(error);
  });
  // Apply incoming request skip.
  this.query((request, response, next) => {
    let skip = request.query.skip;
    if (skip === undefined || skip === null) return next();
    if (!isNonNegativeInteger(skip))
      return next(RestError.BadRequest('Skip must be a non-negative integer if set'));
    request.baucis.query.skip(getAsInt(skip));
    next();
  });
  // Apply incoming request limit.
  this.query((request, response, next) => {
    let limit = request.baucis.query.op === 'findOne' ? 1 : request.query.limit;
    if (limit === undefined || limit === null) return next();
    if (!isPositiveInteger(limit))
      return next(RestError.BadRequest('Limit must be a positive integer if set'));
    request.baucis.query.limit(getAsInt(limit));
    next();
  });
  // Set count flag.
  this.query((request, response, next) => {
    if (!request.query.count) return next();
    if (request.query.count === 'false') return next();
    if (request.query.count !== 'true')
      return next(RestError.BadRequest('Count must be "true" or "false" if set'));
    request.baucis.count = true;
    next();
  });
  // Check for query comment.
  this.query((request, response, next) => {
    let comment = request.query.comment;
    if (!comment) return next();
    if (this.comments()) request.baucis.query.comment(comment);
    //else console.warn('Query comment was ignored.');
    next();
  });
  // Check for query hint.
  this.query((request, response, next) => {
    let hint = request.query.hint;
    if (!hint) return next();
    if (!this.hints())
      return next(RestError.Forbidden('Hints are not enabled for this resource'));
    if (typeof hint === 'string') hint = JSON.parse(hint);
    // Convert the value for each path from stirng to number.
    Object.keys(hint).forEach(path => hint[path] = Number(hint[path]));
    request.baucis.query.hint(hint);
    next();
  });
};
