import "reflect-metadata";
import { UserRole } from "@data/types";
import { BotFeatureFlag } from "@config";

import { OptionalRegExp } from "./helpers";
import { BotController, MatchMapperFunction } from "./types";

export enum MetadataKeys {
    Route = "route",
    FeatureFlag = "feature-flag",
    Roles = "roles",
}

// Common user roles
export const TrustedMembers = ["member", "trusted"] as UserRole[];
export const Members = ["member"] as UserRole[];
export const Accountants = ["accountant"] as UserRole[];
export const Admins = ["admin"] as UserRole[];

// Common regexes
export const CaptureListOfIds = /(\d[\d\s,]*)/;
export const CaptureInteger = /(-?\d+)/;

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
