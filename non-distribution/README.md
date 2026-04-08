# non-distribution

This milestone aims (among others) to refresh (and confirm) everyone's
background on developing systems in the languages and libraries used in this
course.

By the end of this assignment you will be familiar with the basics of
JavaScript, shell scripting, stream processing, Docker containers, deployment
to AWS, and performance characterization—all of which will be useful for the
rest of the project.

Your task is to implement a simple search engine that crawls a set of web
pages, indexes them, and allows users to query the index. All the components
will run on a single machine.

## Getting Started

To get started with this milestone, run `npm install` inside this folder. To
execute the (initially unimplemented) crawler run `./engine.sh`. Use
`./query.js` to query the produced index. To run tests, do `npm run test`.
Initially, these will fail.

### Overview

The code inside `non-distribution` is organized as follows:

```
.
├── c            # The components of your search engine
├── d            # Data files like seed urls and the produced index
├── s            # Utility scripts for linting your solutions
├── t            # Tests for your search engine
├── README.md    # This file
├── crawl.sh     # The crawler
├── index.sh     # The indexer
├── engine.sh    # The orchestrator script that runs the crawler and the indexer
├── package.json # The npm package file that holds information like JavaScript dependencies
└── query.js     # The script you can use to query the produced global index
```

### Submitting

To submit your solution, run `./scripts/submit.sh` from the root of the stencil. This will create a
`submission.zip` file which you can upload to the autograder.

### T8
# M0: Setup & Centralized Computing
* name: `Alan Zheng`
* email: `alan_zheng@brown.edu`
* cslogin: `adzheng`
My implementation consists of 5 JS components and 1 shell component for T1-8. 
The most challenging aspect was process.sh because I've barely used shell before, 
* so I had to first learn the basics of shell and also how commands like tr, grep, and iconv work.

To characterize correctness, I developed 8 tests that test the following cases:
- my getText and getURLs test different websites / html pages from the given tests
- merge makes sure the merge script still works on a smaller set of files from the given tests.
- stem and process test on arbitrarily generated word files
- query tests different query terms on the same index file as the given tests

To characterize performance, I used the performance library to time the execution time for crawl, index, and query.
I then divided the relevant measure (URLs/pages for crawl and index, queries for query) by the amount of time taken to get the throughput.

I think it'll take 10000 lines of code to get the fully distributed search engine. 
This non-distributed version probably already has over 1-2000 lines of code without counting tests, and scaling it to become a distributed search engine with more features will likely take many multiples of the current # lines of code.