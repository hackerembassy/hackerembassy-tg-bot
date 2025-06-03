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
    baseUrl: string;
    publicCollectionId: string;
    defaultLocale: string;
}

export interface BotConfig {
    instance: InstanceConfig;
    timezone: string;
    defaultLocale: string;
    launchDate: string;
    chats: ChatsConfig;
    timeouts: AutoinsideTimeouts;
    rateLimits: RateLimits;
    autoWish: boolean;
    persistedfolderpath: string;
    history: BotHistoryConfig;
    live: LiveConfig;
    reminders: RemindersConfig;
    funds: FundsConfig;
    debug: boolean;
    moderatedChats: number[];
    guess: GuessConfig;
    features: BotFeaturesConfig;
    outage: OutageConfig;
}

export interface BotHistoryConfig {
    commandsLimit: number;
    messagesLimit: number;
    summaryModel: string;
}

export interface BotApiConfig {
    port: number;
    static: string;
    features: ApiFeaturesConfig;
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

export interface RemindersConfig {
    utility: UtilityReminder;
    internet: UtilityReminder;
}

export interface OutageConfig {
    electricity: {
        endpoint: string;
        target: string;
        cron: string;
    };
}

export interface FundsConfig {
    alternativeUsernames: string[];
    sponsorship: {
        levels: SponsorshipLevelsConfig;
        period: number;
    };
}

export interface SponsorshipLevelsConfig {
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
}

export interface UtilityReminder {
    cron: string;
    message: string;
}

export interface GuessConfig {
    ignoreList: string[];
}

export interface BotFeaturesConfig {
    reminders: boolean;
    autoinside: boolean;
    outage: boolean;
    wednesday: boolean;
    birthday: boolean;
    welcome: boolean;
    reactions: boolean;
    ai: boolean;
    calendar: boolean;
    /** Welcome feature and bot admin rights in the chat are required for antispam */
    antispam: boolean;
    /** Integration with Yerevan Hacker Embassy infra and space-specific commands */
    embassy: boolean;
    /** Allows connecting chats to the admin-bot conversation */
    chatbridge: boolean;
    /** Keep message history */
    history: boolean;
}

export type BotFeatureFlag = keyof BotFeaturesConfig;

export interface ApiFeaturesConfig {
    calendar: boolean;
}

export interface CalendarConfig {
    url: string;
    ical: string;
    defaultRequestAmount: number;
}

export interface ChatsConfig {
    main: number;
    horny: number;
    offtopic: number;
    test: number;
    key: number;
    alerts: number;
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
    tgbot: TgBotConfig;
    devices: DevicesConfig;
    service: EmbassyServiceConfig;
    spacenetwork: SpaceNetworkConfig;
    mqtthost: string;
    hassorigin: string;
    speaker: SpeakerConfig;
    browser: BrowserConfig;
    cams: CamConfig;
    doorbell: DoorbellConfig;
    ledmatrix: LedMatrixConfig;
    alarm: AlarmConfig;
    climate: ClimateConfig;
    hostsToMonitor?: string[] | null;
}

export interface BrowserConfig {
    target: string;
    popuppath: string;
    closepath: string;
}

export interface TgBotConfig {
    username: string;
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
    localdns: string;
}

export interface SpaceNetworkConfig {
    deviceCheckingMethod: DeviceCheckingMethod;
    networkRange: string;
    routerip: string;
    wifiip: string;
    unifiorigin: string;
    prometheusorigin: string;
}

export interface DeviceCheckingMethod {
    primary: string;
    secondary?: string;
}

export interface SpeakerConfig {
    entity: string;
    ttspath: string;
    playpath: string;
    stoppath: string;
    voicepath: string;
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
    openwebui: OpenWebUIConfig;
    openai: OpenAiConfig;
}

export interface StableDiffusionConfig {
    base: string;
    steps?: number;
    denoising?: number;
    sampler?: string;
}
export interface OpenWebUIConfig {
    base: string;
    model: string;
}

export interface OpenAiConfig {
    model: string;
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
