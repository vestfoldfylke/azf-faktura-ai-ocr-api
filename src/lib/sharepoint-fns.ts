import { type AccessToken, DefaultAzureCredential } from "@azure/identity";
import type { ListItem } from "@microsoft/microsoft-graph-types";
import { logger } from "@vestfoldfylke/loglady";
import { count, countInc } from "@vestfoldfylke/vestfold-metrics";

import {
  MetricsPrefix,
  MetricsResultFailedLabelValue,
  MetricsResultLabelName,
  MetricsResultSuccessLabelValue,
  SharePointStatusFailedNoRetry,
  SharePointStatusFailedWillRetry,
  SharePointStatusQueued
} from "../constants.js";

import type { CollectionResponse, MarkItemAsHandledRequest, Status } from "../types/sharepoint.js";

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

export const getListItems = async (siteId: string, listId: string, handledErrorThreshold: number, unhandledTop: number): Promise<ListItem[]> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items?expand=fields(select=HandledCount,Status,InsertedCount,InvoiceNumber,LinkFilename)&$filter=(fields/Status eq '${SharePointStatusQueued}' OR fields/Status eq '${SharePointStatusFailedWillRetry}') AND fields/HandledCount lt ${handledErrorThreshold} AND fields/DocIcon eq 'pdf'&$top=${unhandledTop}`;
  const response: Response = await _getListItems(endpoint);
  const listItems: CollectionResponse<ListItem> = await response.json();

  countInc(`${MetricsPrefix}_${MetricsFilePrefix}_GetListItems`, "Number of list items retrieved", listItems.value.length);

  return listItems.value;
};

export const markItemAsHandled = async (
  siteId: string,
  listId: string,
  itemId: string,
  status: Status,
  handledCount: number,
  insertedCount: number,
  invoiceNumber: string,
  errorReason?: string
): Promise<void> => {
  const endpoint: string = `sites/${siteId}/lists/${listId}/items/${itemId}/fields`;
  const body: MarkItemAsHandledRequest = {
    HandledAt: new Date().toISOString(),
    Status: status,
    HandledCount: handledCount,
    InsertedCount: insertedCount,
    InvoiceNumber: invoiceNumber,
    Error: errorReason || null
  };

  await patch<MarkItemAsHandledRequest, ListItem>(endpoint, body);
  if (status === SharePointStatusFailedNoRetry) {
    logger.warn("Marked item with Id {ItemId} as {Status} (HandledCount: {HandledCount}): {ErrorReason}", itemId, status, handledCount, errorReason);

    return;
  }

  logger.info("Marked item with Id {ItemId} as {Status} (HandledCount: {HandledCount})", itemId, status, handledCount);
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

const patch = async <TRequest, UResponse>(endpoint: string, body: TRequest): Promise<UResponse> => {
  const token: string = await getToken(GRAPH_SCOPE);

  logger.info("Making PATCH request to Microsoft Graph API at endpoint '{Endpoint}' with body {Body}", endpoint, JSON.stringify(body, null, 2));
  const response: Response = await fetch(`${GRAPH_BASE_URL}/${endpoint}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
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

const getToken = async (scope: string): Promise<string> => {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID) {
    throw new Error("Missing Azure AD credentials in environment variables");
  }

  const accessToken: AccessToken = await credential.getToken(scope);
  return accessToken.token;
};
