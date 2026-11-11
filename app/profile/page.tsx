import { ArrowRight, Check, MapPin, X } from "lucide-react";
import Link from "next/link";
import { addPlace, removePlace, savePreferences, uploadCv } from "@/app/actions";
import { CvDropzone } from "@/components/CvDropzone";
import { Flash, one, type Search } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { effectiveFields, OCCUPATION_FIELDS } from "@/lib/fields";
import { providerLabel } from "@/lib/llm-provider";
import { getSettings } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SENIORITY: Record<string, string> = { student: "Student", junior: "Junior", mid: "Mid-level", senior: "Senior", lead: "Lead", executive: "Executive" };

function Chip({ name, value, label, checked }: { name: string; value?: string; label: string; checked: boolean }) {
  return (
    <label className="chip">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} />
      <Check size={14} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </label>
  );
}

function Steps({ current, done, locked }: { current: number; done: boolean[]; locked: boolean }) {
  const labels = ["Your CV", "Where", "Preferences"];
  return (
    <ol className="steps" aria-label="Setup steps">
      {labels.map((label, i) => {
        const n = i + 1;
        const cls = done[i] && n !== current ? "step step-done" : "step";
        const inner = (
          <>
            <span className="step-dot">{done[i] && n !== current ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : n}</span>
            {label}
          </>
        );
        return (
          <li key={label}>
            {locked && n > 1 ? (
              <span className={cls}>{inner}</span>
            ) : (
              <Link href={`/profile?step=${n}`} className={cls} aria-current={n === current ? "step" : undefined}>{inner}</Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const { profile, cvFilename, prefs } = await getSettings();
  const fields = effectiveFields(profile, prefs);
  const asked = Number(one(params.step));
  // The later steps build on what the CV says, so they open once it has been read.
  const step = !profile ? 1 : [1, 2, 3].includes(asked) ? asked : prefs.places.length === 0 ? 2 : 3;

  return (
    <>
      <Steps current={step} done={[Boolean(profile), prefs.places.length > 0, prefs.searchTerms.length > 0 && fields.length > 0]} locked={!profile} />
      <Flash ok={one(params.ok)} error={one(params.error)} />

      {step === 1 && (
        <div className="stack-lg">
          <div className="page-head">
            <div>
              <h1>{profile ? "Your CV" : "Let’s see what fits you"}</h1>
              <p className="lede">
                {profile
                  ? "This is what we read from your CV. Upload a newer one whenever it changes."
                  : "Start by sharing your CV. We read your experience, skills and level from it, so there are no long forms to fill in."}
              </p>
            </div>
          </div>

          {profile && (
            <section className="card stack-lg">
              <div className="stack">
                <p className="eyebrow">What we read{cvFilename ? ` from ${cvFilename}` : ""}</p>
                <h2>{profile.name}</h2>
                <p className="muted">{profile.headline}</p>
              </div>
              <dl className="facts">
                <div>
                  <dt>Level</dt>
                  <dd>{SENIORITY[profile.seniority] ?? profile.seniority}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>About {profile.yearsExperience} {profile.yearsExperience === 1 ? "year" : "years"}</dd>
                </div>
                <div>
                  <dt>Languages</dt>
                  <dd>{profile.languages.map((l) => `${l.language} (${l.level})`).join(", ") || "None listed"}</dd>
                </div>
              </dl>
              <p>{profile.summary}</p>
              <ul className="pills" aria-label="Skills">
                {profile.skills.map((s) => <li className="pill pill-plain" key={s}>{s}</li>)}
              </ul>
              <p className="hint">Your level is worked out from your CV, so there is nothing to set. If something looks wrong, update the CV and upload it again.</p>
              <div>
                <Link className="btn" href="/profile?step=2">Continue to places <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </section>
          )}
          <form action={uploadCv} className="stack">
            {profile && <h2>Upload a newer CV</h2>}
            <div style={{ width: "100%" }}>
              <CvDropzone hasCv={Boolean(profile)} />
            </div>
            <SubmitButton className="btn btn-primary" pendingText="Reading your CV…">{profile ? "Read the new CV" : "Read my CV"}</SubmitButton>
            <p className="hint">
              Your file is sent to {providerLabel()} to be read, and only the summary below is saved. The file itself is not kept.
            </p>
          </form>

        </div>
      )}

      {step === 2 && (
        <div className="stack-lg">
          <div className="page-head">
            <div>
              <h1>Where would you like to work?</h1>
              <p className="lede">Add each town with how far from it you are willing to travel. For “anything within 60 km of home”, add your home town with a 60 km radius.</p>
            </div>
          </div>

          <section className="card stack-lg" id="places">
            {prefs.places.length > 0 ? (
              <div className="chips" aria-label="Your places">
                {prefs.places.map((p) => (
                  <form action={removePlace} key={p.name} className="chip chip-static">
                    <MapPin size={14} aria-hidden="true" style={{ display: "block" }} />
                    {p.name} <span className="muted">within {p.radiusKm} km</span>
                    <input type="hidden" name="name" value={p.name} />
                    <button className="chip-remove" aria-label={`Remove ${p.name}`}><X size={14} aria-hidden="true" style={{ display: "block" }} /></button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="muted">No places yet. Until you add one, we look across all of Sweden.</p>
            )}

            <form action={addPlace} className="row" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label htmlFor="place">Town or city</label>
                <input id="place" type="text" name="place" placeholder="e.g. Örebro" required style={{ width: 260 }} />
              </div>
              <div className="field">
                <label htmlFor="radiusKm">Within (km)</label>
                <input id="radiusKm" type="number" name="radiusKm" defaultValue={30} min={1} max={500} className="input-narrow" />
              </div>
              <SubmitButton pendingText="Finding it…">Add place</SubmitButton>
            </form>
          </section>

          <div>
            <Link className="btn btn-primary" href="/profile?step=3">Continue to preferences <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="page-head">
            <div>
              <h1>What matters to you?</h1>
              <p className="lede">These shape which jobs we look for and how each one is scored. You can change them at any time.</p>
            </div>
          </div>

          <form action={savePreferences}>
            <section className="form-group">
              <h2>How you want to work</h2>
              <fieldset className="field">
                <legend>Way of working</legend>
                <div className="chips">
                  <Chip name="workModes" value="onsite" label="On site" checked={prefs.workModes.includes("onsite")} />
                  <Chip name="workModes" value="hybrid" label="Hybrid" checked={prefs.workModes.includes("hybrid")} />
                  <Chip name="workModes" value="remote" label="Remote" checked={prefs.workModes.includes("remote")} />
                </div>
                <p className="hint">With Remote chosen, remote jobs elsewhere in Sweden are included too.</p>
              </fieldset>
              <fieldset className="field">
                <legend>Hours</legend>
                <div className="chips">
                  <Chip name="workingHours" value="full_time" label="Full-time" checked={prefs.workingHours.includes("full_time")} />
                  <Chip name="workingHours" value="part_time" label="Part-time" checked={prefs.workingHours.includes("part_time")} />
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>Contract</legend>
                <div className="chips">
                  <Chip name="contractTypes" value="permanent" label="Permanent" checked={prefs.contractTypes.includes("permanent")} />
                  <Chip name="contractTypes" value="temporary" label="Temporary or fixed-term" checked={prefs.contractTypes.includes("temporary")} />
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>Jobs outside Sweden</legend>
                <div className="chips">
                  <Chip name="includeInternationalRemote" label="Include fully remote jobs abroad" checked={prefs.includeInternationalRemote} />
                </div>
                <p className="hint">Only jobs that are entirely remote and open to people living in Sweden.</p>
              </fieldset>
            </section>

            <section className="form-group" id="fields">
              <h2>What you are looking for</h2>
              <fieldset className="field">
                <legend>Fields of work</legend>
                <p className="hint">
                  Swedish jobs outside the fields you choose are left out.
                  {prefs.occupationFields === null && fields.length > 0 ? " These were suggested from your CV." : ""}
                  {fields.length === 0 ? " Nothing is chosen yet, so every field is included: pick yours to keep unrelated jobs away." : ""}
                </p>
                <div className="chips">
                  {OCCUPATION_FIELDS.map((f) => (
                    <Chip key={f.id} name="occupationFields" value={f.id} label={f.english} checked={fields.includes(f.id)} />
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="searchTerms">Job titles to look for</label>
                <textarea id="searchTerms" name="searchTerms" rows={6} defaultValue={prefs.searchTerms.join("\n")} />
                <p className="hint">One per line, in Swedish or English. We suggested these from your CV. Specific titles work best: a broad word like “analytiker” also matches other professions.</p>
              </div>
            </section>

            <section className="form-group">
              <h2>What to leave out</h2>
              <div className="field">
                <label htmlFor="avoidIndustries">Industries you would rather avoid</label>
                <textarea id="avoidIndustries" name="avoidIndustries" rows={3} defaultValue={prefs.avoidIndustries.join("\n")} placeholder="e.g. gambling" />
                <p className="hint">One per line. Jobs in these industries score low.</p>
              </div>
              <div className="field">
                <label htmlFor="avoidCompanies">Employers you do not want to see</label>
                <textarea id="avoidCompanies" name="avoidCompanies" rows={3} defaultValue={prefs.avoidCompanies.join("\n")} />
                <p className="hint">One per line. Their postings are never shown.</p>
              </div>
            </section>

            <section className="form-group">
              <h2>The finer points</h2>
              <div className="field">
                <label htmlFor="minSalarySek">Lowest monthly salary you would accept (SEK)</label>
                <input id="minSalarySek" type="number" name="minSalarySek" defaultValue={prefs.minSalarySek ?? ""} min={0} step={500} placeholder="e.g. 42000" style={{ width: 200 }} />
                <p className="hint">Most Swedish postings do not state a salary. When one does and it is lower than this, the score drops; the job is not hidden.</p>
              </div>
              <div className="field">
                <label htmlFor="notes">Anything else we should know</label>
                <textarea id="notes" name="notes" rows={4} defaultValue={prefs.notes} placeholder="e.g. I would like to move from consulting to a product company. No on-call. I need to get there by public transport." />
                <p className="hint">Written in your own words. It is taken into account when each job is scored.</p>
              </div>
              <div className="field">
                <label htmlFor="digestMinScore">Email me about matches scoring at least</label>
                <input id="digestMinScore" type="number" name="digestMinScore" defaultValue={prefs.digestMinScore} min={0} max={100} className="input-narrow" />
              </div>
            </section>

            <div className="form-actions">
              <SubmitButton className="btn btn-primary" pendingText="Saving…">Save preferences</SubmitButton>
              <Link href="/">See your matches</Link>
            </div>
          </form>
        </>
      )}
    </>
  );
}
