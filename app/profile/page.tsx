import { addPlace, removePlace, savePreferences, uploadCv } from "@/app/actions";
import { Flash, one, type Search } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function Check({ name, value, label, checked }: { name: string; value?: string; label: string; checked: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} /> {label}
    </label>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const { profile, cvFilename, prefs } = await getSettings();
  return (
    <>
      <h1>CV &amp; preferences</h1>
      <Flash ok={one(params.ok)} error={one(params.error)} />

      <section className="card">
        <h2>CV</h2>
        <form action={uploadCv} className="row">
          <input type="file" name="cv" accept=".pdf,.txt,.md,application/pdf,text/plain" required />
          <SubmitButton className="btn btn-primary" pendingText="Reading your CV…">{profile ? "Replace CV" : "Upload CV"}</SubmitButton>
        </form>
        <p className="meta">PDF or plain text. The file is sent to Claude to extract your profile; only the extracted profile is stored.</p>
        {profile && (
          <div className="profile">
            <p><strong>{profile.name}</strong> — {profile.headline} <span className="meta">(from {cvFilename})</span></p>
            <p>
              <span className="tag">{profile.seniority}</span> <span className="meta">about {profile.yearsExperience} years of experience. Seniority is read from the CV, so there is nothing to set.</span>
            </p>
            <p>{profile.summary}</p>
            <p className="chips">{profile.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</p>
            <p className="meta">Languages: {profile.languages.map((l) => `${l.language} (${l.level})`).join(", ") || "none listed"}</p>
          </div>
        )}
      </section>

      <section className="card" id="places">
        <h2>Where you want to work</h2>
        <p className="meta">Add each city with how far from it you are willing to travel. For “anything within 60 km of home”, add your home town with a 60 km radius.</p>
        {prefs.places.length > 0 && (
          <ul className="places">
            {prefs.places.map((p) => (
              <li key={p.name}>
                <span>{p.name} — within {p.radiusKm} km</span>
                <form action={removePlace}>
                  <input type="hidden" name="name" value={p.name} />
                  <button className="btn btn-small">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addPlace} className="row">
          <input type="text" name="place" placeholder="City, e.g. Uppsala" required aria-label="City" />
          <input type="number" name="radiusKm" defaultValue={30} min={1} max={500} aria-label="Radius in km" className="narrow" />
          <span className="meta">km</span>
          <SubmitButton pendingText="Looking up…">Add place</SubmitButton>
        </form>
      </section>

      <form action={savePreferences} className="card">
        <h2>Preferences</h2>

        <fieldset>
          <legend>Work mode</legend>
          <Check name="workModes" value="onsite" label="On location" checked={prefs.workModes.includes("onsite")} />
          <Check name="workModes" value="hybrid" label="Hybrid" checked={prefs.workModes.includes("hybrid")} />
          <Check name="workModes" value="remote" label="Remote (also includes remote jobs elsewhere in Sweden)" checked={prefs.workModes.includes("remote")} />
        </fieldset>

        <fieldset>
          <legend>Jobs outside Sweden</legend>
          <Check name="includeInternationalRemote" label="Include international jobs, only if strictly remote and open to people living in Sweden" checked={prefs.includeInternationalRemote} />
        </fieldset>

        <fieldset>
          <legend>Working hours</legend>
          <Check name="workingHours" value="full_time" label="Full-time" checked={prefs.workingHours.includes("full_time")} />
          <Check name="workingHours" value="part_time" label="Part-time" checked={prefs.workingHours.includes("part_time")} />
        </fieldset>

        <fieldset>
          <legend>Contract</legend>
          <Check name="contractTypes" value="permanent" label="Permanent" checked={prefs.contractTypes.includes("permanent")} />
          <Check name="contractTypes" value="temporary" label="Temporary / fixed-term" checked={prefs.contractTypes.includes("temporary")} />
        </fieldset>

        <label>
          Minimum monthly salary (SEK)
          <input type="number" name="minSalarySek" defaultValue={prefs.minSalarySek ?? ""} min={0} step={500} placeholder="e.g. 42000" />
          <span className="meta">Most Swedish postings do not state a salary, so this lowers the score when one is stated rather than hiding jobs.</span>
        </label>

        <label>
          Job titles to search for (one per line)
          <textarea name="searchTerms" rows={6} defaultValue={prefs.searchTerms.join("\n")} />
          <span className="meta">Suggested from your CV. Edit freely, in Swedish and English.</span>
        </label>

        <label>
          Industries to avoid (one per line)
          <textarea name="avoidIndustries" rows={3} defaultValue={prefs.avoidIndustries.join("\n")} placeholder="e.g. gambling" />
        </label>

        <label>
          Companies to exclude (one per line)
          <textarea name="avoidCompanies" rows={3} defaultValue={prefs.avoidCompanies.join("\n")} />
        </label>

        <label>
          Anything else the grading should know
          <textarea name="notes" rows={4} defaultValue={prefs.notes} placeholder="e.g. I want to move from consulting to a product company. No on-call. I need a workplace reachable by public transport." />
        </label>

        <label>
          Email me matches scoring at least
          <input type="number" name="digestMinScore" defaultValue={prefs.digestMinScore} min={0} max={100} className="narrow" />
        </label>

        <SubmitButton className="btn btn-primary" pendingText="Saving…">Save preferences</SubmitButton>
      </form>
    </>
  );
}
