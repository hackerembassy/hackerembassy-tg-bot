/* eslint-disable @typescript-eslint/no-unsafe-argument */
import path from "node:path";

import { fileURLToPath } from "node:url";

import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import prettier from "eslint-plugin-prettier";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import globals from "globals";

import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    globalIgnores(["**/dist/", "**/node_modules/", "**/coverage/"]),
    {
        extends: fixupConfigRules(
            compat.extends(
                "eslint:recommended",
                "plugin:import/typescript",
                "plugin:@typescript-eslint/eslint-recommended",
                "plugin:@typescript-eslint/recommended-type-checked"
            )
        ),

        plugins: {
            prettier,
            "@typescript-eslint": fixupPluginRules(typescriptEslint),
            import: fixupPluginRules(_import),
        },

        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.commonjs,
            },

            ecmaVersion: "latest",
            sourceType: "module",

            parserOptions: {
                project: true,
                parser: "@typescript-eslint/parser",
            },
        },

        settings: {
            "import/resolver": {
                typescript: true,
                node: true,
            },
        },

        rules: {
            "prettier/prettier": ["warn"],
            "@typescript-eslint/no-unnecessary-condition": "error",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-this-alias": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/unbound-method": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "no-duplicate-imports": "error",
            "require-await": "error",
            eqeqeq: "error",
            "no-unneeded-ternary": "error",
            "no-var": "error",
            "prefer-const": "error",
            "no-console": "warn",
            "no-unexpected-multiline": "warn",

            "import/order": [
                "error",
                {
                    groups: ["builtin", "external", "internal", ["parent", "sibling", "index", "object"]],

                    pathGroups: [
                        {
                            pattern: "^@.+",
                            group: "internal",
                            position: "after",
                        },
                    ],

                    "newlines-between": "always-and-inside-groups",

                    alphabetize: {
                        order: "ignore",
                        caseInsensitive: true,
                    },
                },
            ],
        },
    },
]);
