const supertest = require('supertest');
const fixture = require('./fixtures/inheritence');

describe('Inheritence', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should return all documents for parent model controller', () =>
    request().get('/api/liqueurs')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(6))
  );

  // There seems to be an bug in mongoose that prevents this from working...
  it('should return typed documents for child model controller', () =>
    request().get('/api/amari')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(3))
  );

  it('should create parent model when no discriminator is supplied', () =>
    request().post('/api/liqueurs')
      .send({ name: 'Generic 2' })
      .expect(201)
      .then(({ body, headers }) => {
        expect(body).not.toHaveProperty('__t');
        expect(headers).toHaveProperty('location');
        return request().get(headers.location)
          .expect(200)
          .then(({ body }) => expect(body).toHaveProperty('name', 'Generic 2'))
      })
  );

  it('should create child model when a discriminator is supplied', () =>
    request().post('/api/liqueurs')
      .send({ name: 'Elderberry', sweetness: 3, __t: 'cordial' })
      .expect(201)
      .then(({ body, headers }) => {
        expect(body).toHaveProperty('__t', 'cordial');
        expect(headers).toHaveProperty('location');
        return request().get(headers.location)
          .expect(200)
          .then(({ body }) => expect(body).toHaveProperty('name', 'Elderberry'))
      })
  );

  it('should give a 422 if the discriminator does not exist', () =>
    request().post('/api/liqueurs')
      .send({ name: 'Oud Bruin', __t: 'ale' })
      .expect(422, { message: 'A document\'s type did not match any known discriminators for this resource', name: 'RestError', path: '__t', value: 'ale' })
  );

});
