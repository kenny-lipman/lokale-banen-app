import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  parseDetailHtml,
  JobPostingValidationError,
} from "@/lib/scrapers/werkenindekempen/detail-parser";

const fix = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

describe("parseDetailHtml", () => {
  test("rich fixture: alle hoofdvelden gevuld", () => {
    const jp = parseDetailHtml(fix("rich.html"), "https://example/rich");
    expect(jp.title).toBeTruthy();
    expect(jp.hiringOrganization.name).toBeTruthy();
    expect(jp.jobLocation.address.addressLocality).toBeTruthy();
    expect(jp.baseSalary).toBeDefined();
    expect(jp.baseSalary?.value).toBeDefined();
    expect(jp.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test("rich fixture: baseSalary heeft min en max", () => {
    const jp = parseDetailHtml(fix("rich.html"), "https://example/rich");
    const sal = jp.baseSalary?.value?.value;
    expect(typeof sal === "string" || typeof sal === "number").toBe(true);
  });

  test("sparse fixture: optionele velden afwezig, geen error", () => {
    const jp = parseDetailHtml(fix("sparse.html"), "https://example/sparse");
    expect(jp.title).toBeTruthy();
    expect(jp.hiringOrganization.name).toBeTruthy();
    expect(jp.baseSalary).toBeUndefined();
  });

  test("invalid fixture: throws ValidationError op missing required field", () => {
    expect(() =>
      parseDetailHtml(fix("invalid.html"), "https://example/invalid")
    ).toThrow(JobPostingValidationError);
  });

  test("HTML zonder JSON-LD: throws met duidelijke reason", () => {
    expect(() =>
      parseDetailHtml(
        "<html><body>No JSON-LD here</body></html>",
        "https://example/empty"
      )
    ).toThrow(/no JobPosting JSON-LD found/);
  });

  test("multiple JSON-LD blocks: vindt de JobPosting", () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization","name":"Test"}</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Foo Bar","datePosted":"2026-05-12","hiringOrganization":{"name":"Org"},"jobLocation":{"address":{"addressLocality":"Eindhoven"}}}</script>
    `;
    const jp = parseDetailHtml(html, "https://example/multi");
    expect(jp.title).toBe("Foo Bar");
  });
});
