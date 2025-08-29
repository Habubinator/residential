import { prisma } from "../config/database";
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

export class ResidentialService {
    async fetchAndSaveResidentialData(): Promise<void> {
        try {
            const response = await HttpRequest.get(
                "https://api.infatica.io/count-by-geo"
            );
            const data = response.data;

            console.log(`Fetched ${data.length} records from API`);

            if (data?.length < 10000) {
                console.log(`Update stopped. Small amount records from API`);
                return;
            }

            // Upsert данные пакетами
            const BATCH_SIZE = 1000;
            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);

                try {
                    const upsertPromises = batch.map((item: any) =>
                        prisma.residential.upsert({
                            where: {
                                country_subdivision_city_isp_asn: {
                                    country: item.country,
                                    subdivision: item.subdivision,
                                    city: item.city,
                                    isp: item.isp,
                                    asn: item.asn,
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
                                nodes: item.nodes,
                                zipCodeId: undefined, // Будет заполнено позже
                            },
                        })
                    );

                    await Promise.all(upsertPromises);

                    console.log(
                        `Residential data upserted successfully for batch starting at index ${i}:`,
                        batch.length
                    );

                    if (batch.length < 1000) {
                        console.log(`Residential data upserted successfully`);
                    }
                } catch (error) {
                    console.error(
                        "Error upserting residential entities in batch:",
                        error
                    );
                }
            }

            // After saving residential data, match ZIP codes
            await this.matchZipCodes();
        } catch (error) {
            console.error("Error fetching data from API:", error);
        }
    }

    async fetchAndSaveZipCodes(): Promise<void> {
        try {
            const response = await HttpRequest.post(
                "https://api.infatica.io/zip-codes"
            );
            const zipData = response.data;

            logger.info(`Fetched ${zipData.length} ZIP code arrays from API`);

            // Flatten the array of arrays and save ZIP codes
            const allZipCodes = zipData.flat().map((item: any) => ({
                zip: item.zip,
                country: item.country,
                subdivision: item.subdivision,
                city: item.city,
            }));

            // Upsert ZIP codes in batches
            const BATCH_SIZE = 5000;
            for (let i = 0; i < allZipCodes.length; i += BATCH_SIZE) {
                const batch = allZipCodes.slice(i, i + BATCH_SIZE);

                try {
                    const upsertPromises = batch.map((zipCode: any) =>
                        prisma.zipCode.upsert({
                            where: { zip: zipCode.zip },
                            update: {
                                country: zipCode.country,
                                subdivision: zipCode.subdivision,
                                city: zipCode.city,
                            },
                            create: zipCode,
                        })
                    );

                    await Promise.all(upsertPromises);
                    logger.info(
                        `ZIP codes batch upserted: ${batch.length} records`
                    );
                } catch (error) {
                    logger.error("Error upserting ZIP codes batch:", error);
                }
            }

            logger.info(`Total ZIP codes processed: ${allZipCodes.length}`);
        } catch (error) {
            logger.error("Error fetching ZIP codes from API:", error);
        }
    }

    async matchZipCodes(): Promise<void> {
        try {
            logger.info("Starting ZIP code matching process");

            // Получаем все резиденциальные записи без ZIP-кодов
            const residentialRecords = await prisma.residential.findMany({
                where: { zipCodeId: null },
            });

            let updatedCount = 0;
            const UPDATE_BATCH_SIZE = 500;

            for (
                let i = 0;
                i < residentialRecords.length;
                i += UPDATE_BATCH_SIZE
            ) {
                const batch = residentialRecords.slice(
                    i,
                    i + UPDATE_BATCH_SIZE
                );

                const updates = await Promise.allSettled(
                    batch.map(async (record) => {
                        // Найти подходящие ZIP-коды для этой локации
                        const matchingZipCodes = await prisma.zipCode.findMany({
                            where: {
                                country: record.country,
                                subdivision: record.subdivision,
                                city: record.city,
                            },
                            take: 1, // Берем первый подходящий ZIP-код
                        });

                        if (matchingZipCodes.length > 0) {
                            return prisma.residential.update({
                                where: { id: record.id },
                                data: { zipCodeId: matchingZipCodes[0].id },
                            });
                        }
                        return null;
                    })
                );

                const successfulUpdates = updates.filter(
                    (result) =>
                        result.status === "fulfilled" && result.value !== null
                ).length;

                updatedCount += successfulUpdates;

                logger.info(
                    `Processed batch ${
                        Math.floor(i / UPDATE_BATCH_SIZE) + 1
                    }: ${successfulUpdates} updates`
                );
            }

            logger.info(
                `ZIP code matching completed. Updated ${updatedCount} records`
            );
        } catch (error) {
            logger.error("Error matching ZIP codes:", error);
        }
    }

    async clearResidentialData(): Promise<void> {
        try {
            await prisma.residential.deleteMany();
            console.log("Residential data cleared successfully.");
        } catch (error) {
            console.error("Error clearing residential data:", error);
        }
    }

    async getResidentials(filters: {
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
        }

        // Добавляем фильтрацию по ZIP-коду через relation
        if (zip) {
            where.zipCode = {
                zip: zip,
            };
        }

        const queryOptions: any = {
            where,
            skip,
            include: {
                zipCode: true, // Включаем данные ZIP-кода в ответ
            },
        };

        if (take) {
            queryOptions.take = take;
        }

        if (!country) {
            // Return only unique countries
            return prisma.residential.findMany({
                where: { nodes: { gt: nodes } },
                select: { country: true },
                distinct: ["country"],
            });
        }

        return prisma.residential.findMany(queryOptions);
    }
}
