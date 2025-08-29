import { Request, Response } from "express";
import { ResidentialService } from "../services/residential.service";
import { HttpRequest } from "../utils/http";
import { DataItemWithZipCodes, CountryData } from "../types/residential.types";
import winston from "winston";

const FormData = require("form-data");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

let subdivisionData: Record<string, number> = {};
let ispData: Record<string, number> = {};

const fetchDataId = async () => {
    logger.info("Started fetching subdivision code data");

    try {
        const response = await HttpRequest.get(
            "https://api.infatica.io/subdivision-codes"
        );

        subdivisionData = response.data[0].reduce((acc: any, item: any) => {
            acc[item.subdivision] = item.code;
            return acc;
        }, {});

        logger.info("Subdivision code data fetched successfully");
    } catch (e) {
        logger.error("Error fetching subdivision code data", e);
    }
};

const fetchDataIsp = async () => {
    logger.info("Started fetching ISP code data");

    try {
        const formData = new FormData();
        formData.append("email", "dentk222@gmail.com");
        formData.append("password", "nuzpyx-soWpiw-kysdu0");

        const response = await HttpRequest.post(
            "https://dashboard.infatica.io/includes/api/client/isp_codes.php",
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        ispData = response.data[0].reduce((acc: any, item: any) => {
            acc[item.isp] = item.code;
            return acc;
        }, {});

        logger.info("ISP code data fetched successfully");
    } catch (e) {
        logger.error("Error fetching ISP code data", e);
    }
};

// Initialize data
fetchDataId();
fetchDataIsp();

export class ResidentialController {
    private residentialService = new ResidentialService();

    async fetchResidentials(req: Request, res: Response): Promise<void> {
        try {
            await this.residentialService.fetchAndSaveResidentialData();
            res.json({ message: "Residential data has been updated." });
        } catch (error) {
            logger.error("Error in fetchResidentials:", error);
            res.status(500).json({ error: "Failed to fetch residential data" });
        }
    }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            logger.info("Got data from webhook");
            console.log(req.body);

            const incomingData = req.body;
            const transformedData = this.transformWebhookData(incomingData);

            const apiUrl = "https://gonzoproxy.com/api/1.1/wf/wfp_hook";

            logger.info("Send data from webhook - Loading");

            if (transformedData.transactionStatus === "Approved") {
                await HttpRequest.post(apiUrl, transformedData);

                logger.info("Send data from webhook - Success");

                const response = {
                    orderReference: transformedData.orderReference,
                    status: "accept",
                    time: this.getCurrentTimeInPlusTwoTimezone(),
                    signature: transformedData.merchantSignature,
                };

                logger.info("Webhook response:", response);
                res.json(response);
            } else {
                res.json({ status: "success", data: "Success" });
            }
        } catch (error) {
            logger.error("Send data from webhook - Error", error);
            res.json({ status: "success", data: "Success" });
        }
    }

    async getResidentials(req: Request, res: Response): Promise<void> {
        try {
            const {
                country,
                subdivision,
                city,
                isp,
                asn,
                nodes,
                zip, // Поддерживаем фильтрацию по ZIP
                skip = 0,
                take,
            } = req.query;

            const filters = {
                country: country as string,
                subdivision: subdivision as string,
                city: city as string,
                isp: isp as string,
                asn: asn ? Number(asn) : undefined,
                nodes: nodes ? Number(nodes) : undefined,
                zip: zip as string, // Добавляем ZIP в фильтры
                skip: Number(skip),
                take: take ? Number(take) : undefined,
            };

            const data = await this.residentialService.getResidentials(filters);

            if (country) {
                const transformedData = this.transformData(
                    data as DataItemWithZipCodes[]
                );
                res.json(transformedData);
            } else {
                const transformedData = this.transformDataCountry(
                    data as any[]
                );
                res.json(transformedData);
            }
        } catch (error) {
            logger.error("Error in getResidentials:", error);
            res.status(500).json({ error: "Failed to get residential data" });
        }
    }

    async fetchISPData(req: Request, res: Response): Promise<void> {
        try {
            const { ispName } = req.query;
            const data = ispData[ispName as string] || null;

            res.json({ isp: ispName, code: data });
        } catch (error) {
            logger.error("Error in fetchISPData:", error);
            res.status(500).json({ error: "Failed to fetch ISP data" });
        }
    }

    async fetchZipCodes(req: Request, res: Response): Promise<void> {
        try {
            await this.residentialService.fetchAndSaveZipCodes();
            res.json({ message: "ZIP codes have been updated successfully." });
        } catch (error) {
            logger.error("Error in fetchZipCodes:", error);
            res.status(500).json({ error: "Failed to fetch ZIP codes" });
        }
    }

    async matchZipCodes(req: Request, res: Response): Promise<void> {
        try {
            await this.residentialService.matchZipCodes();
            res.json({ message: "ZIP codes matching completed successfully." });
        } catch (error) {
            logger.error("Error in matchZipCodes:", error);
            res.status(500).json({ error: "Failed to match ZIP codes" });
        }
    }

    private getCurrentTimeInPlusTwoTimezone(): number {
        const now = new Date();
        const utcTime = now.getTime();
        const localTimezoneOffset = now.getTimezoneOffset();
        const offsetInMilliseconds = (localTimezoneOffset + -120) * 60 * 1000;
        return Math.floor((utcTime + offsetInMilliseconds) / 1000);
    }

    private transformWebhookData(incomingData: any): any {
        try {
            const dataString = Object.keys(incomingData)[0];

            const extractField = (fieldName: string): string | null => {
                const regex = new RegExp(`"${fieldName}":\\s?"(.*?)"`, "i");
                const match = dataString.match(regex);
                return match ? match[1] : null;
            };

            const orderReference = extractField("orderReference");
            const merchantSignature = extractField("merchantSignature");
            const transactionStatus = extractField("transactionStatus");

            return {
                orderReference,
                merchantSignature,
                transactionStatus,
            };
        } catch (error) {
            logger.error("Error extracting fields from incoming data", error);
            return {};
        }
    }

    private transformData(arr: DataItemWithZipCodes[]): CountryData[] {
        const result: {
            [key: string]: {
                divisions: {
                    [key: string]: { cities: { [key: string]: any } };
                };
            };
        } = {};

        const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

        arr.forEach((item) => {
            const {
                country,
                city,
                subdivision,
                id,
                isp,
                asn,
                nodes,
                zipCodes,
            } = item;

            if (!result[country]) {
                result[country] = { divisions: {} };
            }

            if (!result[country].divisions[subdivision]) {
                result[country].divisions[subdivision] = { cities: {} };
            }

            if (!result[country].divisions[subdivision].cities[city]) {
                result[country].divisions[subdivision].cities[city] = {
                    city,
                    data: [],
                };
            }

            // Извлекаем все ZIP-коды в массив
            const zipCodesArray = zipCodes?.map((zc) => zc.zipCode.zip) || [];

            result[country].divisions[subdivision].cities[city].data.push({
                id,
                isp,
                asn,
                nodes,
                zips: zipCodesArray, // Теперь zips - это массив
            });
        });

        return Object.keys(result).map((countryKey) => ({
            country: countryKey,
            countryName: regionNames.of(countryKey) || countryKey,
            divisions: Object.keys(result[countryKey].divisions).map(
                (subdivisionKey) => ({
                    subdivision: subdivisionKey,
                    subdivisionCode: subdivisionData[subdivisionKey] || null,
                    cities: Object.values(
                        result[countryKey].divisions[subdivisionKey].cities
                    ),
                })
            ),
        }));
    }

    private transformDataCountry(
        arr: { country: string }[]
    ): { country: string; countryName: string }[] {
        const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
        const uniqueCountries = new Set<string>();

        arr.forEach((item) => {
            uniqueCountries.add(item.country);
        });

        return Array.from(uniqueCountries).map((countryKey) => ({
            country: countryKey,
            countryName: regionNames.of(countryKey) || countryKey,
        }));
    }
}
