const fixture = require('./fixtures/vegetable');

describe('Headers', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => require('supertest')(fixture.app());

  it('sets Last-Modified for single documents', () => {
    let turnip = fixture.vegetables[0];
    return request().head('/api/vegetables/' + turnip._id)
      .expect(200)
      .then(({ headers }) => {
        expect(headers).toHaveProperty('last-modified');
        let modified = headers['last-modified'];
        let httpDate = new Date(modified).toUTCString();
        return request().get('/api/vegetables/' + turnip._id)
          .expect(200)
          .expect('last-modified', httpDate)
      });
  });

  it('sets Last-Modified for the collection', () => {
    let updates = fixture.vegetables.map(vege => vege.lastModified);
    let max = new Date(Math.max.apply(null, updates));
    let httpDate = new Date(max).toUTCString();
    return request().head('/api/vegetables')
      .expect(200)
      .expect('last-modified', httpDate)
      .then(() =>
        request().get('/api/vegetables')
          .expect(200)
          .expect('trailer', /Last-Modified/)
          .expect('content-type', 'application/json; charset=utf-8')
          .expect('transfer-encoding', 'chunked')
          .then(({ res }) =>
            expect(res.trailers).toHaveProperty('last-modified', httpDate)
          ));
  });

  it('sets Etag for single documents', () => {
    let turnip = fixture.vegetables[0];
    return request().head('/api/vegetables/' + turnip._id)
      .expect(200)
      .expect('etag', /^"[0-9a-z]{32}"$/)
      .then(({ headers }) =>
        request().get('/api/vegetables/' + turnip._id)
          .expect(200)
          .expect('etag', headers.etag)
      );
  });

  it('sets Etag for the collection', () =>
    request().head('/api/vegetables')
      .expect(200)
      .expect('etag', /^"[0-9a-z]{32}"$/)
      .then(() =>
        request().get('/api/vegetables')
          .expect(200)
          .expect('trailer', /Last-Modified/)
          .expect('content-type', 'application/json; charset=utf-8')
          .expect('transfer-encoding', 'chunked')
        //.then(({ res }) => expect(res.trailers).toHaveProperty('etag', res.trailers.etag))
      ));

  it('sets Allowed', () =>
    request().head('/api/vegetables')
      .expect(200)
      .expect('allow', 'HEAD,GET,POST,PUT,DELETE')
  );

  it('sends 406 Not Acceptable when the requested type is not accepted', () =>
    request().get('/api/vegetables')
      .set('Accept', 'application/xml')
      .expect('content-type', 'text/html; charset=utf-8')
      .expect(406, /Not Acceptable: The requested content type could not be provided \(406\)\./)
  );

  it('should send 415 Unsupported Media Type when the request content type cannot be parsed', () =>
    request().post('/api/vegetables')
      .set('Content-Type', 'application/xml')
      .expect(415)
      .then(({ body }) =>
        expect(body).toHaveProperty('message', "The request's content type is unsupported (415).")
      ));

  it('should match the correct MIME type, ignoring extra options and linear whitespace', () =>
    request().post('/api/vegetables')
      .set('Content-Type', '     application/json        ;       charset=UTF-8    cheese=roquefort      ')
      .send({ name: 'Tomatillo' })
      .expect(201));

  it('should not set X-Powered-By', () =>
    request().head('/api/vegetables')
      .expect(200)
      .then(({ headers }) =>
        expect(headers).not.toHaveProperty('x-powered-by')
      ));

});
