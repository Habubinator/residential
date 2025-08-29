export interface DataItem {
    country: string;
    city: string;
    subdivision: string;
    id: number;
    isp: string;
    asn: number;
    nodes: number;
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
