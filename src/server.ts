import "dotenv/config";
import app from "./app";
import { ServerConfig } from "./config/server.config";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { ResidentialService } from "./services/residential.service";
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

        // Setup cron job
        const residentialService = new ResidentialService();

        // Every 5 minutes cron job
        cron.schedule("*/5 * * * *", async () => {
            console.log("Cron job started at:", new Date().toISOString());
            try {
                await residentialService.fetchAndSaveResidentialData();
                console.log(
                    "Cron job completed successfully at:",
                    new Date().toISOString()
                );
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
