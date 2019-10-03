// __Module Definition__
module.exports = function () {
  this.query('collection', '*', (request, response, next) => {
    request.rested.query = this.model().find(request.rested.conditions);
    next();
  });
  this.query('instance', '*', (request, response, next) => {
    request.rested.query = this.model().findOne(request.rested.conditions);
    next();
  });
};
