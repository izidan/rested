const supertest = require('supertest');
const fixture = require('./fixtures/countries');

describe('Distinct', () => {
    beforeAll(fixture.init);
    afterAll(fixture.deinit);
    const request = () => supertest(fixture.app());

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