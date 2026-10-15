import styles from "./page.module.css";

const regions = [
  {
    id: "plan",
    title: "Plan",
    body: "Describe the inspection in plain language. A draft mission appears here.",
  },
  {
    id: "review",
    title: "Review",
    body: "Validator findings and the approval diff appear here before anything flies.",
  },
  {
    id: "fly",
    title: "Fly",
    body: "Replayed telemetry and map playback appear here once a mission is approved.",
  },
  {
    id: "report",
    title: "Report",
    body: "The evidence-linked mission report appears here after playback.",
  },
] as const;

export default function Home() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#plan">
        Skip to mission planner
      </a>
      <header className={styles.header}>
        <h1 className={styles.productName}>DroneOS Mission Copilot</h1>
        {/* ponytail: mode badge slot; WAVE-02+ renders a real LIVE/REPLAY badge here */}
        <span className={styles.modeBadge} data-slot="mode-badge" />
      </header>
      <main className={styles.main}>
        <div className={styles.map} data-slot="map">
          Map
        </div>
        <div className={styles.panels}>
          {regions.map((region) => (
            <section
              key={region.id}
              id={region.id}
              className={styles.panel}
              aria-labelledby={`${region.id}-heading`}
            >
              <h2 id={`${region.id}-heading`} className={styles.panelTitle}>
                {region.title}
              </h2>
              <p className={styles.panelBody}>{region.body}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className={styles.footer}>
        <p>Simulation only. LLM drafts, validator checks, you approve.</p>
      </footer>
    </div>
  );
}
