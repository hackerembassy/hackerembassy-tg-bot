import fs from "fs";

import { GifFrame, GifCodec, GifUtil, BitmapImage } from "gifwrap";
import { Jimp, JimpInstance } from "jimp";

const MAX_BITMAP_INDEX = 256;

export async function overlayStaticImageOnGif(
    gifPath: string,
    overlayImagePath: string,
    options: { overlayWidth: number; overlayX: number; overlayY: number }
) {
    const gifCodec = new GifCodec();
    const gif = await gifCodec.decodeGif(fs.readFileSync(gifPath));
    const overlay = (await Jimp.read(overlayImagePath)).resize({
        w: options.overlayWidth,
    }) as JimpInstance;
    overlay.background = 0;
    const overlayCenter = options.overlayWidth / 2;
    overlay.circle({
        radius: overlayCenter,
        x: overlayCenter,
        y: overlayCenter,
    });

    const processedFrames = await Promise.all(
        gif.frames.map(async frame => {
            const jimpFrame = (await Jimp.fromBitmap(frame.bitmap)) as JimpInstance;

            jimpFrame.composite(overlay, options.overlayX, options.overlayY);

            const bitmapImage = new BitmapImage(jimpFrame.bitmap);
            GifUtil.quantizeDekker(bitmapImage, MAX_BITMAP_INDEX);

            return new GifFrame(bitmapImage, { delayCentisecs: frame.delayCentisecs });
        })
    );

    const codec = new GifCodec();
    const outputGif = await codec.encodeGif(processedFrames, { loops: 3, colorScope: 2 });

    return outputGif.buffer;
}
