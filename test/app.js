'use strict';

const test = require('tape');
const request = require('supertest');
const async = require('async');

test('Test the entire API', function (assert) {
	const app = require('../app/app');
	async.waterfall([
			(cb) => request(app).get('/api/accounts').expect(200, cb),
			(results, cb) => { assert.ok(results.body.length, 'Returned accounts list'); cb(null, results); },
			(results, cb) => { assert.ok(results.body[0].reference, 'account #0 has reference'); cb(null, results); },
			(results, cb) => request(app).get('/api/plans').expect(200, cb),
			(results, cb) => request(app).get('/api/services').expect(200, cb),
			(results, cb) => request(app).get('/api/users').expect(200, cb),
		],
		(err, results) => {
			app.closeDatabase();
			assert.end();
		}
	);
});


// cb => { request(app).get('/new').expect(200, cb); },
// cb => { request(app).post('/').send({prop1: 'new'}).expect(404, cb); },
// cb => { request(app).get('/0').expect(200, cb); },
// cb => { request(app).get('/0/edit').expect(404, cb); },
// cb => { request(app).put('/0').send({prop1: 'new value'}).expect(404, cb); },
// cb => { request(app).delete('/0').expect(404, cb); },

// test('Accounts: List', function (assert) {
// 	const app = require('../app/app');
// 	request(app)
// 		.get('/api/accounts')
// 		.expect('Content-Type', /json/)
// 		.expect(200)
// 		.end(function (err, results) {
// 			assert.error(err, 'No error');
// 			assert.ok(results.body.length, 'Returned accounts list');
// 			assert.ok(results.body[0], 'account #0 existed');
// 			assert.ok(results.body[0].reference, 'account #0 has reference');
// 			assert.ok(results.body[0].dateCreated, 'account #0 has dateCreated');
// 			//assert.same(results.body, expectedUsers, 'Users as expected');
// 			assert.end();
// 			app.closeDatabase();
// 		});
// });

// https://github.com/substack/tape

/*
test.skip(name, cb)
test.onFinish(fn)
test.only(name, cb)
test.createStream().pipe(process.stdout);
test.createStream({ objectMode: true }).on('data', function (row) {
	console.log(JSON.stringify(row))
});

t.plan(n)
t.end(err)
t.fail(msg)
t.pass(msg)
t.timeoutAfter(ms)
t.skip(msg)
t.ok(value, msg)
t.notOk(value, msg)
t.error(err, msg)
t.equal(actual, expected, msg)
t.notEqual(actual, expected, msg)
t.deepEqual(actual, expected, msg)
t.notDeepEqual(actual, expected, msg)
t.deepLooseEqual(actual, expected, msg)
t.notDeepLooseEqual(actual, expected, msg)
t.throws(fn, expected, msg)
t.doesNotThrow(fn, expected, msg)
t.test(name, [opts], cb)
t.comment(message)
*/

// test('Codegenerator', function (t) {
// 	var codegenerator = require('../app/lib/codegenerator');
// 	t.plan(3);
// 	t.equal(codegenerator.generateCode(0), 'ba');
// 	t.equal(codegenerator.generateCode(20000), 'bibaba');
// 	t.equal(codegenerator.generateCode(12345678), 'fakiqevo');
// 	t.equal(codegenerator.generateCode(1000000), 'fakiqevo');
// 	t.end();
// });
