/**
 * Get Company Intelligence Tool
 *
 * Retrieves comprehensive company intelligence from Tango's RAG endpoint.
 * Returns AI-generated summary, related people/contacts, and recent news.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TangoApiClient } from "@/api/tango-client";
import type { CacheManager } from "@/cache/kv-cache";
import { sanitizeToolArgs } from "@/middleware/sanitization";
import type { Env } from "@/types/env";
import { getLogger } from "@/utils/logger";
import type { RichTextNode } from "@/types/tango-api";

/**
 * Extract plain text from rich text node structure
 * Simple recursive extraction - don't over-engineer
 */
function extractText(node: RichTextNode | undefined): string {
	if (!node) return "";

	let text = "";

	// If node has direct text, add it
	if (node.text) {
		text += node.text;
	}

	// Recursively extract from content array
	if (node.content && Array.isArray(node.content)) {
		for (const child of node.content) {
			text += extractText(child);
			// Add spacing between blocks
			if (child.type === "paragraph") {
				text += "\n\n";
			}
		}
	}

	return text;
}

/**
 * Register get company intelligence tool with the MCP server
 */
export function registerGetCompanyIntelligenceTool(
	server: McpServer,
	env: Env,
	cache?: CacheManager,
	userApiKey?: string,
): void {
	server.tool(
		"get_tango_company_intelligence",
		"Get comprehensive company intelligence including AI-generated summary, related people/contacts, and recent news. Optimized for LLM consumption with pre-aggregated data from multiple sources. Returns company profile with AI analysis, related individuals with contact info, and recent news/contract awards. Use this for business intelligence, competitive analysis, and partner research. Note: Must provide company_name (UEI search currently unavailable). For federal contracting compliance data (SAM.gov registration, certifications, obligations), use get_tango_vendor_profile tool instead. These tools complement each other: use company intelligence for business research, vendor profile for government compliance.",
		{
			company_name: z
				.string()
				.min(1)
				.describe(
					"Company name to search for. Examples: 'Agile Six Applications', 'Booz Allen Hamilton', 'SAIC'. Must be exact or close match to company's legal name.",
				),
		},
		async (args) => {
			const startTime = Date.now();
			const logger = getLogger();

			try {
				logger.toolInvocation("get_tango_company_intelligence", args, startTime);

				// Sanitize input
				const sanitized = sanitizeToolArgs(args);

				// Require API key
				const apiKey = userApiKey || env.TANGO_API_KEY;
				if (!apiKey) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: "API key required for company intelligence",
										error_code: "MISSING_API_KEY",
										suggestion: "Configure TANGO_API_KEY environment variable",
										recoverable: false,
									},
									null,
									2,
								),
							},
						],
					};
				}

				// Call Tango API with caching
				const client = new TangoApiClient(env, cache);
				const response = await client.getCompanyIntelligence(
					sanitized.company_name,
					apiKey,
				);

				// Handle API error
				if (!response.success || !response.data) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										error: response.error || "API request failed",
										error_code: "API_ERROR",
										status: response.status,
										suggestion:
											response.status === 404
												? "Company not found. Try variations of the company name."
												: "Check your company name and try again",
										recoverable: true,
										transient: response.status === 429 || response.status === 503,
									},
									null,
									2,
								),
							},
						],
					};
				}

				const data = response.data;

				// Extract AI summary text (simple extraction)
				const aiSummaryText = data.company?.ai_summary
					? extractText(data.company.ai_summary)
					: null;

				// Build response with structured data
				logger.toolComplete(
					"get_tango_company_intelligence",
					true,
					Date.now() - startTime,
					{
						company: data.company?.company_name,
						news_count: data.related_news?.length || 0,
						people_count: data.related_people?.length || 0,
					},
				);

				const result = {
					company: {
						name: data.company?.company_name || sanitized.company_name,
						uei: data.company?.uei || null,
						description: data.company?.company_description || null,
						ai_summary: aiSummaryText, // Plain text extraction
						ai_summary_raw: data.company?.ai_summary, // Keep raw for agents that want it
						employees_est: data.company?.employees_est || null,
						logo_url: data.company?.logo_url || null,
						canonical_url: data.company?.canonical_url || null,
						documents: data.company?.company_documents || [],
					},
					related_people: (data.related_people || []).map((person) => ({
						name: person.name || null,
						title: person.title || null,
						email: person.email || null,
						company: person.company_name || null,
						source: person.source || null,
					})),
					related_news: (data.related_news || []).map((news) => ({
						title: news.title || null,
						url: news.url || null,
						preview: news.preview || null,
						published_date: news.published_date || null,
						source: news.source || null,
					})),
					metadata: {
						news_count: data.related_news?.length || 0,
						people_count: data.related_people?.length || 0,
						documents_count: data.company?.company_documents?.length || 0,
					},
					execution: {
						duration_ms: Date.now() - startTime,
						cached: response.cache?.hit || false,
						api_calls: 1,
					},
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				// Handle unexpected errors
				logger.error(
					"Unexpected error in get_tango_company_intelligence",
					error instanceof Error ? error : new Error(String(error)),
					{ tool: "get_tango_company_intelligence" },
				);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									error: error instanceof Error ? error.message : "Unknown error",
									error_code: "INTERNAL_ERROR",
									suggestion: "Contact support if this error persists",
									recoverable: false,
									execution: {
										duration_ms: Date.now() - startTime,
									},
								},
								null,
								2,
							),
						},
					],
				};
			}
		},
	);
}
