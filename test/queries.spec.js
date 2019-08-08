const parselinks = require('parse-link-header');
const fixture = require('./fixtures/vegetable');

describe('Queries', () => {
  beforeAll(fixture.init);
  afterAll(fixture.deinit);
  beforeEach(fixture.create);
  const request = () => require('supertest')(fixture.app());

  it('should support skip 1', () =>
    request().get('/api/vegetables?skip=1')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(fixture.vegetables.length - 1))
  );

  it('should support skip 2', () =>
    request().get('/api/vegetables?skip=2')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(fixture.vegetables.length - 2))
  );

  it('should support limit 1', () =>
    request().get('/api/minerals?limit=1')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(1))
  );

  it('should support limit 2', () =>
    request().get('/api/minerals?limit=2')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(2))
  );

  it('disallows selecting deselected fields', () =>
    request().get('/api/vegetables?select=species+lastModified')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Including excluded fields is not permitted (403).'))
  );

  it('disallows populating deselected fields 1', () =>
    request().get('/api/vegetables?populate=species')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Including excluded fields is not permitted (403).'))
  )

  it('disallows populating deselected fields 2', () =>
    request().get('/api/vegetables?populate={ "path": "species" }')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Including excluded fields is not permitted (403).'))
  );

  it('should support default express query parser when using populate', () =>
    request().get('/api/vegetables?populate[path]=species')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Including excluded fields is not permitted (403).'))
  );

  it('disallows using +fields with populate', () =>
    request().get('/api/vegetables?populate={ "select": "%2Bboiler" }')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Selecting fields of populated documents is not permitted (403).'))
  );

  it('disallows using +fields with select', () =>
    request().get('/api/vegetables?select=%2Bboiler')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Including excluded fields is not permitted (403).'))
  );

  it('disallows selecting fields when populating', () =>
    request().get('/api/vegetables?populate={ "path": "a", "select": "arbitrary" }')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Selecting fields of populated documents is not permitted (403).'))
  );

  it('should not crash when disallowing selecting fields when populating', () =>
    request().get('/api/vegetables?populate=[{ "path": "a", "select": "arbitrary actuary" }, { "path": "b", "select": "arbitrary actuary" }]')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Selecting fields of populated documents is not permitted (403).'))
  );

  it('disallows selecting fields when populating', () =>
    request().get('/api/vegetables?populate={ "path": "a", "select": "arbitrary" }')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Selecting fields of populated documents is not permitted (403).'))
  );

  it('allows populating children', () =>
    request().get('/api/vegetables/' + fixture.vegetables[0]._id + '/?populate=nutrients')
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveProperty('nutrients');
        expect(body.nutrients).toHaveLength(1);
        expect(body.nutrients[0]).toHaveProperty('color', 'Blue');
      })
  );

  it('allows query by Id', () =>
    request().get('/api/vegetables/' + fixture.vegetables[0]._id)
      .expect(200)
      .then(({ body }) => expect(body).toHaveProperty('name', 'Turnip'))
  );

  it('allows default express query string format', () =>
    request().get('/api/vegetables?conditions[name]=Radicchio')
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toHaveProperty('name', 'Radicchio');
      })
  );

  it('allows selecting fields', () =>
    request().get('/api/vegetables?select=-_id lastModified')
      .expect(200)
      .then(({ body }) => {
        expect(body[0]).not.toHaveProperty('_id');
        expect(body[0]).not.toHaveProperty('name');
        expect(body[0]).toHaveProperty('lastModified');
      })
  );

  it('allows setting default sort', () =>
    request().get('/api/minerals')
      .expect(200)
      .then(({ body }) => {
        let lastMineral;
        body.forEach(mineral => {
          if (lastMineral) expect(mineral.color.localeCompare(lastMineral)).toBe(1);
          lastMineral = mineral.color;
        });
      })
  );

  it('allows overriding default sort', () =>
    request().get('/api/minerals?sort=-color')
      .expect(200)
      .then(({ body }) => {
        let lastMineral;
        body.forEach(mineral => {
          if (lastMineral) expect(mineral.color.localeCompare(lastMineral)).toBe(-1);
          lastMineral = mineral.color;
        });
      })
  );

  it('allows deselecting hyphenated field names', () =>
    request().get('/api/vegetables?select=-hyphenated-field-name')
      .expect(200)
      .then(({ body }) => {
        expect(body[0]).toHaveProperty('_id');
        expect(body[0]).toHaveProperty('__v');
        expect(body[0]).not.toHaveProperty('hpyhenated-field-name');
      })
  );

  it('should not add query string to the search link (collection)', () =>
    request().get('/api/minerals?sort=color')
      .expect(200)
      .expect('link', '</api/minerals>; rel="search", </api/minerals?sort=color>; rel="self"')
  );

  it('should not add query string to the search link (instance)', () =>
    request().get('/api/minerals')
      .expect(200)
      .then(({ body }) => {
        let id = body[0]._id;
        return request().get('/api/minerals/' + id + '?sort=color')
          .expect(200)
          .expect('link', '</api/minerals>; rel="collection", </api/minerals>; rel="search", </api/minerals/' + id + '>; rel="edit", </api/minerals/' + id + '>; rel="self"')
      })
  );

  it('should send 400 if limit is invalid', () =>
    request().get('/api/minerals?limit=-1')
      .expect(400)
      .then(({ body, headers }) => {
        expect(headers).not.toHaveProperty('link');
        expect(body).toHaveProperty('message', 'Limit must be a positive integer if set (400).');
      })
  );

  it('should send 400 if limit is invalid', () =>
    request().get('/api/minerals?limit=0')
      .expect(400)
      .then(({ body, headers }) => {
        expect(headers).not.toHaveProperty('link');
        expect(body).toHaveProperty('message', 'Limit must be a positive integer if set (400).')
      })
  );

  it('should send 400 if limit is invalid', () =>
    request().get('/api/minerals?limit=3.6')
      .expect(400)
      .then(({ body, headers }) => {
        expect(headers).not.toHaveProperty('link');
        expect(body).toHaveProperty('message', 'Limit must be a positive integer if set (400).')
      })
  );

  it('should send 400 if limit is invalid', () =>
    request().get('/api/minerals?limit= asd  asd ')
      .expect(400)
      .then(({ body, headers }) => {
        expect(headers).not.toHaveProperty('link');
        expect(body).toHaveProperty('message', 'Limit must be a positive integer if set (400).')
      })
  );

  it('should send 400 if skip is invalid', () =>
    request().get('/api/minerals?skip=1.1')
      .expect(400)
      .then(({ body, headers }) => {
        expect(headers).not.toHaveProperty('link');
        expect(body).toHaveProperty('message', 'Skip must be a non-negative integer if set (400).')
      })
  );

  it('should send 400 if count is invalid', () =>
    request().get('/api/minerals?count=1')
      .expect(400)
      .then(({ body, headers }) => {
        expect(headers).not.toHaveProperty('link');
        expect(body).toHaveProperty('message', 'Count must be "true" or "false" if set (400).')
      })
  );

  it('allows adding paging links', () =>
    request().get('/api/minerals?limit=2')
      .expect(200)
      .then(({ headers }) => expect(headers).toHaveProperty('link'))
  );

  it('should not return paging links if limit not set', () =>
    request().get('/api/minerals?sort=name')
      .expect(200)
      .then(({ headers }) => {
        expect(headers.link).toContain('rel="self"');
        expect(headers.link).toContain('rel="search"');
        expect(headers.link).not.toContain('rel="first"');
        expect(headers.link).not.toContain('rel="last"');
        expect(headers.link).not.toContain('rel="next"');
        expect(headers.link).not.toContain('rel="previous"');
      })
  );

  it('should not return paging links if relations are not enabled', () =>
    request().get('/api/vegetables')
      .expect(200)
      .then(({ headers }) => expect(headers.link).toBeUndefined())
  );

  it('allows using relations: true with sorted queries', () =>
    request().get('/api/minerals?sort=color&limit=2&skip=2&select=-__v -_id -enables')
      .expect(200, [{ color: 'Indigo' }, { color: 'Orange' }])
      .then(({ headers }) => {
        expect(headers.link).toContain('rel="first"');
        expect(headers.link).toContain('rel="last"');
        expect(headers.link).toContain('rel="next"');
        expect(headers.link).toContain('rel="previous"');
      })
  );

  it('should return next for first page', () =>
    request().get('/api/minerals?limit=2')
      .expect(200)
      .expect('link', /rel="next"/)
  );

  it('should return previous for second page', () =>
    request().get('/api/minerals?limit=2&skip=2')
      .expect(200)
      .expect('link', /rel="previous"/)
  );

  it('should not return paging links previous for first page', () =>
    request().get('/api/minerals?limit=2')
      .expect(200)
      .then(({ headers }) => expect(headers.link).not.toContain('rel="previous"'))
  );

  it('should not return paging links next for last page', () =>
    request().get('/api/minerals?limit=2&skip=6')
      .expect(200)
      .then(({ headers }) => expect(headers.link).not.toContain('rel="next"'))
  );

  it('should preserve query in paging links', () => {
    let conditions = JSON.stringify({ color: { $regex: '.*e.*' } });
    return request().get('/api/minerals?limit=1&skip=0&conditions=' + conditions)
      .expect(200)
      .expect('link', /rel="next"/)
      .then(({ headers }) => {
        let links = parselinks(headers.link);
        expect(links.next.url).toContain('conditions=' + encodeURIComponent(conditions));
      })
  });

  it('allows retrieving paging links next', () =>
    request().get('/api/minerals?limit=2&skip=0')
      .expect(200)
      .then(({ headers }) => {
        expect(headers).toHaveProperty('link');
        let links = parselinks(headers.link);
        expect(links).toHaveProperty('next');
        return request().get(links.next.url)
          .expect(200)
      })
  );

  it('allows retrieving paging links previous', () =>
    request().get('/api/minerals?limit=2&skip=2')
      .expect(200)
      .then(({ headers }) => {
        expect(headers).toHaveProperty('link');
        let links = parselinks(headers.link);
        expect(links).toHaveProperty('previous');
        return request().get(links.previous.url)
          .expect(200)
      })
  );

  it('allows retrieving paging links last', () =>
    request().get('/api/minerals?limit=2&skip=6')
      .expect(200)
      .then(({ headers }) => {
        expect(headers).toHaveProperty('link');
        let links = parselinks(headers.link);
        expect(links).toHaveProperty('first');
        return request().get(links.first.url)
          .expect(200)
      })
  );

  it('allows retrieving paging links first', () =>
    request().get('/api/minerals?limit=2&skip=0')
      .expect(200)
      .then(({ headers }) => {
        expect(headers).toHaveProperty('link');
        let links = parselinks(headers.link);
        expect(links).toHaveProperty('last');
        return request().get(links.last.url)
          .expect(200)
      })
  );

  it('allows retrieving count instead of documents', () =>
    request().get('/api/vegetables?count=true')
      .expect(200)
      .then(({ body }) => expect(body).toBe(8))
  );

  it('should not send count if count is not set to true', () =>
    request().get('/api/vegetables?count=false')
      .expect(200)
      .then(({ body }) => expect(body).not.toBeInstanceOf(Number))
  );

  it('should report bad hints', () =>
    request().get('/api/vegetables?hint={ "foogle": 1 }')
      .expect(400)
      .then(({ body }) => expect(body).toHaveProperty('message', 'The requested query hint is invalid (400).'))
  );

  it('allow using hint with count', () =>
    request().get('/api/vegetables?count=true&hint={ "_id": 1 }')
      .expect(200)
      .then(({ body }) => expect(body).toBe(8))
  );

  it('allows adding index hint', () =>
    request().get('/api/vegetables?hint={ "_id": 1 }')
      .expect(200)
  );

  it('allows adding index hint', () =>
    request().get('/api/vegetables?hint[_id]=1')
      .expect(200)
  );

  it('allows using comment with count', () =>
    request().get('/api/vegetables?count=true&comment=salve')
      .expect(200)
      .then(({ body }) => expect(body).toBe(8))
  );

  it('allows adding a query comment', () =>
    request().get('/api/vegetables?comment=testing testing 123')
      .expect(200)
  );

  it('should not allow adding an index hint if not enabled', () =>
    request().get('/api/fungi?hint={ "_id": 1 }')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Hints are not enabled for this resource (403).'))
  );

  it('should ignore query comments if not enabled', () =>
    request().get('/api/fungi?comment=testing testing 123')
      .expect(200)
      .then(({ body }) => expect(body).toHaveLength(1))
  );

  it('allows querying for distinct values', () =>
    request().get('/api/vegetables?distinct=name')
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(8);
        body.sort();
        expect(body[0]).toBe('Carrot');
        expect(body[1]).toBe('Lima Bean');
        expect(body[2]).toBe('Pea');
        expect(body[3]).toBe('Radicchio');
        expect(body[4]).toBe('Shitake');
        expect(body[5]).toBe('Spinach');
        expect(body[6]).toBe('Turnip');
        expect(body[7]).toBe('Zucchini');
      })
  );

  it('allows counting for distinct values', () =>
    request().get('/api/vegetables?distinct=name&count=true')
      .expect(200)
      .then(({ body }) => expect(body).toBe(8))
  );

  it('allows querying for distinct values restricted by conditions', () =>
    request().get('/api/vegetables?distinct=name&conditions={ "name": "Carrot" }')
      .expect(200, ['Carrot'])
  );

  it('allows counting for distinct values restricted by conditions', () =>
    request().get('/api/vegetables?distinct=name&count=true&conditions={ "name": "Carrot" }')
      .expect(200)
      .then(({ body }) => expect(body).toBe(1))
  );

  it('should not allow querying for distinct values of deselected paths', () =>
    request().get('/api/fungi?distinct=hyphenated-field-name')
      .expect(403)
      .then(({ body }) => expect(body).toHaveProperty('message', 'You may not find distinct values for the requested path (403).'))
  );


  it('allows using query operators with _id', () =>
    request().get('/api/vegetables?conditions={ "_id": { "$gt": "111111111111111111111111" } }')
      .expect(200)
      .then(({ body }) => {
        expect(body).toHaveLength(8);
        expect(body[0]).toHaveProperty('name', 'Turnip');

      })
  );

  it('should give a 400 if the query string is unpar using query operators with _id', () =>
    request().get('/api/vegetables?conditions={ \'_id\': { \'$gt\': \'111111111111111111111111\' } }')
      .expect(400)
      .then(({ body }) => expect(body).toHaveProperty('message', 'The conditions query string value was not valid JSON: "Unexpected token \' in JSON at position 2" (400).'))
  );

  it('disallows $explain by default', () =>
    request().get('/api/vegetables?conditions={ "$explain": true }')
      .expect(400)
      .then(({ body }) => expect(body).toHaveProperty('message', 'Using $explain is disabled for this resource (400).'))
  )

});
