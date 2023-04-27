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

    // Use of distributed atomic counters to increment docCount
    const docCounter = {"id": dateString};
    let result = couchbase.increment(metadata_collection, docCounter);
    let count = 0;
    if (result.success) {
        count = result.doc.count;
    } else {
        throw new Error(`Failure to atomically increment : ${docCounter.id}, result : ${result}`);
    }
    log(`Number of documents for ${dateString}: ${count}`)

    // Calculate the chunk number and document ID for the current document
    const chunkNumber = Math.floor(count / MAX_DOCS_PER_AGGREGATE);
    const chunkId = `${dateString}-${chunkNumber}`;

    // Create the document with headers if not already exists
    let aggregatedCsv = dst_collection[chunkId];
    if (!aggregatedCsv) {
        log(`Creating new document with ID: ${chunkId}`);
        aggregatedCsv = headers.join(",");
    }

    // Convert the flattened document to a CSV line and append it to aggregated document
    var row = [];
    for (var i = 0; i < headers.length; i++) {
        row.push(flattenedDoc[headers[i]]);
    }
    let csvDoc = row.join(",");
    aggregatedCsv = aggregatedCsv + '\n' + csvDoc;

    // Save aggregated document
    dst_collection[chunkId] = aggregatedCsv;
    log(`Added document to ${chunkId}`);
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
