const { vegetable } = require('./fixtures');

describe('DEL plural', () => {
  beforeAll(vegetable.init);
  afterAll(vegetable.deinit);
  beforeEach(vegetable.create);
  const request = () => require('supertest')(vegetable.app());

  it('should delete all documents in addressed collection', () =>
    request().del('/api/vegetables/')
      .expect(200)
      .then(({ body }) =>
        // Check that the correct number were deleted.
        expect(body).toBe(8))
  );

  it('should invoke "remove" middleware', () =>
    request().del('/api/vegetables/')
      .then(() => expect(vegetable).toHaveProperty('removeCount', 8))
  );
});
