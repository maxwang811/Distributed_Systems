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
  // Fill out this test case...
  const s = 'Brown';
  const serialized = '{"type":"string","value":"Brown"}';
  expect(util.serialize(s)).toEqual(serialized);
});


test('(1 pts) student test', () => {
  // Fill out this test case...
  const obj = {'Fruit': 'Apple', 'AnotherFruit': 'Banana'};
  const serialized = '{"type":"object","value":{"Fruit":{"type":"string","value":"Apple"},"AnotherFruit":{"type":"string","value":"Banana"}}}';
  expect(util.serialize(obj)).toEqual(serialized);
});


test('(1 pts) student test', () => {
  // Fill out this test case...
  const arr = [1, 2, 'test'];
  const serialized = '{"type":"array","value":{"0":{"type":"number","value":"1"},"1":{"type":"number","value":"2"},"2":{"type":"string","value":"test"}}}';
  expect(util.serialize(arr)).toEqual(serialized);
});

test('(1 pts) student test', () => {
  // Fill out this test case...
  const expectedObj = [1];
  const serializedStr = '{"type":"array","value":{"0":{"type":"number","value":"1"}}}';
  expect(util.deserialize(serializedStr)).toEqual(expectedObj);
});

test('(1 pts) student test', () => {
  // Fill out this test case...
  const expectedDate = new Date(2);
  const serializedStr = '{"type":"date","value":"1970-01-01T00:00:00.002Z"}';
  expect(util.deserialize(serializedStr)).toEqual(expectedDate);
});

test('(T5) latency for T2', () => {
  const items = [1, '1', true, null, undefined];

  const start = performance.now();
  for (const item in items) {
    expect(util.deserialize(util.serialize(item))).toEqual(item);
  }
  const end = performance.now();

  console.log('Avg: ' + (end - start) / items.length + ' ms per serialization/deserialization for T2 data types');
});

test('(T5) latency for T3', () => {
  const items = [(a) => a * a, (a, b) => a + b, (a, b) => a - b];

  const start = performance.now();
  for (const item in items) {
    expect(util.deserialize(util.serialize(item))).toEqual(item);
  }
  const end = performance.now();

  console.log('Avg: ' + (end - start) / items.length + ' ms per serialization/deserialization for T3 data types');
});

test('(T5) latency for T4', () => {
  const items = [new Date(2), new Error('message 123'),
    {'1': [1, 2], 'abc': 'apple'}, [1, 4, true]];

  const start = performance.now();
  for (const item in items) {
    expect(util.deserialize(util.serialize(item))).toEqual(item);
  }
  const end = performance.now();

  console.log('Avg: ' + (end - start) / items.length + ' ms per serialization/deserialization for T4 data types');
});

