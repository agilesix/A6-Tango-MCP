/**
 * Helper script to fetch real IDs for integration tests
 * Calls search endpoints and extracts IDs for detail endpoint tests
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const SERVER_URL = "http://localhost:8788/sse";

async function main() {
	console.log("🔍 Fetching test IDs from Tango API...\n");

	const transport = new SSEClientTransport(new URL(SERVER_URL));
	const client = new Client(
		{
			name: "test-id-fetcher",
			version: "1.0.0",
		},
		{
			capabilities: {},
		}
	);

	await client.connect(transport);

	try {
		// Get grant_id
		console.log("📋 Fetching grant_id from search_tango_grants...");
		const grantsResult = await client.callTool({
			name: "search_tango_grants",
			arguments: { limit: 1 },
		});
		const grantsData = JSON.parse(grantsResult.content[0].text);
		const grantId = grantsData.data[0]?.grant_id || grantsData.data[0]?.opportunity_id;
		console.log(`   grant_id: ${grantId}\n`);

		// Get opportunity_id
		console.log("📋 Fetching opportunity_id from search_tango_opportunities...");
		const oppsResult = await client.callTool({
			name: "search_tango_opportunities",
			arguments: { limit: 1 },
		});
		const oppsData = JSON.parse(oppsResult.content[0].text);
		const opportunityId = oppsData.data[0]?.opportunity_id || oppsData.data[0]?.notice_id;
		console.log(`   opportunity_id: ${opportunityId}\n`);

		// Summary
		console.log("\n📝 Summary of Test IDs:");
		console.log("─────────────────────────────────────────");
		console.log(`contract_key:   CONT_AWD_9523ZY26P0004_9507_-NONE-_-NONE-`);
		console.log(`grant_id:       ${grantId}`);
		console.log(`opportunity_id: ${opportunityId}`);
		console.log(`vendor_uei:     XRKKJ1T3PKP7`);
		console.log(`agency_code:    9507`);
		console.log("─────────────────────────────────────────\n");
	} catch (error) {
		console.error("Error fetching IDs:", error);
	} finally {
		await client.close();
	}
}

main().catch(console.error);
