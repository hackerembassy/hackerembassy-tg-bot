import "reflect-metadata";

import config from "config";
import { ChatId } from "node-telegram-bot-api";

import { BotConfig, BotFeatureFlag } from "@config";
import { Alias, User } from "@data/models";
import aliasesRepository from "@data/repositories/aliases";
import { UserRole } from "@data/types";
import { hasRole } from "@services/domain/user";
import logger from "@services/common/logger";

import { OptionalRegExp } from "../helpers";
import { MetadataKeys, RouteMetadata } from "../decorators";
import { BotController, BotHandler, BotRoute, MatchMapperFunction } from "../types";

const botConfig = config.get<BotConfig>("bot");

export interface ResolvedRoute {
    route: Optional<BotRoute>;
    text: string;
    commandWithCase: string;
    command: string;
}

export enum AddAliasResult {
    Added,
    AlreadyExists,
    InvalidTarget,
}

// Holds and matches command routes registered by controllers, decoupled from message
// dispatch/sending so the core bot class doesn't also have to be the router.
export default class CommandRouter {
    private routeMap = new Map<string, BotRoute>();

    constructor(private readonly botName: string) {}

    public getRoute(command: string): Optional<BotRoute> {
        return this.routeMap.get(command);
    }

    public canUserCallCommand(user: Nullable<User>, command: string): boolean {
        const savedRestrictions = this.routeMap.get(command)?.userRoles;

        if (!savedRestrictions || savedRestrictions.length === 0) return true;
        if (user) return hasRole(user, "admin", ...savedRestrictions);

        return savedRestrictions.includes("default");
    }

    public canCallCommandInChat(chatId: number, command: string): boolean {
        const savedRestrictions = this.routeMap.get(command)?.allowedChats;

        if (!savedRestrictions || savedRestrictions.length === 0) return true;
        if (savedRestrictions.includes(chatId)) return true;

        return false;
    }

    public addAlias(alias: string, target: string, createdBy: number): AddAliasResult {
        const bareAlias = alias.slice(1);
        const bareTargetCommand = target.split(" ")[0].slice(1).toLowerCase();

        if (this.hasRoute(bareAlias)) return AddAliasResult.AlreadyExists;
        if (!this.hasRoute(bareTargetCommand)) return AddAliasResult.InvalidTarget;

        aliasesRepository.upsertAlias(alias, target, createdBy);
        return AddAliasResult.Added;
    }

    public removeAlias(alias: string): boolean {
        const normalized = alias.startsWith("/") ? alias : `/${alias}`;
        return aliasesRepository.removeAlias(normalized).changes > 0;
    }

    public getAliases(): Alias[] {
        return aliasesRepository.getAliases();
    }

    // Parses the command out of message text and matches it to a route, falling back to a
    // user-defined alias (resolved once, non-recursively) when no route matches directly.
    public resolveRoute(text: string): ResolvedRoute {
        const parsed = this.parseCommand(text);
        const { fullCommand } = parsed;
        let { commandWithCase, command } = parsed;
        let route = this.getRoute(command);

        if (!route) {
            let alias: Optional<Alias>;

            try {
                alias = aliasesRepository.getAliasByName(`/${command}`);
            } catch (error) {
                logger.error(error);
            }

            if (alias) {
                // Just replacing one command with another: swap the leading "/command[@bot]"
                // token for the alias's stored target, keep the rest of the text.
                const aliasedText = text.replace(fullCommand, () => alias.target);
                const parsed = this.parseCommand(aliasedText);
                const aliasedRoute = this.getRoute(parsed.command);

                if (aliasedRoute) {
                    text = aliasedText;
                    ({ commandWithCase, command } = parsed);
                    route = aliasedRoute;
                }
            }
        }

        return { route, text, commandWithCase, command };
    }

    public matchParams(route: BotRoute, text: string): Nullable<unknown[]> {
        if (!route.paramMapper) return null;

        const match = route.regex.exec(text);
        return match ? route.paramMapper(match) : null;
    }

    public addController(controller: BotController) {
        const decoratedMethods = Object.getOwnPropertyNames(controller)
            .filter(
                name =>
                    typeof controller[name as keyof BotController] === "function" &&
                    name !== "prototype" &&
                    name !== "length" &&
                    name !== "name"
            )
            .filter(name => Reflect.getMetadata(MetadataKeys.Route, controller, name));

        for (const methodName of decoratedMethods) {
            const featureFlag = Reflect.getMetadata(MetadataKeys.FeatureFlag, controller, methodName) as
                BotFeatureFlag | undefined;

            if (featureFlag && !botConfig.features[featureFlag]) continue;

            const roles = Reflect.getMetadata(MetadataKeys.Roles, controller, methodName) as UserRole[];
            const routes = Reflect.getMetadata(MetadataKeys.Route, controller, methodName) as RouteMetadata[];
            const allowedChats = Reflect.getMetadata(MetadataKeys.AllowedChats, controller, methodName) as ChatId[];
            const method = controller[methodName as keyof BotController] as BotHandler;
            const handler = method.bind(controller);

            for (const route of routes) {
                this.addRoute(route.aliases, handler, route.paramRegex, route.paramMapper, roles, allowedChats);
            }
        }
    }

    public addRoute(
        aliases: string[],
        handler: BotHandler,
        paramRegex: Nullable<RegExp> = null,
        paramMapper: Nullable<MatchMapperFunction> = null,
        userRoles: UserRole[] = [],
        allowedChats: ChatId[] = []
    ): void {
        const optional = paramRegex instanceof OptionalRegExp;
        const regex = this.createRegex(aliases, paramRegex, optional);
        const botRoute = {
            regex,
            handler,
            paramMapper,
            optional,
            userRoles,
            allowedChats,
        };

        for (const alias of aliases) {
            this.routeMap.set(alias, botRoute);
        }
    }

    private hasRoute(command: string): boolean {
        return this.routeMap.has(command.toLowerCase());
    }

    private parseCommand(text: string) {
        const fullCommand = text.split(" ")[0];
        const commandWithCase = fullCommand.split("@")[0].slice(1);

        return { fullCommand, commandWithCase, command: commandWithCase.toLowerCase() };
    }

    private createRegex(aliases: string[], paramRegex: Nullable<RegExp>, optional: boolean = false) {
        const commandPart = `/(?:${aliases.join("|")})`;
        const botnamePart = this.botName ? `(?:@${this.botName})?` : "";

        let paramsPart = "";
        if (paramRegex) paramsPart = optional ? paramRegex.source : ` ${paramRegex.source}`;

        return new RegExp(`^${commandPart}${botnamePart}${paramsPart}$`, paramRegex?.flags);
    }
}
