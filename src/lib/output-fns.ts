import { existsSync, mkdirSync } from "node:fs";
import { logger } from "@vestfoldfylke/loglady";

export const createDirectoryIfNotExists = (dirPath: string): void => {
  try {
    if (existsSync(dirPath)) {
      return;
    }

    logger.info("Output directory '{OutputDir}' does not exist. Creating...", dirPath);
    mkdirSync(dirPath, {recursive: true});
    logger.info("Output directory '{OutputDir}' created.", dirPath);
  } catch (error) {
    logger.errorException(error, "Failed to create output directory '{OutputDir}'", dirPath);
    throw error;
  }
}
