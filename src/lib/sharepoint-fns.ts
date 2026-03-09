import { type AccessToken, DefaultAzureCredential } from "@azure/identity";
import type { DriveItem, ListItem } from "@microsoft/microsoft-graph-types";
import { logger } from "@vestfoldfylke/loglady";
import { count, countInc } from "@vestfoldfylke/vestfold-metrics";

import {
  MetricsPrefix,
  MetricsResultFailedLabelValue,
  MetricsResultLabelName,
  MetricsResultSuccessLabelValue,
  SharePointStatusFailed,
  SharePointStatusFailedNoRetry,
  SharePointStatusFailedWillRetry,
  SharePointStatusQueued
} from "../constants.js";

import type {
  CollectionResponse,
  CsvStatus,
  InvoiceStatus,
  MarkCsvItemAsHandledRequest,
  MarkInvoiceItemAsHandledRequest
} from "../types/sharepoint.js";

const credential = new DefaultAzureCredential();

const GRAPH_BASE_URL: string = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPE: string = "https://graph.microsoft.com/.default";
const MetricsFilePrefix = "SharepointFns";

export const getItemContentAsBase64 = async (siteId: string, listId: string, itemId: string): Promise<string> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items/${itemId}/driveItem/content`;
  const response: Response = await _getItemContentAsBase64(endpoint);
  const arrayBuffer: ArrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer).toString("base64");
};

export const getCsvListItems = async (siteId: string, listId: string): Promise<ListItem[]> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items?expand=fields(select=Title,FromDate,ToDate)&$filter=fields/Status eq '${SharePointStatusQueued}'&$top=100`;
  const response: Response = await _getListItems(endpoint);
  const listItems: CollectionResponse<ListItem> = await response.json();

  countInc(`${MetricsPrefix}_${MetricsFilePrefix}_GetCsvListItems`, "Number of CSV list items retrieved", listItems.value.length);

  return listItems.value;
};

export const getCsvWebUrl = async (siteId: string, listId: string, newCsvItemId: string): Promise<string> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items/${newCsvItemId}/driveItem`;
  const response: Response = await _getListItems(endpoint);
  const listItem: DriveItem = await response.json();

  return listItem.webUrl;
};

export const getInvoiceListItems = async (
  siteId: string,
  listId: string,
  handledErrorThreshold: number,
  unhandledTop: number
): Promise<ListItem[]> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items?expand=fields(select=HandledCount,Status,InsertedCount,InvoiceNumber,LinkFilename)&$filter=(fields/Status eq '${SharePointStatusQueued}' OR fields/Status eq '${SharePointStatusFailedWillRetry}') AND fields/HandledCount lt ${handledErrorThreshold} AND fields/DocIcon eq 'pdf'&$top=${unhandledTop}`;
  const response: Response = await _getListItems(endpoint);
  const listItems: CollectionResponse<ListItem> = await response.json();

  countInc(`${MetricsPrefix}_${MetricsFilePrefix}_GetInvoiceListItems`, "Number of invoice list items retrieved", listItems.value.length);

  return listItems.value;
};

export const getLatestCsvItemId = async (siteId: string, listId: string): Promise<string> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items?$orderby=fields/Created desc&$top=1`;
  const response: Response = await _getListItems(endpoint);
  const listItems: CollectionResponse<ListItem> = await response.json();

  if (listItems.value.length === 0) {
    throw new Error(`No CSV items found in list with ListId ${listId} at SiteId ${siteId}`);
  }

  return listItems.value[0].id;
};

export const markCsvItemAsHandled = async (
  siteId: string,
  listId: string,
  itemId: string,
  status: CsvStatus,
  csvName?: string,
  webUrl?: string,
  workItemCount?: number,
  findingsCount?: number
): Promise<void> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items/${itemId}/fields`;
  const body: MarkCsvItemAsHandledRequest = {
    HandledAt: new Date().toISOString(),
    Status: status
  };

  if (csvName && webUrl) {
    body.Download = {
      Description: csvName,
      Url: webUrl
    };
  }

  if (workItemCount !== undefined) {
    body.WorkItemCount = workItemCount;
  }

  if (findingsCount !== undefined) {
    body.FindingsCount = findingsCount;
  }

  await patch<MarkCsvItemAsHandledRequest, ListItem>(endpoint, body, { Prefer: "apiversion=2.1" });
  if (status === SharePointStatusFailed) {
    if (csvName && webUrl) {
      logger.warn("Marked CSV item with Id {ItemId} as '{Status}' and linked to csv export with Name '{CsvName}'", itemId, status, csvName);
      return;
    }

    logger.warn("Marked CSV item with Id {ItemId} as '{Status}'", itemId, status);
    return;
  }

  if (csvName && webUrl) {
    logger.info("Marked CSV item with Id {ItemId} as '{Status}' and linked to csv export with Name '{CsvName}'", itemId, status, csvName);
    return;
  }

  logger.info("Marked CSV item with Id {ItemId} as '{Status}'", itemId, status);
};

