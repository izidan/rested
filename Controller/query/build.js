// __Module Definition__
module.exports = function () {
  this.query('collection', '*', (request, response, next) => {
    request.baucis.query = this.model().find(request.baucis.conditions);
    next();
  });
  this.query('instance', '*', (request, response, next) => {
    request.baucis.query = this.model().findOne(request.baucis.conditions);
    next();
  });
};
