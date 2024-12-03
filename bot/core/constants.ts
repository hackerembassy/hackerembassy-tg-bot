export const MAX_MESSAGE_LENGTH = 3500;
export const MAX_MESSAGE_LENGTH_WITH_TAGS = 3200;
export const MAX_MENTIONS_WITH_NOTIFICATIONS = 5;
export const IGNORE_UPDATE_TIMEOUT = 8; // Seconds from bot api
export const DEFAULT_TEMPORARY_MESSAGE_TIMEOUT = 8000; // Milliseconds
export const DEFAULT_CLEAR_QUEUE_TIMEOUT = 5000;
export const DEFAULT_CLEAR_QUEUE_LENGTH = 10;

export const RESTRICTED_PERMISSIONS = {
    can_send_messages: false,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
    can_manage_topics: false,
};

export const FULL_PERMISSIONS = Object.fromEntries(Object.keys(RESTRICTED_PERMISSIONS).map(key => [key, true]));
