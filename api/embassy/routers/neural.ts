import { Router } from "express";

import { stableDiffusion } from "@services/neural";

type txt2imgBody = { prompt?: string; negative_prompt?: string };
type img2imgBody = { prompt?: string; negative_prompt?: string; image?: string };

const router = Router();

/**
 * Endpoint to ask StableDiffusion to generate an image from a text prompt
 */
router.post("/sd/txt2img", async (req: RequestWithBody<txt2imgBody>, res, next): Promise<any> => {
    try {
        if (!req.body.prompt) return res.sendStatus(400).send({ message: "Prompt is required" });

        const image = await stableDiffusion.txt2image(req.body.prompt, req.body.negative_prompt);

        if (!image) throw Error("txt2image process failed");

        res.send({ image });
    } catch (error) {
        next(error);
    }
});

/**
 * Endpoint to ask StableDiffusion to generate an image from a text prompt and a starting image
 */
router.post("/sd/img2img", async (req: RequestWithBody<img2imgBody>, res, next): Promise<any> => {
    try {
        if (!req.body.image) return res.sendStatus(400).send({ message: "Initial image is required" });

        const image = await stableDiffusion.img2image(req.body.prompt, req.body.negative_prompt, req.body.image);

        if (!image) throw Error("img2image process failed");

        res.send({ image });
    } catch (error) {
        next(error);
    }
});

export default router;
