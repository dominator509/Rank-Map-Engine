import { defineConfig } from "drizzle-kit";

const isGeneratingMigrations = process.argv.includes("generate");

if (!process.env.DATABASE_URL && !isGeneratingMigrations) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