export const markInvoiceItemAsHandled = async (
  siteId: string,
  listId: string,
  itemId: string,
  status: InvoiceStatus,
  handledCount: number,
  insertedCount: number,
  invoiceNumber: string,
  errorReason?: string
): Promise<void> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items/${itemId}/fields`;
  const body: MarkInvoiceItemAsHandledRequest = {
    HandledAt: new Date().toISOString(),
    Status: status,
    HandledCount: handledCount,
    InsertedCount: insertedCount,
    InvoiceNumber: invoiceNumber,
    Error: errorReason || null
  };

  await patch<MarkInvoiceItemAsHandledRequest, ListItem>(endpoint, body);
  if (status === SharePointStatusFailedNoRetry) {
    logger.warn(
      "Marked invoice item with Id {ItemId} as '{Status}' (HandledCount: {HandledCount}): {ErrorReason}",
      itemId,
      status,
      handledCount,
      errorReason
    );

    return;
  }

  logger.info("Marked invoice item with Id {ItemId} as '{Status}' (HandledCount: {HandledCount})", itemId, status, handledCount);
};

export const uploadCsvToSharePoint = async (csvContent: string, csvName: string, siteId: string, driveId: string): Promise<void> => {
  const endpoint: string = `sites/${siteId}/drives/${driveId}/items/root:/${csvName}:/content`;
  const driveItem: DriveItem = await put<string, DriveItem>(endpoint, "text/plain", csvContent);

  logger.info("Uploaded CSV '{CsvName}' to SharePoint list with drive item id {ItemId}", csvName, driveItem.id);

  count(`${MetricsPrefix}_${MetricsFilePrefix}_UploadCsvToSharePoint`, "Number of CSV files uploaded to SharePoint");
};

const _getItemContentAsBase64 = async (endpoint: string): Promise<Response> => {
  const token: string = await getToken(GRAPH_SCOPE);

  const request: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  return await get(endpoint, request);
};

const _getListItems = async (endpoint: string): Promise<Response> => {
  const token: string = await getToken(GRAPH_SCOPE);

  const request: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly"
    }
  };

  return await get(endpoint, request);
};

const get = async (endpoint: string, request: RequestInit): Promise<Response> => {
  logger.info("Making GET request to Microsoft Graph API at endpoint '{Endpoint}'", endpoint);
  const response: Response = await fetch(`${GRAPH_BASE_URL}/${endpoint}`, request);

  if (!response.ok) {
    const errorText: string = await response.text();

    logger.error(
      "Microsoft Graph API GET request to endpoint {Endpoint} failed with status {Status}: {StatusText} ---> {@ErrorText}",
      endpoint,
      response.status,
      response.statusText,
      errorText
    );
    count(`${MetricsPrefix}_${MetricsFilePrefix}_GetRequest`, "Number of GET requests to Graph SharePoint", [
      MetricsResultLabelName,
      MetricsResultFailedLabelValue
    ]);
    throw new Error(`Microsoft Graph API GET request failed with status ${response.status}: ${response.statusText}`);
  }

  count(`${MetricsPrefix}_${MetricsFilePrefix}_GetRequest`, "Number of GET requests to Graph SharePoint", [
    MetricsResultLabelName,
    MetricsResultSuccessLabelValue
  ]);
  return response;
};

const patch = async <TRequest, UResponse>(endpoint: string, body: TRequest, additionalHeaders?: Record<string, string>): Promise<UResponse> => {
  const token: string = await getToken(GRAPH_SCOPE);

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...additionalHeaders
  };

  logger.info("Making PATCH request to Microsoft Graph API at endpoint '{Endpoint}' with body {Body}", endpoint, JSON.stringify(body, null, 2));
  const response: Response = await fetch(`${GRAPH_BASE_URL}/${endpoint}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText: string = await response.text();

    logger.error(
      "Microsoft Graph API PATCH request to endpoint '{Endpoint}' failed with status {Status}: {StatusText} ---> {@ErrorText}",
      endpoint,
      response.status,
      response.statusText,
      errorText
    );

    count(`${MetricsPrefix}_${MetricsFilePrefix}_PatchRequest`, "Number of PATCH requests to Graph SharePoint", [
      MetricsResultLabelName,
      MetricsResultFailedLabelValue
    ]);

    throw new Error(`Microsoft Graph API PATCH request failed with status ${response.status}: ${response.statusText}`);
  }

  const jsonResponse: UResponse = await response.json();

  count(`${MetricsPrefix}_${MetricsFilePrefix}_PatchRequest`, "Number of PATCH requests to Graph SharePoint", [
    MetricsResultLabelName,
    MetricsResultSuccessLabelValue
  ]);

  return jsonResponse;
};

const put = async <TRequest, UResponse>(endpoint: string, contentType: string, body: TRequest): Promise<UResponse> => {
  const token: string = await getToken(GRAPH_SCOPE);

  logger.info("Making PUT request to Microsoft Graph API at endpoint '{Endpoint}' with ContentType '{ContentType}'", endpoint, contentType);

  const response: Response = await fetch(`${GRAPH_BASE_URL}/${endpoint}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType
    },
    body: contentType === "text/plain" ? String(body) : JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText: string = await response.text();

    logger.error(
      "Microsoft Graph API PUT request to endpoint '{Endpoint}' failed with status {Status}: {StatusText} ---> {@ErrorText}",
      endpoint,
      response.status,
      response.statusText,
      errorText
    );

    count(`${MetricsPrefix}_${MetricsFilePrefix}_PutRequest`, "Number of PUT requests to Graph SharePoint", [
      MetricsResultLabelName,
      MetricsResultFailedLabelValue
    ]);

    throw new Error(`Microsoft Graph API PUT request failed with status ${response.status}: ${response.statusText}`);
  }

  const jsonResponse: UResponse = await response.json();

  count(`${MetricsPrefix}_${MetricsFilePrefix}_PutRequest`, "Number of PUT requests to Graph SharePoint", [
    MetricsResultLabelName,
    MetricsResultSuccessLabelValue
  ]);

  return jsonResponse;
};

const getToken = async (scope: string): Promise<string> => {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
    throw new Error("Missing Azure AD credentials in environment variables");
  }

  const accessToken: AccessToken = await credential.getToken(scope);
  return accessToken.token;
};
