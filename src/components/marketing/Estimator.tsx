"use client";
// The free cost estimator. Everything is worked out in the browser by the
// tested cost model in src/lib/estimator, so nothing is sent anywhere until
// the person chooses to save it to their account.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AREA_LABELS,
  COST_GROUPS,
  DIY_OPTIONS,
  FINISH_LEVELS,
  REGIONS,
  estimate,
  inputsToSearchParams,
  money,
  parseEstimateInputs,
  percent,
  shortMoney,
  type AreaKey,
  type CostGroup,
  type DiyKey,
  type EstimateInputs,
  type FinishLevel,
  type Region,
} from "@/lib/estimator";
import { saveEstimate } from "@/app/(marketing)/estimate/actions";
import { WaitlistLink } from "./site";

export const GROUP_COLORS: Record<CostGroup, string> = {
  "Site & structure": "var(--c1)",
  Envelope: "var(--c2)",
  Systems: "var(--c3)",
  Interior: "var(--c4)",
  "Soft costs": "var(--c5)",
};

type Form = {
  sqft: Record<AreaKey, string>;
  finish: FinishLevel;
  region: Region;
  land: string;
  utilities: string;
  diy: Record<DiyKey, boolean>;
};

const toForm = (i: EstimateInputs): Form => ({
  sqft: Object.fromEntries(Object.entries(i.sqft).map(([k, v]) => [k, String(v)])) as Record<AreaKey, string>,
  finish: i.finish,
  region: i.region,
  land: String(i.land),
  utilities: String(i.utilities),
  diy: { ...i.diy },
});

type Props = {
  initial: EstimateInputs;
  /** "landing" is the compact version on the home page; "full" adds schedule, subs, draws and saving. */
  variant: "landing" | "full";
  signedIn?: boolean;
  /** When editing a saved project's estimate. */
  project?: { id: string; name: string };
};

