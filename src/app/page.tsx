import { MissionApp } from "@/components/MissionApp";
import { DEFAULT_TILE_URL } from "@/lib/env";
import { listScenarios } from "@/lib/scenarios";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#plan">
        Skip to mission planner
      </a>
      <header className={styles.header}>
        <h1 className={styles.productName}>DroneOS Mission Copilot</h1>
      </header>
      <main className={styles.main}>
        <MissionApp
          scenarios={listScenarios()}
          tileUrl={process.env.NEXT_PUBLIC_TILE_URL ?? DEFAULT_TILE_URL}
        />
      </main>
      <footer className={styles.footer}>
        <p>Simulation only. LLM drafts, validator checks, you approve.</p>
      </footer>
    </div>
  );
}
