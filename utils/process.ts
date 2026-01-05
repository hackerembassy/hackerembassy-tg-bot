import { execFile } from "child_process";

const ALLOWED_COMMANDS = ["ping", "arp"];
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

export function execCommand(command: string, params: string[], timeout: number = 5000): Promise<string> {
    if (!ALLOWED_COMMANDS.includes(command)) {
        throw new Error(`Command ${command} is not allowed`);
    }

    return new Promise((resolve, reject) => {
        execFile(
            command,
            params,
            {
                timeout,
                maxBuffer: MAX_BUFFER_SIZE,
            },
            (error, stdout) => {
                if (error) {
                    reject(new Error(error.message));
                    return;
                }
                resolve(stdout);
            }
        );
    });
}
