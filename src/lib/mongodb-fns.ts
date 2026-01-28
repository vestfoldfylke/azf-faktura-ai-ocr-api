import { logger } from "@vestfoldfylke/loglady";
import { type Collection, type InsertManyResult, MongoClient, type ObjectId } from "mongodb";

import { getMongoDbCollectionName, getMongoDbConnectionString, getMongoDbDatabaseName } from "../config.js";

import type { WorkItemMongo } from "../types/zod-mongo";

let mongoClient: MongoClient | null = null;

export const closeDatabaseConnection = async (): Promise<void> => {
  if (!mongoClient) {
    return;
  }

  try {
    await mongoClient.close();
    logger.info("MongoDB connection closed successfully");
  } catch (error) {
    logger.errorException(error, "Error occurred while closing MongoDB connection");
  }
};

export const insertWorkItemsToDb = async (workItems: WorkItemMongo[]): Promise<string[]> => {
  const collectionName: string = getMongoDbCollectionName();
  const dbName: string = getMongoDbDatabaseName();

  const client: MongoClient | null = await getMongoClient();
  if (!client) {
    logger.error("MongoDB client is not available. Cannot insert work item.");
    return [];
  }

  try {
    const clientCollection: Collection<WorkItemMongo> = client.db(dbName).collection<WorkItemMongo>(collectionName);

    const result: InsertManyResult<WorkItemMongo> = await clientCollection.insertMany(workItems);
    if (result.acknowledged) {
      const insertedIds: string[] = Object.values(result.insertedIds).map((id: ObjectId) => id.toHexString());

      if (result.insertedCount !== workItems.length) {
        logger.warn(
          "Inserted count {InsertedCount} does not match work items length {WorkItemsLength} into collection '{CollectionName}'",
          result.insertedCount,
          workItems.length,
          collectionName
        );
        return insertedIds;
      }

      logger.info("Successfully inserted {InsertedCount} work items into collection '{CollectionName}'", result.insertedCount, collectionName);
      return insertedIds;
    }

    logger.error("Failed to insert {WorkItemsLength} work items into collection '{CollectionName}'", workItems.length, collectionName);
  } catch (error) {
    logger.errorException(
      error,
      "Error occurred while inserting {WorkItemsLength} work items into collection '{CollectionName}'",
      workItems.length,
      collectionName
    );

    return [];
  }
};

export const invoiceNumberExistsInDb = async (invoiceNumber: string): Promise<boolean> => {
  const collectionName: string = getMongoDbCollectionName();
  const dbName: string = getMongoDbDatabaseName();

  const client: MongoClient | null = await getMongoClient();
  if (!client) {
    logger.error("MongoDB client is not available. Invoice number query not possible!");
    throw new Error("MongoDB client is not available. Invoice number query not possible!");
  }

  try {
    const clientCollection: Collection<WorkItemMongo> = client.db(dbName).collection<WorkItemMongo>(collectionName);
    const itemsWithInvoiceNumber: number = await clientCollection.countDocuments({ invoiceNumber });
    return itemsWithInvoiceNumber > 0;
  } catch (error) {
    logger.errorException(error, "Error occured while checking if work items for invoice number '{InvoiceNumber}' exists in database", invoiceNumber);
    return false;
  }
};

const getMongoClient = async (): Promise<MongoClient | null> => {
  if (mongoClient) {
    try {
      await mongoClient.connect();
      logger.info("Successfully connected to already existing MongoDB instance");
      return mongoClient;
    } catch (error) {
      logger.errorException(error, "Failed to connect to already existing MongoDB instance");
    }
  }

  try {
    logger.info("Creating new MongoDB instance and connecting to MongoDB");
    const connectionString: string = getMongoDbConnectionString();
    mongoClient = new MongoClient(connectionString);

    await mongoClient.connect();
    logger.info("Successfully connected to MongoDB");
    return mongoClient;
  } catch (error) {
    logger.errorException(error, "Failed to create new MongoDB instance and/or connect to MongoDB");
    return null;
  }
};
