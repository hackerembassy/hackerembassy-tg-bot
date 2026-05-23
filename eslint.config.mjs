import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import importPlugin from "eslint-plugin-import";
import { configs } from "typescript-eslint";

export default defineConfig([
    globalIgnores(["**/dist/", "**/node_modules/", "**/coverage/"]),

    js.configs.recommended,
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    eslintPluginUnicorn.configs.recommended,
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
            unicorn: eslintPluginUnicorn,
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
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/unbound-method": "off",
            "@typescript-eslint/no-unsafe-return": "error",
            "no-duplicate-imports": "error",
            "require-await": "error",
            eqeqeq: "error",
            "no-unneeded-ternary": "error",
            "no-var": "error",
            "prefer-const": "error",
            "no-console": "warn",
            "no-unexpected-multiline": "warn",
            "unicorn/no-useless-promise-resolve-reject": "error",
            "unicorn/prefer-module": "off",
            "unicorn/prefer-spread": "off",
            "unicorn/no-await-expression-member": "off",
            "unicorn/no-nested-ternary": "off",
            "unicorn/no-array-sort": "off",
            "unicorn/prefer-event-target": "off",
            "unicorn/no-array-reduce": "off",
            "unicorn/no-array-callback-reference": "off",
            "unicorn/prevent-abbreviations": "off",
            "unicorn/prefer-string-slice": "off",
            "unicorn/escape-case": "off",
            "unicorn/numeric-separators-style": "off",
            "unicorn/prefer-string-raw": "off",
            "unicorn/no-process-exit": "off",
            "unicorn/filename-case": "off",
            "unicorn/no-hex-escape": "off",
            "unicorn/no-null": "off",
            "unicorn/no-useless-switch-case": "off",
            "unicorn/prefer-math-trunc": "off",
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
