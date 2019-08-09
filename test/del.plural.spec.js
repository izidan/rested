const supertest = require('supertest');
const fixture = require('./fixtures/vegetable');

describe('DEL plural', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should delete all documents in addressed collection', () =>
    request().del('/api/vegetables/')
      .expect(200)
      .then(({ body }) =>
        // Check that the correct number were deleted.
        expect(body).toBe(8))
  );

  it('should invoke "remove" middleware', () =>
    request().del('/api/vegetables/')
      .then(() => expect(fixture).toHaveProperty('removeCount', 8))
  );
});
