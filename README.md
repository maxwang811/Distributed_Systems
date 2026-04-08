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
  *	Regular Tests (`*.test.js`)
  *	Scenario Tests (`*.scenario.js`)
  *	Extra Credit Tests (`*.extra.test.js`)
  * Student Tests (`*.student.test.js`) - inside `test/test-student`

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
This callback is invoked when the method completes, with the first argument being an error (if any) and the second argument being the result.
The following runs the sequence of commands described above inside a script (note the nested callbacks):

```js
let distribution = require("@brown-ds/distribution")();
// Now we're only doing a few of the things we did above
const out = (cb) => {
  distribution.local.status.stop(cb); // Shut down the local node
};
distribution.node.start(() => {
  // This will run only after the node has started
  const node = {ip: '127.0.0.1', port: 8765};
  distribution.local.status.spawn(node, (e, v) => {
    if (e) {
      return out(console.log);
    }
    // This will run only after the new node has been spawned
    distribution.all.status.get('sid', (e, v) => {
      // This will run only after we communicated with all nodes and got their sids
      console.log(v); // { '8cf1b': '8cf1b', '8cf1c': '8cf1c' }
      // Shut down the remote node
      distribution.local.comm.send([], {service: 'status', method: 'stop', node: node}, () => {
        // Finally, stop the local node
        out(console.log); // null, {ip: '127.0.0.1', port: 1380}
      });
    });
  });
});
```

# Results and Reflections

# M1: Serialization / Deserialization


## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M1 (`hours`) and the lines of code per task.


My implementation comprises 2 software components, totaling 150 lines of code. Key challenges included 
1. understanding the recursive structure used to serialize objects and arrays. I overcame this by using the distribution.util.serialize function to study how the reference 
implementation worked, and using a similar structure in my function.
2. differentiating between the many types of objects that all return 'object' when you call typeof on them. I was able to do this using instanceof for some objects, and Object.prototype to identify JS objects, {}.
3. dealing with calling deserialize recursively when it expects a string object. I initially did this by calling deserialize(JSON.stringify(obj)),
but I realized this was inefficient so I made a helper function decodeObject that takes in JSON objects as input. Then my deserialize function calls decodeObject(JSON.parse(str)) and I can call decodeObject recursively without stringifying things.


## Correctness & Performance Characterization


> Describe how you characterized the correctness and performance of your implementation


*Correctness*: I wrote 5 tests; these tests take 0.14 ms to execute. This includes objects like dates, arrays, objects, and strings. 
I also tested giving the deserializer a serialized string that I wrote, and testing if it deserializes to the correct object.


