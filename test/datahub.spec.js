const supertest = require('supertest');
const csv = require('csv-parser');
const fs = require('fs');
const fixture = require('./fixtures/datahub');

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

describe('Controllers', () => {
    beforeAll(fixture.init);
    afterAll(fixture.deinit);
    //beforeEach(fixture.create);
    const request = () => supertest(fixture.app());

    it('should replace entire (or matched) collection with given new collection', done =>
        request().del('/api/countries').then(({ statusCode }) => {
            let rows = [];
            expect(statusCode).toBeLessThanOrEqual(204);
            expect(statusCode).toBeGreaterThanOrEqual(200);
            fs.createReadStream('test/data/country-codes.csv').pipe(parser)
                .on('data', row => row.isO31661Alpha3 ? rows.push(row) : console.warn(row))
                .on('end', err => err ? done(err) : request().post('/api/countries').send(rows)
                    .expect(201).then(({ body }) => {
                        expect(body).toHaveLength(rows.length);
                        expect(body[0]).toHaveProperty('_id');
                        expect(body[0]._id).toMatch(/^[A-Z]{3}$/);
                        console.log(body)
                    }).catch(done).then(done)
                );
            /*.on('data', row => !row.isO31661Alpha3 ? console.warn(row) :
                request().post('/api/countries').send(row)//.expect(201)
                    .then(({ body }) => console.log(body))
            )
            .on('end', done)*/
        })
    );
});