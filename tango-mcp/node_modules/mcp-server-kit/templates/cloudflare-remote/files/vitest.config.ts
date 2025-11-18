import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		globals: true,
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					// Add any bindings needed for testing
					compatibilityDate: "2025-03-10",
					compatibilityFlags: ["nodejs_compat"],
				},
			},
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.d.ts",
				"src/types/**",
				"**/node_modules/**",
				"**/test/**",
			],
		},
	},
});
