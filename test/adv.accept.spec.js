const supertest = require('supertest');
const fixture = require('./fixtures/countries');

describe('Distinct', () => {
    beforeAll(fixture.init);
    afterAll(fixture.deinit);
    const request = () => supertest(fixture.app());

    it('get distinct values in csv', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent' })
            .accept('text/csv')
            .expect(200, 'AS\nEU\nAF\nOC\nNA\nAN\nSA\n'))

    it('get distinct values in tsv', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent' })
            .accept('text/tsv')
            .expect(200, 'AS\nEU\nAF\nOC\nNA\nAN\nSA\n'))

    it('get distinct values in xml', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent' })
            .accept('text/xml')
            .expect(200, '<?xml version="1.0" encoding="utf-8"?><ArrayOfCountry><Country>AS</Country><Country>EU</Country><Country>AF</Country><Country>OC</Country><Country>NA</Country><Country>AN</Country><Country>SA</Country></ArrayOfCountry>'))

    it('get distinct values in text/yaml', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent' })
            .accept('text/plain')
            .expect(200, '- AS\n- EU\n- AF\n- OC\n- NA\n- AN\n- SA\n'))

    it('get distinct values in js/jsonp', () =>
        request().get('/api/countries')
            .query({ distinct: 'continent' })
            .accept('application/javascript')
            .expect(200, 'jsonp(["AS","EU","AF","OC","NA","AN","SA"],{"string":"SA"})'))

    it('get json values in csv', () =>
        request().get('/api/countries?select=_id name')
            .query({ limit: 3 })
            .accept('text/csv')
            .expect(200, '_id,name\nTWN,Taiwan\nAFG,Afghanistan\nALB,Albania\n'))

    it('get json values in tsv', () =>
        request().get('/api/countries?select=_id name')
            .query({ limit: 3 })
            .accept('text/tsv')
            .expect(200, '_id\tname\nTWN\tTaiwan\nAFG\tAfghanistan\nALB\tAlbania\n'))

    it('get json values in xml', () =>
        request().get('/api/countries?select=_id name')
            .query({ limit: 3 })
            .accept('text/xml')
            .expect(200, '<?xml version="1.0" encoding="utf-8"?><ArrayOfCountry><Country id="TWN"><name>Taiwan</name></Country><Country id="AFG"><name>Afghanistan</name></Country><Country id="ALB"><name>Albania</name></Country></ArrayOfCountry>'))

    it('get json values in text/yaml', () =>
        request().get('/api/countries?select=_id name')
            .query({ limit: 3 })
            .accept('text/plain')
            .expect(200, '- _id: TWN\n  name: Taiwan\n- _id: AFG\n  name: Afghanistan\n- _id: ALB\n  name: Albania\n'))

    it('get json values in js/jsonp', () =>
        request().get('/api/countries?select=_id name')
            .query({ limit: 3 })
            .accept('application/javascript')
            .expect(200, 'jsonp([{"_id":"TWN","name":"Taiwan"},{"_id":"AFG","name":"Afghanistan"},{"_id":"ALB","name":"Albania"}],{"_id":"ALB","name":"Albania"})'))
});