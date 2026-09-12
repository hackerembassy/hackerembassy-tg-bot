import type { Donation, Fund } from "@data/models";
import fundsRepository from "@data/repositories/funds";
import { TEST_USERS } from "@data/seed";

import { convertCurrency, prepareCurrency } from "@services/domain/funds/currency";
import { fundsService } from "@services/domain/funds";

describe("services/domain/funds FundsService money math", () => {
    describe("createFund", () => {
        afterEach(() => fundsRepository.removeFundByName("Money Math Create Fund"));

        it("persists a fund with the parsed target value and prepared currency", async () => {
            const fund = await fundsService.createFund("Money Math Create Fund", "1,500", "usd");

            expect(fund).toEqual({
                name: "Money Math Create Fund",
                target_value: 1500,
                target_currency: "usd",
                status: "open",
            });
            expect(fundsRepository.getFundByName("Money Math Create Fund")).toMatchObject({ target_value: 1500 });
        });

        it("returns undefined and creates nothing when the target amount doesn't parse", async () => {
            const fund = await fundsService.createFund("Money Math Create Fund", "not-a-number", "usd");

            expect(fund).toBeUndefined();
            expect(fundsRepository.getFundByName("Money Math Create Fund")).toBeUndefined();
        });

        it("returns undefined and creates nothing when the currency can't be prepared", async () => {
            jest.mocked(prepareCurrency).mockResolvedValueOnce(null);

            const fund = await fundsService.createFund("Money Math Create Fund", "500", "zzz");

            expect(fund).toBeUndefined();
            expect(fundsRepository.getFundByName("Money Math Create Fund")).toBeUndefined();
        });
    });

    describe("updateFundDetails", () => {
        let fund: Fund;

        beforeEach(() => {
            fundsRepository.addFund({
                name: "Money Math Update Fund",
                target_value: 100,
                target_currency: "USD",
                status: "open",
            });
            fund = fundsRepository.getFundByName("Money Math Update Fund")!;
        });

        afterEach(() => {
            fundsRepository.removeFundByName("Money Math Update Fund");
            fundsRepository.removeFundByName("Money Math Renamed Fund");
        });

        it("updates the parsed target value/currency and keeps the name when no rename is given", async () => {
            const updated = await fundsService.updateFundDetails(fund, "2000", "eur");

            expect(updated).toMatchObject({ name: "Money Math Update Fund", target_value: 2000, target_currency: "eur" });
            expect(fundsRepository.getFundById(fund.id)).toMatchObject({ target_value: 2000, target_currency: "eur" });
        });

        it("renames the fund when a new name is supplied", async () => {
            const updated = await fundsService.updateFundDetails(fund, "300", "usd", "Money Math Renamed Fund");

            expect(updated?.name).toBe("Money Math Renamed Fund");
            expect(fundsRepository.getFundById(fund.id)?.name).toBe("Money Math Renamed Fund");
        });

        it("returns undefined and leaves the fund untouched when the target amount doesn't parse", async () => {
            const updated = await fundsService.updateFundDetails(fund, "not-a-number", "usd");

            expect(updated).toBeUndefined();
            expect(fundsRepository.getFundById(fund.id)).toMatchObject({ target_value: 100, target_currency: "USD" });
        });
    });

    describe("applyDonationAmount", () => {
        let fund: Fund;
        let donation: Donation;

        beforeEach(() => {
            fundsRepository.addFund({
                name: "Money Math Donation Fund",
                target_value: 100,
                target_currency: "USD",
                status: "open",
            });
            fund = fundsRepository.getFundByName("Money Math Donation Fund")!;
            const donationId = fundsRepository.addDonationTo(
                fund.id,
                TEST_USERS.guest.userid,
                50,
                TEST_USERS.admin.userid,
                "USD"
            );
            donation = fundsRepository.getDonationById(Number(donationId))!;
        });

        afterEach(() => {
            fundsRepository.removeDonationById(donation.id);
            fundsRepository.removeFundByName("Money Math Donation Fund");
        });

        it("updates the parsed value/currency of an existing donation", async () => {
            const updated = await fundsService.applyDonationAmount(donation, "1,250.5", "eur");

            expect(updated).toMatchObject({ id: donation.id, value: 1250.5, currency: "eur" });
            expect(fundsRepository.getDonationById(donation.id)).toMatchObject({ value: 1250.5, currency: "eur" });
        });

        it("returns undefined and leaves the donation untouched when the value doesn't parse", async () => {
            const updated = await fundsService.applyDonationAmount(donation, "not-a-number", "usd");

            expect(updated).toBeUndefined();
            expect(fundsRepository.getDonationById(donation.id)).toMatchObject({ value: 50, currency: "USD" });
        });
    });

    describe("sumDonations", () => {
        it("returns 0 for an empty donation list", async () => {
            expect(await fundsService.sumDonations([])).toBe(0);
        });

        it("skips a donation whose conversion fails, keeping the running total", async () => {
            jest.mocked(convertCurrency)
                .mockResolvedValueOnce(100)
                // eslint-disable-next-line unicorn/no-useless-undefined -- mockResolvedValueOnce requires an explicit value
                .mockResolvedValueOnce(undefined);

            const total = await fundsService.sumDonations([
                { value: 100, currency: "USD" },
                { value: 45, currency: "XYZ" },
            ]);

            expect(total).toBe(100);
        });

        it("converts each donation into the requested target currency", async () => {
            await fundsService.sumDonations([{ value: 10, currency: "EUR" }], "USD");

            expect(convertCurrency).toHaveBeenCalledWith(10, "EUR", "USD");
        });
    });

    describe("getDebtSummary", () => {
        afterEach(() => fundsRepository.removeFundByName("Money Math Debt Fund"));

        it("returns a zero total when the accountant holds nothing", async () => {
            const summary = await fundsService.getDebtSummary(TEST_USERS.accountant.userid);

            expect(summary).toEqual({ donations: [], total: 0 });
        });

        it("sums the accountant's held donations across currencies", async () => {
            fundsRepository.addFund({ name: "Money Math Debt Fund", target_value: 100, target_currency: "USD", status: "open" });
            const fund = fundsRepository.getFundByName("Money Math Debt Fund")!;
            const id1 = fundsRepository.addDonationTo(fund.id, TEST_USERS.guest.userid, 100, TEST_USERS.accountant.userid, "USD");
            const id2 = fundsRepository.addDonationTo(fund.id, TEST_USERS.admin.userid, 50, TEST_USERS.accountant.userid, "EUR");

            const summary = await fundsService.getDebtSummary(TEST_USERS.accountant.userid);

            expect(summary.donations).toHaveLength(2);
            expect(summary.total).toBe(150);

            fundsRepository.removeDonationById(Number(id1));
            fundsRepository.removeDonationById(Number(id2));
        });
    });
});
