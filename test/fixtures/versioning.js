const mongoose = require('mongoose');
const express = require('express');
const baucis = require('../..');

let app;
let server;
const Schema = mongoose.Schema;

mongoose.set('useCreateIndex', true);
mongoose.set('useNewUrlParser', true);
mongoose.set('debug', (process.env.DEBUG || '').match(/mongoose/));

const Party = new Schema({ hobbits: Number, dwarves: Number });
const Dungeon = new Schema({ treasures: Number });
const Pumpkin = new Schema({ title: String });

mongoose.model('party', Party);
mongoose.model('dungeon', Dungeon);
mongoose.model('pumpkin', Pumpkin).locking(true);

module.exports = {
  app: () => app,
  server: () => server,
  deinit: done => Promise.all([server.close(), mongoose.disconnect()]).then(done),
  init: done => {
    mongoose.connect(global.__MONGO_URI__);

    app = express();

    baucis.rest('pumpkin');
    baucis.rest('party').versions('1.x');
    baucis.rest('party').versions('2.1.0');
    baucis.rest('party').versions('~3');

    app.use('/api/versioned', baucis().releases('1.0.0').releases('2.1.0').releases('3.0.1'));

    baucis.rest('dungeon');

    app.use('/api/unversioned', baucis());

    server = app.listen(done);
  }
};
