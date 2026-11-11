import { describe, expect, it } from "vitest";
import { dedupe, hardFilter } from "@/lib/filters";
import { haversineKm } from "@/lib/geo";
import { matchesAnyTerm } from "@/lib/sources/types";
import { htmlToText } from "@/lib/text";
import { job, prefs } from "./helpers";

describe("hardFilter", () => {
  it("keeps a job inside the travel radius", () => {
    expect(hardFilter(job(), prefs())).toBeNull();
  });

  it("drops a Swedish job outside every radius", () => {
    const gothenburg = job({ lat: 57.7089, lon: 11.9746, location: "Göteborg" });
    expect(hardFilter(gothenburg, prefs())).toBe("outside travel distance");
  });

  it("keeps a distant job flagged remote when remote is accepted, and drops it otherwise", () => {
    const remote = job({ lat: 57.7089, lon: 11.9746, remote: true });
    expect(hardFilter(remote, prefs())).toBeNull();
    expect(hardFilter(remote, prefs({ workModes: ["onsite", "hybrid"] }))).toBe("outside travel distance");
  });

  it("keeps everything in Sweden when no places are chosen", () => {
    expect(hardFilter(job({ lat: 65.58, lon: 22.15 }), prefs({ places: [] }))).toBeNull();
  });

  it("drops excluded companies regardless of legal suffix or case", () => {
    expect(hardFilter(job({ company: "ACME Sweden AB" }), prefs({ avoidCompanies: ["acme"] }))).toBe("company excluded");
  });

  it("drops unwanted working hours and contract types but keeps unknown ones", () => {
    expect(hardFilter(job({ workingHours: "part_time" }), prefs())).toMatch(/working hours/);
    expect(hardFilter(job({ contractType: "temporary" }), prefs({ contractTypes: ["permanent"] }))).toMatch(/contract/);
    expect(hardFilter(job({ workingHours: null, contractType: null }), prefs({ contractTypes: ["permanent"] }))).toBeNull();
  });

  it("only lets international jobs through when enabled, remote, and open to Sweden", () => {
    const intl = job({ region: "INTL", lat: null, lon: null, remote: true, eligibleRegions: "Europe, USA" });
    expect(hardFilter(intl, prefs())).toBe("international jobs disabled");
    const on = prefs({ includeInternationalRemote: true });
    expect(hardFilter(intl, on)).toBeNull();
    expect(hardFilter({ ...intl, eligibleRegions: "EMEA" }, on)).toBeNull();
    expect(hardFilter({ ...intl, eligibleRegions: "USA, Canada" }, on)).toBe("not open to candidates in Sweden");
    expect(hardFilter({ ...intl, eligibleRegions: null }, on)).toBe("not open to candidates in Sweden");
    expect(hardFilter({ ...intl, remote: false }, on)).toBe("international and not remote");
  });
});

describe("dedupe", () => {
  it("collapses the same posting from two sites", () => {
    const a = job({ source: "jobicy", externalId: "a", region: "INTL", title: "Senior Backend Developer", company: "Acme Inc" });
    const b = job({ source: "remotive", externalId: "b", region: "INTL", title: "senior backend developer ", company: "ACME" });
    expect(dedupe([a, b])).toEqual([a]);
  });

  it("keeps one employer's identical role in two towns", () => {
    const a = job({ externalId: "a", location: "Stockholm" });
    const b = job({ externalId: "b", location: "Uppsala" });
    expect(dedupe([a, b])).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("measures Stockholm to Uppsala as roughly 64 km", () => {
    expect(haversineKm(59.3293, 18.0686, 59.8586, 17.6389)).toBeGreaterThan(60);
    expect(haversineKm(59.3293, 18.0686, 59.8586, 17.6389)).toBeLessThan(68);
  });

  it("matches a feed title when every word of some term is present", () => {
    expect(matchesAnyTerm("Senior Backend Developer (Go)", ["backend developer"])).toBe(true);
    expect(matchesAnyTerm("Frontend Developer", ["backend developer", "systemutvecklare"])).toBe(false);
  });

  it("turns feed HTML into text", () => {
    expect(htmlToText("<p>Hi &amp; welcome</p><ul><li>One</li><li>Two&nbsp;x</li></ul>")).toBe("Hi & welcome\n- One\n- Two x");
  });
});
