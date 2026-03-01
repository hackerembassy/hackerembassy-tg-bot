import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";
import { configs } from "typescript-eslint";

export default defineConfig([
    globalIgnores(["**/dist/", "**/node_modules/", "**/coverage/"]),

    js.configs.recommended,
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    configs.recommendedTypeChecked,

    {
        files: ["**/*.{js,cjs,mjs,ts,tsx,cts,mts}"],

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.commonjs,
            },
            parserOptions: {
                projectService: true,
            },
        },

        plugins: {
            prettier,
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
            "@typescript-eslint/no-var-requires": "error",
            "@typescript-eslint/no-this-alias": "error",
            "@typescript-eslint/no-explicit-any": "error",
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
