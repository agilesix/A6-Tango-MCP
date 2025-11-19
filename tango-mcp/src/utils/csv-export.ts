/**
 * CSV Export Utilities
 *
 * Shared utilities for handling CSV export responses from Tango API.
 * Provides consistent CSV handling across all search tools.
 */

import type { Logger } from "./logger";

/**
 * Handle CSV export response from Tango API
 *
 * @param csvData - Raw CSV string from API response
 * @param toolName - Name of the tool for logging
 * @param logger - Logger instance
 * @param startTime - Timestamp when tool execution started
 * @returns MCP tool response with CSV content
 */
export function handleCsvExport(
	csvData: string,
	toolName: string,
	logger: Logger,
	startTime: number,
): { content: Array<{ type: "text"; text: string }> } {
	logger.toolComplete(toolName, true, Date.now() - startTime, {
		format: "csv",
		csv_length: csvData.length,
	});

	return {
		content: [
			{
				type: "text" as const,
				text: csvData,
			},
		],
	};
}
