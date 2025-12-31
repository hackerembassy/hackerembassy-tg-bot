import "reflect-metadata";
import config from "config";

import { BotConfig, BotFeatureFlag } from "@config";
import { UserRole } from "@data/types";

import { OptionalRegExp } from "./helpers";
import { BotController, MatchMapperFunction } from "./types";

const botConfig = config.get<BotConfig>("bot");

export enum MetadataKeys {
    Route = "route",
    FeatureFlag = "feature-flag",
    Roles = "roles",
    AllowedChats = "allowed-chats",
}

// Common user roles
export const TrustedMembers = ["member", "trusted"] as UserRole[];
export const Members = ["member"] as UserRole[];
export const Accountants = ["accountant"] as UserRole[];
export const Admins = ["admin"] as UserRole[];

// Common regexes
export const CaptureListOfIds = /(\d[\d\s,]*)/;
export const CaptureInteger = /(-?\d+)/;

// Common chat IDs
export const PublicChats = Object.values(botConfig.chats) as number[];
export const GreetingsChats = [botConfig.chats.main, botConfig.chats.offtopic, botConfig.chats.horny, botConfig.chats.key];
export const NonTopicChats = [
    botConfig.chats.main,
    botConfig.chats.horny,
    botConfig.chats.key,
    botConfig.chats.test,
    botConfig.chats.alerts,
];
export const ClosedChats = [botConfig.chats.alerts, botConfig.chats.horny, botConfig.chats.key];

export interface RouteMetadata {
    aliases: string[];
    paramRegex: Optional<OptionalRegExp>;
    paramMapper: Optional<MatchMapperFunction>;
}

export function UserRoles(roles: UserRole[]) {
    return function (target: BotController, propertyKey: string | symbol) {
        Reflect.defineMetadata(MetadataKeys.Roles, roles, target, propertyKey);
    };
}

export function AllowedChats(chatIds: number[]) {
    return function (target: BotController, propertyKey: string | symbol) {
        Reflect.defineMetadata(MetadataKeys.AllowedChats, chatIds, target, propertyKey);
    };
}

export function FeatureFlag(flag: BotFeatureFlag) {
    return function (target: BotController, propertyKey: string | symbol) {
        Reflect.defineMetadata(MetadataKeys.FeatureFlag, flag, target, propertyKey);
    };
}

export function Route(aliases: string[], paramRegex?: Optional<OptionalRegExp>, paramMapper?: Optional<MatchMapperFunction>) {
    return function (target: BotController, propertyKey: string | symbol) {
        const currentMetadata = (Reflect.getMetadata(MetadataKeys.Route, target, propertyKey) || []) as RouteMetadata[];
        currentMetadata.push({
            aliases,
            paramRegex,
            paramMapper,
        });
        Reflect.defineMetadata("route", currentMetadata, target, propertyKey);
    };
}
