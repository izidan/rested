const { vegetable } = require('./fixtures');

describe('HEAD plural', () => {
  beforeAll(vegetable.init);
  afterAll(vegetable.deinit);
  beforeEach(vegetable.create);
  const request = () => require('supertest')(vegetable.app());

  it("should get the header", () =>
    request().head('/api/vegetables')
      .expect(200, undefined)
  );
});
