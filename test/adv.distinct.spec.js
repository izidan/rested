const supertest = require('supertest');
const csv = require('csv-parser');
const fs = require('fs');
const fixture = require('./fixtures/countries');

const toTitleCase = (str) => str.trim()
    .replace(/([-\s_\(\)\[\]\\\/:])\w?/g, t => t.substr(1).toUpperCase())
    .replace(/(?![a-z])([A-Z]+)$/g, t => t[0].toUpperCase() + t.substr(1).toLowerCase())
    .replace(/^[A-Z|0-9]+?(?=[A-Z]?[a-z|0-9])/g, t => t.toLowerCase())

const parser = csv({
    mapHeaders: ({ header }) => toTitleCase(header),
    mapValues: ({ header, value }) => value.match(/^\s*$/) ? undefined :
        header.match(/@id|Id|ID/) ? value : !isNaN(value) ? Number(value) :
            value.match(/^\d{2}\/\d{2}\/\d{4}$/) ? new Date(value.split('/').reverse().join('-')) : value
});

describe('Advanced', () => {
    beforeAll(fixture.init);
    afterAll(fixture.deinit);
    const request = () => supertest(fixture.app());

    it('should replace entire countries collection from csv', done =>
        request().del('/api/countries').then(({ statusCode }) => {
            let rows = [];
            expect(statusCode).toBeLessThanOrEqual(204);
            expect(statusCode).toBeGreaterThanOrEqual(200);
            fs.createReadStream('test/data/country-codes.csv').pipe(parser)
                .on('data', row => row.isO31661Alpha3 ? rows.push(row) : null)
                .on('end', err => err ? done(err) : request().post('/api/countries').send(rows)
                    .expect(201)
                    .then(({ body }) => {
                        expect(body).toHaveLength(rows.length);
                        expect(body[9]).toHaveProperty('_id');
                        expect(body[9]._id).toMatch(/^[A-Z]{3}$/);
                        expect(body[9]).not.toHaveProperty('names');
                        done();
                    }).catch(done)
                );
        })
    );

    it('get distinct values', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent' })
            .expect(200, ['AS', 'EU', 'AF', 'OC', 'NA', 'AN', 'SA']))

    it('count distinct values', () =>
        request().get('/api/countries').query({ distinct: 'continent', count: true })
            .expect(200, '7'))

    it('get distinct values filtered by currency', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent', conditions: { currency: 'USD' } })
            .expect(200, ['OC', 'NA', 'AS', 'SA']))

    it('count distinct values filtered by currency', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent', count: true, conditions: { currency: 'USD' } })
            .expect(200, '4'))

    it('get distinct values with null in last', () =>
        request().put('/api/countries/USA')
            .send({ continent: null })
            .expect(200)
            .then(({ body }) => {
                expect(body).toHaveProperty('_id', 'USA');
                expect(body).not.toHaveProperty('names');
                return request().get('/api/countries')
                    .query({ distinct: 'continent' })
                    .expect(200, ['AS', 'EU', 'AF', 'OC', 'NA', 'AN', 'SA', null]);
            }));

    it('get distinct values with null in between', () =>
        request().put('/api/countries/ALB')
            .send({ continent: null })
            .expect(200)
            .then(({ body }) => {
                expect(body).toHaveProperty('_id', 'ALB');
                expect(body).not.toHaveProperty('names');
                return request().get('/api/countries')
                    .query({ distinct: 'continent' })
                    .expect(200, ['AS', null, 'AF', 'OC', 'EU', 'NA', 'AN', 'SA']);
            }));

    it('get distinct values with null in first', () =>
        request().put('/api/countries/TWN')
            .send({ continent: null })
            .expect(200)
            .then(({ body }) => {
                expect(body).toHaveProperty('_id', 'TWN');
                expect(body).not.toHaveProperty('names');
                return request().get('/api/countries')
                    .query({ distinct: 'continent' })
                    .expect(200, [null, 'AS', 'AF', 'OC', 'EU', 'NA', 'AN', 'SA']);
            }));

    it('count distinct values including nulls', () =>
        request().put('/api/countries/TWN')
            .send({ continent: null })
            .expect(200)
            .then(() => request().get('/api/countries')
                .query({ distinct: 'continent', count: true })
                .expect(200, '8')));

    it('get distinct by non-existent field should return empty array', () =>
        request().get('/api/countries')
            .query({ distinct: 'non-existent' })
            .expect(200, []))

    it('count distinct by non-existent field should return zero', () =>
        request().get('/api/countries').query({ distinct: 'non-existent', count: true })
            .expect(200, '0'))

    it('get distinct values on single document', () =>
        request().get('/api/countries/EGY')
            .query({ distinct: 'continent' })
            .expect(200, ['AF']));

    it('count distinct values on single document', () =>
        request().get('/api/countries/EGY')
            .query({ distinct: 'continent', count: true })
            .expect(200, '1'));

    it('get distinct values on single document with null value', () =>
        request().get('/api/countries/TWN')
            .query({ distinct: 'continent' })
            .expect(200, [null]));

    it('count distinct values on single document', () =>
        request().get('/api/countries/TWN')
            .query({ distinct: 'continent', count: true })
            .expect(200, '1'));

    it('get distinct values using alias', () =>
        request().get('/api/countries')
            .query({ distinct: 'regionName' })
            .expect(200, ['Asia', 'Europe', 'Africa', 'Oceania', 'Americas']));

    it('get distinct values using dotted field', () =>
        request().get('/api/countries')
            .query({ distinct: 'region.name' })
            .expect(200, ['Asia', 'Europe', 'Africa', 'Oceania', 'Americas']));
});