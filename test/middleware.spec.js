const supertest = require('supertest');
const fixture = require('./fixtures/vegetable');

describe('Middleware', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should prevent resource from being loaded when block is set', () =>
    request().get('/api/vegetables/' + fixture.vegetables[0]._id)
      .query({ block: true })
      .expect(401)
  );

  it('should allow resource to be loaded when block is not set', () =>
    request().get('/api/vegetables/' + fixture.vegetables[0]._id)
      .query({ block: false })
      .expect(200)
      .then(({ body }) => expect(body).toHaveProperty('name', 'Turnip'))
  );

  it('should allow query middleware to alter query', () =>
    request().get('/api/vegetables/' + fixture.vegetables[0]._id)
      .query({ testQuery: true })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id');
        expect(body).not.toHaveProperty('name');
      })
  );

  it('should allow custom stream handlers (IN/POST)', () =>
    request().post('/api/vegetables/')
      .query({ streamIn: true })
      .send({ name: 'zoom' })
      .expect(201)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id');
        expect(body).toHaveProperty('name', 'boom');
      })
  );

  it('should allow custom stream handlers (IN/PUT)', () => {
    let radicchio = fixture.vegetables[7];
    return request().put('/api/vegetables/' + radicchio._id)
      .query({ streamIn: true })
      .send({ name: 'zoom' })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id', radicchio._id.toString());
        expect(body).toHaveProperty('name', 'boom');
      })
  });

  it('should allow custom stream handlers (FUNCTION)', () =>
    request().post('/api/vegetables/')
      .query({ streamInFunction: true })
      .send({ name: 'zoom' })
      .expect(201)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id');
        expect(body).toHaveProperty('name', 'bimm');
      })
  );

  it('should handle errors in user streams (IN/POST)', () =>
    request().post('/api/vegetables/')
      .query({ failIt: true })
      .send({ name: 'zoom' })
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Bento box'))
  );

  it('should handle errors in user streams (IN/PUT)', () => {
    let radicchio = fixture.vegetables[7];
    return request().put('/api/vegetables/' + radicchio._id)
      .query({ failIt: true })
      .send({ name: 'zoom' })
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Bento box'))
  });

  it('should handle errors in user streams (FUNCTION)', () =>
    request().post('/api/vegetables/')
      .query({ failItFunction: true })
      .send({ name: 'zoom' })
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Bento box'))
  );

  it('should handle errors in user streams (OUT)', () =>
    request().get('/api/vegetables/')
      .query({ failIt2: true })
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Bento box'))
  );

  it('should skip streaming documents in if request.body is already present', () =>
    request().post('/api/vegetables/')
      .query({ parse: true })
      .send({ name: 'zoom' })
      .expect(201)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id');
        expect(body).toHaveProperty('name', 'zoom');
      })
  );

  it('should allow custom stream handlers (OUT)', () =>
    request().get('/api/vegetables/')
      .query({ streamOut: true })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(8);
        expect(body[0]).toHaveProperty('name', 'beam');
        expect(body[1]).toHaveProperty('name', 'beam');
        expect(body[2]).toHaveProperty('name', 'beam');
      })
  );

  it('allows custom stream handlers to alter documents (delete)', () =>
    request().get('/api/vegetables/')
      .query({ deleteNutrients: true })
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(8);
        expect(body[0]).not.toHaveProperty('nutrients');
      })
  );

  //it('should prevent mixing streaming and documents middleware (maybe)');
  xit('should allow streaming out into request.rested.documents (maybe)', () =>
    request().get('/api/vegetables/')
      .query({ streamToArray: true })
      .expect(201)
      .then(({ body }) => {
        expect(body).toHaveLength(8);
        expect(body[0]).toHaveProperty('name', 'beam');
        expect(body[1]).toHaveProperty('name', 'beam');
        expect(body[2]).toHaveProperty('name', 'beam');
      })
  );

  xit('should 404 if request.rested.documents is undefined, null, or 0 (maybe)', () =>
    request().get('/api/vegetables/')
      .expect(404, 1234)
  );

  it('should skip streaming documents out if request.rested.documents is present', () =>
    request().get('/api/vegetables/')
      .query({ creamIt: true })
      .expect(200, ['Devonshire Clotted Cream.'])
  );

});
