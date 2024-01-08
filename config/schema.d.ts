export interface Config {
    bot: BotConfig;
    printers: PrintersConfig;
    embassyApi: EmbassyApiConfig;
    currency: CurrencyConfig;
    api: BotApiConfig;
    network: NetworkConfig;
    wiki: WikiConfig;
}

export interface WikiConfig {
    endpoint: string;
    defaultLocale: string;
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
    moderatedChats: number[];
    static: string;
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
    alerts: number;
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
    devices: DevicesConfig;
    service: EmbassyServiceConfig;
    spacenetwork: SpaceNetworkConfig;
    mqtthost: string;
    speaker: SpeakerConfig;
    cams: CamConfig;
    doorbell: DoorbellConfig;
    climate: ClimateConfig;
    hostsToMonitor?: string[] | null;
}

export interface DoorbellConfig {
    host: string;
    hasspath: string;
}

export interface EmbassyServiceConfig {
    host: string;
    queryMonitorInterval: number;
    statusCheckInterval: number;
    port: number;
    static: string;
}

export interface SpaceNetworkConfig {
    devicesCheckingMethod: string;
    networkRange: string;
    routerip: string;
    wifiip: string;
}

export interface SpeakerConfig {
    entity: string;
    ttspath: string;
    playpath: string;
    stoppath: string;
}

export interface NetworkConfig {
    timeout: number;
}

export interface DevicesConfig {
    [key: string]: DeviceDescriptor | undefined;
}

export interface DeviceDescriptor {
    host: string;
    mac: string;
    os?: "windows" | "linux" | "macos";
}

export interface CamConfig {
    downstairs: string;
    upstairs: string;
    jigglycam: string;
    printers: string;
    outdoors: string;
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
    co2?: string;
}

export interface CurrencyConfig {
    default: string;
    cryptoUpdateInterval: number;
    fiatUpdateInterval: number;
}

export interface BotApiConfig {
    port: number;
}

export interface NeuralConfig {
    stableDiffusion: StableDiffusionConfig;
}

export interface StableDiffusionConfig {
    base: string;
    steps?: 15;
    denoising?: 0.57;
    sampler?: string;
}
