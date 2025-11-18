# include_history Parameter - Example Usage

This document demonstrates the `include_history` parameter functionality added to the `get_tango_vendor_profile` tool.

## Overview

The `include_history` parameter, when set to `true`, fetches recent contract and subaward history for a vendor, providing comprehensive insight into their past government engagements.

## Parameters

- **include_history** (boolean, default: false): When true, includes contract and grant history
- **history_limit** (number, default: 10, max: 50): Number of records to fetch per type

## Example Request (include_history=false)

```json
{
  "uei": "J3RW5C5KVLZ1",
  "include_history": false
}
```

**Response** (simplified):
```json
{
  "data": {
    "uei": "J3RW5C5KVLZ1",
    "legal_business_name": "Example Corporation",
    "federal_obligations": {
      "active_contracts": {
        "total_obligated": 5000000,
        "count": 10
      },
      "total_contracts": {
        "total_obligated": 15000000,
        "count": 50
      }
    }
    // No contract_history or subaward_history fields
  },
  "execution": {
    "duration_ms": 245,
    "api_calls": 1,
    "history_fetched": false
  }
}
```

## Example Request (include_history=true)

```json
{
  "uei": "J3RW5C5KVLZ1",
  "include_history": true,
  "history_limit": 5
}
```

**Response** (simplified):
```json
{
  "data": {
    "uei": "J3RW5C5KVLZ1",
    "legal_business_name": "Example Corporation",
    "federal_obligations": {
      "active_contracts": {
        "total_obligated": 5000000,
        "count": 10
      },
      "total_contracts": {
        "total_obligated": 15000000,
        "count": 50
      }
    },
    "contract_history": [
      {
        "piid": "GS-35F-1234AA",
        "title": "IT Infrastructure Support Services",
        "award_date": "2024-03-15",
        "amount": 2500000
      },
      {
        "piid": "FA8750-23-C-5678",
        "title": "Software Development and Maintenance",
        "award_date": "2023-11-20",
        "amount": 1750000
      },
      {
        "piid": "W52P1J-23-D-9012",
        "title": "Cybersecurity Assessment Services",
        "award_date": "2023-08-10",
        "amount": 890000
      },
      {
        "piid": "N00024-22-C-3456",
        "title": "Network Infrastructure Upgrade",
        "award_date": "2022-12-05",
        "amount": 1200000
      },
      {
        "piid": "HSHQDC-22-A-7890",
        "title": "Cloud Migration Services",
        "award_date": "2022-09-18",
        "amount": 3400000
      }
    ],
    "subaward_history": [
      {
        "award_id": "R01GM123456",
        "title": "Biomedical Research Support",
        "award_date": "2024-01-08",
        "amount": 450000
      },
      {
        "award_id": "U54CA234567",
        "title": "Cancer Research Consortium",
        "award_date": "2023-07-22",
        "amount": 680000
      },
      {
        "award_id": "P30ES345678",
        "title": "Environmental Health Sciences",
        "award_date": "2023-04-14",
        "amount": 320000
      }
    ]
  },
  "execution": {
    "duration_ms": 687,
    "api_calls": 3,
    "history_fetched": true
  }
}
```

## History Data Structure

### Contract History

Each contract history item includes:
- **piid**: Procurement Instrument Identifier (unique contract ID)
- **title**: Contract description/title
- **award_date**: Date the contract was awarded (YYYY-MM-DD)
- **amount**: Obligated amount in dollars

### Subaward History

Each subaward history item includes:
- **award_id**: Federal Award Identification Number (FAIN)
- **title**: Grant/subaward description
- **award_date**: Date the award was made (YYYY-MM-DD)
- **amount**: Award amount in dollars

## Implementation Details

### Parallel Fetching

History data is fetched in parallel using `Promise.all` to minimize latency:
```typescript
const [contractsResponse, subawardsResponse] = await Promise.all([
  client.getVendorContracts(uei, { limit: "10" }, apiKey),
  client.getVendorGrants(uei, { limit: "10" }, apiKey),
]);
```

### Error Handling

History fetch failures do **not** break the main vendor profile response:
- If history fetching fails, the profile is still returned
- Empty arrays are provided for `contract_history` and `subaward_history`
- Errors are logged but don't propagate to the user

### Performance Impact

- **Without history**: 1 API call (~200-300ms)
- **With history**: 3 API calls (~600-800ms)
- History fetching adds approximately 2x latency but provides valuable context

## Use Cases

1. **Vendor Due Diligence**: Review past performance and contract values
2. **Capability Assessment**: Understand vendor's experience with similar work
3. **Trend Analysis**: Identify patterns in contract awards over time
4. **Competitive Intelligence**: Compare vendor history against competitors
5. **Risk Assessment**: Evaluate contract size progression and subaward activity

## Notes

- History is sorted by award date (most recent first) by default
- The API endpoints support additional filtering (not yet exposed in tool)
- Future enhancements could include date ranges, agency filters, etc.
