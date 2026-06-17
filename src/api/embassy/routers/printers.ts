import { Router } from "express";

import { AvailablePrinters, Thumbnail } from "@services/embassy/printer3d";
const router = Router();

function findBestThumbnail(thumbnails: Thumbnail[]): Nullable<string> {
    if (thumbnails.length === 0) return null;

    const suitableThumbnail =
        thumbnails.find(thumbnail => thumbnail.width > 200 && thumbnail.height > 200 && thumbnail.size > 10000) ??
        thumbnails.at(-1);

    return suitableThumbnail?.relative_path ?? null;
}

router.get("/:name", async (req, res, next) => {
    try {
        const printer = AvailablePrinters.get(req.params.name);

        if (!printer) return res.status(404).send({ message: "Printer not found" });

        const statusResponse = await printer.getPrinterStatus();
        const status = statusResponse.status;
        const fileMetadata = await printer.getFileMetadata(status.print_stats.filename);
        const cam = await printer.getCam().catch(() => null);
        const thumbnailPath = fileMetadata?.thumbnails ? findBestThumbnail(fileMetadata.thumbnails) : null;
        const thumbnailBuffer = thumbnailPath ? await printer.getThumbnail(thumbnailPath) : null;

        return res.send({ status, thumbnailBuffer, cam });
    } catch (error) {
        next(error);
        return;
    }
});

export default router;
