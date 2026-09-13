"use strict";

const { createChatHandler } = require("../supabase/functions/_shared/chat-core.mjs");
module.exports = createChatHandler(process.env);
