// __Dependencies__
require('mongodb');
const mongoose = require('mongoose');
const express = require('express');
const deco = require('deco');
const async = require('async');
const rested = require('../..');

// __Private Module Members__
let app;
let server;

mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
mongoose.set('useUnifiedTopology', true);
mongoose.set('debug', (process.env.DEBUG || '').match(/mongoose/));

const BaseSchema = deco(function () { this.add({ name: String }) });

BaseSchema.inherit(mongoose.Schema);

const LiqueurSchema = BaseSchema();
const AmaroSchema = BaseSchema({ bitterness: Number });
const CordialSchema = BaseSchema({ sweetness: Number });

const Liqueur = mongoose.model('liqueur', LiqueurSchema);
const Amaro = Liqueur.discriminator('amaro', AmaroSchema).plural('amari');
const Cordial = Liqueur.discriminator('cordial', CordialSchema);

module.exports = {
  app: () => app,
  server: () => server,
  deinit: done => Promise.all([server.close(), mongoose.disconnect()]).then(done),
  init: done => {
    mongoose.connect(global.__MONGO_URI__);

    rested.rest(Liqueur);
    rested.rest(Amaro);

    app = express();
    app.use('/api', rested());
    server = app.listen(done);
  },
  create: done => {
    let liqueurs = [{ name: 'Generic' }];
    let amari = [{ name: 'Amaro alle Erbe', bitterness: 3 }, { name: 'Campari', bitterness: 5 }, { name: 'Fernet', bitterness: 10 }];
    let cordials = [{ name: 'Blackberry', sweetness: 5 }, { name: 'Peach', sweetness: 7 }];

    Liqueur.deleteMany({}, error =>
      error ? done(error) : Amaro.deleteMany({}, error =>
        error ? done(error) : Cordial.deleteMany({}, error => {
          if (error) return done(error);

          let deferred = [
            Liqueur.deleteOne.bind(Liqueur),
            Amaro.deleteOne.bind(Amaro),
            Cordial.deleteOne.bind(Cordial)
          ];

          deferred = deferred.concat(liqueurs.map(data => {
            let liqueur = new Liqueur(data);
            return liqueur.save.bind(liqueur);
          }));

          deferred = deferred.concat(amari.map(data => {
            let amaro = new Amaro(data);
            return amaro.save.bind(amaro);
          }));

          deferred = deferred.concat(cordials.map(data => {
            let cordial = new Cordial(data);
            return cordial.save.bind(cordial);
          }));

          async.series(deferred, done);
        })));
  }
};
