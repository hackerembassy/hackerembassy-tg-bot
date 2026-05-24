export default class ChatBridge {
    private adminChatMap: Map<number, number> = new Map();
    private chatAdminMap: Map<number, number> = new Map();

    getLinkedChat(adminId: number): number | null {
        return this.adminChatMap.get(adminId) ?? null;
    }

    getLinkedAdmin(chatId: number): number | null {
        return this.chatAdminMap.get(chatId) ?? null;
    }

    link(chatId: number, adminId: number) {
        if (this.adminChatMap.has(adminId)) this.unlink(adminId);

        this.adminChatMap.set(adminId, chatId);
        this.chatAdminMap.set(chatId, adminId);
    }

    unlink(adminId: number) {
        const chatId = this.adminChatMap.get(adminId);
        if (chatId) {
            this.adminChatMap.delete(adminId);
            this.chatAdminMap.delete(chatId);
        }
    }
}
