/**
 * NAICS Code Lookup Table
 *
 * North American Industry Classification System (NAICS) codes with descriptions.
 * Source: U.S. Census Bureau NAICS 2022
 *
 * This lookup table focuses on common codes found in federal contracting,
 * particularly those frequently appearing in USASpending.gov and FPDS data.
 *
 * Last updated: 2025-01-18
 */

export const NAICS_DESCRIPTIONS: Record<string, string> = {
	// Information Technology & Software (541xxx)
	"541511": "Custom Computer Programming Services",
	"541512": "Computer Systems Design Services",
	"541513": "Computer Facilities Management Services",
	"541519": "Other Computer Related Services",
	"513210": "Software Publishers", // Changed from 511210 in 2022 update
	"511210": "Software Publishers", // Legacy code for backward compatibility
	"518210": "Data Processing, Hosting, and Related Services",
	"541690": "Other Scientific and Technical Consulting Services",

	// Engineering & Architecture (541xxx)
	"541330": "Engineering Services",
	"541310": "Architectural Services",
	"541320": "Landscape Architectural Services",
	"541340": "Drafting Services",
	"541350": "Building Inspection Services",
	"541360": "Geophysical Surveying and Mapping Services",
	"541370": "Surveying and Mapping (except Geophysical) Services",
	"541380": "Testing Laboratories and Services", // Name updated in 2022

	// Management & Consulting Services (541xxx)
	"541611": "Administrative Management and General Management Consulting Services",
	"541612": "Human Resources Consulting Services",
	"541613": "Marketing Consulting Services",
	"541614": "Process, Physical Distribution, and Logistics Consulting Services",
	"541618": "Other Management Consulting Services",
	"541620": "Environmental Consulting Services",

	// Scientific Research & Development (541xxx)
	"541711": "Research and Development in Biotechnology",
	"541712": "Research and Development in the Physical, Engineering, and Life Sciences (except Biotechnology)",
	"541715": "Research and Development in the Physical, Engineering, and Life Sciences",
	"541720": "Research and Development in the Social Sciences and Humanities",

	// Legal & Accounting Services (541xxx)
	"541110": "Offices of Lawyers",
	"541191": "Title Abstract and Settlement Offices",
	"541199": "All Other Legal Services",
	"541211": "Offices of Certified Public Accountants",
	"541213": "Tax Preparation Services",
	"541214": "Payroll Services",
	"541219": "Other Accounting Services",

	// Specialized Design Services (541xxx)
	"541410": "Interior Design Services",
	"541420": "Industrial Design Services",
	"541430": "Graphic Design Services",
	"541490": "Other Specialized Design Services",

	// Advertising & Marketing (541xxx)
	"541810": "Advertising Agencies",
	"541820": "Public Relations Agencies",
	"541830": "Media Buying Agencies",
	"541840": "Media Representatives",
	"541850": "Outdoor Advertising",
	"541860": "Direct Mail Advertising",
	"541870": "Advertising Material Distribution Services",
	"541890": "Other Services Related to Advertising",

	// Other Professional Services (541xxx)
	"541910": "Marketing Research and Public Opinion Polling",
	"541920": "Photographic Services",
	"541930": "Translation and Interpretation Services",
	"541940": "Veterinary Services",
	"541990": "All Other Professional, Scientific, and Technical Services",

	// Administrative & Support Services (561xxx)
	"561110": "Office Administrative Services",
	"561210": "Facilities Support Services",
	"561310": "Employment Placement Agencies",
	"561320": "Temporary Help Services",
	"561330": "Professional Employer Organizations",
	"561410": "Document Preparation Services",
	"561421": "Telephone Answering Services",
	"561422": "Telemarketing Bureaus and Other Contact Centers",
	"561431": "Private Mail Centers",
	"561439": "Other Business Service Centers (including Copy Shops)",
	"561440": "Collection Agencies",
	"561450": "Credit Bureaus",
	"561491": "Repossession Services",
	"561499": "All Other Business Support Services",
	"561510": "Travel Agencies",
	"561520": "Tour Operators",
	"561591": "Convention and Visitors Bureaus",
	"561599": "All Other Travel Arrangement and Reservation Services",
	"561611": "Investigation Services",
	"561612": "Security Guards and Patrol Services",
	"561613": "Armored Car Services",
	"561621": "Security Systems Services (except Locksmiths)",
	"561622": "Locksmiths",
	"561710": "Exterminating and Pest Control Services",
	"561720": "Janitorial Services",
	"561730": "Landscaping Services",
	"561740": "Carpet and Upholstery Cleaning Services",
	"561790": "Other Services to Buildings and Dwellings",
	"561910": "Packaging and Labeling Services",
	"561920": "Convention and Trade Show Organizers",
	"561990": "All Other Support Services",

	// Educational Services (611xxx)
	"611430": "Professional and Management Development Training",
	"611710": "Educational Support Services",

	// Health Care (621xxx, 622xxx, 623xxx)
	"621111": "Offices of Physicians (except Mental Health Specialists)",
	"621112": "Offices of Physicians, Mental Health Specialists",
	"621210": "Offices of Dentists",
	"621310": "Offices of Chiropractors",
	"621320": "Offices of Optometrists",
	"621330": "Offices of Mental Health Practitioners (except Physicians)",
	"621340": "Offices of Physical, Occupational and Speech Therapists, and Audiologists",
	"621391": "Offices of Podiatrists",
	"621399": "Offices of All Other Miscellaneous Health Practitioners",
	"621410": "Family Planning Centers",
	"621420": "Outpatient Mental Health and Substance Abuse Centers",
	"621491": "HMO Medical Centers",
	"621492": "Kidney Dialysis Centers",
	"621493": "Freestanding Ambulatory Surgical and Emergency Centers",
	"621498": "All Other Outpatient Care Centers",
	"621511": "Medical Laboratories",
	"621512": "Diagnostic Imaging Centers",
	"621610": "Home Health Care Services",
	"621910": "Ambulance Services",
	"621991": "Blood and Organ Banks",
	"621999": "All Other Miscellaneous Ambulatory Health Care Services",
	"622110": "General Medical and Surgical Hospitals",
	"622210": "Psychiatric and Substance Abuse Hospitals",
	"622310": "Specialty (except Psychiatric and Substance Abuse) Hospitals",
	"623110": "Nursing Care Facilities (Skilled Nursing Facilities)",
	"623210": "Residential Intellectual and Developmental Disability Facilities",
	"623220": "Residential Mental Health and Substance Abuse Facilities",
	"623311": "Continuing Care Retirement Communities",
	"623312": "Assisted Living Facilities for the Elderly",

	// Medical Equipment & Supplies Manufacturing (334xxx, 339xxx)
	"334510": "Electromedical and Electrotherapeutic Apparatus Manufacturing",
	"334516": "Analytical Laboratory Instrument Manufacturing",
	"334517": "Irradiation Apparatus Manufacturing",
	"339112": "Surgical and Medical Instrument Manufacturing",
	"339113": "Surgical Appliance and Supplies Manufacturing",
	"339114": "Dental Equipment and Supplies Manufacturing",
	"339115": "Ophthalmic Goods Manufacturing",
	"339116": "Dental Laboratories",

	// Pharmaceutical & Medicine Manufacturing (325xxx)
	"325411": "Medicinal and Botanical Manufacturing",
	"325412": "Pharmaceutical Preparation Manufacturing",
	"325413": "In-Vitro Diagnostic Substance Manufacturing",
	"325414": "Biological Product (except Diagnostic) Manufacturing",

	// Defense & Aerospace Manufacturing (336xxx)
	"336411": "Aircraft Manufacturing",
	"336412": "Aircraft Engine and Engine Parts Manufacturing",
	"336413": "Other Aircraft Parts and Auxiliary Equipment Manufacturing",
	"336414": "Guided Missile and Space Vehicle Manufacturing",
	"336415": "Guided Missile and Space Vehicle Propulsion Unit and Propulsion Unit Parts Manufacturing",
	"336419": "Other Guided Missile and Space Vehicle Parts and Auxiliary Equipment Manufacturing",

	// Shipbuilding & Marine Equipment (336xxx)
	"336611": "Ship Building and Repairing",
	"336612": "Boat Building",

	// Other Transportation Equipment Manufacturing (336xxx)
	"336120": "Heavy Duty Truck Manufacturing",
	"336211": "Motor Vehicle Body Manufacturing",
	"336212": "Truck Trailer Manufacturing",
	"336213": "Motor Home Manufacturing",
	"336214": "Travel Trailer and Camper Manufacturing",
	"336310": "Motor Vehicle Gasoline Engine and Engine Parts Manufacturing",
	"336320": "Motor Vehicle Electrical and Electronic Equipment Manufacturing",
	"336330": "Motor Vehicle Steering and Suspension Components (except Spring) Manufacturing",
	"336340": "Motor Vehicle Brake System Manufacturing",
	"336350": "Motor Vehicle Transmission and Power Train Parts Manufacturing",
	"336360": "Motor Vehicle Seating and Interior Trim Manufacturing",
	"336370": "Motor Vehicle Metal Stamping",
	"336390": "Other Motor Vehicle Parts Manufacturing",
	"336991": "Motorcycle, Bicycle, and Parts Manufacturing",
	"336992": "Military Armored Vehicle, Tank, and Tank Component Manufacturing",
	"336999": "All Other Transportation Equipment Manufacturing",

	// Computer & Electronic Product Manufacturing (334xxx)
	"334111": "Electronic Computer Manufacturing",
	"334112": "Computer Storage Device Manufacturing",
	"334118": "Computer Terminal and Other Computer Peripheral Equipment Manufacturing",
	"334210": "Telephone Apparatus Manufacturing",
	"334220": "Radio and Television Broadcasting and Wireless Communications Equipment Manufacturing",
	"334290": "Other Communications Equipment Manufacturing",
	"334310": "Audio and Video Equipment Manufacturing",
	"334411": "Electron Tube Manufacturing",
	"334412": "Bare Printed Circuit Board Manufacturing",
	"334413": "Semiconductor and Related Device Manufacturing",
	"334414": "Electronic Capacitor Manufacturing",
	"334415": "Electronic Resistor Manufacturing",
	"334416": "Electronic Coil, Transformer, and Other Inductor Manufacturing",
	"334417": "Electronic Connector Manufacturing",
	"334418": "Printed Circuit Assembly (Electronic Assembly) Manufacturing",
	"334419": "Other Electronic Component Manufacturing",
	"334511": "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing",
	"334512": "Automatic Environmental Control Manufacturing for Residential, Commercial, and Appliance Use",
	"334513": "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables",
	"334514": "Totalizing Fluid Meter and Counting Device Manufacturing",
	"334515": "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals",
	"334519": "Other Measuring and Controlling Device Manufacturing",

	// Electrical Equipment & Component Manufacturing (335xxx)
	"335110": "Electric Lamp Bulb and Part Manufacturing",
	"335121": "Residential Electric Lighting Fixture Manufacturing",
	"335122": "Commercial, Industrial, and Institutional Electric Lighting Fixture Manufacturing",
	"335129": "Other Lighting Equipment Manufacturing",
	"335210": "Small Electrical Appliance Manufacturing",
	"335220": "Major Household Appliance Manufacturing",
	"335311": "Power, Distribution, and Specialty Transformer Manufacturing",
	"335312": "Motor and Generator Manufacturing",
	"335313": "Switchgear and Switchboard Apparatus Manufacturing",
	"335314": "Relay and Industrial Control Manufacturing",
	"335911": "Storage Battery Manufacturing",
	"335912": "Primary Battery Manufacturing",
	"335921": "Fiber Optic Cable Manufacturing",
	"335929": "Other Communication and Energy Wire Manufacturing",
	"335931": "Current-Carrying Wiring Device Manufacturing",
	"335932": "Noncurrent-Carrying Wiring Device Manufacturing",
	"335991": "Carbon and Graphite Product Manufacturing",
	"335999": "All Other Miscellaneous Electrical Equipment and Component Manufacturing",

	// Machinery Manufacturing (333xxx)
	"333111": "Farm Machinery and Equipment Manufacturing",
	"333112": "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing",
	"333120": "Construction Machinery Manufacturing",
	"333131": "Mining Machinery and Equipment Manufacturing",
	"333132": "Oil and Gas Field Machinery and Equipment Manufacturing",
	"333241": "Food Product Machinery Manufacturing",
	"333242": "Semiconductor Machinery Manufacturing",
	"333243": "Sawmill, Woodworking, and Paper Machinery Manufacturing",
	"333244": "Printing Machinery and Equipment Manufacturing",
	"333249": "Other Industrial Machinery Manufacturing",
	"333314": "Optical Instrument and Lens Manufacturing",
	"333316": "Photographic and Photocopying Equipment Manufacturing",
	"333318": "Other Commercial and Service Industry Machinery Manufacturing",
	"333413": "Industrial and Commercial Fan and Blower and Air Purification Equipment Manufacturing",
	"333414": "Heating Equipment (except Warm Air Furnaces) Manufacturing",
	"333415": "Air-Conditioning and Warm Air Heating Equipment and Commercial and Industrial Refrigeration Equipment Manufacturing",
	"333511": "Industrial Mold Manufacturing",
	"333514": "Special Die and Tool, Die Set, Jig, and Fixture Manufacturing",
	"333515": "Cutting Tool and Machine Tool Accessory Manufacturing",
	"333517": "Machine Tool Manufacturing",
	"333611": "Turbine and Turbine Generator Set Units Manufacturing",
	"333612": "Speed Changer, Industrial High-Speed Drive, and Gear Manufacturing",
	"333613": "Mechanical Power Transmission Equipment Manufacturing",
	"333618": "Other Engine Equipment Manufacturing",
	"333911": "Pump and Pumping Equipment Manufacturing",
	"333912": "Air and Gas Compressor Manufacturing",
	"333913": "Measuring and Dispensing Pump Manufacturing",
	"333921": "Elevator and Moving Stairway Manufacturing",
	"333922": "Conveyor and Conveying Equipment Manufacturing",
	"333923": "Overhead Traveling Crane, Hoist, and Monorail System Manufacturing",
	"333924": "Industrial Truck, Tractor, Trailer, and Stacker Machinery Manufacturing",
	"333991": "Power-Driven Handtool Manufacturing",
	"333992": "Welding and Soldering Equipment Manufacturing",
	"333993": "Packaging Machinery Manufacturing",
	"333994": "Industrial Process Furnace and Oven Manufacturing",
	"333995": "Fluid Power Cylinder and Actuator Manufacturing",
	"333996": "Fluid Power Pump and Motor Manufacturing",
	"333997": "Scale and Balance Manufacturing",
	"333999": "All Other Miscellaneous General Purpose Machinery Manufacturing",

	// Fabricated Metal Product Manufacturing (332xxx)
	"332111": "Iron and Steel Forging",
	"332112": "Nonferrous Forging",
	"332114": "Custom Roll Forming",
	"332117": "Powder Metallurgy Part Manufacturing",
	"332119": "Metal Crown, Closure, and Other Metal Stamping (except Automotive)",
	"332215": "Metal Kitchen Cookware, Utensil, Cutlery, and Flatware (except Precious) Manufacturing",
	"332216": "Saw Blade and Handtool Manufacturing",
	"332311": "Prefabricated Metal Building and Component Manufacturing",
	"332312": "Fabricated Structural Metal Manufacturing",
	"332313": "Plate Work Manufacturing",
	"332321": "Metal Window and Door Manufacturing",
	"332322": "Sheet Metal Work Manufacturing",
	"332323": "Ornamental and Architectural Metal Work Manufacturing",
	"332410": "Power Boiler and Heat Exchanger Manufacturing",
	"332420": "Metal Tank (Heavy Gauge) Manufacturing",
	"332431": "Metal Can Manufacturing",
	"332439": "Other Metal Container Manufacturing",
	"332510": "Hardware Manufacturing",
	"332613": "Spring Manufacturing",
	"332618": "Other Fabricated Wire Product Manufacturing",
	"332710": "Machine Shops",
	"332721": "Precision Turned Product Manufacturing",
	"332722": "Bolt, Nut, Screw, Rivet, and Washer Manufacturing",
	"332811": "Metal Heat Treating",
	"332812": "Metal Coating, Engraving (except Jewelry and Silverware), and Allied Services to Manufacturers",
	"332813": "Electroplating, Plating, Polishing, Anodizing, and Coloring",
	"332911": "Industrial Valve Manufacturing",
	"332912": "Fluid Power Valve and Hose Fitting Manufacturing",
	"332913": "Plumbing Fixture Fitting and Trim Manufacturing",
	"332919": "Other Metal Valve and Pipe Fitting Manufacturing",
	"332991": "Ball and Roller Bearing Manufacturing",
	"332992": "Small Arms Ammunition Manufacturing",
	"332993": "Ammunition (except Small Arms) Manufacturing",
	"332994": "Small Arms, Ordnance, and Ordnance Accessories Manufacturing",
	"332996": "Fabricated Pipe and Pipe Fitting Manufacturing",
	"332999": "All Other Miscellaneous Fabricated Metal Product Manufacturing",

	// Utilities (221xxx)
	"221111": "Hydroelectric Power Generation",
	"221112": "Fossil Fuel Electric Power Generation",
	"221113": "Nuclear Electric Power Generation",
	"221114": "Solar Electric Power Generation",
	"221115": "Wind Electric Power Generation",
	"221116": "Geothermal Electric Power Generation",
	"221117": "Biomass Electric Power Generation",
	"221118": "Other Electric Power Generation",
	"221121": "Electric Bulk Power Transmission and Control",
	"221122": "Electric Power Distribution",
	"221210": "Natural Gas Distribution",
	"221310": "Water Supply and Irrigation Systems",
	"221320": "Sewage Treatment Facilities",
	"221330": "Steam and Air-Conditioning Supply",

	// Construction (236xxx, 237xxx, 238xxx)
	"236115": "New Single-Family Housing Construction (except For-Sale Builders)",
	"236116": "New Multifamily Housing Construction (except For-Sale Builders)",
	"236117": "New Housing For-Sale Builders",
	"236118": "Residential Remodelers",
	"236210": "Industrial Building Construction",
	"236220": "Commercial and Institutional Building Construction",
	"237110": "Water and Sewer Line and Related Structures Construction",
	"237120": "Oil and Gas Pipeline and Related Structures Construction",
	"237130": "Power and Communication Line and Related Structures Construction",
	"237210": "Land Subdivision",
	"237310": "Highway, Street, and Bridge Construction",
	"237990": "Other Heavy and Civil Engineering Construction",
	"238110": "Poured Concrete Foundation and Structure Contractors",
	"238120": "Structural Steel and Precast Concrete Contractors",
	"238130": "Framing Contractors",
	"238140": "Masonry Contractors",
	"238150": "Glass and Glazing Contractors",
	"238160": "Roofing Contractors",
	"238170": "Siding Contractors",
	"238190": "Other Foundation, Structure, and Building Exterior Contractors",
	"238210": "Electrical Contractors and Other Wiring Installation Contractors",
	"238220": "Plumbing, Heating, and Air-Conditioning Contractors",
	"238290": "Other Building Equipment Contractors",
	"238310": "Drywall and Insulation Contractors",
	"238320": "Painting and Wall Covering Contractors",
	"238330": "Flooring Contractors",
	"238340": "Tile and Terrazzo Contractors",
	"238350": "Finish Carpentry Contractors",
	"238390": "Other Building Finishing Contractors",
	"238910": "Site Preparation Contractors",
	"238990": "All Other Specialty Trade Contractors",

	// Telecommunications (517xxx)
	"517111": "Wired Telecommunications Carriers",
	"517112": "Wireless Telecommunications Carriers (except Satellite)",
	"517121": "Telecommunications Resellers",
	"517410": "Satellite Telecommunications",
	"517911": "Telecommunications Resellers",
	"517919": "All Other Telecommunications",

	// Publishing Industries (511xxx)
	"511110": "Newspaper Publishers",
	"511120": "Periodical Publishers",
	"511130": "Book Publishers",
	"511140": "Directory and Mailing List Publishers",
	"511191": "Greeting Card Publishers",
	"511199": "All Other Publishers",

	// Motion Picture & Video Industries (512xxx)
	"512110": "Motion Picture and Video Production",
	"512120": "Motion Picture and Video Distribution",
	"512131": "Motion Picture Theaters (except Drive-Ins)",
	"512132": "Drive-In Motion Picture Theaters",
	"512191": "Teleproduction and Other Postproduction Services",
	"512199": "Other Motion Picture and Video Industries",

	// Sound Recording Industries (512xxx)
	"512240": "Sound Recording Studios",
	"512250": "Record Production and Distribution",

	// Broadcasting (515xxx)
	"515111": "Radio Networks",
	"515112": "Radio Stations",
	"515120": "Television Broadcasting",
	"515210": "Cable and Other Subscription Programming",

	// Rental & Leasing Services (532xxx)
	"532111": "Passenger Car Rental",
	"532112": "Passenger Car Leasing",
	"532120": "Truck, Utility Trailer, and RV (Recreational Vehicle) Rental and Leasing",
	"532210": "Consumer Electronics and Appliances Rental",
	"532281": "Formal Wear and Costume Rental",
	"532282": "Video Tape and Disc Rental",
	"532283": "Home Health Equipment Rental",
	"532284": "Recreational Goods Rental",
	"532289": "All Other Consumer Goods Rental",
	"532310": "General Rental Centers",
	"532411": "Commercial Air, Rail, and Water Transportation Equipment Rental and Leasing",
	"532412": "Construction, Mining, and Forestry Machinery and Equipment Rental and Leasing",
	"532420": "Office Machinery and Equipment Rental and Leasing",
	"532490": "Other Commercial and Industrial Machinery and Equipment Rental and Leasing",

	// Waste Management & Remediation Services (562xxx)
	"562111": "Solid Waste Collection",
	"562112": "Hazardous Waste Collection",
	"562119": "Other Waste Collection",
	"562211": "Hazardous Waste Treatment and Disposal",
	"562212": "Solid Waste Landfill",
	"562213": "Solid Waste Combustors and Incinerators",
	"562219": "Other Nonhazardous Waste Treatment and Disposal",
	"562910": "Remediation Services",
	"562920": "Materials Recovery Facilities",
	"562991": "Septic Tank and Related Services",
	"562998": "All Other Miscellaneous Waste Management Services",

	// Social Assistance (624xxx)
	"624110": "Child and Youth Services",
	"624120": "Services for the Elderly and Persons with Disabilities",
	"624190": "Other Individual and Family Services",
	"624210": "Community Food Services",
	"624221": "Temporary Shelters",
	"624229": "Other Community Housing Services",
	"624230": "Emergency and Other Relief Services",
	"624310": "Vocational Rehabilitation Services",
	"624410": "Child Care Services",

	// Other Common Federal Contracting Codes
	"811219": "Other Electronic and Precision Equipment Repair and Maintenance",
	"811310": "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance",
	"811412": "Appliance Repair and Maintenance",
};

/**
 * Get NAICS description by code
 * @param code NAICS code (with or without hyphens)
 * @returns Description or null if not found
 */
export function getNAICSDescription(code: string | null | undefined): string | null {
	if (!code) return null;

	// Remove hyphens and spaces
	const cleanCode = code.replace(/[-\s]/g, "");

	return NAICS_DESCRIPTIONS[cleanCode] || null;
}

/**
 * Get formatted NAICS display string
 * @param code NAICS code
 * @param fallbackDescription Optional description from API
 * @returns Formatted string like "541511 - Custom Computer Programming Services" or "NAICS 541511"
 */
export function formatNAICS(
	code: string | null | undefined,
	fallbackDescription?: string | null
): string {
	if (!code) return "Unknown Industry";

	const cleanCode = code.replace(/[-\s]/g, "");
	const description = NAICS_DESCRIPTIONS[cleanCode] || fallbackDescription;

	if (description) {
		return `${cleanCode} - ${description}`;
	}

	return `NAICS ${cleanCode}`;
}
