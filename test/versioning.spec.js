const supertest = require('supertest');
const rested = require('..');
const fixture = require('./fixtures/versioning');

describe('Versioning', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(rested.empty.bind(rested));
  const request = () => supertest(fixture.app());

  it('should use the highest release if no request version is specified', () =>
    request().get('/api/versioned/parties')
      .expect('accept-version', '3.0.1'));

  it('should cause an error when an invalid release is specified', () => {
    let fn = () => rested().releases('1.0.0').releases('abc');
    expect(fn).toThrow(/^Release version "abc" is not a valid semver version$/);
  });

  it('should use the highest valid release in the requested version range', () =>
    request().get('/api/versioned/parties')
      .set('Accept-Version', '<3')
      .expect('accept-version', '2.1.0'));

  it('should use the requested release if specific version is given', () =>
    request().get('/api/versioned/parties')
      .set('Accept-Version', '1.0.0')
      .expect('accept-version', '1.0.0'));

  it("should 400 if the requested release range can't be satisfied", () =>
    request().get('/api/versioned/parties')
      .set('Accept-Version', '>3.0.1')
      // now is HTML / before was plain/text
      .expect(400, /BadRequestError: The requested API version range &quot;&gt;3.0.1&quot; could not be satisfied/)
      // I would expect JSON instead of html as negociated with json: true in the caller
      .expect('content-type', /text\/html/)
      .then(({ headers }) => expect(headers).not.toHaveProperty('accept-version'))
  );

  xit('should catch controllers that are added twice to overlapping API dependencies', () => {
    rested.rest('party').versions('>0.0.0');
    rested.rest('party').versions('<2');
    expect(rested.bind(rested)).toThrow(/^Controllers with path "\/parties" exist more than once in a release that overlaps "<2"$/);
  });

  xit('should catch controllers that are added twice to the same release', () => {
    rested.rest('party').versions('0.0.1');
    rested.rest('party').versions('0.0.1');
    expect(rested.bind(rested)).toThrow(/^Controllers with path "\/parties" exist more than once in a release that overlaps "0.0.1"$/);
  });

  it('should catch controllers with invalid version range', () => {
    let fn = () => rested.rest('party').versions('abc');
    expect(fn).toThrow(/^Controller version range "abc" was not a valid semver range$/);
  });

  xit('should cause an error when a release has no controllers', () => {
    rested.rest('party').versions('1.5.7');
    let fn = rested.bind(rested, { releases: ['0.0.1', '1.5.7'] });
    expect(fn).toThrow(/^There are no controllers in release "0[.]0[.]1"$/);
  });

  xit("should catch controllers where the API version range doesn't satisfy any releases", () => {
    rested.rest('party').versions('0.0.1');
    rested.rest('party').versions('1.4.6');
    expect(rested.bind(rested)).toThrow(/^The controller version range "1[.]4[.]6" doesn't satisfy any API release$/);
  });

  it('should work seamlessly when no versioning info is supplied', () =>
    request().get('/api/unversioned/dungeons')
      .expect('accept-version', '0.0.1'));

  it('should set the `Vary` header', () =>
    request().get('/api/unversioned/dungeons')
      .expect('vary', 'Accept-Version, Accept'));

  it('should send "409 Conflict" if there is a version conflict', () =>
    request().post('/api/versioned/pumpkins')
      .send({ title: 'Franklin' })
      .expect(201)
      .then(({ body }) =>
        request().put('/api/versioned/pumpkins/' + body._id)
          .send({ title: 'Ranken', __v: 0 })
          .expect(200)
          .then(() =>
            request().put('/api/versioned/pumpkins/' + body._id)
              .send({ title: 'Ranken', __v: 0 })
              .expect(409)
              .then(({ body }) =>
                expect(body).toHaveProperty('message', 'The requested update would conflict with a previous update')
              ))));

  it('should send "409 Conflict" if there is a version conflict (greater than)', () =>
    request().get('/api/versioned/pumpkins?sort=-_id')
      .expect(200)
      .then(({ body }) => {
        expect(body).toBeDefined();
        expect(body).toBeInstanceOf(Array);
        expect(body.length).toBeGreaterThan(0);
        return request().put('/api/versioned/pumpkins/' + body[0]._id)
          .send({ __v: body[0].__v + 10 })
          .expect(409)
          .then(({ body }) =>
            expect(body).toHaveProperty('message', 'The requested update would conflict with a previous update')
          );
      }));

  it('should not send "409 Conflict" if there is no version conflict (equal)', () =>
    request().get('/api/versioned/pumpkins?sort=-_id')
      .expect(200)
      .then(({ body }) =>
        request().put('/api/versioned/pumpkins/' + body[0]._id)
          .send({ __v: body[0].__v })
          .expect(200)));

  it('should cause an error if locking is enabled and no version is selected on the doc', () =>
    request().get('/api/versioned/pumpkins')
      .expect(200)
      .then(({ body }) =>
        request().put('/api/versioned/pumpkins/' + body[0]._id)
          .send({ title: 'Forest Expansion' })
          .then(({ body }) =>
            expect(body).toHaveProperty('message', 'Locking is enabled, but the target version key "__v" was not provided in the request body'))
      ))

});
