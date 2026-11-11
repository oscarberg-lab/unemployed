/** Entry point for the scheduled run: `npm run daily`. */
import { runPipeline } from "../lib/pipeline";

runPipeline()
  .then((stats) => {
    console.log("Daily run finished:", JSON.stringify(stats, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Daily run failed:", err);
    process.exit(1);
  });
