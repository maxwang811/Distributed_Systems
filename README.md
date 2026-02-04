# distribution

This is the distribution library.

## Environment Setup

We recommend using the prepared [container image](https://github.com/brown-cs1380/container).

## Installation

After you have setup your environment, you can start using the distribution library.
When loaded, distribution introduces functionality supporting the distributed execution of programs. To download it:

```sh
$ npm i '@brown-ds/distribution'
```

This command downloads and installs the distribution library.

## Testing

There are several categories of tests:

- Regular Tests (`*.test.js`)
- Scenario Tests (`*.scenario.js`)
- Extra Credit Tests (`*.extra.test.js`)
- Student Tests (`*.student.test.js`) - inside `test/test-student`

### Running Tests

By default, all regular tests are run. Use the options below to run different sets of tests:

1. Run all regular tests (default): `$ npm test` or `$ npm test -- -t`
2. Run scenario tests: `$ npm test -- -c`
3. Run extra credit tests: `$ npm test -- -ec`
4. Run the `non-distribution` tests: `$ npm test -- -nd`
5. Combine options: `$ npm test -- -c -ec -nd -t`

## Usage

To try out the distribution library inside an interactive Node.js session, run:

```sh
$ node
```

Then, load the distribution library:

```js
> let distribution = require("@brown-ds/distribution")();
> distribution.node.start(console.log);
```

Now you have access to the full distribution library. You can start off by serializing some values.

```js
> s = distribution.util.serialize(1); // '{"type":"number","value":"1"}'
> n = distribution.util.deserialize(s); // 1
```

You can inspect information about the current node (for example its `sid`) by running:

```js
> distribution.local.status.get('sid', console.log); // null 8cf1b (null here is the error value; meaning there is no error)
```

You can also store and retrieve values from the local memory:

```js
> distribution.local.mem.put({name: 'nikos'}, 'key', console.log); // null {name: 'nikos'} (again, null is the error value)
> distribution.local.mem.get('key', console.log); // null {name: 'nikos'}

> distribution.local.mem.get('wrong-key', console.log); // Error('Key not found') undefined
```

You can also spawn a new node:

```js
> node = { ip: '127.0.0.1', port: 8080 };
> distribution.local.status.spawn(node, console.log);
```

Using the `distribution.all` set of services will allow you to act
on the full set of nodes created as if they were a single one.

```js
> distribution.all.status.get('sid', console.log); // {} { '8cf1b': '8cf1b', '8cf1c': '8cf1c' } (now, errors are per-node and form an object)
```

You can also send messages to other nodes:

```js
> distribution.local.comm.send(['sid'], {node: node, service: 'status', method: 'get'}, console.log); // null 8cf1c
```

Most methods in the distribution library are asynchronous and take a callback as their last argument.
This callback is called when the method completes, with the first argument being an error (if any) and the second argument being the result.
If you wanted to run this same sequence of commands in a script, you could do something like this (note the nested callbacks):

```js
let distribution = require("@brown-ds/distribution")();
// Now we're only doing a few of the things we did above
const out = (cb) => {
  distribution.local.status.stop(cb); // Shut down the local node
};
distribution.node.start(() => {
  // This will run only after the node has started
  const node = { ip: "127.0.0.1", port: 8765 };
  distribution.local.status.spawn(node, (e, v) => {
    if (e) {
      return out(console.log);
    }
    // This will run only after the new node has been spawned
    distribution.all.status.get("sid", (e, v) => {
      // This will run only after we communicated with all nodes and got their sids
      console.log(v); // { '8cf1b': '8cf1b', '8cf1c': '8cf1c' }
      // Shut down the remote node
      distribution.local.comm.send(
        [],
        { service: "status", method: "stop", node: node },
        () => {
          // Finally, stop the local node
          out(console.log); // null, {ip: '127.0.0.1', port: 1380}
        },
      );
    });
  });
});
```

# Results and Reflections

# M0: Setup & Centralized Computing

- name: Mohan Wang

- email: mohan_wang@brown.edu

- cslogin: mwang264

## Summary

My implementation consists of 6 core components (5 JavaScript + 1 shell) plus testing, deployment configuration, performance characterization, and documentation to address T1–T8:

JavaScript: stem.js, getText.js, getURLs.js, merge.js, query.js
Shell: process.sh
Tests: component tests + edge cases under non-distribution/t/ts/
Deployment: configured EC2 IP/port in non-distribution/package.json, verified server connectivity
Performance: measured throughput for crawler, indexer, and query subsystems on local + EC2 and recorded results in package.json

The most challenging aspect was merge.js because the inverted index format requires preserving multiple invariants simultaneously (sorted terms, correct URL-weight ordering, and stable merging behavior when terms appear across multiple pages). Debugging also required carefully validating intermediate streams (content, tokens, partial indices) to ensure the merged global index stayed consistent.

## Correctness & Performance Characterization

To characterize correctness, we developed 10 tests that cover both individual components and end-to-end behavior. These tests validate the correctness of text extraction (getText.js), URL extraction and normalization (getURLs.js), token processing and stopword removal (process.sh), stemming (stem.js), and index merging (merge.js). We also included edge-case tests such as handling empty or malformed HTML, relative vs. absolute URLs, missing global index files, and duplicate terms or URLs in the local index. Finally, we added an end-to-end test that runs the full pipeline from crawling through querying to ensure all components integrate correctly.

On the local development environment, the crawler achieved a throughput of 1.53 pages/sec, the indexer achieved 0.11 pages/sec, and the query engine achieved 3.04 queries/sec. On AWS EC2, the crawler achieved 0.73 pages/sec, the indexer achieved 0.29 pages/sec, and the query engine achieved 1.38 queries/sec.

## Wild Guess

I need to have to add code for, coordinating multiple workers across machines, distributed storage for the URL frontier, visited set, and index, partitioning/sharding and merging index updates across nodes, routing queries to the right shards and aggregating results, and handling failures, retries, and monitoring. So a few thousand lines (≈5k) is a reasonable estimate.

# M1: Serialization / Deserialization

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M1 (`hours`) and the lines of code per task.

My implementation comprises `<number>` software components, totaling `<number>` lines of code. Key challenges included `<1, 2, 3 + how you solved them>`.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_: I wrote `<number>` tests; these tests take `<time>` to execute. This includes objects with `<certain kinds of features>`.

_Performance_: The latency of various subsystems is described in the `"latency"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.