*Performance*: The latency of various subsystems is described in the `"latency"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

# M2: Actors and Remote Procedure Calls (RPC)


## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M2 (`hours`) and the lines of code per task.


My implementation comprises 4 software components, totaling 200 lines of code. Key challenges included 
1. I didn't realize T4 and T5 had to be both implemented before T4's tests could pass, so I spent a long time debugging comm.send before a TA told me to do T5 first in office hours.
2. It was difficult understanding the structure of the nodes, how they were started, and where they "lived", such as what the distribution.node is. But I also got help from OH for this
3. Learning the structure of HTTP requests and servers for comm.send and node.js was tricky. I solved this by reading documentation online.


## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness*: I wrote 6 tests; these tests take 12s to execute.


*Performance*: I characterized the performance of comm and RPC by sending 1000 service requests in a tight loop. Average throughput and latency is recorded in `package.json`.
Format is [comm.send, rpc]. reqs/sec for throughput and ms/req for latency.

## Key Feature

> How would you explain the implementation of `createRPC` to someone who has no background in computer science — i.e., with the minimum jargon possible?
createRPC allows one node, call it A, (nodes can be thought of as computers for this explanation) to create a 'backdoor' that it can send to another node, B, allowing node B to execute a function that only exists on node A. Basically allowing node B to remotely execute a function that exists on node A.

# M3: Node Groups & Gossip Protocols


## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M3 (`hours`) and the lines of code per task.


My implementation comprises 8 new software components, totaling 250 added lines of code over the previous implementation. Key challenges included
1. lots of timeout errors including "exceeded timeout for test/book" and "listen EADDRINUSE". I ended up solving a lot of these by debugging my all.comm.send file but it took a very long time.
2. Understanding the stucture of groups and what the difference is between distribution.local and distribution.<gid>. The scenarios were very helpful for this!
3. Getting problems with services being undefined. I initially didn't initialize the distributed services in my groups.put function so I had to debug this as well.


## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness* -- number of tests and time they take.
I wrote 5 student tests that test various functionalities we had to implement, including all.routes, all.comm, local.groups, and all.status.
For each function call, I tested to make sure the callback was returning the expected err and val values.


*Performance* -- spawn times (all students) and gossip (lab/ec-only).
I used performance.now() to record the amount of time it took to execute several repeated calls to
require('distribution.js')(config) which is how a new node is spawned. For throughput, I recorded nodes per sec 
for the amount of time it took to spawn 5 nodes, and for latency, I recorded ms per node for 5 nodes as well.


## Key Feature

> What is the point of having a gossip protocol? Why doesn't a node just send the message to _all_ other nodes in its group?
> It would be prohibitively expensive for each node to send a message to all other nodes in its group.
> The point of a gossip protocol is to reduce the number of messages needed to be sent from O(N^2) to O(N log N), N = number of nodes, which is a large reduction,
> while still having a probabilitistic guarantee of convergence (i.e. we can still be confident that all the nodes will hear the message eventually).

# M4: Distributed Storage


## Summary

> Summarize your implementation, including key challenges you encountered
I implemented the distributed and local versions of mem and store, as well as two hash functions.
A big challenge was getting all.store and all.mem correct, which were identical except for the service method in the argument to local.comm.
I kept failing a few tests and eventaully I realized that the config being passed to local.comm should have the original key as the key, not the hashed KID.
It was also challenging to acclimate to using fs to write to files, and another challenge was thinking of the storage structure to use.
Eventually I decided to have one folder for each node, named by the SID, and naming each file "gid-key", which worked well. At first, I just named each file after the key which led to me failing several tests.

Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M4 (`hours`) and the lines of code per task.


## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness* -- number of tests and time they take.
I wrote 5 student tests whose suite takes 11 seconds to run. I tested the basic functionalities of get and put, as well as 
making sure my system can differentiate between two identical keys placed in different group ids. 


*Performance* -- insertion and retrieval.
I wrote an m4-benchmark file that created a group using my three AWS nodes, created 1000 objects using crypto.randomBytes, and measured the amount of time it took to call
distribution.awsGroup.store.get and put on the 1000 objects. To spawn the nodes, I ssh'd into the AWS nodes and did node -e distribution.node.start( ... distribution.local.status.spawn(node));
These are the results from my benchmark run:
Inserting 1000 objects took 26949.455 ms
Insertion throughput: 37.107 insertions per sec
Insertion latency: 26.949 ms per insertion
Retrieving 1000 objects took 26405.995 ms
Retrieval throughput: 37.870 retrievals per sec
Retrieval latency: 26.406 ms per retrieval

## Key Feature

> Why is the `reconf` method designed to first identify all the keys to be relocated and then relocate individual objects instead of fetching all the objects immediately and then pushing them to their corresponding locations?
Fetching all the objects at once could exhaust the available memory if the dataset is large. By relocating individual objects, the memory usage is kept bounded.
Also, first identifying the keys to be relocated allows us to only relocate those objects instead of fetching all the objects at first, which would be inefficient.
Finally, if the process crashes midway, by relocating individual objects, the previously relocated objects would have been successfully relocated already. 
But if you fetch all objects immediately, then the fetched data is all lost from memory and you have to start over.

# M5: Distributed Execution Engine


## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M5 (`hours`) and the lines of code per task.


My implementation comprises 5 new software components, totaling 250 added lines of code over the previous implementation. Key challenges included `<1, 2, 3 + how you solved them>`.


## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness*: I wrote 5 cases testing modified versions of the scenarios such as word count, TF-IDF, and temperature count.


*Performance*: My word count workflow can sustain 542 jobs/second, with an average latency of 1.56 milliseconds per job.


## Key Feature

> Which extra features did you implement and how?
I did not do any extra features.