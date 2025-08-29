import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    log: ["error"],
});

export const connectDatabase = async (): Promise<void> => {
    try {
        await prisma.$connect();
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
};

export const disconnectDatabase = async (): Promise<void> => {
    await prisma.$disconnect();
};
