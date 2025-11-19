/**
 * Federal Contract Set-Aside Codes
 *
 * Set-asides restrict competition to specific socioeconomic categories.
 * These codes are used in contract searches to filter by set-aside type.
 *
 * @see https://www.acquisition.gov/far/part-19
 */

export interface SetAsideCode {
  code: string;
  description: string;
  category: 'small-business' | 'veteran' | 'women' | '8a' | 'hubzone' | 'other';
}

export const SET_ASIDE_CODES: Record<string, SetAsideCode> = {
  // No Set-Aside
  'NONE': {
    code: 'NONE',
    description: 'No Set-Aside (Full and Open Competition)',
    category: 'other'
  },

  // Small Business
  'SBA': {
    code: 'SBA',
    description: 'Total Small Business Set-Aside',
    category: 'small-business'
  },
  'SBP': {
    code: 'SBP',
    description: 'Partial Small Business Set-Aside',
    category: 'small-business'
  },
  'RSB': {
    code: 'RSB',
    description: 'Reserved for Small Business',
    category: 'small-business'
  },

  // Service-Disabled Veteran-Owned
  'SDVOSBC': {
    code: 'SDVOSBC',
    description: 'Service-Disabled Veteran-Owned Small Business Set-Aside',
    category: 'veteran'
  },
  'SDVOSBS': {
    code: 'SDVOSBS',
    description: 'Service-Disabled Veteran-Owned Small Business Sole Source',
    category: 'veteran'
  },
  'SDVOSB': {
    code: 'SDVOSB',
    description: 'Service-Disabled Veteran-Owned (SDVOSBC or SDVOSBS)',
    category: 'veteran'
  },

  // Veteran-Owned
  'VOSB': {
    code: 'VOSB',
    description: 'Veteran-Owned Small Business',
    category: 'veteran'
  },
  'VSA': {
    code: 'VSA',
    description: 'Veteran-Owned Small Business Set-Aside',
    category: 'veteran'
  },
  'VSS': {
    code: 'VSS',
    description: 'Veteran-Owned Small Business Sole Source',
    category: 'veteran'
  },

  // Women-Owned
  'WOSB': {
    code: 'WOSB',
    description: 'Women-Owned Small Business',
    category: 'women'
  },
  'WOSBSS': {
    code: 'WOSBSS',
    description: 'Women-Owned Small Business Sole Source',
    category: 'women'
  },
  'EDWOSB': {
    code: 'EDWOSB',
    description: 'Economically Disadvantaged Women-Owned Small Business',
    category: 'women'
  },

  // 8(a) Program
  '8A': {
    code: '8A',
    description: '8(a) Small Disadvantaged Business',
    category: '8a'
  },
  '8AN': {
    code: '8AN',
    description: '8(a) Set-Aside',
    category: '8a'
  },
  '8AC': {
    code: '8AC',
    description: '8(a) Competed',
    category: '8a'
  },

  // HUBZone
  'HZC': {
    code: 'HZC',
    description: 'HUBZone Set-Aside',
    category: 'hubzone'
  },
  'HZS': {
    code: 'HZS',
    description: 'HUBZone Sole Source',
    category: 'hubzone'
  },

  // Other
  'BICiv': {
    code: 'BICiv',
    description: 'Buy Indian (Civilian)',
    category: 'other'
  },
  'LAS': {
    code: 'LAS',
    description: 'Local Area Set-Aside',
    category: 'other'
  },
};

/**
 * Get description for a set-aside code
 */
export function getSetAsideDescription(code: string): string | null {
  return SET_ASIDE_CODES[code]?.description || null;
}

/**
 * Get all set-aside codes by category
 */
export function getSetAsidesByCategory(category: SetAsideCode['category']): SetAsideCode[] {
  return Object.values(SET_ASIDE_CODES).filter(sa => sa.category === category);
}

/**
 * Get all supported set-aside codes
 */
export function getSupportedSetAsides(): string[] {
  return Object.keys(SET_ASIDE_CODES);
}
