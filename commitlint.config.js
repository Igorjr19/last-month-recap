// Scopes mirror the area:* labels on GitHub. Use `repo` for changes at the
// workspace root or across several packages.
const scopes = [
  "repo",
  "core",
  "lastfm",
  "api",
  "web",
  "templates",
  "ci",
  "infra",
  "docs",
];

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", scopes],
    "scope-empty": [2, "never"],
  },
};
