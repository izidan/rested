// __Dependencies__
const RestError = require('rest-error');

// __Module Definition__
module.exports = function (options, protect) {
  protect.isInvalid = (id, instance, type) => {
    if (!id) return false;
    if (!['ObjectID', 'Number'].includes(instance)) return false;
    if (instance === 'ObjectID' && id.match(/^[a-f0-9]{24}$/i)) return false;
    if (instance === 'Number' && !isNaN(Number(id))) return false;
    return true;
  };
  // Validate URL's ID parameter, if any.
  this.request((request, response, next) => {
    let id = request.params.id;
    let instance = (this.model().schema.path(this.findBy()) || {}).instance || 'String';
    let invalid = protect.isInvalid(request.params.id, instance, 'url.id');
    next(invalid ? RestError.BadRequest('The requested document ID "%s" is not a valid document ID', id) : undefined);
  });
  // Check that the HTTP method has not been disabled for this controller.
  this.request((request, response, next) =>
    next(this.methods(request.method.toLowerCase()) === false ? RestError.MethodNotAllowed('The requested method has been disabled for this resource') : undefined));
  // Treat the addressed document as a collection, and push the addressed object to it. (Not implemented.) TODO
  this.request('instance', 'post', (request, response, next) =>
    next(RestError.NotImplemented('Cannot POST to an instance')));
  // Update all given docs. (Not implemented.) TODO
  this.request('collection', 'put', (request, response, next) => next(RestError.NotImplemented('Cannot PUT to the collection')));
};
