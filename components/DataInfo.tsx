"use client"
import { useRef } from 'react'

export default function DataInfo() {
  const dialog = useRef<HTMLDialogElement>(null)
  return <>
    <nav className="header-nav" aria-label="Information">
      <button onClick={() => dialog.current?.showModal()}>About & data</button>
    </nav>
    <dialog ref={dialog} className="data-dialog" aria-label="About TIV Archive" onClick={e => { if (e.target === dialog.current) dialog.current.close() }}>
      <div className="about-bar">
        <span className="about-label"><i aria-hidden="true" /> FIELD NOTES / TIV ARCHIVE</span>
        <button className="about-close" aria-label="Close data information" onClick={() => dialog.current?.close()}>Close <span aria-hidden="true">×</span></button>
      </div>
      <div className="about-exhibit">
        <section className="about-origin" aria-labelledby="origin-title">
          <div className="about-section-heading">
            <h3 id="origin-title">Why I made this!</h3>
          </div>
          <div className="about-story">
            <p>growing up, I was fascinated by the weather system—especially tornadoes. i watched Sean Casey’s storm chasing documentaries and wanted to film some of my own! his Tornado Intercept Vehicle (TIV), a heavily armored vehicle he built to get close enough to tornadoes to film them, was insanely cool to me and naturally, i wanted one of my own. so my friend and i built a prototype in my basement out of three huge cardboard boxes, whatever tools we could find in my dad’s garage, and, crucially, my Nintendo Wii wheel from Mario Kart. i was convinced i’d grow up and film tornadoes myself someday and it felt pretty close to the real thing in my basement that summer.</p>
            <p><strong>TIV Archive</strong> is a small tribute to that childhood obsession—an interactive archive for exploring the history of U.S. tornadoes. search anywhere in the country, explore tornadoes recorded nearby, inspect their paths and intensity, and move through decades of tornado history using data from NOAA/SPC.</p>
            <p>in a way this is a pretty similar project, just with considerably less cardboard.</p>
            <p><a className="about-resource-link" href="https://stormofpassion.com/history/" target="_blank" rel="noopener noreferrer">The Original TIV <span aria-hidden="true">↗</span><span className="about-sr-only"> (opens in a new tab)</span></a></p>
          </div>
        </section>

        <section className="about-archive" aria-labelledby="archive-title">
          <div>
            <p className="about-label">THE ARCHIVE</p>
            <h3 id="archive-title">Explore decades of U.S. tornado history.</h3>
            <p>Search anywhere in the country, explore tornadoes recorded nearby, inspect their paths, EF/F ratings, and casualties, replay a path, and move through decades of tornado history with the timeline.</p>
          </div>
          <dl className="about-facts">
            <div><dt>SOURCE DATA</dt><dd>NOAA / SPC</dd></div>
            <div><dt>DAMAGE RATINGS</dt><dd>F / EF 0–5</dd></div>
            <div><dt>HISTORY MODE</dt><dd>Through the years</dd></div>
          </dl>
        </section>

        <div className="about-documentation">
          <section aria-labelledby="reading-title">
            <h3 id="reading-title" className="about-label">READING THE RECORDS</h3>
            <p>The 0–5 ratings describe assessed tornado damage intensity. Older records use the Fujita scale; the Enhanced Fujita scale has been used since February 2007. The interface groups both under EF rating filters. Unknown ratings remain separate.</p>
            <p>Path length is the recorded track length, displayed in kilometers. For verified source matches, SPC’s miles are converted to kilometers. Path replay interpolates recorded coordinates; it does not reproduce measured timing or storm speed.</p>
          </section>
          <section aria-labelledby="coverage-title">
            <h3 id="coverage-title" className="about-label">COVERAGE & LIMITATIONS</h3>
            <p>Verified duplicate imports are counted once. Records that cannot be matched unambiguously to the source remain separate. Location search returns at most 200 records; natural-language search may return up to 500. Timeline counts and activity bars describe that loaded set, not nationwide totals.</p>
            <p>State names come from matched source records. City and county names are not available. Ambiguous event dates remain unknown and those records stay visible during playback. Some tracks have missing endpoints. Missing casualty values are not treated as zero.</p>
          </section>
        </div>

        <footer className="about-resources">
          <p className="about-label">SOURCE MATERIAL</p>
          <div>
            <a href="https://www.spc.noaa.gov/wcm/#data" target="_blank" rel="noreferrer">NOAA/SPC source data <span aria-hidden="true">↗</span><span className="about-sr-only"> (opens in a new tab)</span></a>
            <a href="https://www.spc.noaa.gov/faq/tornado/" target="_blank" rel="noreferrer">Tornado ratings explained <span aria-hidden="true">↗</span><span className="about-sr-only"> (opens in a new tab)</span></a>
          </div>
        </footer>
      </div>
    </dialog>
  </>
}
