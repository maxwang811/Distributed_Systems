function normalizeText(input) {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(input) {
    const text = normalizeText(input);
    if (!text) return [];
    return text.split(' ');
}

function processTerms(input) {
    
}