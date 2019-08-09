const supertest = require('supertest');
const fixture = require('./fixtures/vegetable');

describe('DELETE singular', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should delete the addressed document', () => {
    let shitake = fixture.vegetables[3];
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
    let shitake = fixture.vegetables[3];
    return request().del('/api/vegetables/' + shitake._id)
      .then(() => expect(fixture).toHaveProperty('removeCount', 1))
  });

});
