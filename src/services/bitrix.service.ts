import { HttpRequest } from "../utils/http";
import { PackageService } from "./package.service";
import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

interface BitrixContact {
    ID: string;
    PACKAGE_ID: string;
}

interface BitrixContactsResponse {
    result: {
        CONTACTS: BitrixContact[];
    };
}

interface PackageTrafficData {
    remaining: bigint;
    dailyUsage: bigint;
    weeklyUsage: bigint;
    monthlyUsage: bigint;
    commonUsage: bigint;
    isActive: boolean;
}

interface BitrixUpdateFields {
    UF_CRM_1740404730667: string; // Осталось ГБ
    UF_CRM_1740404794225: string; // Потрачено за День
    UF_CRM_1740404853908: string; // Потрачено за Неделю
    UF_CRM_1740404892655: string; // Потрачено за Месяц
    UF_CRM_1740404935906: string; // Потрачено Всего
    UF_CRM_1740404976395: boolean; // Активный\Неактивный пакет
}

export class BitrixService {
    private readonly GET_CONTACTS_URL = `https://gonzoproxy.cloud/rest/1/${process.env.BITRIX_GET_CREDS}/ateam.get.contacts.json`;
    private readonly UPDATE_CONTACTS_URL = `https://gonzoproxy.cloud/rest/1/${process.env.BITRIX_SET_CREDS}/ateam.update.contacts.json`;

    /**
     * Получает список контактов с их PACKAGE_ID из Битрикс24
     */
    async getBitrixContacts(): Promise<BitrixContact[]> {
        try {
            logger.info("Fetching contacts from Bitrix24...");

            const response = await HttpRequest.get<BitrixContactsResponse>(
                this.GET_CONTACTS_URL
            );

            if (!response.data?.result?.CONTACTS) {
                throw new Error("Invalid response structure from Bitrix24");
            }

            const contacts = response.data.result.CONTACTS;
            logger.info(`Fetched ${contacts.length} contacts from Bitrix24`);

            return contacts;
        } catch (error) {
            logger.error("Error fetching contacts from Bitrix24:", error);
            throw error;
        }
    }

    /**
     * Обновляет контакт в Битрикс24
     */
    async updateBitrixContact(
        contactId: string,
        fields: BitrixUpdateFields
    ): Promise<void> {
        try {
            const updateData = {
                id: contactId,
                fields: fields,
            };

            logger.info(`Updating contact ${contactId} in Bitrix24...`);

            await HttpRequest.post(this.UPDATE_CONTACTS_URL, updateData);

            logger.info(
                `Successfully updated contact ${contactId} in Bitrix24`
            );
        } catch (error) {
            logger.error(
                `Error updating contact ${contactId} in Bitrix24:`,
                error
            );
            throw error;
        }
    }

    /**
     * Конвертирует байты в гигабайты с точностью до 2 знаков после запятой
     */
    private bytesToGB(bytes: bigint): string {
        const gb = Number(bytes) / (1024 * 1024 * 1024);
        return gb.toFixed(2);
    }

    /**
     * Подготавливает поля для обновления в Битрикс24 на основе данных пакета
     */
    private prepareUpdateFields(
        trafficData: PackageTrafficData
    ): BitrixUpdateFields {
        return {
            UF_CRM_1740404730667: this.bytesToGB(trafficData.remaining), // Осталось ГБ
            UF_CRM_1740404794225: this.bytesToGB(trafficData.dailyUsage), // Потрачено за День
            UF_CRM_1740404853908: this.bytesToGB(trafficData.weeklyUsage), // Потрачено за Неделю
            UF_CRM_1740404892655: this.bytesToGB(trafficData.monthlyUsage), // Потрачено за Месяц
            UF_CRM_1740404935906: this.bytesToGB(trafficData.commonUsage), // Потрачено Всего
            UF_CRM_1740404976395: trafficData.isActive,
        };
    }

    /**
     * Синхронизирует данные трафика пакетов с Битрикс24
     */
    async syncPackageDataToBitrix(
        packageData: Map<string, PackageTrafficData>
    ): Promise<void> {
        try {
            logger.info("Starting synchronization with Bitrix24...");

            // Получаем список контактов из Битрикс24
            const bitrixContacts = await this.getBitrixContacts();

            let updatedCount = 0;
            let errorCount = 0;

            // Обрабатываем каждый контакт
            for (const contact of bitrixContacts) {
                try {
                    // Ищем данные пакета по PACKAGE_ID
                    const trafficData = packageData.get(contact.PACKAGE_ID);

                    if (!trafficData) {
                        logger.warn(
                            `Package data not found for PACKAGE_ID: ${contact.PACKAGE_ID} (Contact ID: ${contact.ID})`
                        );
                        continue;
                    }

                    // Подготавливаем поля для обновления
                    const updateFields = this.prepareUpdateFields(trafficData);

                    // Обновляем контакт в Битрикс24
                    await this.updateBitrixContact(contact.ID, updateFields);

                    updatedCount++;

                    // Добавляем небольшую задержку между запросами, чтобы не превысить лимиты API
                    await this.sleep(100);
                } catch (error) {
                    logger.error(
                        `Error processing contact ${contact.ID} with package ${contact.PACKAGE_ID}:`,
                        error
                    );
                    errorCount++;
                }
            }

            logger.info(
                `Bitrix24 synchronization completed. Updated: ${updatedCount}, Errors: ${errorCount}`
            );
        } catch (error) {
            logger.error("Error during Bitrix24 synchronization:", error);
            throw error;
        }
    }

    /**
     * Вспомогательная функция для добавления задержки
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Получает актуальные данные пакетов и синхронизирует с Битрикс24
     */
    async syncCurrentPackageData(): Promise<void> {
        try {
            // Импортируем PackageService здесь, чтобы избежать циклических зависимостей
            const packageService = new PackageService();

            logger.info("Fetching current package data...");

            // Получаем все пакеты из базы данных
            const packages = await packageService.getPackages({ skip: 0 });

            // Преобразуем данные в Map для быстрого поиска
            const packageDataMap = new Map<string, PackageTrafficData>();

            packages.forEach((pkg) => {
                packageDataMap.set(pkg.packageKey, {
                    remaining: pkg.remaining,
                    dailyUsage: pkg.dailyUsage,
                    weeklyUsage: pkg.weeklyUsage,
                    monthlyUsage: pkg.monthlyUsage,
                    commonUsage: pkg.commonUsage,
                    isActive: pkg.isActive,
                });
            });

            logger.info(`Prepared data for ${packageDataMap.size} packages`);

            // Синхронизируем с Битрикс24
            await this.syncPackageDataToBitrix(packageDataMap);
        } catch (error) {
            logger.error("Error syncing current package data:", error);
            throw error;
        }
    }
}
