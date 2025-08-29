import { prisma } from "../config/database";
import { HttpRequest } from "../utils/http";

export class MobileService {
    async fetchAndSaveMobileData(): Promise<void> {
        try {
            const response = await HttpRequest.get(
                "https://api.infatica.io/count-by-geo-mob"
            );
            const data = response.data;

            console.log(`Fetched ${data.length} mobile records from API`);

            if (data?.length < 1000) {
                console.log(
                    `Update stopped. Small amount of mobile records from API`
                );
                return;
            }

            // Upsert данные пакетами
            const BATCH_SIZE = 1000;
            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);

                try {
                    const upsertPromises = batch.map((item: any) =>
                        prisma.mobile.upsert({
                            where: {
                                country_subdivision_city_isp_asn_zip: {
                                    country: item.country,
                                    subdivision: item.subdivision,
                                    city: item.city,
                                    isp: item.isp,
                                    asn: item.asn,
                                    zip: item.zip,
                                },
                            },
                            update: {
                                nodes: item.nodes,
                            },
                            create: {
                                country: item.country,
                                subdivision: item.subdivision,
                                city: item.city,
                                isp: item.isp,
                                asn: item.asn,
                                zip: item.zip,
                                nodes: item.nodes,
                            },
                        })
                    );

                    await Promise.all(upsertPromises);

                    console.log(
                        `Mobile data upserted successfully for batch starting at index ${i}:`,
                        batch.length
                    );

                    if (batch.length < 1000) {
                        console.log(`Mobile data upserted successfully`);
                    }
                } catch (error) {
                    console.error(
                        "Error upserting mobile entities in batch:",
                        error
                    );
                }
            }
        } catch (error) {
            console.error("Error fetching mobile data from API:", error);
        }
    }

    async clearMobileData(): Promise<void> {
        try {
            await prisma.mobile.deleteMany();
            console.log("Mobile data cleared successfully.");
        } catch (error) {
            console.error("Error clearing mobile data:", error);
        }
    }

    async getMobiles(filters: {
        country?: string;
        subdivision?: string;
        city?: string;
        isp?: string;
        asn?: number;
        nodes?: number;
        zip?: string;
        skip?: number;
        take?: number;
    }) {
        const {
            country,
            subdivision,
            city,
            isp,
            asn,
            nodes = 0,
            zip,
            skip = 0,
            take,
        } = filters;

        const where: any = {
            nodes: {
                gt: nodes,
            },
        };

        if (country) {
            where.country = country;
            if (subdivision) where.subdivision = subdivision;
            if (city) where.city = city;
            if (isp) where.isp = isp;
            if (asn) where.asn = asn;
            if (zip) where.zip = zip;
        }

        const queryOptions: any = {
            where,
            skip,
        };

        if (take) {
            queryOptions.take = take;
        }

        if (!country) {
            // Return only unique countries
            return prisma.mobile.findMany({
                where: { nodes: { gt: nodes } },
                select: { country: true },
                distinct: ["country"],
            });
        }

        return prisma.mobile.findMany(queryOptions);
    }
}
