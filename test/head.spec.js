const { vegetable } = require('./fixtures');

describe('HEAD singular', () => {
  beforeAll(vegetable.init);
  afterAll(vegetable.deinit);
  beforeEach(vegetable.create);
  const request = () => require('supertest')(vegetable.app());

  it('should get the header for the addressed document', () =>
    request().head('/api/vegetables/' + vegetable.vegetables[0]._id)
      .expect(200, undefined)
  );

  it('should return a 404 when ID not found', () =>
    request().head('/api/vegetables/666666666666666666666666')
      .expect(204, undefined)
  );

});
