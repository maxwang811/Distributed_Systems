module.exports = {
    gid: 'geo',
    nodes: [
        {ip: '127.0.0.1', port: 7301},
        {ip: '127.0.0.1', port: 7302},
        {ip: '127.0.0.1', port: 7303},
    ],

    maxPages: 500,
    allowedHostSuffix: 'wikipedia.org',
    seedUrls: [
        'https://en.wikipedia.org/wiki/Continent',
        'https://en.wikipedia.org/wiki/Geography'
    ],

    keys: {
        frontier: 'crawl:frontier', // pending URLs to visit
        visited: 'crawl:visited',
        docPrefix: 'doc:',
        indexPrefix: 'idx:',
    }
}