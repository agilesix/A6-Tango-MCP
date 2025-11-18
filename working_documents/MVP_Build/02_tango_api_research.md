# Tango API Research Document

## Overview

Tango (https://tango.makegov.com) is a unified federal contracting and grants API platform that consolidates data from multiple government sources including FPDS (Federal Procurement Data System), SAM.gov, and USASpending.gov. It provides enhanced search capabilities and normalized data models for federal spending information.

**Base URL**: `https://tango.makegov.com/api`

## Authentication

### API Key Authentication
- **Method**: HTTP Header
- **Header Name**: `X-API-Key`
- **Format**: String API key
- **Environment Variable**: `TANGO_API_KEY` (optional fallback)
- **Error Handling**: Returns error if no API key provided: "Tango API key is required"

### Example Header
```typescript
headers: {
  'Accept': 'application/json',
  'X-API-Key': apiKey,
  'User-Agent': 'Capture-MCP/1.0.0'
}
```

## Rate Limiting

- **Conservative Rate Limit**: 100ms delay between requests
- **Implementation**: Queue-based rate limiting with promise chaining
- **Timeout**: 30 seconds per request
- **Concurrent Handling**: Preserves request ordering across concurrent invocations

## Available Endpoints

### 1. Search Contracts
**Endpoint**: `GET /contracts/`

**Purpose**: Search federal contract awards from FPDS with comprehensive filtering

**Query Parameters**:
- `search` - Search query for contract description or title
- `recipient` - Vendor/contractor name filter
- `uei` - Vendor Unique Entity Identifier
- `awarding_agency` - Awarding agency name or code
- `naics` - NAICS industry classification code
- `psc` - Product/Service Code
- `award_date_gte` - Start date for awards (YYYY-MM-DD)
- `award_date_lte` - End date for awards (YYYY-MM-DD)
- `set_aside` - Set-aside type (e.g., 'SBA', 'WOSB', 'SDVOSB', '8A')
- `limit` - Number of results (default: 10, max: 100)

**Response Structure**:
```typescript
{
  results: Array<{
    key?: string,
    piid?: string,
    description?: string,
    title?: string,
    recipient?: {
      display_name?: string,
      uei?: string
    },
    vendor_name?: string,
    vendor_uei?: string,
    vendor_duns?: string,
    awarding_office?: {
      agency_name?: string,
      agency_code?: string,
      office_name?: string
    },
    obligated?: number,
    total_contract_value?: number,
    base_and_exercised_options_value?: number,
    award_date?: string,
    date_signed?: string,
    naics_code?: string,
    naics_description?: string,
    psc_code?: string,
    psc_description?: string,
    set_aside?: {
      code?: string
    },
    type_of_set_aside?: string,
    place_of_performance?: {
      city_name?: string,
      state_name?: string,
      country_name?: string
    },
    contract_status?: string,
    status?: string
  }>,
  total?: number,
  count?: number
}
```

### 2. Search Grants
**Endpoint**: `GET /grants/`

**Purpose**: Access federal grants and financial assistance data from USASpending

**Query Parameters**:
- `search` - Search query for grant description or title
- `agency` - Awarding agency name or code
- `cfda_number` - Catalog of Federal Domestic Assistance number
- `posted_date_after` - Start date (YYYY-MM-DD)
- `posted_date_before` - End date (YYYY-MM-DD)
- `limit` - Number of results (default: 10, max: 100)

**Note**: Client-side filtering applied for:
- `recipient_name` - Filtered in code after API response
- `recipient_uei` - Filtered in code after API response
- `award_amount_min/max` - Filtered in code after API response

**Response Structure**:
```typescript
{
  results: Array<{
    fain?: string,
    grant_id?: string,
    description?: string,
    title?: string,
    project_title?: string,
    recipient?: {
      name?: string,
      uei?: string,
      duns?: string,
      type?: string
    },
    agency_name?: string,
    agency_code?: string,
    office_name?: string,
    award_amount?: number,
    total_funding_amount?: number,
    award_date?: string,
    cfda_number?: string,
    cfda_title?: string,
    pop_city?: string,
    pop_state_code?: string,
    pop_country_code?: string,
    grant_status?: string,
    period_start_date?: string,
    period_end_date?: string
  }>,
  total?: number,
  count?: number
}
```

### 3. Get Vendor Profile
**Endpoint**: `GET /entities/{uei}/`

**Purpose**: Retrieve comprehensive entity profiles from SAM.gov data

**Path Parameters**:
- `uei` - Required Unique Entity Identifier

**Query Parameters**: None for main profile

**Additional Endpoints**:
- `GET /entities/{uei}/contracts/` - Recent contract history
  - Parameters: `limit`, `ordering` (e.g., '-award_date')
- `GET /entities/{uei}/subawards/` - Recent grant/subaward history
  - Parameters: `limit`, `ordering` (e.g., '-fiscal_year')

**Response Structure**:
```typescript
{
  uei: string,
  legal_business_name?: string,
  name?: string,
  duns?: string,
  cage_code?: string,
  registration_status?: string,
  activation_date?: string,
  expiration_date?: string,
  business_types?: any,
  business_type_list?: any,
  physical_address?: any,
  mailing_address?: any,
  points_of_contact?: any,
  contacts?: any,
  naics_codes?: any,
  psc_codes?: any,
  certifications?: any,
  total_contracts?: number,
  total_contract_value?: number,
  total_grants?: number,
  total_grant_value?: number
}
```

### 4. Search Opportunities
**Endpoint**: `GET /opportunities/`

**Purpose**: Find federal contract opportunities, forecasts, and solicitation notices

**Query Parameters**:
- `search` - Search query for title or description
- `agency` - Agency name or code
- `naics` - NAICS industry classification code
- `set_aside` - Set-aside type filter
- `posted_date_after` - Start date for posting (YYYY-MM-DD)
- `first_notice_date_after` - Alternative date filter
- `posted_date_before` - End date for posting (YYYY-MM-DD)
- `first_notice_date_before` - Alternative date filter
- `response_deadline_after` - Minimum response deadline (YYYY-MM-DD)
- `active` - Boolean filter (true/false)
- `notice_type` - Notice type code (e.g., 'f' for forecasted)
- `limit` - Number of results (default: 10, max: 100)

**Response Structure**:
```typescript
{
  results: Array<{
    opportunity_id?: string,
    notice_id?: string,
    solicitation_number?: string,
    title?: string,
    meta?: {
      notice_type?: {
        type?: string
      }
    },
    opportunity_type?: string,
    type?: string,
    active?: boolean,
    status?: string,
    office?: {
      agency_name?: string,
      agency_code?: string,
      office_name?: string
    },
    posted_date?: string,
    first_notice_date?: string,
    date_posted?: string,
    response_deadline?: string,
    due_date?: string,
    naics_code?: string,
    set_aside?: {
      code?: string
    },
    set_aside_type?: string,
    place_of_performance?: {
      city?: string,
      state?: string,
      zip?: string,
      country?: string
    },
    summary?: string,
    description?: string,
    sam_url?: string,
    url?: string,
    link?: string
  }>,
  total?: number,
  count?: number,
  next?: string  // Cursor for pagination
}
```

### 5. Get Spending Summary
**Endpoint**: `GET /contracts/` (with aggregation logic)

**Purpose**: Generate aggregated spending analytics by various dimensions

**Note**: This endpoint uses the contracts endpoint with client-side aggregation

**Query Parameters**:
- `awarding_agency` - Agency name or code
- `uei` - Vendor UEI
- `fiscal_year` - Fiscal year (e.g., 2024)
- `award_type` - Filter by type: 'contracts', 'grants', 'all'
- `limit` - Number of results for aggregation (default: 100)

**Aggregation Dimensions** (client-side):
- `agency` - Group by awarding agency
- `vendor` - Group by recipient/vendor
- `naics` - Group by NAICS code
- `psc` - Group by PSC code
- `month` - Group by award month (YYYY-MM format)

## Data Models

### Normalized Contract Object
```typescript
{
  contract_id: string,
  title: string,
  vendor: {
    name: string,
    uei: string,
    duns: string
  },
  agency: {
    name: string,
    code: string,
    office: string
  },
  award_amount: number,
  award_date: string,
  naics_code: string,
  naics_description: string,
  psc_code: string,
  psc_description: string,
  set_aside: string,
  place_of_performance: {
    city: string,
    state: string,
    country: string
  },
  status: string
}
```

### Normalized Grant Object
```typescript
{
  grant_id: string,
  title: string,
  recipient: {
    name: string,
    uei: string,
    duns: string,
    type: string
  },
  agency: {
    name: string,
    code: string,
    office: string
  },
  award_amount: number,
  award_date: string,
  cfda: {
    number: string,
    title: string
  },
  place_of_performance: {
    city: string,
    state: string,
    country: string
  },
  status: string,
  period_of_performance: {
    start: string,
    end: string
  }
}
```

### Vendor Profile Object
```typescript
{
  uei: string,
  legal_business_name: string,
  duns: string,
  cage_code: string,
  registration: {
    status: string,
    activation_date: string,
    expiration_date: string
  },
  business_types: any[],
  address: {
    physical: any,
    mailing: any
  },
  contacts: any[],
  naics_codes: any[],
  psc_codes: any[],
  certifications: any[],
  performance_summary: {
    total_contracts: number,
    total_contract_value: number,
    total_grants: number,
    total_grant_value: number
  },
  recent_contracts?: any[],
  recent_grants?: any[]
}
```

### Opportunity Object
```typescript
{
  opportunity_id: string,
  solicitation_number: string,
  title: string,
  type: string,
  status: string,
  agency: {
    name: string,
    code: string,
    office: string
  },
  posted_date: string,
  response_deadline: string,
  naics_code: string,
  set_aside: string,
  place_of_performance: {
    city: string,
    state: string,
    zip: string,
    country: string
  },
  description: string,  // Truncated to 500 characters
  link: string
}
```

### Spending Summary Object
```typescript
{
  total_contracts: number,
  total_obligated: number,
  breakdown: Array<{
    rank: number,
    key: string,
    label: string,
    total_obligated: number,
    contract_count: number
  }>,
  group_by: string,
  award_type: string,
  fiscal_year?: number,
  filters: {
    awarding_agency?: string,
    vendor_uei?: string
  },
  page_info: {
    limit: number,
    total_available: number | null,
    next_cursor: string | null
  }
}
```

## Example API Calls

### Search Contracts by Vendor
```typescript
const response = await ApiClient.tangoGet(
  '/contracts/',
  {
    recipient: 'Lockheed Martin',
    award_date_gte: '2024-01-01',
    limit: 50
  },
  apiKey
);
```

### Get Vendor Profile with History
```typescript
const profileResponse = await ApiClient.tangoGet(
  `/entities/${uei}/`,
  {},
  apiKey
);

const contractsResponse = await ApiClient.tangoGet(
  `/entities/${uei}/contracts/`,
  { limit: 5, ordering: '-award_date' },
  apiKey
);
```

### Search Active Opportunities
```typescript
const response = await ApiClient.tangoGet(
  '/opportunities/',
  {
    active: true,
    naics: '541512',
    response_deadline_after: '2024-12-01',
    limit: 25
  },
  apiKey
);
```

## Integration Patterns

### 1. Response Field Normalization
The API has inconsistent field naming across different endpoints. The implementation handles multiple field variations:

```typescript
// Amount fields
const amount = contract.obligated ??
               contract.total_contract_value ??
               contract.base_and_exercised_options_value ?? 0;

// Name fields
const vendorName = contract.recipient?.display_name ||
                   contract.vendor_name;

// ID fields
const contractId = contract.key ||
                   contract.piid ||
                   contract.contract_id;
```

### 2. Client-Side Filtering
Some filters are applied after API response for more precise control:

- Award amount ranges (min/max)
- Vendor name matching (case-insensitive substring)
- Recipient UEI exact matching

### 3. Error Handling Pattern
```typescript
const response = await ApiClient.tangoGet(endpoint, params, apiKey);

if (!response.success) {
  return { error: response.error };
}

// Process response.data
```

### 4. Input Sanitization
All inputs are sanitized before API calls:
```typescript
const sanitizedArgs = ApiClient.sanitizeInput(args);
// Strips control characters, trims strings, recursively processes objects/arrays
```

### 5. Status Normalization
Opportunity status is normalized from various formats:
```typescript
if (status === 'active') {
  params.active = true;
} else if (['inactive', 'closed'].includes(status)) {
  params.active = false;
} else if (status === 'forecasted') {
  params.notice_type = 'f';
}
```

## Constraints and Considerations

### API Limitations
1. **Result Limits**: Maximum 100 results per request
2. **Timeout**: 30-second timeout on all requests
3. **Rate Limiting**: Conservative 100ms delay between requests
4. **Field Inconsistency**: Response fields vary across endpoints and records

### Data Quality Issues
1. **Optional Fields**: Most fields are optional and may be null/undefined
2. **Multiple Field Names**: Same data under different field names (requires fallback logic)
3. **Date Formats**: Various date field names for similar data
4. **Amount Fields**: Multiple possible fields for monetary values

### Implementation Requirements
1. **API Key Management**: Must support both parameter and environment variable
2. **Input Validation**: Sanitize all user inputs before API calls
3. **Field Mapping**: Robust fallback logic for field name variations
4. **Client-Side Filtering**: Some filters must be applied post-response
5. **Error Propagation**: Return structured error objects on API failures

### Best Practices
1. Always use the `ApiClient.sanitizeInput()` for user-provided data
2. Check `response.success` before processing data
3. Use conservative limits (≤100) for better performance
4. Implement null/undefined checks for all response fields
5. Provide meaningful default values for optional parameters
6. Cache vendor profile data when possible to reduce API calls
7. Use pagination cursors (`next`) for large result sets
8. Truncate long text fields (e.g., descriptions to 500 chars) for display

### Security Considerations
1. API keys should never be logged or exposed
2. All inputs must be sanitized to prevent injection attacks
3. Control characters are stripped from string inputs
4. User-Agent header identifies the client application

## MCP Server Implementation Notes

### Tool Definitions
Each Tango operation should be exposed as a separate MCP tool with:
- Clear description of data source and capabilities
- Comprehensive input schema with type validation
- Required vs optional parameter distinction
- Sensible defaults for limit parameters

### Response Formatting
- Return normalized data structures for consistency
- Include metadata (total count, filters applied, pagination info)
- Provide helpful error messages with context
- Filter responses to essential fields only

### Performance Optimization
- Implement request queuing for rate limit compliance
- Use promise-based async/await patterns
- Consider caching for vendor profiles and static data
- Batch related requests when possible

### Testing Considerations
- Mock API responses for testing (API may be down)
- Test field name variations and fallback logic
- Validate input sanitization effectiveness
- Test error handling for various failure modes
