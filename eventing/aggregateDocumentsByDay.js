// Define the maximum number of documents that can be aggregated into a single document
const MAX_DOCS_PER_AGGREGATE = 50000;

const dst_collection = [];
const metadata_collection = [];

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

    // Split per-day documents into multiple chunks if the number of documents exceeds MAX_DOCS_PER_AGGREGATE
    let aggregatedDoc = dst_collection[chunkId];
    if (!aggregatedDoc) {
        log(`Creating new document with ID: ${chunkId}`);
        aggregatedDoc = [];
    }
    aggregatedDoc.push(doc);
    dst_collection[chunkId] = aggregatedDoc;
    log(`Added document to ${chunkId}`);
}
