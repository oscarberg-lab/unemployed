import { describe, expect, it } from "vitest";
import { mapJobicy } from "@/lib/sources/jobicy";
import { mapJobTechHit } from "@/lib/sources/jobtech";
import { mapRemotive } from "@/lib/sources/remotive";

describe("source mapping", () => {
  it("maps a JobTech hit, swapping its [lon, lat] coordinates", () => {
    const mapped = mapJobTechHit(
      {
        id: "31715948",
        headline: "Full Stack utvecklare ",
        webpage_url: "https://arbetsformedlingen.se/platsbanken/annonser/31715948",
        description: { text: "Vi söker..." },
        employer: { name: "Exempel AB", workplace: "Exempel" },
        working_hours_type: { label: "Heltid" },
        duration: { label: "Tills vidare" },
        salary_description: null,
        application_deadline: "2026-12-18T23:59:59",
        publication_date: "2026-11-11T11:43:54",
        workplace_address: { municipality: "Stockholm", region: "Stockholms län", coordinates: [18.0599, 59.3302] },
        occupation: { label: "Fullstack-utvecklare" },
        occupation_field: { concept_id: "apaJ_2ja_LuF" },
      },
      false,
    );
    expect(mapped).toMatchObject({
      externalId: "31715948",
      title: "Full Stack utvecklare",
      company: "Exempel AB",
      region: "SE",
      location: "Stockholm, Stockholms län",
      lat: 59.3302,
      lon: 18.0599,
      workingHours: "full_time",
      contractType: "permanent",
      occupation: "Fullstack-utvecklare",
      occupationField: "apaJ_2ja_LuF",
    });
  });

  it("treats a fixed-term JobTech ad as temporary and tolerates missing fields", () => {
    const mapped = mapJobTechHit({ id: "2", headline: "Vikarie", webpage_url: null, duration: { label: "6 månader eller längre" } }, true);
    expect(mapped.contractType).toBe("temporary");
    expect(mapped.lat).toBeNull();
    expect(mapped.remote).toBe(true);
    expect(mapped.url).toContain("/annonser/2");
  });

  it("maps Jobicy and Remotive jobs as international remote", () => {
    const a = mapJobicy({ id: 1, url: "https://jobicy.com/jobs/1", jobTitle: "Data Engineer", companyName: "Co", jobType: ["Full-Time"], jobGeo: "Europe", jobDescription: "<p>Hello</p>", salaryMin: 50000, salaryMax: 70000, salaryCurrency: "EUR", salaryPeriod: "yearly" });
    expect(a).toMatchObject({ region: "INTL", remote: true, eligibleRegions: "Europe", workingHours: "full_time", description: "Hello", salary: "50000–70000 EUR yearly" });
    const b = mapRemotive({ id: 2, url: "https://remotive.com/x", title: "Dev", company_name: "Co", job_type: "contract", candidate_required_location: "Worldwide", salary: "" });
    expect(b).toMatchObject({ region: "INTL", remote: true, eligibleRegions: "Worldwide", contractType: "temporary", salary: null });
  });
});
