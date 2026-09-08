import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { getDb } from "./config/firebase.js";
import { seedRoles } from "./authorization/roleSeeder.js";

async function main() {
  getDb(); // fail fast if Firebase Admin credentials are misconfigured

  console.log(`Seeding system role definitions (project ${env.firebaseProjectId})...`);
  await seedRoles();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`BetterPlacemaking Express API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
