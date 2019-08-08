const { vegetable } = require('./fixtures');

describe('GET plural', () => {
  beforeAll(vegetable.init);
  afterAll(vegetable.deinit);
  beforeEach(vegetable.create);
  const request = () => require('supertest')(vegetable.app());

  it("should return 'em all", () =>
    request().get('/api/vegetables')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(8);
        body.forEach((doc, i) => {
          let found = vegetable.vegetables.some(vege => vege._id.toString() === doc._id);
          expect(found).toBe(true);
        });
      }));

  it("should return an array even for one document match", () =>
    request().get('/api/vegetables')
      .query({ limit: 1 })
      .expect('Content-Type', /json/)
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(1);
        body.forEach((doc, i) => {
          let found = vegetable.vegetables.some(vege => vege._id.toString() === doc._id);
          expect(found).toBe(true);
        });
      }));

  it("should send 204 when no documents found", () =>
    request().get('/api/empty-array')
      .expect(204, ''));

  it("should send 204 when no document found", () =>
    request().get('/api/no-content')
      .expect(204, ''));

  it("should send 404 when no path found", () =>
    request().get('/api/not-found')
      .expect(404, /Cannot GET \/api\/not-found/));

  it('should not set Location header', () =>
    request().get('/api/vegetables')
      .then(({ headers }) =>
        expect(headers).not.toHaveProperty('location')));

});
