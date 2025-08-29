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

            // Очищаємо дані перед збереженням нових записів
            await this.clearResidentialData();

            // Зберігаємо дані пакетами
            const BATCH_SIZE = 5000;
            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const batch = data
                    .slice(i, i + BATCH_SIZE)
                    .map((item: any) => ({
                        country: item.country,
                        subdivision: item.subdivision,
                        city: item.city,
                        isp: item.isp,
                        asn: item.asn,
                        nodes: item.nodes,
                    }));

                try {
                    await prisma.residential.createMany({
                        data: batch,
                        skipDuplicates: true,
                    });

                    console.log(
                        `Residential data saved successfully for batch starting at index ${i}:`,
                        batch.length
                    );

                    if (batch.length < 1000) {
                        console.log(`Residential data saved successfully`);
                    }
                } catch (error) {
                    console.error(
                        "Error saving residential entities in batch:",
                        error
                    );
                }
            }
        } catch (error) {
            console.error("Error fetching data from API:", error);
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

        const queryOptions: any = {
            where,
            skip,
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
