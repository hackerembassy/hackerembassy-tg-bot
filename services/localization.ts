import { t, use } from "i18next";
import Backend from "i18next-fs-backend";
import { join } from "path";

// @ts-ignore
use(Backend).init({
    backend: {
        loadPath: join(__dirname, "../resources/locales/{{lng}}/{{ns}}.yaml"),
    },
    interpolation: {
        escapeValue: false,
    },
    lng: "ru",
    debug: false,
});

export default t;
