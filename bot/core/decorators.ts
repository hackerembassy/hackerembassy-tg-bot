import "reflect-metadata";
import { UserRole } from "@data/types";

import { OptionalRegExp } from "./helpers";
import { BotHandlers, MatchMapperFunction } from "./types";

export enum MetadataKeys {
    Route = "route",
    FeatureFlag = "feature-flag",
    Roles = "roles",
}

export interface RouteMetadata {
    aliases: string[];
    paramRegex?: OptionalRegExp | null;
    paramMapper?: MatchMapperFunction | null;
    roles?: UserRole[];
}

export function UserRoles(roles: UserRole[]) {
    return function (target: BotHandlers, propertyKey: string | symbol) {
        Reflect.defineMetadata(MetadataKeys.Roles, roles, target, propertyKey);
    };
}

export function FeatureFlag(flag: string) {
    return function (target: BotHandlers, propertyKey: string | symbol) {
        Reflect.defineMetadata(MetadataKeys.FeatureFlag, flag, target, propertyKey);
    };
}

export function Route(
    aliases: string[],
    paramRegex?: OptionalRegExp | null,
    paramMapper?: MatchMapperFunction | null,
    roles?: UserRole[]
) {
    return function (target: BotHandlers, propertyKey: string | symbol) {
        const currentMetadata = (Reflect.getMetadata(MetadataKeys.Route, target, propertyKey) || []) as RouteMetadata[];
        currentMetadata.push({
            aliases,
            paramRegex,
            paramMapper,
            roles,
        });
        Reflect.defineMetadata("route", currentMetadata, target, propertyKey);
    };
}
