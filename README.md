# azf-faktura-ai-ocr-api

A project that uses Mistral OCR to extract structured data from invoices and attachments.

This project uses Mistral AI's OCR model to automatically extract structured information from PDF invoices, including:
- Invoice information (invoice number, date, due date, KID number)
- Timesheets with details about employees, projects, and hours

## Prerequisites

- Mistral AI API key [console.mistral.ai](https://console.mistral.ai)
- MongoDB database
- Storage account (Azure Blob Storage or local emulator like Azurite)

## Installation

### 1. Clone and Setup Project

```bash
git clone <repository-url>

cd faktura-ai-ocr

npm install
```

### 2. Configure Environment Variables

Create a `local.settings.json` file in the project root with the following content:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "BLOB_STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=key1;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;",
    "BLOB_STORAGE_CONTAINER_NAME": "local",
    "BLOB_STORAGE_FAILED_FOLDER_NAME": "failed",
    "BLOB_STORAGE_FINISHED_FOLDER_NAME": "finished",
    "BLOB_STORAGE_QUEUE_FOLDER_NAME": "queue",
    "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
    "MISTRAL_MAX_PAGES_PER_CHUNK": "4",
    "OCR_PROCESS_ALREADY_PROCESSED_FILES": "false",
    "MONGODB_CONNECTION_STRING": "mongodb+srv://<db_username>:<db_password>@<db_host>/?appName=azf-faktura-ai-ocr-api-local",
    "MONGODB_COLLECTION_NAME": "<db_collection_name>",
    "MONGODB_DATABASE_NAME": "<db_name>",
    "BETTERSTACK_MIN_LOG_LEVEL": "info"
  }
}
```

## Running the Project

```bash
npm run start
```

- This will process PDF files uploaded to the blob storage container `BLOB_STORAGE_CONTAINER_NAME` in the `BLOB_STORAGE_QUEUE_FOLDER_NAME` folder.
  - Split PDF
    - If the PDF exceeds the max page limit, it will be split into chunks.
  - Each chunk or full PDF will be sent to Mistral for OCR processing
    - Successfully parsed document annotations will be saved to blob storage container `BLOB_STORAGE_CONTAINER_NAME` as `BLOB_STORAGE_FINISHED_FOLDER_NAME/<invoiceNumber>/<blobName>_document_annotation.json` or `BLOB_STORAGE_FINISHED_FOLDER_NAME/<invoiceNumber>/<blobName>_chunk_n_document_annotation.json`
    - Successfully parsed WorkItems will be saved to MongoDB.
    - Documents failed to be processed by Mistral OCR OR document annotations from Mistral OCR that failed to be parsed, will be saved to blob storage container `BLOB_STORAGE_CONTAINER_NAME` as `BLOB_STORAGE_FAILED_FOLDER_NAME/<blobName>.pdf`
  - PDF from blob storage container `BLOB_STORAGE_CONTAINER_NAME` in `BLOB_STORAGE_QUEUE_FOLDER_NAME` folder will be deleted after successful processing
