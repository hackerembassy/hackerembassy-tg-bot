/* eslint-disable no-console */
import { copy, ensureDir } from "fs-extra";

async function postbuild() {
    try {
        await copy("./resources", "./dist/resources");
        await copy("./db", "./dist/db").catch(() => console.warn("No db directory found, skipping copy"));
        await copy("./config", "./dist/config");
        await copy("./src/api/bot/swagger-schema.json", "./dist/src/api/bot/swagger-schema.json");
        await copy("./package.json", "./dist/package.json");

        await ensureDir("./dist/log");

        console.log("Postbuild completed successfully");
    } catch (error) {
        console.error(error);
    }
}

await postbuild();

export default postbuild;
