export interface DataItem {
    country: string;
    city: string;
    subdivision: string;
    id: number;
    isp: string;
    asn: number;
    nodes: number;
}

export interface ZipCodeData {
    id: bigint;
    zip: string;
    country: string;
    subdivision: string;
    city: string;
    createDate: Date;
}

export interface CityData {
    city: string;
    data: Array<{
        id: number;
        isp: string;
        asn: number;
        nodes: number;
        zips: string[];
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

export interface ResidentialZipCodeRelation {
    id: bigint;
    residentialId: bigint;
    zipCodeId: bigint;
    createDate: Date;
    zipCode: ZipCodeData;
}

export interface ResidentialWithZipCodes extends DataItem {
    zipCodes?: ResidentialZipCodeRelation[];
}

export interface DataItemWithZipCodes extends DataItem {
    zipCodes?: Array<{
        id: bigint;
        zipCode: {
            id: bigint;
            zip: string;
            country: string;
            subdivision: string;
            city: string;
        };
    }>;
}
