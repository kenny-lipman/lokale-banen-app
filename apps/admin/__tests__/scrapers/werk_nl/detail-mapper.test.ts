import { describe, test, expect } from "vitest";
import { mapDetail, isBemiddelaar } from "@/lib/scrapers/werk_nl/detail-mapper";
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
    expect(m.jobPatch.education_level).toBe("Vmbo");
    expect(m.jobPatch.acquisition_not_appreciated).toBe(true);
    expect(m.expiresAt).toBe("2026-07-03T00:00:00");
  });

  test("bouwt company met werknl_employer_id + bemiddelaar-tag", () => {
    const m = mapDetail(base);
    expect(m.company?.werknl_employer_id).toBe("32609");
    expect(m.company?.name).toBe("Urgent Uitzendburo B.V.");
    expect(m.company?.is_bemiddelaar).toBe(true);
    expect(m.isBemiddelaar).toBe(true);
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
