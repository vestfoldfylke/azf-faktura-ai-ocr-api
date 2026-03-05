# azf-faktura-ai-ocr-api

A project that uses Mistral OCR or OpenAI to extract structured data from invoices and attachments.

This project uses Mistral AI's OCR model or OpenAI to automatically extract structured information from PDF invoices, including:
- Invoice information (invoice number, date, due date, KID number)
- Timesheets with details about employees, projects, and hours

## Prerequisites

- Mistral AI API key [console.mistral.ai](https://console.mistral.ai)
- OpenAI API key [platform.openai.com](https://platform.openai.com/api-keys)
- MongoDB database
- SharePoint site and list for unhandled documents (SP_SITE_ID, SP_LIST_ID)
  - App registration (AZURE_CLIENT_ID) needs Sites.Selected application permission with write access to the SharePoint site defined in SP_SITE_ID. [See documentation here](#)

## Installation

### 1. Clone and Setup Project

```bash
git clone <repository-url>

cd azf-faktura-ai-ocr-api

npm install
```

### 2. Setup and grant permissions to Azure AD App Registration

1. Create an Azure AD App Registration in the Azure Portal
2. Add the following application permissions to the app registration:
   - Microsoft Graph > Sites.Selected > Application permission
3. Grant admin consent for the permission
4. Since we are using **Sites.Selected** permission, [do we also need to grant permission on the SharePoint site](https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0&tabs=http)
5. Use the Microsoft **Graph Explorer** to grant the app registration write access to the SharePoint site defined in **SP_SITE_ID**:
   1. Prerequisites:
      1. User performing this step needs to have SharePoint Admin permissions OR be an owner of the SharePoint site
      2. Have an app with permission to run **Sites.FullControl.All** (for instance Graph Explorer)
      3. Find the **SP_SITE_ID** for the SharePoint site by running `GET https://<orgname>.sharepoint.com/sites/<sitename>/_api/site/id`
      4. Run the following **POST** request in Graph Explorer. All is good when it returns a 200 status code:
         ```text
         POST https://graph.microsoft.com/v1.0/sites/<SP_SITE_ID>/permissions

         {
          "roles": ["write"],
          "grantedToIdentities": [{
            "application": {
                "id": "<app registration id>",
                "displayName": "<app registration name>"
              }
          }]
         }
         ```

### 3. Configure Environment Variables

Create a `local.settings.json` file in the project root with the following content:
```json5
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "InvoiceReadSchedule": "0 0 */1 * * *", // Cron expression for how often the function should run
    "AZURE_CLIENT_ID": "client-id-here",
    "AZURE_CLIENT_SECRET": "client-secret-here",
    "AZURE_TENANT_ID": "tenant-id-here",
    "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
    "MISTRAL_MODEL_NAME": "mistral-ocr-latest", // set to a model that supports OCR
    "OPENAI_API_KEY": "OPENAI_API_KEY_HERE",
    "OPENAI_MODEL_NAME:": "gpt-4o", // set to a model that supports OCR
    "OCR_MAX_PAGES_PER_CHUNK": "2",
    "OCR_PROCESS_ALREADY_PROCESSED_FILES": "false",
    "MONGODB_CONNECTION_STRING": "mongodb+srv://<db_username>:<db_password>@<db_host>/?appName=azf-faktura-ai-ocr-api-local",
    "MONGODB_COLLECTION_NAME": "<db_collection_name>",
    "MONGODB_DATABASE_NAME": "<db_name>",
    "SP_SITE_ID": "site-id-here",
    "SP_LIST_ID": "list-id-here",
    "SP_LIST_UNHANDLED_TOP": "2", // Number of unhandled PDF documents to list from SharePoint per execution. Should not be set too high to avoid azure function timeout.
    "SP_HANDLED_ERROR_THRESHOLD": "3", // Number of times a PDF document can be processed with errors before it is no longer attempted to be processed.
    "BETTERSTACK_MIN_LOG_LEVEL": "info"
  }
}
```

## Running the Project

```bash
npm run start
```

- This will process PDF files in the SharePoint site specified in `SP_SITE_ID` from the list specified in `SP_LIST_ID`.
  - Split PDF
    - If the PDF exceeds the max page limit, it will be split into chunks.
  - Each chunk or full PDF will be sent to Mistral or OpenAI for OCR processing
    - Successfully parsed files will have metadata updated on them in SharePoint.
    - Successfully parsed WorkItems will be saved to MongoDB.
    - Files failed to be processed by Mistral OCR or OpenAI OR document annotations from Mistral OCR or OpenAI that failed to be parsed, will have metadata updated on them in SharePoint. Failed files will be retried up to the number of times specified in `SP_HANDLED_ERROR_THRESHOLD`. After that, they will no longer be attempted to be processed and will require manual handling.
