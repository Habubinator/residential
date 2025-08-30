import { Request, Response } from "express";
import { PackageService } from "../services/package.service";
import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

export class PackageController {
    private packageService = new PackageService();

    async fetchPackages(req: Request, res: Response): Promise<void> {
        try {
            await this.packageService.fetchAndSavePackageData();
            res.json({ message: "Packages data has been updated." });
        } catch (error) {
            logger.error("Error in fetchPackages:", error);
            res.status(500).json({ error: "Failed to fetch packages data" });
        }
    }

    async getPackages(req: Request, res: Response): Promise<void> {
        try {
            const { packageKey, skip = 0, take } = req.query;

            const filters = {
                packageKey: packageKey as string,
                skip: Number(skip),
                take: take ? Number(take) : undefined,
            };

            const packages = await this.packageService.getPackages(filters);

            // Преобразуем BigInt в строки для JSON
            const responsePackages = packages.map((pkg) => ({
                ...pkg,
                id: pkg.id.toString(),
                commonLimit: pkg.commonLimit.toString(),
                dailyLimit: pkg.dailyLimit?.toString() || null,
                weeklyLimit: pkg.weeklyLimit?.toString() || null,
                monthlyLimit: pkg.monthlyLimit?.toString() || null,
                dailyUsage: pkg.dailyUsage.toString(),
                weeklyUsage: pkg.weeklyUsage.toString(),
                monthlyUsage: pkg.monthlyUsage.toString(),
                commonUsage: pkg.commonUsage.toString(),
                remaining: pkg.remaining.toString(),
            }));

            res.json(responsePackages);
        } catch (error) {
            logger.error("Error in getPackages:", error);
            res.status(500).json({ error: "Failed to get packages data" });
        }
    }

    async getPackageById(req: Request, res: Response) {
        try {
            const { packageKey } = req.params;

            if (!packageKey) {
                return res
                    .status(400)
                    .json({ error: "Package key is required" });
            }

            const packageData = await this.packageService.getPackageById(
                packageKey
            );

            if (!packageData) {
                return res.status(404).json({ error: "Package not found" });
            }

            // Преобразуем BigInt в строки для JSON
            const responsePackage = {
                ...packageData,
                id: packageData.id.toString(),
                commonLimit: packageData.commonLimit.toString(),
                dailyLimit: packageData.dailyLimit?.toString() || null,
                weeklyLimit: packageData.weeklyLimit?.toString() || null,
                monthlyLimit: packageData.monthlyLimit?.toString() || null,
                dailyUsage: packageData.dailyUsage.toString(),
                weeklyUsage: packageData.weeklyUsage.toString(),
                monthlyUsage: packageData.monthlyUsage.toString(),
                commonUsage: packageData.commonUsage.toString(),
                remaining: packageData.remaining.toString(),
                trafficHistory:
                    packageData.trafficHistory?.map((history) => ({
                        ...history,
                        id: history.id.toString(),
                        packageId: history.packageId.toString(),
                        dailyUsage: history.dailyUsage.toString(),
                    })) || [],
            };

            res.json(responsePackage);
        } catch (error) {
            logger.error("Error in getPackageById:", error);
            res.status(500).json({ error: "Failed to get package data" });
        }
    }

    async getPackageTrafficHistory(req: Request, res: Response) {
        try {
            const { packageId } = req.params;
            const { days = 30 } = req.query;

            if (!packageId) {
                return res
                    .status(400)
                    .json({ error: "Package ID is required" });
            }

            const filters = {
                packageId: BigInt(packageId),
                days: Number(days),
            };

            const trafficHistory =
                await this.packageService.getPackageTrafficHistory(filters);

            const responseHistory = trafficHistory.map((history) => ({
                ...history,
                id: history.id.toString(),
                packageId: history.packageId.toString(),
                dailyUsage: history.dailyUsage.toString(),
            }));

            res.json(responseHistory);
        } catch (error) {
            logger.error("Error in getPackageTrafficHistory:", error);
            res.status(500).json({
                error: "Failed to get package traffic history",
            });
        }
    }

    async getPackagesStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await this.packageService.getPackagesStats();

            // Преобразуем BigInt в строки для JSON
            const responseStats = {
                ...stats,
                totalLimit: stats.totalLimit.toString(),
                totalUsage: stats.totalUsage.toString(),
                totalRemaining: stats.totalRemaining.toString(),
            };

            res.json(responseStats);
        } catch (error) {
            logger.error("Error in getPackagesStats:", error);
            res.status(500).json({ error: "Failed to get packages stats" });
        }
    }
}
