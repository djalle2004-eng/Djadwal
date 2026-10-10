import { useState, useEffect } from 'react';
import { turso } from '../lib/turso';
import { APP_VERSION } from '../constants/version';
import { Linking } from 'react-native';

interface AppConfig {
    min_version: string;
    latest_version: string;
    download_url: string;
}

export const useAppUpdate = () => {
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const checkUpdate = async () => {
        try {
            const result = await turso.execute('SELECT key, value FROM app_config');
            const newConfig: any = {};
            result.rows.forEach(row => {
                newConfig[row.key as string] = row.value;
            });

            setConfig(newConfig);

            if (newConfig.min_version) {
                if (compareVersions(APP_VERSION, newConfig.min_version) < 0) {
                    setNeedsUpdate(true);
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkUpdate();
    }, []);

    const compareVersions = (v1: string, v2: string) => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            if (part1 > part2) return 1;
            if (part1 < part2) return -1;
        }
        return 0;
    };

    const handleUpdate = () => {
        if (config?.download_url) {
            Linking.openURL(config.download_url);
        }
    };

    return { needsUpdate, handleUpdate, loading, config };
};
