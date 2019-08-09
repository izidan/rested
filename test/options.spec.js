const supertest = require('supertest');
const fixture = require('./fixtures/vegetable');

describe.skip('OPTIONS instance/collection', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('provides options for the collection', () =>
    request().options('/api/vegetables/')
      .expect(200, 'HEAD,GET,POST,PUT,DELETE')
      .then(({ headers }) => {
        expect(headers).toHaveProperty('vary', 'Accept-Version');
        expect(headers).toHaveProperty('accept-version', '0.0.1');
        expect(headers).toHaveProperty('allow', 'HEAD,GET,POST,PUT,DELETE');
        expect(headers).toHaveProperty('date');
        expect(headers).toHaveProperty('connection', 'keep-alive');
      })
  );

  it('provides options for the instance', () =>
    request().options('/api/vegetables/' + fixture.vegetables[3]._id)
      .expect(200, 'HEAD,GET,POST,PUT,DELETE')
      .then(({ headers }) => {
        expect(headers).toHaveProperty('vary', 'Accept-Version');
        expect(headers).toHaveProperty('accept-version', '0.0.1');
        expect(headers).toHaveProperty('allow', 'HEAD,GET,POST,PUT,DELETE');
        expect(headers).toHaveProperty('date');
        expect(headers).toHaveProperty('connection', 'keep-alive');
      })
  );

});
