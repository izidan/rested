const supertest = require('supertest');
const fixture = require('./fixtures/vegetable');

describe('POST plural', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => supertest(fixture.app());

  it('should create a new object and return its ID', () =>
    request().post('/api/vegetables/')
      .send({ name: 'Tomato' })
      .expect(201)
      .then(({ body, headers }) => {
        expect(body._id).toBeDefined();
        expect(headers.location).toEqual('/api/vegetables/' + body._id);
        return request().get(headers.location)
          .expect(200)
          .then(({ body }) => expect(body).toHaveProperty('name', 'Tomato'))
      })
  );

  it('should correctly set location header when there is no trailing slash', () =>
    request().post('/api/vegetables')
      .send({ name: 'Tomato' })
      .expect(201)
      .then(({ body, headers }) => {
        expect(body._id).toBeDefined();
        expect(headers.location).toEqual('/api/vegetables/' + body._id);
      })
  );

  it('should allow posting multiple documents at once', () =>
    request().post('/api/vegetables/')
      .send([{ name: 'Catnip' }, { name: 'Cattail' }])
      .expect(201)
      .then(({ body, headers }) => {
        expect(body).toHaveLength(2);
        expect(body[0]._id).toBeDefined();
        expect(body[1]._id).toBeDefined();
        return request().get(headers.location)
          .expect(200)
          .then(({ body }) => {
            expect(body).toHaveLength(2);
            expect(body[0]).toHaveProperty('name', 'Catnip');
            expect(body[1]).toHaveProperty('name', 'Cattail');
          });
      })
  );

  it('should 422 if no document sent', () =>
    request().post('/api/vegetables/')
      .send([])
      .expect(422, [{ message: 'The request body must contain at least one document', name: 'RestError' }])
  );


  it('should fire pre save Mongoose middleware', () => {
    fixture.saveCount = 0;
    return request().post('/api/vegetables/')
      .send({ name: 'Ground Cherry' })
      .then(() => expect(fixture.saveCount).toBe(1));
  });

  it('should provide correct status and informative body for validation errors', () =>
    request().post('/api/vegetables/')
      .send({ score: -1 })
      .expect(422)
      .then(({ body }) => {
        expect(body).toHaveLength(2);
        expect(body[0]).toHaveProperty('message', 'Path `name` is required.');
        expect(body[0]).toHaveProperty('name', 'ValidatorError');
        expect(body[0]).toHaveProperty('path', 'name');
        //expect(body[0]).toHaveProperty('type', 'required');
        expect(body[0]).toHaveProperty('kind', 'required');
        expect(body[1]).toHaveProperty('message', 'Path `score` (-1) is less than minimum allowed value (1).');
        expect(body[1]).toHaveProperty('name', 'ValidatorError');
        expect(body[1]).toHaveProperty('path', 'score');
        //expect(body[1]).toHaveProperty('type', 'min');
        expect(body[1]).toHaveProperty('kind', 'min');
        expect(body[1]).toHaveProperty('value', -1);
      })
  );

  it('should handle malformed JSON inside first-level objects but ignore those outside', () =>
    request().post('/api/vegetables/')
      .send('bababa { cacacaca "name": "Garlic Scape" }')
      .set('Content-Type', 'application/json')
      .expect(400)
      .then(({ body }) => expect(body).toHaveProperty('message', 'The body of this request was invalid and could not be parsed. "Unexpected token c in JSON at position 2" (400).'))
  );

});
