import { Router } from "express";
import config from "config";

import bot from "@hackembot/instance";
import wiki, { OutlineWebhookPayload } from "@services/external/wiki";
import { WikiConfig } from "@config";
import { MINUTE } from "@utils/date";

import { createOutlineVerificationMiddleware } from "../middleware";

const wikiConfig = config.get<WikiConfig>("wiki");
const outlineSignedMiddleware = createOutlineVerificationMiddleware(process.env.OUTLINE_SIGNING_SECRET);
const router = Router();

router.get("/tree", async (_, res, next) => {
    try {
        const list = await wiki.listPagesAsTree();

        res.set("Cache-Control", "public, max-age=3600").json(list);
    } catch (error) {
        next(error);
    }
});

router.get("/page/:id", async (req, res, next): Promise<any> => {
    try {
        if (!req.params.id) return void res.status(400).send({ error: "Missing page id" });

        const content = await wiki.getPageContent(req.params.id);

        res.set("Cache-Control", "public, max-age=60").json({ id: req.params.id, content });
    } catch (error) {
        next(error);
    }
});

// Outline spams webhook with multiple requests for the same page quite often
const debounceTimers = new Map<string, NodeJS.Timeout>();
const WEBHOOK_DEBOUNCE = MINUTE;

// Webhook for Outline
router.post("/hooks/documents.update", outlineSignedMiddleware, (req, res, next): any => {
    try {
        const body = req.body as Optional<OutlineWebhookPayload>;
        if (!body || body.event !== "documents.update") return void res.sendStatus(400);

        const { title, url, updatedBy } = body.payload.model;

        if (debounceTimers.has(url)) {
            clearTimeout(debounceTimers.get(url));
        }

        const timeoutId = setTimeout(() => {
            const fullUrl = `${wikiConfig.baseUrl}${url}`;

            bot.sendAlert(`📝 \\u0023wiki page #[${title}#]#(${fullUrl}#) was updated by ${updatedBy.name}`);
            debounceTimers.delete(url);
        }, WEBHOOK_DEBOUNCE);

        debounceTimers.set(url, timeoutId);

        res.sendStatus(200);
    } catch (error) {
        next(error);
    }
});

export default router;
