/* eslint-disable no-console */
// One-off migration from the legacy single db/state.json file to the split db/state/ layout
// (flags.json, fileIdCache.json, liveChats.json, history/<chatId>.json, messages/<chatId>.json).
// Run once before deploying the code that reads the split layout: `npx tsx scripts/migrateState.ts`.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import config from "config";

import { BotConfig } from "@config";

interface MessageHistoryEntry {
    messageId: number;
    text?: string;
    from?: string;
    datetime: number;
}

interface LegacyState {
    history?: Record<string, MessageHistoryEntry[]>;
    messages?: Record<string, MessageHistoryEntry[]>;
    liveChats?: { chatId: number; event: string; serializationData: unknown }[];
    flags?: Record<string, boolean>;
    fileIdCache?: Record<string, string>;
}

const botConfig = config.get<BotConfig>("bot");

const oldStatePath = path.join(botConfig.persistedfolderpath, "state.json");
const stateDir = path.join(botConfig.persistedfolderpath, "state");

function writeJson(filePath: string, data: unknown) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data));
}

function migrate() {
    if (!existsSync(oldStatePath)) {
        console.log(`No legacy state file found at ${oldStatePath}, nothing to migrate`);
        return;
    }

    if (existsSync(stateDir)) {
        console.log(`Target state directory ${stateDir} already exists, aborting to avoid overwriting it`);
        return;
    }

    const legacyState = JSON.parse(readFileSync(oldStatePath, "utf8")) as LegacyState;

    writeJson(path.join(stateDir, "flags.json"), legacyState.flags ?? {});
    writeJson(path.join(stateDir, "fileIdCache.json"), legacyState.fileIdCache ?? {});
    writeJson(path.join(stateDir, "liveChats.json"), legacyState.liveChats ?? []);

    const historyEntries = Object.entries(legacyState.history ?? {});
    for (const [chatId, entries] of historyEntries) {
        writeJson(path.join(stateDir, "history", `${chatId}.json`), entries);
    }

    const messageEntries = Object.entries(legacyState.messages ?? {});
    for (const [chatId, entries] of messageEntries) {
        writeJson(path.join(stateDir, "messages", `${chatId}.json`), entries);
    }

    const legacyBackupPath = `${oldStatePath}.bak`;
    renameSync(oldStatePath, legacyBackupPath);

    console.log(
        `Migrated ${oldStatePath} into ${stateDir} ` +
            `(${historyEntries.length} history file(s), ${messageEntries.length} message file(s)).`
    );
    console.log(`Old state file preserved as ${legacyBackupPath}`);
}

migrate();
