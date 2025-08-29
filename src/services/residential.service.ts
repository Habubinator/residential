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
            logger.info(`Fetching records from API...`);

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
            logger.info(`Fetching ZIP codes arrays...`);

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

            // Сначала очистим все существующие связи many-to-many
            await prisma.residentialZipCode.deleteMany();
            logger.info("Cleared existing residential-zipcode relations");

            // Получаем все резиденциальные записи
            const residentialRecords = await prisma.residential.findMany();

            let totalRelationsCreated = 0;
            const BATCH_SIZE = 500;

            for (let i = 0; i < residentialRecords.length; i += BATCH_SIZE) {
                const batch = residentialRecords.slice(i, i + BATCH_SIZE);

                // Для каждой резиденциальной записи в батче
                const relationPromises = batch.map(async (record) => {
                    // Найти ВСЕ подходящие ZIP-коды для этой локации
                    const matchingZipCodes = await prisma.zipCode.findMany({
                        where: {
                            country: record.country,
                            subdivision: record.subdivision,
                            city: record.city,
                        },
                    });

                    // Создать связи many-to-many для ВСЕХ подходящих ZIP-кодов
                    if (matchingZipCodes.length > 0) {
                        const relations = matchingZipCodes.map((zipCode) => ({
                            residentialId: record.id,
                            zipCodeId: zipCode.id,
                        }));

                        await prisma.residentialZipCode.createMany({
                            data: relations,
                            skipDuplicates: true,
                        });

                        return matchingZipCodes.length;
                    }
                    return 0;
                });

                const results = await Promise.allSettled(relationPromises);
                const batchRelationsCreated = results.reduce((sum, result) => {
                    return (
                        sum + (result.status === "fulfilled" ? result.value : 0)
                    );
                }, 0);

                totalRelationsCreated += batchRelationsCreated;

                logger.info(
                    `Processed batch ${
                        Math.floor(i / BATCH_SIZE) + 1
                    }: ${batchRelationsCreated} relations created`
                );
            }

            logger.info(
                `ZIP code matching completed. Created ${totalRelationsCreated} total relations`
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

        // Добавляем фильтрацию по ZIP-коду через many-to-many relation
        if (zip) {
            where.zipCodes = {
                some: {
                    zipCode: {
                        zip: zip,
                    },
                },
            };
        }

        const queryOptions: any = {
            where,
            skip,
            include: {
                zipCodes: {
                    include: {
                        zipCode: true, // Включаем данные всех ZIP-кодов
                    },
                },
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
