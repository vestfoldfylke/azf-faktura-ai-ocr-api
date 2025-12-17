# faktura-ai-ocr

A project that uses Mistral OCR to extract structured data from invoices and attachments.

This project uses Mistral AI's OCR model to automatically extract structured information from PDF invoices, including:
- Invoice information (invoice number, date, due date, KID number)
- Timesheets with details about employees, projects, and hours

## Prerequisites

- Mistral AI API key [console.mistral.ai](https://console.mistral.ai)

## Installation

### 1. Clone and Setup Project

```bash
git clone <repository-url>

cd faktura-ai-ocr

npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with your Mistral API key:
```bash
MISTRAL_API_KEY="MISTRAL_API_KEY_HERE"
```

### 3. Required Folders

The project requires the following folder structure, and it will create them if they do not exist:
- `input/` - Place your invoice PDF files here.
- `output/` - Extracted data will be saved in folders here.
- `output/chunks/` - PDF's to process will be stored here. Chunked or original.
- `output/ocr/` - OCR results in JSON format will be saved here.

## Running the Project

```bash
npm run start
```

- This will process all PDF files in the `input/` folder
  - Split PDF
    - If the PDF has less than or equal to the specified max page limit (default is 4), it will be copied to `output/chunks/` as is.
    - If the PDF exceeds the max page limit, it will be split into chunks and saved in `output/chunks/`.
  - Each chunk or full PDF will be sent to Mistral for OCR processing
    - The full result will be saved as `output/ocr/filename.json` or `output/ocr/filename_chunk_n.json`
    - Document annotations will be saved as `output/ocr/filename_da.json` or `output/ocr/filename_chunk_n_da.json`