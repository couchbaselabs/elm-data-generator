function OnUpdate(doc, meta) {
    if (!meta.id.match(/^\d{4}-\d{2}-\d{2}-\d+$/)) {
        log("Document id not matching the expected format", meta.id)
    }

    //Extract the date
    const docIdParts = meta.id.split("-");
    const year = docIdParts[0];
    const month = docIdParts[1];

    // Upload to S3
    var request = {
        path:`/${year}/${month}/${meta.id}.csv`,
        body: doc
    };
    var response = curl('PUT', s3_bucket, request);
    // Delete the document once successfuly uploaded
    if (response.status == 200) {
        log("Successfully uploaded document", meta.id);
        //delete src[meta.id]
    } else {
        throw new Error(`Unable to upload document ${meta.id}. Response: ${response}`)
    }


}
