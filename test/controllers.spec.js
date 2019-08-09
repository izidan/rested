const supertest = require('supertest');
const mongoose = require('mongoose');
const baucis = require('..');
const fixture = require('./fixtures/controller');

describe('Controllers', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should allow passing string name to create', () => {
    let makeController = () => baucis.Controller('unmade');
    expect(makeController).not.toThrow();
  });

  it('should allow passing a model to create', () => {
    let makeController = () => baucis.Controller(mongoose.model('unmade'));
    expect(makeController).not.toThrow();
  });

  it('should not allow leaving off arguments to create', () => {
    let makeController = () => baucis.Controller();
    expect(makeController).toThrow(/You must pass in a model or model name \(500\)\./);
  });

  it('should not allow weird arguments to create', () => {
    let makeController = () => baucis.Controller({});
    expect(makeController).toThrow(/You must pass in a model or model name \(500\)\./);
  });

  it('should have methods set by default', () => {
    let controller;
    let makeController = () => controller = baucis.Controller('unmade');
    expect(makeController).not.toThrow();
    expect(controller.methods()).toEqual(['head', 'get', 'put', 'post', 'delete']);
  });

  it('should support select options for GET requests', () =>
    request().get('/api/cheeses')
      .query({ sort: 'name' })
      .expect('Content-Type', /json/)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(3);
        expect(body[1]).toEqual({ name: 'Cheddar', color: 'Yellow' });
      }));

  it('should allow deselecting', () =>
    request().get('/api/liens')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(({ body }) => {
        expect(body[0]).toHaveProperty('_id');
        expect(body[0]).toHaveProperty('__v');
        expect(body[0]).not.toHaveProperty('title');
      }));

  it('should allow deselecting hyphenated field names', () =>
    request().get('/api/stores')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(({ body }) => {
        expect(body[0]).toHaveProperty('_id');
        expect(body[0]).toHaveProperty('__v');
        expect(body[0]).not.toHaveProperty('hpyhenated-field-name');
        expect(body[0]).not.toHaveProperty('voltaic');
      }));

  it('should support select options for POST requests', () =>
    request().post('/api/cheeses')
      .send({ name: 'Gorgonzola', color: 'Green' })
      .expect('Content-Type', /json/)
      .expect(201)
      .then(({ body }) => {
        expect(body).toHaveProperty('color', 'Green');
        expect(body).toHaveProperty('name', 'Gorgonzola');
        expect(body).not.toHaveProperty('_id');
        expect(body).not.toHaveProperty('cave');
      }));

  it('should support select options for PUT requests', () =>
    request().put('/api/cheeses/Cheddar')
      .send({ color: 'White' })
      .expect('Content-Type', /json/)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('color', 'White');
        expect(body).toHaveProperty('name', 'Cheddar');
        expect(body).not.toHaveProperty('_id');
        expect(body).not.toHaveProperty('cave');
      }));

  it('should allow POSTing when fields are deselected (issue #67)', () =>
    request().post('/api/stores')
      .send({ name: "Lou's" })
      .expect(201)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id');
        expect(body).toHaveProperty('__v');
        expect(body).toHaveProperty('name', "Lou's");
      }));

  it('should support finding documents with custom findBy field', () =>
    request().get('/api/cheeses/Camembert')
      .expect(200)
      .then(({ body }) =>
        expect(body).toHaveProperty('color', 'White')
      ));

  xit('should disallow adding a non-unique findBy field', () => {
    let makeController = () => baucis.Controller('cheese').findBy('color');
    expect(makeController).toThrow(/^`findBy` path for model "cheese" must be unique \(500\)\.$/);
  });

  it('should allow adding a uniqe findBy field 1', () => {
    let makeController = () => {
      let rab = new mongoose.Schema({ 'arb': { type: String, unique: true } });
      mongoose.model('rab', rab);
      baucis.Controller('rab').findBy('arb');
    };
    expect(makeController).not.toThrow();
  });

  it('should allow adding a unique findBy field 2', () => {
    let makeController = () => {
      let barb = new mongoose.Schema({ 'arb': { type: String, index: { unique: true } } });
      mongoose.model('barb', barb);
      baucis.Controller('barb').findBy('arb');
    };
    expect(makeController).not.toThrow();
  });

  it('should allow adding arbitrary routes', () =>
    request().get('/api/stores/info')
      .expect(200, '"OK!"'));

  it('should allow adding arbitrary routes with params', () =>
    request().get('/api/stores/XYZ/arbitrary')
      .expect(200)
      .then(({ body }) =>
        expect(body).toEqual('XYZ')
      ));

  it('should still allow using baucis routes when adding arbitrary routes', () =>
    request().get('/api/stores')
      .query({ select: '-_id -__v', sort: 'name' })
      .expect(200)
      .then(({ body }) =>
        expect(body).toEqual([{ name: 'Corner' }, { name: 'Westlake' }])
      ));

  it('should allow using middleware', () =>
    request().del('/api/stores')
      .expect(200)
      .then(({ headers }) =>
        expect(headers['x-poncho']).toEqual('Poncho!')
      ));

  it('should allow using middleware mounted at a path', () =>
    request().post('/api/stores/binfo')
      .expect(200)
      .then(({ body }) =>
        expect(body).toEqual('Poncho!')
      ));

  it('should disallow unrecognized verbs', () => {
    let controller = baucis.Controller('store');
    let register = () => controller.request('get dude', () => { });
    expect(register).toThrow(/^Unrecognized HTTP method: "dude" \(500\)\.$/);
  });

  it('should disallow unrecognized howManys', () => {
    let controller = baucis.Controller('store');
    let register = () => controller.request('gargoyle', 'get put', () => { });
    expect(register).toThrow(/^End-point type must be either "instance" or "collection," not "gargoyle" \(500\)\.$/);
  });

  it('should allow specifying instance or collection middleware', () => {
    let controller = baucis.Controller('store');
    let register = () => {
      controller.request('collection', 'get put head delete post', () => { });
      controller.request('instance', 'get put head delete post', () => { });
    };
    expect(register).not.toThrow();
  });

  it('should allow registering query middleware for other verbs', () => {
    let controller = baucis.Controller('store');
    let register = () => controller.query('get put head delete', () => { });
    expect(register).not.toThrow();
  });

  it('should allow registering POST middleware for other stages', () => {
    let controller = baucis.Controller('store');
    let register = () => {
      controller.request('post', () => { });
      controller.query('post', () => { });
    };
    expect(register).not.toThrow();
  });

  it('should correctly set the deselected paths property', () => {
    let doozle = new mongoose.Schema({ a: { type: String, select: false }, b: String, c: String, d: String });
    mongoose.model('doozle', doozle);
    let controller = baucis.Controller('doozle').select('-d c -a b');
    expect(controller.deselected()).toEqual(['a', 'd']);
  });

  it('should disallow push mode by default', () =>
    request().put('/api/stores/Westlake')
      .send({ molds: 'penicillium roqueforti', __v: 0 })
      .set('Update-Operator', '$push')
      .expect(403)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'The requested update operator "$push" is not enabled for this resource (403).')
      ));

  it('should disallow pushing to non-whitelisted paths', () =>
    request().put('/api/cheeses/Huntsman')
      .set('Update-Operator', '$push')
      .send({ 'favorite nes game': 'bubble bobble' })
      .expect(403)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'This update path is forbidden for the requested update operator "$push" (403).')
      ));

  it("should allow pushing to an instance document's whitelisted arrays when $push mode is enabled", () =>
    request().put('/api/cheeses/Huntsman?select=molds')
      .set('Update-Operator', '$push')
      .send({ molds: 'penicillium roqueforti' })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('molds');
        expect(body.molds).toHaveProperty('length', 1);
        expect(body.molds).toEqual(['penicillium roqueforti']);
      }));

  it('should disallow $pull mode by default', () =>
    request().put('/api/stores/Westlake')
      .set('Update-Operator', '$pull')
      .send({ molds: 'penicillium roqueforti', __v: 0 })
      .expect(403)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'The requested update operator "$pull" is not enabled for this resource (403).')
      ));

  it('should disallow pulling non-whitelisted paths', () =>
    request().put('/api/cheeses/Huntsman')
      .set('Update-Operator', '$pull')
      .send({ 'favorite nes game': 'bubble bobble' })
      .expect(403)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'This update path is forbidden for the requested update operator "$pull" (403).')
      ));

  it("should allow pulling from an instance document's whitelisted arrays when $pull mode is enabled", () =>
    request().put('/api/cheeses/Huntsman?select=molds')
      .set('Update-Operator', '$push')
      .send({ molds: 'penicillium roqueforti' })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('molds');
        expect(body.molds).toHaveProperty('length', 1);
        expect(body.molds).toEqual(['penicillium roqueforti']);
      })
      .then(() =>
        request().put('/api/cheeses/Huntsman?select=molds')
          .set('Update-Operator', '$pull')
          .send({ molds: 'penicillium roqueforti' })
          .expect(200)
          .then(({ body }) => {
            expect(body).toHaveProperty('molds');
            expect(body.molds).toHaveProperty('length', 0);
          })));

  it('should disallow push mode by default', () =>
    request().put('/api/stores/Westlake')
      .set('Update-Operator', '$set')
      .send({ molds: 'penicillium roqueforti', __v: 0 })
      .expect(403)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'The requested update operator "$set" is not enabled for this resource (403).')
      ));

  it('should disallow setting non-whitelisted paths', () =>
    request().put('/api/cheeses/Huntsman')
      .set('Update-Operator', '$set')
      .send({ 'favorite nes game': 'bubble bobble' })
      .expect(403)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'This update path is forbidden for the requested update operator "$set" (403).')
      ));

  it("should allow setting an instance document's whitelisted paths when $set mode is enabled", () =>
    request().put('/api/cheeses/Huntsman?select=molds')
      .set('Update-Operator', '$set')
      .send({ molds: ['penicillium roqueforti'] })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('molds');
        expect(body.molds).toHaveProperty('length', 1);
        expect(body.molds).toEqual(['penicillium roqueforti']);
      }));

  it("should allow pushing to embedded arrays using positional $", () =>
    request().put('/api/cheeses/Camembert?select=arbitrary')
      .set('Update-Operator', '$push')
      .query({ conditions: JSON.stringify({ 'arbitrary.goat': true }) })
      .send({ 'arbitrary.$.llama': 5 })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('arbitrary');
        expect(body.arbitrary).toHaveProperty('length', 2);
        expect(body.arbitrary[0]).toHaveProperty('llama');
        expect(body.arbitrary[0].llama).toHaveProperty('length', 3);
        /*
       .expect(3).then(({ body }) => {
       .expect(4).then(({ body }) => {
       .expect(5).then(({ body }) => {
          expect(body.arbitrary[1].llama).toHaveProperty('length', 2);
       .expect(1).then(({ body }) => {
       .expect(2).then(({ body }) => {
        */
      }));

  it("should allow setting embedded fields using positional $", () =>
    request().put('/api/cheeses/Camembert?select=arbitrary')
      .set('Update-Operator', '$set')
      .query({ conditions: JSON.stringify({ 'arbitrary.goat': false }) })
      .send({ 'arbitrary.$.champagne': 'extra dry' })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('arbitrary');
        expect(body.arbitrary).toHaveProperty('length', 2);
        expect(body.arbitrary[0]).not.toHaveProperty('champagne');
        expect(body.arbitrary[1]).toHaveProperty('champagne', 'extra dry');
      }));

  it("should allow pulling from embedded fields using positional $", () =>
    request().put('/api/cheeses/Camembert?select=arbitrary')
      .set('Update-Operator', '$pull')
      .query({ conditions: JSON.stringify({ 'arbitrary.goat': true }) })
      .send({ 'arbitrary.$.llama': 3 })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('arbitrary');
        expect(body.arbitrary).toHaveProperty('length', 2);
        expect(body.arbitrary[0]).toHaveProperty('llama');
        expect(body.arbitrary[0].llama).toHaveProperty('length', 1);
        /*
       .expect(4).then(({ body }) => {
          expect(body.arbitrary[1].llama).toHaveProperty('length', 2);
       .expect(1).then(({ body }) => {
       .expect(2).then(({ body }) => {
        */
      }));

  it('should send 405 when a verb is disabled (GET)', () =>
    request().get('/api/beans')
      .expect(405)
      .then(({ headers, body }) => {
        expect(headers).toHaveProperty('allow', 'HEAD,POST,PUT,DELETE');
        expect(body).toHaveProperty('message', 'The requested method has been disabled for this resource (405).');
      }));

  it('should send 405 when a verb is disabled (DELETE)', () =>
    request().del('/api/liens')
      .expect(405)
      .then(({ headers, body }) => {
        expect(headers).toHaveProperty('allow', 'HEAD,GET,POST,PUT');
        expect(body).toHaveProperty('message', 'The requested method has been disabled for this resource (405).');
      }));

  it('should return a 400 when ID malformed (not ObjectID)', () =>
    request().get('/api/beans/bad')
      .expect(400)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'The requested document ID "bad" is not a valid document ID (400).')
      ));

  it('should return a 400 when ID malformed (not Number)', () =>
    request().get('/api/deans/0booze')
      .expect(400)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', 'The requested document ID "0booze" is not a valid document ID (400).')
      ));

  it('should allow setting path different from model name', () =>
    request().get('/api/baloo/?sort=name')
      .expect(200)
      .then(({ body }) =>
        expect(body).toHaveLength(2)
      ));

  it('should allow setting model independently of name', () =>
    request().get('/api/timeentries/Camembert')
      .expect(200)
      .then(({ body }) =>
        expect(body).toHaveProperty('color', 'White')
      ));

  it('should handle unique key error as a validation error', () =>
    request().post('/api/cheeses')
      .send({ name: 'Gorgonzola', color: 'Green' })
      .expect(201)
      .then(() =>
        request().post('/api/cheeses')
          .send({ name: 'Gorgonzola', color: 'Green' })
          .expect(422)
          .then(({ body }) => {
            expect(body).toHaveLength(1);
            expect(body[0]).toHaveProperty('type', 'unique');
            expect(body[0]).toHaveProperty('name', 'MongoError');
            expect(body[0]).toHaveProperty('value', 'Gorgonzola');
            expect(body[0]).toHaveProperty('path', 'name', '???');
            expect(body[0]).toHaveProperty('message', 'Path `name` (Gorgonzola) must be unique.', 'Path `???` (Gorgonzola) must be unique.');
            expect(body[0]).toHaveProperty('originalMessage');
            expect(body[0].originalMessage).toMatch(/dup key/);
            expect(body[0].originalMessage).toMatch(/"Gorgonzola"/);
            expect(body[0].originalMessage).toMatch(/E11000 duplicate key/);
          })
      ));

  it('should not handle errors if disabled', () =>
    request().post('/api-no-error-handler/geese')
      .send({ name: 'Gorgonzola', color: 'Green' })
      .expect(201)
      .then(() =>
        request().post('/api-no-error-handler/geese')
          .send({ name: 'Gorgonzola', color: 'Green' })
          .expect(422, /Unprocessable Entity: The request entity could not be processed \(422\)/)
      ));

  it('should allow setting path apart from plural', () =>
    request().get('/api/linseed.oil')
      .expect(200)
      .then(({ body }) =>
        expect(body).toHaveProperty('length', 2)
      ));
});
