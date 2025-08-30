export interface PackageData {
    id: bigint;
    packageKey: string;
    createdAt: Date;
    expiredAt: Date | null;
    isSuspended: boolean;
    isActive: boolean;
    status: string;
    proxyCount: number;
    commonLimit: bigint | null;
    dailyLimit: bigint | null;
    weeklyLimit: bigint | null;
    monthlyLimit: bigint | null;
    dailyUsage: bigint;
    weeklyUsage: bigint;
    monthlyUsage: bigint;
    commonUsage: bigint;
    remaining: bigint; // commonLimit - commonUsage
    updateDate: Date;
}

export interface PackageResponse extends PackageData {
    trafficHistory?: PackageTrafficHistoryData[];
}

export interface PackageTrafficHistoryData {
    id: bigint;
    packageId: bigint;
    date: Date;
    dailyUsage: bigint;
    createDate: Date;
}

export interface ApiPackageResponse {
    description: string;
    results: ApiPackage[];
}

export interface ApiPackage {
    package_key: string;
    created_at: string;
    expired_at: string | false;
    is_suspended: boolean;
    is_active: boolean;
    status: string;
    proxy_count: number;
    proxy_package_filter: any[];
    traffic_limits: {
        daily: number | false;
        weekly: number | false;
        monthly: number | false;
        common: number;
    };
    traffic_usage: {
        daily: number;
        weekly: number;
        monthly: number;
        common: number;
    };
    lists: Array<{
        id: number;
        name: string;
        login: string;
        password: string;
        network: string;
        rotation: number;
        rotation_mode: number;
        geo: Array<{
            country: string;
            region: string;
            city: string;
            isp: string;
        }>;
        format: number;
    }>;
}

export interface PackageFilters {
    packageKey?: string;
    skip?: number;
    take?: number;
}

export interface PackageTrafficHistoryFilters {
    packageId: bigint;
    days?: number; // Количество дней назад (по умолчанию 30)
}
