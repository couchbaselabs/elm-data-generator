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
    //log(`Processing document with date: ${dateString}`)

    // Prepare CSV file
    let csvHeader = 'readingId,activityId,assetId,companyId,insertionTime,originalTime,requestTime,sensorStatus,velocity,weight,lat,lon\n';
    const csvLine = `${doc.readingId},${doc.activityId},${doc.assetId},${doc.companyId},${doc.insertionTime},${doc.originalTime},${doc.requestTime},${doc.sensorStatus},${doc.velocity},${doc.weight},${doc.location.lat},${doc.location.lon}`;

    // Use of distributed atomic counters to increment docCount
    let count = getAndIncrementCounter(dateString);

    // Calculate the chunk number and document ID for the current document
    const chunkNumber = Math.floor(count / MAX_DOCS_PER_AGGREGATE);
    const chunkId = `${dateString}-${chunkNumber}`;

    // Append the csv line to the aggregated document
    append(meta.id, chunkId, csvHeader, csvLine);
}

function append(id, chunkId, csvHeader, csvLine) {
    let operationSuccess = false;
    while (!operationSuccess) {
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
                operationSuccess = true;
            } else if (result.error.key_already_exists) {
                // Retry if the document already exists
                // log(`WARN: The document '${chunkId}' has already been inserted, retrying...`)
            } else {
                log(`ERROR: Unable to insert document '${chunkId}'`, result);
                break;
            }
            // If it is an append
        } else {
            result = couchbase.replace(dst_collection, {id: chunkId, cas: cas}, aggregatedDoc);
            if (result.success) {
                operationSuccess = true;
            } else if (result.error.cas_mismatch) {
                // Retry if the document has already been updated by another process
                // log(`WARN: The document '${chunkId}' has already been updated, retrying...`)
            } else {
                log(`ERROR: Unable to replace document '${chunkId}'`, result)
                break;
            }
        }
    }
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
    //log(`Number of documents for ${dateString}: ${count}`)
    return count;
}
