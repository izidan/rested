const fixture = require('./fixtures/vegetable');

describe('HEAD singular', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => require('supertest')(fixture.app());

  it('should get the header for the addressed document', () =>
    request().head('/api/vegetables/' + fixture.vegetables[0]._id)
      .expect(200, undefined)
  );

  it('should return a 404 when ID not found', () =>
    request().head('/api/vegetables/666666666666666666666666')
      .expect(204, undefined)
  );

});
