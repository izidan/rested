const supertest = require('supertest');
const fixture = require('./fixtures/vegetable');

describe('GET singular', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should get the addressed document', () => {
    let turnip = fixture.vegetables[0];
    return request().get('/api/vegetables/' + turnip._id)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('_id', turnip._id.toString());
        expect(body).toHaveProperty('name', turnip.name);
      })
  });

  it('should return a 204 when ID not found', () =>
    request().get('/api/vegetables/666666666666666666666666')
      .expect(204, ''));

  it('should not set Location header', () =>
    request().get('/api/vegetables/6')
      .then(({ headers }) => expect(headers).not.toHaveProperty('location')));

});
