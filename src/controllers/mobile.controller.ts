import { Request, Response } from "express";
import { MobileService } from "../services/mobile.service";
import { MobileItem, CountryData } from "../types/residential.types";
import { HttpRequest } from "../utils/http";
import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

let subdivisionData: Record<string, number> = {};

const fetchDataId = async () => {
    try {
        const response = await HttpRequest.get(
            "https://api.infatica.io/subdivision-codes"
        );
        subdivisionData = response.data[0].reduce((acc: any, item: any) => {
            acc[item.subdivision] = item.code;
            return acc;
        }, {});
        logger.info("Subdivision code data fetched successfully for Mobile");
    } catch (e) {
        logger.error("Error fetching subdivision code data for Mobile", e);
    }
};

fetchDataId();

export class MobileController {
    private mobileService = new MobileService();

    async fetchMobiles(req: Request, res: Response): Promise<void> {
        try {
            await this.mobileService.fetchAndSaveMobileData();
            res.json({ message: "Mobile data has been updated." });
        } catch (error) {
            logger.error("Error in fetchMobiles:", error);
            res.status(500).json({ error: "Failed to fetch mobile data" });
        }
    }

    async getMobiles(req: Request, res: Response): Promise<void> {
        try {
            const {
                country,
                subdivision,
                city,
                isp,
                asn,
                nodes,
                zip,
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
                zip: zip as string,
                skip: Number(skip),
                take: take ? Number(take) : undefined,
            };

            const data = await this.mobileService.getMobiles(filters);

            if (country) {
                const transformedData = this.transformMobileData(
                    data as MobileItem[]
                );
                res.json(transformedData);
            } else {
                const transformedData = this.transformDataCountry(
                    data as any[]
                );
                res.json(transformedData);
            }
        } catch (error) {
            logger.error("Error in getMobiles:", error);
            res.status(500).json({ error: "Failed to get mobile data" });
        }
    }

    private transformMobileData(arr: MobileItem[]): CountryData[] {
        const result: {
            [key: string]: {
                divisions: {
                    [key: string]: { cities: { [key: string]: any } };
                };
            };
        } = {};

        const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

        arr.forEach((item) => {
            const { country, city, subdivision, id, isp, asn, nodes, zip } =
                item;

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

            result[country].divisions[subdivision].cities[city].data.push({
                id,
                isp,
                asn,
                nodes,
                zip,
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
