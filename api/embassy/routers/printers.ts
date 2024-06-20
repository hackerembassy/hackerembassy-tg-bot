import { Router } from "express";

import { AvailablePrinters } from "@services/printer3d";
const router = Router();

router.get("/:name", async (req, res, next): Promise<any> => {
    try {
        const printer = AvailablePrinters.get(req.params.name);

        if (!printer) return res.status(404).send({ message: "Printer not found" });

        const statusResponse = await printer.getPrinterStatus();
        const status = statusResponse.status;
        const fileMetadata = await printer.getFileMetadata(status.print_stats.filename);
        const cam = await printer.getCam().catch(() => null);
        const thumbnailPath = fileMetadata?.thumbnails?.at(-1)?.relative_path;
        const thumbnailBuffer = thumbnailPath ? await printer.getThumbnail(thumbnailPath) : null;

        res.send({ status, thumbnailBuffer, cam });
    } catch (error) {
        next(error);
    }
});

export default router;
