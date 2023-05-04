function OnUpdate(doc, meta) {
    // Check if the document contains an "insertionDate" property
    if (!doc.insertionTime) {
        log("Skipping document without insertionTime property", meta.id)
        return;
    }

    // Extract the date from the document's "insertionDate" property
    const date = new Date(doc.insertionTime);
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;
    log(`Processing document with date: ${dateString}`)

    // Flatten the document
    let flattenedDoc = flattenObject(doc, {}, /type/);

    // Get the keys from the flattened document to use as headers
    const headers = Object.keys(flattenedDoc);
    // Prepare CSV file
    let csvHeader = headers.join(",");
    let csvLine = convertToCsvLine(headers, flattenedDoc);

    // Use of distributed atomic counters to increment docCount
    let count = getAndIncrementCounter(dateString);

    // Calculate the chunk number and document ID for the current document
    const chunkNumber = Math.floor(count / MAX_DOCS_PER_AGGREGATE);
    const chunkId = `${dateString}-${chunkNumber}`;

    // Append the csv line to the aggregated document
    append(meta.id, chunkId, csvHeader, csvLine);
}

function append(id, chunkId, csvHeader, csvLine) {
    let cas = 0;
    let aggregatedDoc;

    let result = couchbase.get(dst_collection, {id: chunkId});
    if (result.success) {
        aggregatedDoc = result.doc;
        cas = result.meta.cas;
    } else {
        // Create the document with headers if not already exists
        log(`Creating new document with ID: ${chunkId}`);
        aggregatedDoc = csvHeader;
    }

    // Append to aggregated document
    aggregatedDoc = aggregatedDoc + '\n' + csvLine;

    // Save aggregated document
    // If this is the first insertion
    if (cas === 0) {
        result = couchbase.insert(dst_collection, {id: chunkId}, aggregatedDoc);
        if (result.success) {
            log(`Added '${id}' to '${chunkId}' document`);
        } else if (result.error.key_already_exists) {
            // Retry if the document already exists
            log(`WARN: The document '${chunkId}' has already been inserted, retrying...`)
            append(id, chunkId, csvHeader, csvLine)
        } else {
            error(`Unable to insert document '${chunkId}'`, result)
        }
        // If it is an append
    } else {
        result = couchbase.replace(dst_collection, {id: chunkId, cas: cas}, aggregatedDoc);
        if (result.success) {
            log(`Added '${id}' to '${chunkId}' document`);
        } else if (result.error.cas_mismatch) {
            // Retry if the document has already been updated by another process
            log(`WARN: The document '${chunkId}' has already been updated, retrying...`)
            append(id, chunkId, csvHeader, csvLine)
        } else {
            error(`Unable to replace document '${chunkId}'`, result)
        }
    }
}

// Recursive function to flatten a nested object
function flattenObject(obj, result, ignorePattern) {
    for (var key in obj) {
        if (ignorePattern && key.match(ignorePattern)) {
            continue;
        }

        if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
            flattenObject(obj[key], result, ignorePattern);
        } else {
            result[key] = obj[key];
        }
    }

    return result;
}

function getAndIncrementCounter(dateString) {
    const docCounter = {"id": dateString};
    let result = couchbase.increment(metadata_collection, docCounter);
    let count = 0;
    if (result.success) {
        count = result.doc.count;
    } else {
        throw new Error(`Failure to atomically increment : ${docCounter.id}, result : ${result}`);
    }
    log(`Number of documents for ${dateString}: ${count}`)
    return count;
}

function convertToCsvLine(headers, doc) {
    const row = [];
    for (var i = 0; i < headers.length; i++) {
        row.push(doc[headers[i]]);
    }
    let csvDoc = row.join(",");
    return csvDoc;
}
