export interface Config {
    bot: BotConfig;
    printers: PrintersConfig;
    embassyApi: EmbassyApiConfig;
    currency: CurrencyConfig;
    api: BotApiConfig;
}

export interface BotConfig {
    timezone: string;
    chats: ChatsConfig;
    timeouts: AutoinsideTimeouts;
    rateLimit: number;
    autoWish: boolean;
    logfolderpath: string;
    persistedfolderpath: string;
    maxchathistory: number;
    calendar: CalendarConfig;
    locales?: string;
    live: LiveConfig;
    debug: boolean;
}

export interface LiveConfig {
    camRefreshInterval: number;
    statusRefreshInterval: number;
}

export interface CalendarConfig {
    url: string;
    appLink: string;
    upcomingToLoad: number;
}

export interface ChatsConfig {
    main: number;
    horny: number;
    offtopic: number;
    test: number;
    key: number;
    status: number;
}
export interface AutoinsideTimeouts {
    in: number;
    out: number;
}

export interface PrintersConfig {
    anette: PrinterEndpoint;
    plumbus: PrinterEndpoint;
}

export interface PrinterEndpoint {
    apibase: string;
    camport: number;
}

export interface EmbassyApiConfig {
    timeout: number;
    port: number;
    queryMonitorInterval: number;
    statusCheckInterval: number;
    host: string;
    static: string;
    devicesCheckingPath: string;
    networkRange: string;
    routerip: string;
    wifiip: string;
    mqtthost: string;
    doorbell: string;
    webcam: string;
    webcam2: string;
    doorcam: string;
    ttspath: string;
    playpath: string;
    doorbellpath: string;
    climate: ClimateConfig;
    hostsToMonitor?: string[] | null;
}

export interface ClimateConfig {
    first_floor: RoomClimate;
    second_floor: RoomClimate;
    bedroom: RoomClimate;
    conditioner: ConditionerConfig;
}

export interface ConditionerConfig {
    entityId: string;
    statePath: string;
    turnOnPath: string;
    turnOffPath: string;
    setModePath: string;
    setTemperaturePath: string;
}

export interface RoomClimate {
    temperature: string;
    humidity: string;
}

export interface CurrencyConfig {
    default: string;
    cryptoUpdateInterval: number;
    fiatUpdateInterval: number;
}

export interface BotApiConfig {
    port: number;
}
