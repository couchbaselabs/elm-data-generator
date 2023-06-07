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
    let csvHeader = 'readingId,activityId,assetId,companyId,insertionTime,originalTime,requestTime,sensorStatus,velocity,weight,lat,lon';
    const csvLine = `${doc.readingId},${doc.activityId},${doc.assetId},${doc.companyId},${doc.insertionTime},${doc.originalTime},${doc.requestTime},${doc.sensorStatus},${doc.velocity},${doc.weight},${doc.location.lat},${doc.location.lon}`;

    // ⚠️ Increment atomically counter document
    let count = updateWithCAS(metadata_collection, dateString, () => ({count: 0}), (d) => {
        d.count++;
        return d;
    }).count

    // Calculate the chunk number and document ID for the current document
    const chunkNumber = Math.floor(count / MAX_DOCS_PER_AGGREGATE);
    const chunkId = `${dateString}-${chunkNumber}`;

    // Append atomically the csv line to the aggregated document
    updateWithCAS(dst_collection, chunkId, () => csvHeader, (d) => d + '\n' + csvLine);
}

function updateWithCAS(collection, id, init, update) {
    let doc;
    while (true) {
        let cas = 0;

        let result = couchbase.get(collection, {id: id});
        if (result.success) {
            doc = result.doc;
            cas = result.meta.cas;
        } else {
            log(`Creating new document with ID: ${id}`);
            doc = init();
        }

        // Update the document
        doc = update(doc);

        // Save aggregated document
        // If this is the first insertion
        if (cas === 0) {
            result = couchbase.insert(collection, {id: id}, doc);
            if (result.success) {
                return doc;
            } else if (result.error.key_already_exists) {
                // Retry if the document already exists
                // log(`WARN: The document '${chunkId}' has already been inserted, retrying...`)
            } else {
                throw new Error(`Unable to insert document '${id}', result : ${result}`);
            }
            // If it is an update
        } else {
            result = couchbase.replace(collection, {id: id, cas: cas}, doc);
            if (result.success) {
                return doc;
            } else if (result.error.cas_mismatch) {
                // Retry if the document has already been updated by another process
                // log(`WARN: The document '${chunkId}' has already been updated, retrying...`)
            } else {
                throw new Error(`Unable to replace document '${id}', result : ${result}`);
            }
        }
    }
}
