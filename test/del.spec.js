const { vegetable } = require('./fixtures');

describe('DELETE singular', () => {
  beforeAll(vegetable.init);
  afterAll(vegetable.deinit);
  beforeEach(vegetable.create);
  const request = () => require('supertest')(vegetable.app());

  it('should delete the addressed document', () => {
    let shitake = vegetable.vegetables[3];
    return request().del('/api/vegetables/' + shitake._id)
      .expect('Content-Type', /json/)
      .expect(200) // count of deleted objects
      .then(({ body }) => {
        // Check that the correct number were deleted.
        expect(body).toBe(1);
        return request().del('/api/vegetables/' + shitake._id)
          .expect(204)
        //.then(({ body }) =>
        //  expect(body).toHaveProperty('message', 'Nothing matched the requested query (404).'))
      })
  });

  it('should invoke "remove" middleware', () => {
    let shitake = vegetable.vegetables[3];
    return request().del('/api/vegetables/' + shitake._id)
      .then(() => expect(vegetable).toHaveProperty('removeCount', 1))
  });

});
