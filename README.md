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

My implementation comprises 4 major software components (the serializer, deserializer, test suite, and performance harness), totaling approximately 450 lines of code. Key challenges included designing a recursive serialization format, correctly handling JavaScript edge cases such as functions, dates, and errors, and building a systematic latency benchmarking framework. I addressed these challenges by using a tagged JSON representation for all values, implementing recursive descent for complex data structures, and constructing automated student tests and timing harnesses to validate both correctness and performance.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_: I wrote 5 student tests and 5 scenarios; these tests take under one second to execute. The test suite covers objects with nested structures, arrays, functions, dates, errors, and primitive base types, ensuring that both simple and complex values are correctly serialized and deserialized.

_Performance_: The latency of various subsystems is described in the `"latency"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

# M2: Actors and Remote Procedure Calls (RPC)

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M2 (`hours`) and the lines of code per task.

My implementation comprises 5 software components (local `comm`, `node`, `routes`, `status`, and `util/wire`), totaling ~800 lines of code. Key challenges included building a reliable HTTP transport layer with clear error paths and single-callback semantics, which I solved with strict input validation and a guarded callback wrapper; correctly dispatching to services across groups and ensuring method lookup behaved consistently, solved by centralizing service registration in `routes` and normalizing arguments before invocation; and making RPC stubs portable and uniquely identifiable, solved by registering generated methods in a dedicated `__rpc__` service and embedding their owner/ID into a custom `toString` stub.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_: I wrote 10 student tests; these tests take under 1 second to execute locally.

_Performance_: I characterized the performance of comm and RPC by sending 1000 service requests in a tight loop. Average throughput and latency is recorded in `package.json`.

## Key Feature

> How would you explain the implementation of `createRPC` to someone who has no background in computer science — i.e., with the minimum jargon possible?

`createRPC` turns a normal function into a “remote button.” When you press the button, it packages your inputs and sends them to the machine that owns the original function. That machine runs the function and sends back the answer, and then your callback is called with the result.

# M3: Node Groups & Gossip Protocols

## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M3 (`hours`) and the lines of code per task.

My implementation adds 5 new software components (local `groups`, all `groups`, all `status`, local `gossip`, and all `gossip`), totaling ~350 added lines of code over the previous implementation. Key challenges included keeping built-in groups (`local`, `all`) consistent while allowing dynamic membership changes, solved by a centralized group table with `ensureDefaults`/`ensureBuiltinMembership` and syncing `all` on `put`/`add`/`rem`; wiring group-scoped services so all.\* methods correctly dispatch and aggregate per-node results, solved with a shared `dispatch` helper and normalized error/value handling; and implementing scalable gossip fanout without loops, solved by sampling a subset (log N) and deduplicating via message IDs stored in a bounded LRU-style cache.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation

_Correctness_ -- `npm test -- m3` (55 tests including 5 student tests) runs in ~5.5s locally.

_Performance_ -- spawn: ~12.12 ops/sec throughput with ~79.13 ms avg latency; gossip: ~1139.12 ops/sec throughput with ~1.60 ms avg latency (from `scripts/m3-perf.js` on my dev machine).

## Key Feature

> What is the point of having a gossip protocol? Why doesn't a node just send the message to _all_ other nodes in its group?

Gossip lets the group spread information efficiently without overwhelming the network. If every node sent every update to every other node, message traffic would explode as the group grows, and a few slow nodes could stall everyone. Gossip instead forwards to a small random subset each round, which still reaches the whole group quickly but keeps bandwidth and load low, tolerates churn, and avoids central bottlenecks.

# M4: Distributed Storage

## Summary

M4 adds both ephemeral and persistent distributed storage. The local `mem` service stores objects in an in-process table keyed by group id, while the local `store` service persists serialized objects under a per-node, per-group directory in `store/`. On top of that, the distributed `all.mem` and `all.store` services route each key to a single target node using the group hash function (`naiveHash`, `consistentHash`, or `rendezvousHash`), and support `put`, `get`, `del`, `get(null)` for key enumeration, and `reconf` for redistributing data after membership changes.

The main implementation challenge was keeping placement logic and reconfiguration consistent across both memory and persistent storage. The solution in `distribution/all/mem.js` and `distribution/all/store.js` uses the same workflow in both cases: enumerate keys from the old membership, compute which keys change owners under the new membership, then move only those keys with a `get -> put -> del` sequence. Another practical challenge in the persistent store was avoiding filename/path issues, which is handled by hex-encoding path components and namespacing files by node SID.

## Correctness & Performance Characterization

Correctness was characterized with the M4 unit tests and scenarios already present in the repository. The codebase currently contains 89 M4-specific tests/scenarios across hashing, local/distributed `mem`, local/distributed `store`, key enumeration with `get(null)`, and reconfiguration after node removal (`test/m4.*`, `test/test-student/m4.student.test.js`, and `scenarios/m4/m4.scenario.js`). These tests check both normal behavior and failure cases such as missing keys, wrong-group lookups, hash-based placement, and relocation correctness after `reconf`.

Performance was characterized with `scripts/m4-perf.js`. That script generates a configurable dataset, inserts all objects into a 3-node distributed persistent store, reads them all back by key, and reports per-operation latency plus aggregate throughput for both phases. In other words, the key M4 performance measurements are insertion cost (`store.put`) and retrieval cost (`store.get`) under the selected hash function and object size.

## Key Feature

`reconf` first identifies the keys that actually move because that keeps the operation targeted and avoids unnecessary data transfer. If it fetched every object up front, it would pay the cost of reading, serializing, transmitting, and rewriting objects whose placement does not change under the new membership. By comparing the old and new owner for each key first, the implementation only moves the minimal set of affected objects.

This design also scales better for persistent storage. Listing keys is much cheaper than materializing every stored value, especially when values are large. The current implementation therefore separates the metadata step from the data-movement step: scan keys, compute ownership changes, then perform `get -> put -> del` only for keys whose hash target changes. That reduces I/O, network traffic, and temporary memory pressure during reconfiguration.
