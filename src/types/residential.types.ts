export interface DataItem {
    country: string;
    city: string;
    subdivision: string;
    id: number;
    isp: string;
    asn: number;
    nodes: number;
    zip?: string;
}

export interface ZipCodeData {
    zip: string;
    country: string;
    subdivision: string;
    city: string;
}

export interface CityData {
    city: string;
    data: Array<{
        id: number;
        isp: string;
        asn: number;
        nodes: number;
    }>;
}

export interface DataItemWithZip extends DataItem {
    zipCode?: {
        id: bigint;
        zip: string;
        country: string;
        subdivision: string;
        city: string;
    } | null;
}

export interface SubdivisionData {
    subdivision: string;
    subdivisionCode: number | null;
    cities: CityData[];
}

export interface CountryData {
    country: string;
    countryName: string;
    divisions: SubdivisionData[];
}

export interface WebhookData {
    orderReference: string;
    merchantSignature: string;
    transactionStatus: string;
}
