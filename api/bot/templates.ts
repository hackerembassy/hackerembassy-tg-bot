import logger from "@services/common/logger";
import { readFirstExistingFile } from "@utils/filesystem";

function loadSpaceApiTemplate() {
    try {
        const spaceApiFile = readFirstExistingFile("./config/spaceapi.local.json", "./config/spaceapi.json");

        return spaceApiFile ? (JSON.parse(spaceApiFile) as object) : undefined;
    } catch (error) {
        logger.error(error);
        return undefined;
    }
}

export const spaceApiTemplate = loadSpaceApiTemplate();
