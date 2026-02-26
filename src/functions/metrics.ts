import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { register } from "@vestfoldfylke/vestfold-metrics";

import { errorTriggerHandling } from "../middleware/error-handling.js";

export const metrics = async (_: HttpRequest, __: InvocationContext): Promise<HttpResponseInit> => {
  return {
    status: 200,
    headers: { "Content-Type": register.contentType },
    body: await register.metrics()
  };
};

app.get("metrics", {
  authLevel: "function",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> =>
    await errorTriggerHandling(request, context, metrics)
});
