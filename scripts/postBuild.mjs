import { copy, ensureDir } from "fs-extra";

async function postbuild() {
    try {
        await copy("./resources", "./dist/resources");
        await copy("./data", "./dist/data");
        await copy("./config", "./dist/config");
        await copy("./api/bot/swagger-schema.json", "./dist/api/bot/swagger-schema.json");
        await copy("./package.json", "./dist/package.json");

        await ensureDir("./dist/log");

        console.log("Postbuild completed successfully");
    } catch (err) {
        console.error(err);
    }
}

postbuild();

export default postbuild;
