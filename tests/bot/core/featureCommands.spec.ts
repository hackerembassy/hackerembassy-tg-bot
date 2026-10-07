import type { BotCommand } from "node-telegram-bot-api";

import type HackerEmbassyBot from "@hackembot/core/classes/HackerEmbassyBot";

async function loadWithHackemcoins(enabled: boolean) {
    const loaded = { menus: [] as BotCommand[][], help: "", memberHelp: "" };

    await jest.isolateModulesAsync(async () => {
        process.env["NODE_CONFIG"] = JSON.stringify({ bot: { features: { hackemcoins: enabled } } });

        const { setMenu } = await import("@hackembot/setup");
        const { GeneralCommandsList, MemberCommandsList } = await import("@constants/commands");
        const setMyCommands = jest.fn((commands: BotCommand[]) => {
            loaded.menus.push(commands);
            return Promise.resolve(true);
        });

        await setMenu({ setMyCommands } as unknown as HackerEmbassyBot);

        loaded.help = GeneralCommandsList;
        loaded.memberHelp = MemberCommandsList;
    });

    delete process.env["NODE_CONFIG"];

    return loaded;
}

describe("Feature-gated commands:", () => {
    test("hackemcoin commands are listed in the menu and /help while the feature is on", async () => {
        const { menus, help, memberHelp } = await loadWithHackemcoins(true);

        expect(menus).toHaveLength(2);
        for (const menu of menus) expect(menu.map(c => c.command)).toEqual(expect.arrayContaining(["hackemcoins", "snacks"]));
        expect(help).toContain("/snacks");
        expect(memberHelp).toContain("/granthc");
    });

    test("hackemcoin commands disappear from the menu and /help when the feature is off", async () => {
        const { menus, help, memberHelp } = await loadWithHackemcoins(false);

        expect(menus).toHaveLength(2);
        for (const menu of menus) expect(menu.map(c => c.command)).not.toEqual(expect.arrayContaining(["hackemcoins"]));
        for (const menu of menus) expect(menu.map(c => c.command)).not.toEqual(expect.arrayContaining(["snacks"]));
        expect(help).not.toMatch(/hackemcoin|snack/i);
        expect(memberHelp).not.toMatch(/hackemcoin|snack|granthc/i);
    });
});
