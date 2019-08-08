// __Dependencies__
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const async = require('async');
const es = require('event-stream');
const baucis = require('../..');
const config = require('./config');

// __Private Module Members__
let app;
let server;
const Schema = mongoose.Schema;

mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
mongoose.set('debug', (process.env.DEBUG || '').match(/mongoose/));

// __Fixture Schemata__
const Fungus = new Schema({ 'hyphenated-field-name': String });
const Animal = new Schema({ name: String });
const Mineral = new Schema({ color: String, enables: [{ type: Schema.ObjectId, ref: 'fungus' }] });
const Vegetable = new Schema({
  name: { type: String, required: true },
  lastModified: { type: Date, required: true, default: Date.now },
  diseases: { type: [String], select: false },
  species: { type: String, default: 'n/a', select: false },
  related: { type: Schema.ObjectId, ref: 'vegetable' },
  score: { type: Number, min: 1 },
  nutrients: [{ type: Schema.ObjectId, ref: 'mineral' }]
});

Vegetable.pre('save', function (next) {
  this.set('related', this._id);
  next();
});

Vegetable.pre('save', function (next) {
  this.set('lastModified', new Date());
  next();
});

Vegetable.pre('save', next => {
  fixture.saveCount++;
  next();
});

Vegetable.pre('deleteOne', { document: true, query: false }, next => {
  fixture.removeCount++;
  next();
});

mongoose.model('vegetable', Vegetable).lastModified('lastModified');
mongoose.model('fungus', Fungus).plural('fungi');
mongoose.model('mineral', Mineral);
mongoose.model('animal', Animal);

// __Module Definition__
const fixture = module.exports = {
  app: () => app,
  server: () => server,
  deinit: done => Promise.all([server.close(), mongoose.disconnect()]).then(done),
  init: done => {
    mongoose.connect(config.mongo.url);

    fixture.saveCount = 0;
    fixture.removeCount = 0;

    baucis.rest('fungus').select('-hyphenated-field-name');

    baucis.rest('mineral').relations(true).sort('color').explain(true);

    baucis.rest('animal').fragment('empty-array');
    baucis.rest('animal').fragment('no-content');

    let veggies = baucis.rest('vegetable');
    veggies.relations(false).hints(true).comments(true);

    veggies.request((request, response, next) => {
      if (request.query.block === 'true') return response.sendStatus(401);
      next();
    });

    veggies.query((request, response, next) => {
      if (request.query.testQuery !== 'true') return next();
      request.baucis.query.select('_id lastModified');
      next();
    });

    veggies.request((request, response, next) => {
      if (request.query.failIt !== 'true') return next();
      request.baucis.incoming(es.through(
        function (context) { this.emit('error', baucis.Error.Forbidden('Bento box')); }
      ));
      next();
    });

    veggies.request((request, response, next) => {
      if (request.query.failItFunction !== 'true') return next();
      request.baucis.incoming((context, callback) => callback(baucis.Error.Forbidden('Bento box')));
      next();
    });

    veggies.request((request, response, next) => {
      if (request.query.failIt2 !== 'true') return next();
      request.baucis.outgoing((context, callback) => callback(baucis.Error.Forbidden('Bento box')));
      next();
    });

    veggies.request((request, response, next) => {
      if (request.query.deleteNutrients !== 'true') return next();
      request.baucis.outgoing((context, callback) => {
        context.nutrients = undefined;
        callback(null, context);
      });
      next();
    });

    // Test streaming in through custom handler
    veggies.request((request, response, next) => {
      if (request.query.streamIn !== 'true') return next();
      request.baucis.incoming(es.map((context, callback) => {
        context.incoming.name = 'boom';
        callback(null, context);
      }));
      next();
    });

    // Test streaming in through custom handler
    veggies.request((request, response, next) => {
      if (request.query.streamInFunction !== 'true') return next();
      request.baucis.incoming((context, callback) => {
        context.incoming.name = 'bimm';
        callback(null, context);
      });
      next();
    });

    // Test streaming out through custom handler
    veggies.request((request, response, next) => {
      if (request.query.streamOut !== 'true') return next();
      request.baucis.outgoing(es.map((context, callback) => {
        context.name = 'beam';
        callback(null, context);
      }));
      next();
    });

    // Test that parsed body is respected
    veggies.request((request, response, next) => {
      if (request.query.parse !== 'true') return next();
      bodyParser.json()(request, response, next);
    });

    // Test arbitrary documents
    veggies.request((request, response, next) => {
      if (request.query.creamIt !== 'true') return next();
      request.baucis.documents = 'Devonshire Clotted Cream.';
      next();
    });

    // Test 404 for documents
    veggies.request((request, response, next) => {
      if (request.query.emptyIt !== 'true') return next();
      request.baucis.documents = 0;
      next();
    });

    app = express();
    app.use('/api', baucis());

    server = app.listen(done);
  },
  create: done => {
    let Vegetable = mongoose.model('vegetable');
    let Mineral = mongoose.model('mineral');
    let Fungus = mongoose.model('fungus');
    let mineralColors = ['Blue', 'Green', 'Pearlescent', 'Red', 'Orange', 'Yellow', 'Indigo', 'Violet'];
    let vegetableNames = ['Turnip', 'Spinach', 'Pea', 'Shitake', 'Lima Bean', 'Carrot', 'Zucchini', 'Radicchio'];
    let fungus = new Fungus();
    let minerals = mineralColors.map(color => new Mineral({ color: color, enables: fungus._id }));
    let vegetables = vegetableNames.map(name => new Vegetable({ name: name, nutrients: [minerals[0]._id] }));
    fixture.vegetables = vegetables;
    Vegetable.deleteMany({}, error =>
      error ? done(error) : Mineral.deleteMany({}, error =>
        error ? done(error) : Fungus.deleteMany({}, error => {
          if (error) return done(error);
          fixture.saveCount = 0;
          fixture.removeCount = 0;
          let deferred = [
            Vegetable.deleteOne.bind(Vegetable),
            Mineral.deleteOne.bind(Mineral),
            Fungus.deleteOne.bind(Fungus)
          ];
          deferred = deferred.concat(vegetables.map(vegetable => vegetable.save.bind(vegetable)));
          deferred = deferred.concat(minerals.map(mineral => mineral.save.bind(mineral)));
          deferred.push(fungus.save.bind(fungus));
          async.series(deferred, done);
        })))
  }
};
