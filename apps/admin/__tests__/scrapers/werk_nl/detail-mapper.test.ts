import { describe, test, expect } from "vitest";
import { mapDetail, isBemiddelaar } from "@/lib/scrapers/werk_nl/detail-mapper";
import { extractCompanyEvidence } from "@/lib/scrapers/werk_nl/company-evidence";
import type { WerknlDetail } from "@/lib/scrapers/werk_nl/detail-types";

const base: WerknlDetail = {
  referenceNumber: 37544818,
  title: "Technisch handige medewerker",
  description: "Lange tekst",
  expirationDate: "2026-07-03T00:00:00",
  modifiedDate: "2026-06-05T00:00:00",
  isAcquisitionNotAppreciated: true,
  isByEmployerDirectly: true,
  proposition: {
    function: { name: "Assemblagemedewerker", description: null, customDescription: null },
    salary: { type: 1, amountIndication: "2500 - 3500" },
    contract: { type: 1 },
    workhours: { minimumHours: 36, maximumHours: 40 },
    workLocation: { type: 2, city: "UTRECHT", postcode: "3572BB" },
  },
  contactPerson: { referenceNumber: 32609, name: "Dymph Herber", email: "info@urgent.nl", phoneNumber: "030-2316344", department: null },
  employer: { referenceNumber: 32609, organizationName: "Urgent Uitzendburo B.V.", website: "www.urgent-uitzendburo.nl", sector: "31317", addressNetherlands: { postcode: "3572BB", city: "UTRECHT", streetName: "Biltstraat", houseNumber: "16" } },
  cvOffer: { educationLevel: { name: "Vmbo" } },
};

describe("isBemiddelaar", () => {
  test("herkent uitzendbureau aan naam", () => {
    expect(isBemiddelaar("Urgent Uitzendburo B.V.", "www.urgent-uitzendburo.nl")).toBe(true);
    expect(isBemiddelaar("Tempo Team Detachering", null)).toBe(true);
    expect(isBemiddelaar("XYZ Payroll", null)).toBe(true);
  });
  test("eindwerkgever krijgt false", () => {
    expect(isBemiddelaar("Philips Electronics Nederland", "www.philips.nl")).toBe(false);
    expect(isBemiddelaar("Bakkerij De Korenbloem", null)).toBe(false);
  });
});

describe("mapDetail", () => {
  test("mapt jobPatch-detailvelden", () => {
    const m = mapDetail(base);
    expect(m.jobPatch.description).toBe("Lange tekst");
    expect(m.jobPatch.salary).toBe("2500 - 3500");
    expect(m.jobPatch.working_hours_min).toBe(36);
    expect(m.jobPatch.working_hours_max).toBe(40);
    expect(m.jobPatch.city).toBe("Utrecht");
    expect(m.jobPatch.location).toBe("Utrecht"); // nodig voor geocoding-worker
    expect(m.jobPatch.education_level).toBe("Vmbo");
    expect(m.jobPatch.acquisition_not_appreciated).toBe(true);
    expect(m.expiresAt).toBe("2026-07-03T00:00:00");
  });

  test("bouwt company met werknl_employer_id + bemiddelaar-tag", () => {
    const m = mapDetail(base);
    expect(m.company?.werknl_employer_id).toBe("32609");
    expect(m.company?.match_domains).toEqual(["urgent-uitzendburo.nl", "urgent.nl"]);
    expect(m.company?.name).toBe("Urgent Uitzendburo B.V.");
    expect(m.company?.is_bemiddelaar).toBe(true);
    expect(m.isBemiddelaar).toBe(true);
  });

  test("normaliseert employer.referenceNumber 0 naar werknl_employer_id null", () => {
    const m = mapDetail({
      ...base,
      employer: { ...base.employer!, referenceNumber: 0 },
    });

    expect(m.company?.werknl_employer_id).toBeNull();
  });

  test("slaat generieke employer website niet op als company website", () => {
    const m = mapDetail({
      ...base,
      employer: { ...base.employer!, referenceNumber: 0, website: "https://interlancing.foundub.nl" },
      contactPerson: { ...base.contactPerson!, email: "inhuur@eindhoven.nl" },
      applicationMethods: [{ urlApplicationForm: "https://interlancing.foundub.nl/vacature/32826" }],
    });

    expect(m.company?.website).toBeNull();
    expect(m.company?.match_domains).toEqual(["eindhoven.nl"]);
  });

  test("description valt terug naar proposition.function.description als top-level description leeg is", () => {
    const m = mapDetail({
      ...base,
      description: "   ",
      proposition: {
        ...base.proposition,
        function: {
          ...base.proposition!.function,
          description: "Fallback functieomschrijving",
        },
      },
    });

    expect(m.jobPatch.description).toBe("Fallback functieomschrijving");
  });

  test("bouwt contact uit contactPerson", () => {
    const m = mapDetail(base);
    expect(m.contact?.name).toBe("Dymph Herber");
    expect(m.contact?.email).toBe("info@urgent.nl");
    expect(m.contact?.phone).toBe("030-2316344");
  });

  test("geen employer -> company null; geen contactPerson -> contact null", () => {
    const m = mapDetail({ ...base, employer: null, contactPerson: null });
    expect(m.company).toBeNull();
    expect(m.contact).toBeNull();
  });

  test("ontbrekende vervaldatum -> expiresAt null", () => {
    const m = mapDetail({ ...base, expirationDate: null });
    expect(m.expiresAt).toBeNull();
  });
});

describe("extractCompanyEvidence", () => {
  test.each([
    "https://www.nationalevacaturebank.nl/vacature/123",
    "https://www.uitzendbureau.nl/vacature/techniek",
    "https://multiposter.nl/apply/abc",
    "https://easyapply.jobs/apply/abc",
  ])("gebruikt generic application-domain %s niet als betrouwbare company domain als employer website bestaat", (applicationUrl) => {
    const evidence = extractCompanyEvidence({
      ...base,
      employer: { ...base.employer!, website: "https://www.echtewerkgever.nl" },
      contactPerson: { ...base.contactPerson!, email: null },
      applicationMethods: [{ urlApplicationForm: applicationUrl }],
    });

    expect(evidence.trustedDomains).toEqual(["echtewerkgever.nl"]);
  });

  test.each([
    "https://www.nationalevacaturebank.nl/vacature/123",
    "https://www.uitzendbureau.nl/vacature/techniek",
    "https://multiposter.nl/apply/abc",
    "https://easyapply.jobs/apply/abc",
  ])("gebruikt e-maildomain boven generic application-domain %s", (applicationUrl) => {
    const evidence = extractCompanyEvidence({
      ...base,
      employer: { ...base.employer!, website: null },
      contactPerson: { ...base.contactPerson!, email: "hr@echtewerkgever.nl" },
      applicationMethods: [{ urlApplicationForm: applicationUrl }],
    });

    expect(evidence.trustedDomains).toEqual(["echtewerkgever.nl"]);
  });
});
