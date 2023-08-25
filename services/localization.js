const fs = require("path");
const i18next = require("i18next");
const Backend = require("i18next-fs-backend");

// @ts-ignore
i18next.use(Backend).init({
    backend: {
        loadPath: fs.join(__dirname, "../resources/locales/{{lng}}/{{ns}}.yaml"),
    },
    interpolation: {
        escapeValue: false,
    },
    lng: "ru",
    debug: false,
});

module.exports = i18next.t;
