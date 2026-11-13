import FileIdCache from "@hackembot/core/classes/FileIdCache";

describe("FileIdCache", () => {
    test("evicts least recently used entries beyond max size, reads refresh recency", () => {
        const cache = new FileIdCache({ a: "1", b: "2" }, 2);

        cache.get("a");
        cache.set("c", "3");

        expect(cache.toJSON()).toEqual({ a: "1", c: "3" });
    });

    test("trims persisted entries that exceed max size on load", () => {
        const cache = new FileIdCache({ a: "1", b: "2", c: "3" }, 2);

        expect(cache.toJSON()).toEqual({ b: "2", c: "3" });
    });

    test("set with replacePrefix drops older entries of the same family only", () => {
        const cache = new FileIdCache({ "donut:1:old": "x", "donut:10:other": "y", "donut:2:keep": "z" });

        cache.set("donut:1:new", "n", "donut:1:");

        expect(cache.toJSON()).toEqual({ "donut:10:other": "y", "donut:2:keep": "z", "donut:1:new": "n" });
    });

    test("notifies about writes but not reads", () => {
        const onChange = jest.fn();
        const cache = new FileIdCache({}, 10, onChange);

        cache.set("a", "1");
        cache.get("a");

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
