// The public home page, ported from landing/public/index.html (which still
// serves ownergc.app until the domain moves to this app). The estimator here
// runs on the same tested cost model as /estimate and saved projects.
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_INPUTS, estimate, money, shortMoney } from "@/lib/estimator";
import { CostBar, Estimator, GROUP_COLORS } from "@/components/marketing/Estimator";
import { SiteFooter, TopNav, WaitlistLink } from "@/components/marketing/site";

const example = estimate(DEFAULT_INPUTS);

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <div className="hero-band">
        <div className="wrap">
          <TopNav home signedIn={!!user} />
          <header className="hero">
            <div>
              <div className="eyebrow">
                <i></i>Free estimator · No signup
              </div>
              <h1>
                What will your house <em>actually</em> cost to build?
              </h1>
              <p className="lead">
                Enter your plan&apos;s square footage and get a line-item budget, what you save as your own general contractor, and a
                phase-by-phase schedule.
              </p>
              <div className="cta-row">
                <a className="btn lg" href="#estimator">
                  Run my numbers{" "}
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </a>
                <WaitlistLink className="btn lg ghost">Join the waitlist</WaitlistLink>
              </div>
              <div className="trust">
                <span>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 8.5 3 3 7-7" />
                  </svg>
                  Lender-style line items
                </span>
                <span>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 8.5 3 3 7-7" />
                  </svg>
                  DIY savings built in
                </span>
                <span>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 8.5 3 3 7-7" />
                  </svg>
                  Build schedule
                </span>
              </div>
            </div>

            <div className="preview" aria-hidden="true">
              <div className="pcard">
                <div className="ph">
                  <b>Typical new home</b>
                  <small>{example.finishedSqft.toLocaleString("en-US")} sf</small>
                </div>
                <div className="pbig">{money(example.buildCost)}</div>
                <div className="plabel">Total build cost, before land</div>
                <CostBar groups={example.groups} className="pbar" />
                <div className="pkeys">
                  {example.groups.map((g) => (
                    <span key={g.group}>
                      <i style={{ background: GROUP_COLORS[g.group] }}></i>
                      {g.group}
                      <b>{shortMoney(g.cost)}</b>
                    </span>
                  ))}
                </div>
                <div className="pfoot">
                  <div>
                    <div className="k">You save</div>
                    <div className="v save">{shortMoney(example.savings.total)}</div>
                  </div>
                  <div>
                    <div className="k">Timeline</div>
                    <div className="v">{example.schedule.totalWeeks} wks</div>
                  </div>
                </div>
              </div>
              <div className="badge-float">
                <span className="dot">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 11 6 7l3 3 5-6" />
                    <path d="M10 4h4v4" />
                  </svg>
                </span>
                <span>
                  Acting as your own GC<b>save ~{Math.round(example.savings.shareOfBuilderPrice * 100)}%</b>
                </span>
              </div>
            </div>
          </header>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <p className="kicker">How it works</p>
            <h2>A real budget in under a minute</h2>
            <p className="sub">The same kind of line-item breakdown a construction lender asks for, without the spreadsheet.</p>
          </div>
          <div className="steps">
            <div>
              <h3>Enter your plan</h3>
              <p>Square footage for each floor, garage and bonus space, plus your finish level and region.</p>
            </div>
            <div>
              <h3>Pick what you&apos;ll DIY</h3>
              <p>Self-supply materials or take on framing, wiring, drywall or paint and watch the savings add up.</p>
            </div>
            <div>
              <h3>Get budget &amp; schedule</h3>
              <p>Every trade priced out with soft costs and contingency, plus how many weeks the build should take.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="estimator">
        <div className="wrap">
          <div className="sec-head">
            <p className="kicker">Free estimator</p>
            <h2>Your cost to build</h2>
            <p className="sub">Starts with a typical new US home: 2,150 sf over two floors with a two-car garage. Change anything and the numbers update instantly.</p>
          </div>
          <Estimator initial={DEFAULT_INPUTS} variant="landing" signedIn={!!user} />
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="sec-head">
            <p className="kicker">The full app</p>
            <h2>Run your build like a pro GC</h2>
            <p className="sub">
              From first estimate to certificate of occupancy, everything a lender, inspector and sub will ask you for, in one place.
            </p>
          </div>
          <div className="show">
            <div className="srow">
              <div className="stext">
                <p className="kicker">Budget vs. actual</p>
                <h3>See the overrun before it&apos;s a problem</h3>
                <p>
                  Every receipt lands on its budget line, so you always know what&apos;s spent, what&apos;s committed and what&apos;s left.
                </p>
                <ul>
                  <li>Snap a receipt at the lumber yard</li>
                  <li>Over-budget lines flagged automatically</li>
                  <li>Contingency tracked in real time</li>
                </ul>
              </div>
              <div className="stage" aria-hidden="true" style={{ paddingBottom: "64px" }}>
                <div className="win">
                  <div className="bar">
                    <i></i>
                    <i></i>
                    <i></i>
                    <span>Budget · Sample farmhouse</span>
                  </div>
                  <div className="body">
                    <div className="mh">
                      <b>Spent $312,480 of $585,900</b>
                      <small>53% · week 18</small>
                    </div>
                    <div className="bva">
                      <div>
                        <span className="nm">
                          Foundation &amp; flatwork<span className="tag ok">Done</span>
                        </span>
                        <span className="amt">$62,140 / $64,300</span>
                        <span className="track">
                          <i className="done" style={{ width: "97%" }}></i>
                        </span>
                      </div>
                      <div>
                        <span className="nm">Framing materials</span>
                        <span className="amt">$71,900 / $75,500</span>
                        <span className="track">
                          <i style={{ width: "95%" }}></i>
                        </span>
                      </div>
                      <div>
                        <span className="nm">
                          Framing labor<span className="tag warn">+8%</span>
                        </span>
                        <span className="amt over">$43,780 / $40,500</span>
                        <span className="track">
                          <i className="over" style={{ width: "100%" }}></i>
                        </span>
                      </div>
                      <div>
                        <span className="nm">Roofing</span>
                        <span className="amt">$18,200 / $28,900</span>
                        <span className="track">
                          <i style={{ width: "63%" }}></i>
                        </span>
                      </div>
                      <div>
                        <span className="nm">Plumbing rough-in</span>
                        <span className="amt">$14,500 / $40,500</span>
                        <span className="track">
                          <i style={{ width: "36%" }}></i>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="float-note">
                  <b>Framing labor is $3,280 over</b>Covered by contingency. $55,320 left.
                </div>
              </div>
            </div>

            <div className="srow flip">
              <div className="stext">
                <p className="kicker">Lender-ready draws</p>
                <h3>Draw requests your lender will actually approve</h3>
                <p>OwnerGC tells you when a draw is ready and packages the receipts, lien waivers and passed inspections behind it.</p>
                <ul>
                  <li>Matches your lender&apos;s draw schedule</li>
                  <li>Missing paperwork called out first</li>
                  <li>One clean PDF to send</li>
                </ul>
              </div>
              <div className="stage blue" aria-hidden="true">
                <div className="win">
                  <div className="bar">
                    <i></i>
                    <i></i>
                    <i></i>
                    <span>Draw #3 · Dried-in</span>
                  </div>
                  <div className="body draw">
                    <div>
                      <div className="ring">
                        <div>
                          62%<small>complete</small>
                        </div>
                      </div>
                      <div className="lbl" style={{ textAlign: "center" }}>
                        Requesting
                      </div>
                      <div className="big" style={{ textAlign: "center" }}>
                        $96,400
                      </div>
                      <span className="sendbtn">Send to lender</span>
                    </div>
                    <div>
                      <div className="mh">
                        <b>Checklist</b>
                        <small>5 of 6</small>
                      </div>
                      <ul>
                        <li>
                          <i></i>Framing inspection<span>passed</span>
                        </li>
                        <li>
                          <i></i>Roof sheathing<span>passed</span>
                        </li>
                        <li>
                          <i></i>14 receipts<span>$92.1k</span>
                        </li>
                        <li>
                          <i></i>Lien waiver, framer<span>signed</span>
                        </li>
                        <li>
                          <i></i>Site photos<span>8</span>
                        </li>
                        <li>
                          <i className="no"></i>Lien waiver, roofer<span>needed</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="srow">
              <div className="stext">
                <p className="kicker">Inspection checklist</p>
                <h3>Your whole build, in order, in your pocket</h3>
                <p>
                  Every phase and inspection in sequence, so nothing gets covered up before it&apos;s signed off. Built for the job site, on
                  your phone.
                </p>
                <ul>
                  <li>Know what&apos;s next and who to call</li>
                  <li>Photo log for every phase</li>
                  <li>Schedule updates as you go</li>
                </ul>
              </div>
              <div className="stage green" aria-hidden="true">
                <div className="phone-wrap">
                  <div className="side-card">
                    <div className="photo"></div>
                    <b>Framing walk-through</b>
                    <span style={{ color: "var(--muted)" }}>Photo log · 12 photos</span>
                  </div>
                  <div className="phone">
                    <div className="scr">
                      <div className="notch"></div>
                      <div className="ph-h">
                        <b>Build schedule</b>
                        <small>Week 18 of 40</small>
                      </div>
                      <div className="phase">
                        <i></i>
                        <div>
                          <b>Foundation</b>
                          <small>Footing &amp; wall inspections passed</small>
                        </div>
                      </div>
                      <div className="phase">
                        <i></i>
                        <div>
                          <b>Framing</b>
                          <small>Framing inspection passed</small>
                        </div>
                      </div>
                      <div className="phase cur">
                        <i className="now"></i>
                        <div>
                          <b>Rough-ins</b>
                          <small>Plumbing, HVAC, electrical</small>
                        </div>
                      </div>
                      <div className="phase">
                        <i className="next"></i>
                        <div>
                          <b>Insulation</b>
                          <small>Inspection before drywall</small>
                        </div>
                      </div>
                      <div className="phase">
                        <i className="next"></i>
                        <div>
                          <b>Drywall</b>
                          <small>Starts week 24</small>
                        </div>
                      </div>
                      <div className="tabbar">
                        <span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M9 4h6v3H9zM15 5.5h3v15H6v-15h3" />
                          </svg>
                          Schedule
                        </span>
                        <span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M4 20V10M10 20V4M16 20v-7" />
                          </svg>
                          Budget
                        </span>
                        <span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="6" width="18" height="13" rx="2" />
                            <circle cx="12" cy="12.5" r="3.5" />
                          </svg>
                          Photos
                        </span>
                        <span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          </svg>
                          Docs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="sec-head" style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "24px", margin: "0" }}>Plus everything else a GC keeps track of</h3>
          </div>
          <div className="feats small">
            <div>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="7" height="16" rx="1.5" />
                  <rect x="14" y="4" width="7" height="16" rx="1.5" />
                  <path d="m15.5 12 1.5 1.5 3-3" />
                </svg>
              </div>
              <h3>Sub bids</h3>
              <p>Compare bids side by side and award one; it becomes your committed cost.</p>
            </div>
            <div>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
              <h3>All your documents</h3>
              <p>Plans, permits, contracts, lien waivers and receipts in one place, on your phone at the site.</p>
            </div>
            <div>
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                  <path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2z" />
                </svg>
              </div>
              <h3>AI bid review</h3>
              <p>Upload a sub&apos;s bid and get flagged on missing scope before you sign.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: "0" }}>
        <div className="wrap story">
          <div>
            <blockquote>Lenders want a line-item budget, subs want a schedule, and spreadsheets weren&apos;t cutting it.</blockquote>
            <cite>Built by an owner-builder planning a self-contracted build in Idaho.</cite>
          </div>
          <div className="plans" aria-hidden="true">
            <svg viewBox="0 0 520 272" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <g opacity=".18" strokeWidth="1">
                <path d="M0 40h520M0 80h520M0 120h520M0 160h520M0 200h520M0 240h520M40 0v260M120 0v260M200 0v260M280 0v260M360 0v260M440 0v260" />
              </g>
              <g strokeWidth="2.2">
                <path d="M60 230V130l90-70 90 70v100z" />
                <path d="M240 230V150h200v80z" />
                <path d="M240 150l20-30h160l20 30" />
                <path d="M130 230v-55h40v55" />
                <rect x="85" y="140" width="30" height="30" />
                <rect x="185" y="140" width="30" height="30" />
                <path d="M270 230v-60h80v60M290 170v60M310 170v60M330 170v60" />
                <rect x="370" y="170" width="44" height="30" />
                <path d="M40 230h440" />
              </g>
              <g strokeWidth="1.4" opacity=".7" strokeDasharray="4 5">
                <path d="M60 248h380" />
                <path d="M60 242v12M440 242v12M240 242v12" />
              </g>
              <g fill="currentColor" stroke="none" fontFamily="JetBrains Mono,monospace" fontSize="12">
                <text x="128" y="262" opacity=".8">
                  MAIN 2,400 SF
                </text>
                <text x="300" y="262" opacity=".8">
                  GARAGE 900 SF
                </text>
              </g>
              <circle cx="150" cy="60" r="5" fill="#e8902a" stroke="none" />
            </svg>
          </div>
        </div>
      </section>

      <section id="join" style={{ paddingTop: "0" }}>
        <div className="wrap">
          <div className="join">
            <div>
              <p className="kicker" style={{ color: "var(--accent-2)" }}>
                Early access
              </p>
              <h2>Be first in when OwnerGC opens</h2>
              <p className="sub">The full app launches in spring 2027. Join the waitlist and lock in founding-member pricing.</p>
              <ul>
                <li>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10" cy="10" r="8" />
                    <path d="m6.5 10.2 2.3 2.3 4.7-4.7" />
                  </svg>
                  Founding members get a locked-in discount
                </li>
                <li>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10" cy="10" r="8" />
                    <path d="m6.5 10.2 2.3 2.3 4.7-4.7" />
                  </svg>
                  Help shape the features that ship first
                </li>
                <li>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10" cy="10" r="8" />
                    <path d="m6.5 10.2 2.3 2.3 4.7-4.7" />
                  </svg>
                  No spam; one email when it&apos;s ready
                </li>
              </ul>
            </div>
            <div className="cta">
              <div className="price">
                Estimator <b>Free</b> forever
              </div>
              <WaitlistLink className="btn lg">Join the waitlist</WaitlistLink>
              <p className="note">Takes 30 seconds. Opens a short form.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" style={{ paddingTop: "0" }}>
        <div className="wrap faq-grid">
          <div>
            <p className="kicker">FAQ</p>
            <h2>Questions</h2>
          </div>
          <div className="faq">
            <details open>
              <summary>How accurate is the estimate?</summary>
              <p>
                It&apos;s a planning number based on typical cost shares for each part of a build, adjusted for finish level and region.
                Real bids vary by area and season, so use it to plan, then confirm with local bids.
              </p>
            </details>
            <details>
              <summary>Is this for me if I&apos;m hiring a builder?</summary>
              <p>
                The estimator works for anyone. The full app is built for people acting as their own general contractor, and for small
                builders and investors running several builds.
              </p>
            </details>
            <details>
              <summary>What will it cost?</summary>
              <p>
                The estimator stays free. Full tracking is planned at about $24 a month during your build, with a discount for founding
                members.
              </p>
            </details>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
