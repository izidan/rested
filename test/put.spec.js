const fixture = require('./fixtures/vegetable');

describe('PUT singular', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => require('supertest')(fixture.app());

  it("should replace the addressed object if it exists", () => {
    let radicchio = fixture.vegetables[7];
    return request().get('/api/vegetables/' + radicchio._id)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('name', 'Radicchio');
        // put the leek on the server
        return request().put('/api/vegetables/' + radicchio._id)
          .send({ name: 'Leek' })
          .expect(200)
          .then(({ headers }) => {
            expect(headers).not.toHaveProperty('location');
            return request().get('/api/vegetables/' + radicchio._id)
              .expect(200)
              .then(({ body }) => expect(body).toHaveProperty('name', 'Leek'))
          });
      });
  });

  it("should 422 on no document", () => {
    let radicchio = fixture.vegetables[7];
    return request().get('/api/vegetables/' + radicchio._id)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('name', 'Radicchio');
        // put the leek on the server
        return request().put('/api/vegetables/' + radicchio._id)
          .expect(422, [{ message: 'The request body did not contain an update document', name: 'RestError' }]);
      });
  });

  it("should 422 on multiple documents", () => {
    let radicchio = fixture.vegetables[7];
    return request().get('/api/vegetables/' + radicchio._id)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('name', 'Radicchio');
        // Put some veggies on the server.
        return request().put('/api/vegetables/' + radicchio._id)
          .send([{ name: 'Pea Shoot' }, { name: 'Bitter Melon' }])
          .expect(422, [{ message: 'The request body contained more than one update document', name: 'RestError' }]);
      });
  });

  it('should only allow updates', () => {
    let id = 'badbadbadbadbadbadbadbad';
    // First check it's not there
    return request().get('/api/vegetables/' + id)
      .expect(204)
      .then(() =>
        // Attempt to update non-existant doc
        request().put('/api/vegetables/' + id)
          .send({ name: 'Cucumber' })
          .expect(404)
          .then(({ body }) => {
            expect(body).toHaveProperty('message', 'Nothing matched the requested query (404).');
            // Make sure it wasn't created
            return request().get('/api/vegetables/' + id)
              .expect(204)
          })
      );
  });

  it('should fire pre save Mongoose middleware', () => {
    fixture.saveCount = 0;
    let radicchio = fixture.vegetables[7];
    return request().put('/api/vegetables/' + radicchio._id)
      .send({ name: 'Radicchio di Treviso' })
      .then(() => expect(fixture.saveCount).toBe(1))
  });

  //it('should allow running validation with methods that currently bypass validation ... maybe');
  //it('should always select the version key when locking is enabled ... maybe');
});

