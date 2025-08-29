import "dotenv/config";
import app from "./app";
import { ServerConfig } from "./config/server.config";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { ResidentialService } from "./services/residential.service";
import { DataCenterService } from "./services/datacenter.service";
import { MobileService } from "./services/mobile.service";
import * as cron from "node-cron";
import winston from "winston";

BigInt.prototype["toJSON"] = function () {
    return this.toString();
};

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

async function bootstrap() {
    try {
        // Connect to database
        await connectDatabase();

        // Setup services
        const residentialService = new ResidentialService();
        const dataCenterService = new DataCenterService();
        const mobileService = new MobileService();

        // Every 5 minutes cron job for all data types
        cron.schedule("*/5 * * * *", async () => {
            console.log("Cron job started at:", new Date().toISOString());
            try {
                residentialService.fetchAndSaveZipCodes().then(async () => {
                    console.log(
                        "ZIP codes updated successfully at",
                        new Date().toISOString()
                    );
                    residentialService
                        .fetchAndSaveResidentialData()
                        .then(() => {
                            console.log(
                                "Residential data updated successfully at",
                                new Date().toISOString()
                            );
                        });
                });
            } catch (error) {
                console.error(
                    "Cron job failed at:",
                    new Date().toISOString(),
                    error
                );
            }

            try {
                dataCenterService.fetchAndSaveDataCenterData().then(() => {
                    console.log(
                        "Data center data updated successfully at",
                        new Date().toISOString()
                    );
                });
            } catch (error) {
                console.error(
                    "Cron job failed at:",
                    new Date().toISOString(),
                    error
                );
            }

            try {
                mobileService.fetchAndSaveMobileData().then(() => {
                    console.log(
                        "Mobile data updated successfully at",
                        new Date().toISOString()
                    );
                });
            } catch (error) {
                console.error(
                    "Cron job failed at:",
                    new Date().toISOString(),
                    error
                );
            }
        });

        // Start server
        const port = ServerConfig.PORT;
        const server = app.listen(port, () => {
            logger.info(
                `Server ORDER ${ServerConfig.ORDER} listening on port ${port}`
            );
            logger.info(`Server URL is http://localhost:${port}`);
        });

        // Graceful shutdown
        process.on("SIGTERM", async () => {
            logger.info("SIGTERM received");
            server.close(async () => {
                logger.info("HTTP server closed");
                await disconnectDatabase();
                process.exit(0);
            });
        });

        process.on("SIGINT", async () => {
            logger.info("SIGINT received");
            server.close(async () => {
                logger.info("HTTP server closed");
                await disconnectDatabase();
                process.exit(0);
            });
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}

bootstrap();
