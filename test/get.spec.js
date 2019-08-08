const { vegetable } = require('./fixtures');

describe('GET singular', () => {
  beforeAll(vegetable.init);
  afterAll(vegetable.deinit);
  beforeEach(vegetable.create);
  const request = () => require('supertest')(vegetable.app());

  it('should get the addressed document', () => {
    let turnip = vegetable.vegetables[0];
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
