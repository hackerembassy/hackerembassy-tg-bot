import { execCommand } from "@utils/process";

describe("utils/process", () => {
    describe("execCommand", () => {
        it("rejects commands outside the allowlist before running anything", () => {
            expect(() => execCommand("rm", ["-rf", "/"])).toThrow("Command rm is not allowed");
        });
    });
});
