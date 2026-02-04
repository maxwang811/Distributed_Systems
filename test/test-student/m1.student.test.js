/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
const util = distribution.util;
require('../helpers/sync-guard');

test('(1 pts) student test', () => {
  const object = {a: 1, arr: [2, {b: 'x'}], fn: (x) => x + 1};
  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);

  expect(typeof deserialized.fn).toEqual('function');
  expect(deserialized.fn(2)).toEqual(3);
  delete object.fn;
  delete deserialized.fn;
  expect(deserialized).toEqual(object);
});


test('(1 pts) student test', () => {
  const error = new TypeError('bad input');
  const serialized = util.serialize(error);
  const deserialized = util.deserialize(serialized);

  expect(deserialized).toBeInstanceOf(Error);
  expect(deserialized.name).toEqual('TypeError');
  expect(deserialized.message).toEqual('bad input');
});


test('(1 pts) student test', () => {
  const date = new Date('2021-02-03T04:05:06.000Z');
  const serialized = util.serialize(date);
  const deserialized = util.deserialize(serialized);

  expect(deserialized instanceof Date).toEqual(true);
  expect(deserialized.getTime()).toEqual(date.getTime());
});

test('(1 pts) student test', () => {
  const original = '\\\\string\\n\\t\\r\"';
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).toEqual(original);
});

test('(1 pts) student test', () => {
  const original = {a: undefined, b: null, c: 0};
  const serialized = util.serialize(original);
  const deserialized = util.deserialize(serialized);

  expect(Object.prototype.hasOwnProperty.call(deserialized, 'a')).toEqual(true);
  expect(deserialized).toEqual(original);
});
