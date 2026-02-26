// This line is necessary to enable source map support for better error stack traces in Node.js
import "source-map-support/register.js";

import type { HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";

import { logger } from "@vestfoldfylke/loglady";

import { HTTPError } from "../lib/HTTPError.js";

export async function errorTimerHandling(
  timer: Timer,
  context: InvocationContext,
  next: (timer: Timer, context: InvocationContext) => Promise<void>,
  name: string
): Promise<void> {
  try {
    await next(timer, context);
  } catch (error) {
    if (error instanceof HTTPError) {
      logger.errorException(error, "Error in TimerTrigger {Name} with status {Status}. Data: {@Data}", name, error.status, error.data);
    }

    logger.errorException(error, "Error in TimerTrigger {Name} with status {Status}", name, 400);
  } finally {
    await logger.flush();
  }
}

export async function errorTriggerHandling(
  request: HttpRequest,
  context: InvocationContext,
  next: (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
): Promise<HttpResponseInit> {
  try {
    return await next(request, context);
  } catch (error) {
    if (error instanceof HTTPError) {
      logger.errorException(
        error,
        "Error on {Method} to {Url} with status {Status}. Data: {@Data}",
        request.method,
        request.url,
        error.status,
        error.data
      );
      return error.toResponse(true);
    }

    logger.errorException(error, "Error on {Method} to {Url} with status {Status}", request.method, request.url, 400);
    return {
      status: 400,
      body: error.message
    };
  } finally {
    await logger.flush();
  }
}
