import { prisma } from "../config/database";
import { HttpRequest } from "../utils/http";
import {
    ApiPackageResponse,
    PackageFilters,
    PackageTrafficHistoryFilters,
} from "../types/package.types";
import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

export class PackageService {
    async fetchAndSavePackageData(): Promise<void> {
        try {
            logger.info("Fetching packages data from API...");

            const response = await HttpRequest.get<ApiPackageResponse>(
                "https://api.infatica.io/packages"
            );

            const packages = response.data.results;
            logger.info(`Fetched ${packages.length} packages from API`);

            for (const apiPackage of packages) {
                try {
                    // Преобразуем данные API в формат базы данных
                    const packageData = {
                        packageKey: apiPackage.package_key,
                        createdAt: new Date(apiPackage.created_at),
                        expiredAt: apiPackage.expired_at
                            ? new Date(apiPackage.expired_at)
                            : null,
                        isSuspended: apiPackage.is_suspended,
                        isActive: apiPackage.is_active,
                        status: apiPackage.status,
                        proxyCount: apiPackage.proxy_count,
                        commonLimit:
                            typeof apiPackage.traffic_limits.common === "number"
                                ? BigInt(apiPackage.traffic_limits.common)
                                : null,
                        dailyLimit:
                            typeof apiPackage.traffic_limits.daily === "number"
                                ? BigInt(apiPackage.traffic_limits.daily)
                                : null,
                        weeklyLimit:
                            typeof apiPackage.traffic_limits.weekly === "number"
                                ? BigInt(apiPackage.traffic_limits.weekly)
                                : null,
                        monthlyLimit:
                            typeof apiPackage.traffic_limits.monthly ===
                            "number"
                                ? BigInt(apiPackage.traffic_limits.monthly)
                                : null,
                        dailyUsage: BigInt(apiPackage.traffic_usage.daily),
                        weeklyUsage: BigInt(apiPackage.traffic_usage.weekly),
                        monthlyUsage: BigInt(apiPackage.traffic_usage.monthly),
                        commonUsage: BigInt(apiPackage.traffic_usage.common),
                        updateDate: new Date(),
                    };

                    // Upsert пакета
                    const savedPackage = await prisma.package.upsert({
                        where: { packageKey: apiPackage.package_key },
                        update: packageData,
                        create: packageData,
                    });

                    // Сохраняем историю трафика за сегодня
                    await this.saveTrafficHistory(
                        savedPackage.id,
                        packageData.dailyUsage
                    );

                    logger.info(
                        `Package ${apiPackage.package_key} updated successfully`
                    );
                } catch (error) {
                    logger.error(
                        `Error processing package ${apiPackage.package_key}:`,
                        error
                    );
                }
            }

            // Очищаем старую историю (старше 31 дня)
            await this.cleanOldTrafficHistory();

            logger.info("Packages data update completed");
        } catch (error) {
            logger.error("Error fetching packages from API:", error);
        }
    }

    private async saveTrafficHistory(
        packageId: bigint,
        dailyUsage: bigint
    ): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Устанавливаем время на начало дня

            await prisma.packageTrafficHistory.upsert({
                where: {
                    packageId_date: {
                        packageId: packageId,
                        date: today,
                    },
                },
                update: {
                    dailyUsage: dailyUsage,
                },
                create: {
                    packageId: packageId,
                    date: today,
                    dailyUsage: dailyUsage,
                },
            });
        } catch (error) {
            logger.error(
                `Error saving traffic history for package ${packageId}:`,
                error
            );
        }
    }

    private async cleanOldTrafficHistory(): Promise<void> {
        try {
            const thirtyOneDaysAgo = new Date();
            thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

            await prisma.packageTrafficHistory.deleteMany({
                where: {
                    date: {
                        lt: thirtyOneDaysAgo,
                    },
                },
            });

            logger.info("Old traffic history cleaned successfully");
        } catch (error) {
            logger.error("Error cleaning old traffic history:", error);
        }
    }

    async getPackages(filters: PackageFilters) {
        const { packageKey, skip = 0, take } = filters;

        const where: any = {};

        if (packageKey) {
            where.packageKey = packageKey;
        }

        const queryOptions: any = {
            where,
            skip,
            orderBy: {
                updateDate: "desc",
            },
        };

        if (take) {
            queryOptions.take = take;
        }

        const packages = await prisma.package.findMany(queryOptions);

        return packages.map((pkg) => ({
            ...pkg,
            remaining: pkg.commonLimit
                ? pkg.commonLimit - pkg.commonUsage
                : BigInt(0),
        }));
    }

    async getPackageById(packageKey: string) {
        const packageData = await prisma.package.findUnique({
            where: { packageKey },
            include: {
                trafficHistory: {
                    orderBy: {
                        date: "desc",
                    },
                    take: 31, // Последние 31 день
                },
            },
        });

        if (!packageData) {
            return null;
        }

        return {
            ...packageData,
            remaining: packageData.commonLimit
                ? packageData.commonLimit - packageData.commonUsage
                : BigInt(0),
        };
    }

    async getPackageTrafficHistory(filters: PackageTrafficHistoryFilters) {
        const { packageId, days = 30 } = filters;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return prisma.packageTrafficHistory.findMany({
            where: {
                packageId: packageId,
                date: {
                    gte: startDate,
                },
            },
            orderBy: {
                date: "asc",
            },
        });
    }

    // Метод для получения статистики по всем пакетам - FIXED: proper BigInt operations
    async getPackagesStats() {
        const packages = await prisma.package.findMany();

        // FIXED: Initialize with BigInt(0) and handle null values properly
        const totalLimit = packages.reduce(
            (sum, pkg) => sum + (pkg.commonLimit || BigInt(0)),
            BigInt(0)
        );
        const totalUsage = packages.reduce(
            (sum, pkg) => sum + pkg.commonUsage,
            BigInt(0)
        );
        const totalRemaining = totalLimit - totalUsage;

        return {
            totalPackages: packages.length,
            totalLimit,
            totalUsage,
            totalRemaining,
            activePackages: packages.filter((pkg) => pkg.isActive).length,
            suspendedPackages: packages.filter((pkg) => pkg.isSuspended).length,
        };
    }
}
