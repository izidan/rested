const fixture = require('./fixtures/vegetable');

describe('HEAD plural', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => require('supertest')(fixture.app());

  it("should get the header", () =>
    request().head('/api/vegetables')
      .expect(200, undefined)
  );
});
