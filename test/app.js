'use strict';

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

var test = require('tape');
var request = require('supertest');

// test('Codegenerator', function (t) {
// 	var codegenerator = require('../app/lib/codegenerator');
// 	t.plan(3);
// 	t.equal(codegenerator.generateCode(0), 'ba');
// 	t.equal(codegenerator.generateCode(20000), 'bibaba');
// 	t.equal(codegenerator.generateCode(12345678), 'fakiqevo');
// 	t.equal(codegenerator.generateCode(1000000), 'fakiqevo');
// 	t.end();
// });

test('Correct things returned', function (t) {
	var app = require('../app/app');
	request(app)
	.get('/api/things')
	.expect('Content-Type', /json/)
	.expect(200)
	.end(function (err, res) {
		t.error(err, 'No error');
		t.ok(res.body.length, 'Returned things list');
		t.ok(res.body[0].dateCreated, 'Thing #0 existed');
		//t.same(res.body, expectedUsers, 'Users as expected');
		t.end();
		app.closeDatabase();
	});
});