export function Estimator({ initial, variant, signedIn = false, project }: Props) {
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const inputs = useMemo(() => parseEstimateInputs(form), [form]);
  const e = useMemo(() => estimate(inputs), [inputs]);
  const link = `/estimate?${inputsToSearchParams(inputs)}`;

  // On the estimator page, keep the address bar in step with the inputs so a
  // refresh, a shared link or a trip through sign-in keeps the numbers.
  useEffect(() => {
    if (variant !== "full") return;
    const p = inputsToSearchParams(inputs);
    if (project) p.set("project", project.id);
    window.history.replaceState(null, "", `/estimate?${p}`);
  }, [inputs, variant, project]);

  const setSqft = (k: AreaKey, v: string) => setForm((f) => ({ ...f, sqft: { ...f.sqft, [k]: v } }));
  const setDiy = (k: DiyKey, v: boolean) => setForm((f) => ({ ...f, diy: { ...f.diy, [k]: v } }));

  const groupRows: { group: CostGroup; rows: typeof e.lines }[] = COST_GROUPS.map((group) => ({
    group,
    rows: [...e.lines, ...e.softCosts].filter((l) => l.group === group),
  }));

  return (
    <div className="tool">
      <div className="panel inputs">
        <fieldset>
          <legend>Square footage</legend>
          {(Object.keys(AREA_LABELS) as AreaKey[]).map((k) => (
            <div className="row" key={k}>
              <label htmlFor={`sf-${k}`}>
                {AREA_LABELS[k].label} {AREA_LABELS[k].note && <small>{AREA_LABELS[k].note}</small>}
              </label>
              <input
                id={`sf-${k}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={form.sqft[k]}
                onChange={(ev) => setSqft(k, ev.target.value)}
              />
            </div>
          ))}
        </fieldset>
        <fieldset>
          <legend>Market &amp; finishes</legend>
          <div className="row">
            <label htmlFor="finish">Finish level</label>
            <select id="finish" value={form.finish} onChange={(ev) => setForm((f) => ({ ...f, finish: ev.target.value as FinishLevel }))}>
              {(Object.keys(FINISH_LEVELS) as FinishLevel[]).map((k) => (
                <option key={k} value={k}>
                  {FINISH_LEVELS[k].label}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label htmlFor="region">Region cost</label>
            <select id="region" value={form.region} onChange={(ev) => setForm((f) => ({ ...f, region: ev.target.value as Region }))}>
              {(Object.keys(REGIONS) as Region[]).map((k) => (
                <option key={k} value={k}>
                  {REGIONS[k].label}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label htmlFor="land">Land</label>
            <input
              id="land"
              type="number"
              inputMode="numeric"
              min={0}
              step={5000}
              value={form.land}
              onChange={(ev) => setForm((f) => ({ ...f, land: ev.target.value }))}
            />
          </div>
          <div className="row">
            <label htmlFor="util">Well, septic &amp; hookups</label>
            <input
              id="util"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={form.utilities}
              onChange={(ev) => setForm((f) => ({ ...f, utilities: ev.target.value }))}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>What you&apos;ll do yourself</legend>
          {(Object.keys(DIY_OPTIONS) as DiyKey[]).map((k) => {
            const opt: { label: string; note?: string } = DIY_OPTIONS[k];
            return (
              <label className="toggle" key={k}>
                <input type="checkbox" checked={form.diy[k]} onChange={(ev) => setDiy(k, ev.target.checked)} />
                <span>
                  {opt.label}
                  {opt.note && (
                    <small>{opt.note}</small>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="note">Planning-grade estimates based on national averages. Get real bids before you lock a loan amount.</p>
      </div>

      <div>
        <div className="summary">
          <div className="hl">
            <div className="k">All-in cost</div>
            <div className="v total">{shortMoney(e.allIn)}</div>
            <div className="k2">land + build</div>
          </div>
          <div>
            <div className="k">Build cost</div>
            <div className="v">{shortMoney(e.buildCost)}</div>
            <div className="k2">{e.costPerFinishedSqft === null ? "–" : `${money(e.costPerFinishedSqft)} per finished sf`}</div>
          </div>
          <div>
            <div className="k">You save</div>
            <div className="v save">{shortMoney(e.savings.total)}</div>
            <div className="k2">vs. hiring a builder</div>
          </div>
          <div>
            <div className="k">Timeline</div>
            <div className="v">{e.schedule.totalWeeks} wks</div>
            <div className="k2">about {e.schedule.months} months</div>
          </div>
        </div>
        <p className="note" style={{ margin: "0 0 16px" }}>
          Totals include site work, permits, well and septic, and a 10% contingency, not just the house itself.
        </p>

        <div className="panel breakdown">
          <div className="k">Where the money goes</div>
          <CostBar groups={e.groups} className="bar" />
          <div className="legend">
            {e.groups.map((g) => (
              <span key={g.group}>
                <i style={{ background: GROUP_COLORS[g.group] }} />
                {g.group} <b>{percent(g.share)}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="panel">
          <details open>
            <summary>Line-item budget</summary>
            <div className="tbl">
              <table>
                <thead>
                  <tr>
                    <th>Div</th>
                    <th>Item</th>
                    <th style={{ textAlign: "right" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map(({ group, rows }) => [
                    <tr className="grp" key={group} style={{ "--gc": GROUP_COLORS[group] } as React.CSSProperties}>
                      <td colSpan={3}>{group}</td>
                    </tr>,
                    ...rows.map((l) => (
                      <tr key={l.key}>
                        <td className="div">{l.division}</td>
                        <td>
                          {l.name}
                          {l.tag && <span className="chip">{l.tag === "diy" ? "DIY" : "Self-supply"}</span>}
                        </td>
                        <td className="n">
                          {money(l.cost)}
                          {l.saved > 0 && <span className="saved">−{money(l.saved)}</span>}
                        </td>
                      </tr>
                    )),
                  ])}
                  <tr className="tot">
                    <td></td>
                    <td>Total build cost</td>
                    <td className="n">{money(e.buildCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>

        {variant === "full" && (
          <>
            <div className="panel">
              <h3>Build schedule</h3>
              <p className="psub">Phases in order. DIY phases run longer because they happen on evenings and weekends.</p>
              <div className="gantt">
                {e.schedule.phases.map((p) => (
                  <div className="g-row" key={p.key}>
                    <span>{p.name}</span>
                    <div className="g-track">
                      <div
                        className={`g-bar${p.diy ? " diy" : ""}`}
                        style={{
                          left: `${(p.startWeek / e.schedule.totalWeeks) * 100}%`,
                          width: `${(p.weeks / e.schedule.totalWeeks) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="g-wk">{p.weeks} wk</span>
                  </div>
                ))}
              </div>
              <div className="g-legend">
                <span>
                  <i style={{ background: "var(--c2)" }} />
                  Subcontractor
                </span>
                <span>
                  <i style={{ background: "var(--good)" }} />
                  You
                </span>
              </div>
            </div>

            <div className="panel">
              <h3>Subs to line up</h3>
              <p className="psub">Get at least three bids for each. Dashed trades are ones you&apos;re doing yourself.</p>
              <ul className="subs">
                {e.subs.map((s) => (
                  <li key={s.key} className={s.doingItYourself ? "diy" : undefined}>
                    {s.trade}
                    {s.doingItYourself && " · DIY"}
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel">
              <h3>Construction loan draws</h3>
              <p className="psub">A typical five-draw schedule. Your lender&apos;s may differ.</p>
              <div className="draws">
                {e.draws.map((d) => (
                  <div key={d.number}>
                    <b>
                      Draw {d.number} · {percent(d.share)}
                    </b>
                    <div className="amt">{money(d.amount)}</div>
                    <p>
                      {d.name}: {d.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="inline-cta">
          {variant === "landing" ? (
            <>
              <p>
                <b>See your schedule and save this budget.</b>Open it in the full estimator for a phase-by-phase schedule, the subs to line
                up, and a free account to keep it.
              </p>
              <div className="links">
                <Link className="btn" href={link}>
                  Schedule &amp; save
                </Link>
                <WaitlistLink className="small-link">or join the waitlist</WaitlistLink>
              </div>
            </>
          ) : signedIn ? (
            <form action={saveEstimate} className="save-form" style={{ width: "100%" }}>
              <p style={{ flexBasis: "100%" }}>
                <b>{project ? "Update your project" : "Save this as a project"}</b>
                {project
                  ? "Saves these numbers over the project's current estimate."
                  : "Keep this estimate in your account and come back to it any time."}
              </p>
              <input type="hidden" name="inputs" value={JSON.stringify(inputs)} />
              {project && <input type="hidden" name="projectId" value={project.id} />}
              <input
                type="text"
                name="name"
                aria-label="Project name"
                maxLength={200}
                defaultValue={project?.name ?? ""}
                placeholder="Project name, e.g. Lake house"
              />
              <button className="btn" type="submit">
                {project ? "Save changes" : "Save project"}
              </button>
            </form>
          ) : (
            <>
              <p>
                <b>Save this estimate.</b>Create a free account to keep it as a project. Tracking spending, bids and draws against it is
                coming soon.
              </p>
              <Link className="btn" href={`/login?next=${encodeURIComponent(link)}`}>
                Sign in to save
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CostBar({ groups, className }: { groups: { group: CostGroup; cost: number }[]; className: string }) {
  return (
    <div className={className}>
      {groups.map((g) => (
        <i key={g.group} title={g.group} style={{ flexGrow: Math.round(g.cost), background: GROUP_COLORS[g.group] }} />
      ))}
    </div>
  );
}
