import { Router } from "express";

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";

import logger from "@services/common/logger";

import { registerMcpTools } from "../mcp/tools";

const handler = createMcpHandler(
    () => {
        const server = new McpServer({ name: "hackerembassy-tg-bot", version: "1.0.0" });

        registerMcpTools(server);

        return server;
    },
    { onerror: error => logger.error(`MCP handler error: ${error.message}`) }
);

const handleNodeRequest = toNodeHandler(handler);

const router = Router();

router.all("/", (req, res) => {
    handleNodeRequest(req, res, req.body as unknown).catch((error: unknown) => {
        logger.error(`Failed to handle MCP request: ${(error as Error).message}`);

        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
            });
        }
    });
});

export default router;
