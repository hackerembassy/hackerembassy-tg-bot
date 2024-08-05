export interface Config {
    bot: BotConfig;
    logger: LoggerConfig;
    calendar: CalendarConfig;
    printers: PrintersConfig;
    embassyApi: EmbassyApiConfig;
    neural: NeuralConfig;
    currency: CurrencyConfig;
    api: BotApiConfig;
    wiki: WikiConfig;
    github: GithubConfig;
}

export interface WikiConfig {
    endpoint: string;
    publicCollectionId: string;
    defaultLocale: string;
}

export interface BotConfig {
    instance: InstanceConfig;
    timezone: string;
    defaultLocale: string;
    chats: ChatsConfig;
    timeouts: AutoinsideTimeouts;
    rateLimits: RateLimits;
    autoWish: boolean;
    persistedfolderpath: string;
    maxchathistory: number;
    live: LiveConfig;
    debug: boolean;
    moderatedChats: number[];
}

export interface BotApiConfig {
    port: number;
    static: string;
}

export interface LoggerConfig {
    level: string;
    logFolder: string;
    maxSize: string;
    maxFiles: string;
}

export interface InstanceConfig {
    type: "master" | "slave";
    masterHost: string;
    retryInterval: number;
    maxRetryCount: number;
}

export interface RateLimits {
    user: number;
    api: number;
    notifications: number;
}

export interface LiveConfig {
    camRefreshInterval: number;
    statusRefreshInterval: number;
}

export interface CalendarConfig {
    url: string;
    defaultRequestAmount: number;
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
    hassorigin: string;
    speaker: SpeakerConfig;
    cams: CamConfig;
    doorbell: DoorbellConfig;
    ledmatrix: LedMatrixConfig;
    alarm: AlarmConfig;
    climate: ClimateConfig;
    hostsToMonitor?: string[] | null;
}

export interface DoorbellConfig {
    host: string;
    hasspath: string;
}

export interface LedMatrixConfig {
    textpath: string;
}

export interface AlarmConfig {
    disarmpath: string;
}

export interface EmbassyServiceConfig {
    host: string;
    ip: string;
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
    unifiorigin: string;
}

export interface SpeakerConfig {
    entity: string;
    ttspath: string;
    playpath: string;
    stoppath: string;
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
    downstairs2: string;
    upstairs: string;
    printers: string;
    outdoors: string;
    facecontrol: string;
    kitchen: string;
}

export interface ClimateConfig {
    first_floor: RoomClimate;
    second_floor: RoomClimate;
    bedroom: RoomClimate;
    conditioner: ConditionerConfig;
}

export interface ConditionerConfig {
    downstairsId: string;
    upstairsId: string;
    statePath: string;
    turnOnPath: string;
    turnOffPath: string;
    setModePath: string;
    setTemperaturePath: string;
    preheatPath: string;
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

export interface NeuralConfig {
    stableDiffusion: StableDiffusionConfig;
    ollama: OllamaConfig;
    openai: OpenAiConfig;
}

export interface StableDiffusionConfig {
    base: string;
    steps?: 15;
    denoising?: 0.57;
    sampler?: string;
}
export interface OllamaConfig {
    base: string;
    model: string;
}

export interface OpenAiConfig {
    model: string;
    context: string;
    timeout: number;
}

export interface GithubConfig {
    organization: string;
    repos: {
        bot: string;
        space: string;
    };
    maintainer: string;
}
