import { createEdgeHandler } from "../_shared/edge-handler.mjs";

const handler = createEdgeHandler(Deno.env.toObject());
Deno.serve((request, info) => handler(request, info.remoteAddr.hostname));
