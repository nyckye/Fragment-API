// ============================================================================
// TON FRAGMENT STARS SDK
// Универсальный модуль для покупки Telegram Stars через Fragment
// Поддержка: .env
// ============================================================================

import TonWeb from 'tonweb';
import * as tonMnemonic from 'tonweb-mnemonic';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// ТИПЫ И ИНТЕРФЕЙСЫ
// ============================================================================

export interface SDKConfig {
    mnemonic?: string[];
    cookies?: {
        stel_ssid: string;
        stel_dt: string;
        stel_ton_token: string;
        stel_token: string;
    };
    fragmentHash?: string;
    tonApiKey?: string;
    configPath?: string;
    useEnv?: boolean;
}

export interface PurchaseOptions {
    username: string;
    amount: number;
    onProgress?: (step: string, data?: any) => void;
}

export interface PurchaseResult {
    success: boolean;
    txHash?: string;
    error?: string;
    details?: {
        recipient?: string;
        amount?: number;
        fee?: number;
    };
}

export interface WalletInfo {
    address: string;
    balance: string;
    publicKey: string;
}

// ============================================================================
// ГЛАВНЫЙ SDK КЛАСС
// ============================================================================

export class FragmentStarsSDK {
    private config: Required<SDKConfig>;
    
    constructor(config?: SDKConfig) {
        const loadedConfig = this._loadConfig(config);
        
        this.config = {
            mnemonic: loadedConfig.mnemonic || [],
            cookies: loadedConfig.cookies || {
                stel_ssid: '',
                stel_dt: '-240',
                stel_ton_token: '',
                stel_token: ''
            },
            fragmentHash: loadedConfig.fragmentHash || "ed3ec875a724358cea",
            tonApiKey: loadedConfig.tonApiKey || "",
            configPath: loadedConfig.configPath,
            useEnv: loadedConfig.useEnv ?? true
        };
        
        this._validateConfig();
    }
    
    // ========================================================================
    // ЗАГРУЗКА КОНФИГУРАЦИИ
    // ========================================================================
    
    private _loadConfig(config?: SDKConfig): SDKConfig {
        let result: SDKConfig = {};
        
        // 1. Загружаем из .env
        if (config?.useEnv !== false) {
            result = this._loadFromEnv();
        }
        
        // 2. Загружаем из config файла
        if (config?.configPath) {
            const fileConfig = this._loadFromFile(config.configPath);
            result = { ...result, ...fileConfig };
        }
        
        // 3. Переопределяем переданными параметрами
        if (config) {
            if (config.mnemonic) result.mnemonic = config.mnemonic;
            if (config.cookies) result.cookies = { ...result.cookies, ...config.cookies };
            if (config.fragmentHash) result.fragmentHash = config.fragmentHash;
            if (config.tonApiKey) result.tonApiKey = config.tonApiKey;
        }
        
        return result;
    }
    
    private _loadFromEnv(): SDKConfig {
        try {
            require('dotenv').config();
        } catch {}
        
        const mnemonic = process.env.MNEMONIC || process.env.TON_MNEMONIC;
        
        return {
            mnemonic: mnemonic ? mnemonic.split(' ').filter(w => w.length > 0) : undefined,
            cookies: {
                stel_ssid: process.env.STEL_SSID || process.env.FRAGMENT_STEL_SSID || '',
                stel_dt: process.env.STEL_DT || process.env.FRAGMENT_STEL_DT || '-240',
                stel_ton_token: process.env.STEL_TON_TOKEN || process.env.FRAGMENT_STEL_TON_TOKEN || '',
                stel_token: process.env.STEL_TOKEN || process.env.FRAGMENT_STEL_TOKEN || ''
            },
            fragmentHash: process.env.FRAGMENT_HASH,
            tonApiKey: process.env.TON_API_KEY
        };
    }
    
    private _loadFromFile(configPath: string): SDKConfig {
        try {
            const fullPath = path.resolve(configPath);
            
            if (!fs.existsSync(fullPath)) {
                console.warn(`⚠️  Файл конфигурации не найден: ${fullPath}`);
                return {};
            }
            
            const fileContent = fs.readFileSync(fullPath, 'utf-8');
            const json = JSON.parse(fileContent);
            
            return {
                mnemonic: Array.isArray(json.mnemonic) 
                    ? json.mnemonic 
                    : (json.mnemonic || json.TON_MNEMONIC)?.split(' '),
                cookies: {
                    stel_ssid: json.cookies?.stel_ssid || json.STEL_SSID || '',
                    stel_dt: json.cookies?.stel_dt || json.STEL_DT || '-240',
                    stel_ton_token: json.cookies?.stel_ton_token || json.STEL_TON_TOKEN || '',
                    stel_token: json.cookies?.stel_token || json.STEL_TOKEN || ''
                },
                fragmentHash: json.fragmentHash || json.FRAGMENT_HASH,
                tonApiKey: json.tonApiKey || json.TON_API_KEY
            };
        } catch (error: any) {
            console.warn(`⚠️  Ошибка загрузки конфига из ${configPath}:`, error.message);
            return {};
        }
    }
    
    private _validateConfig() {
        const errors: string[] = [];
        
        if (!this.config.mnemonic || this.config.mnemonic.length !== 24) {
            errors.push('Мнемоника должна содержать 24 слова');
        }
        
        if (!this.config.cookies.stel_ssid) {
            errors.push('Отсутствует cookie: stel_ssid');
        }
        
        if (!this.config.cookies.stel_token) {
            errors.push('Отсутствует cookie: stel_token');
        }
        
        if (errors.length > 0) {
            throw new Error(
                '❌ Ошибка конфигурации:\n' + 
                errors.map(e => `  - ${e}`).join('\n') +
                '\n\n💡 Убедитесь что указали параметры в .env, config.json или передали напрямую'
            );
        }
    }
    
    // ========================================================================
    // ПУБЛИЧНЫЕ МЕТОДЫ
    // ========================================================================
    
    async buyStars(options: PurchaseOptions): Promise<PurchaseResult> {
        try {
            const { username, amount, onProgress } = options;
            
            onProgress?.('searching', { username });
            const recipient = await this._findRecipient(username);
            if (!recipient) {
                return { success: false, error: 'Получатель не найден' };
            }
            
            onProgress?.('creating_request', { recipient, amount });
            const reqId = await this._createRequest(recipient, amount);
            if (!reqId) {
                return { success: false, error: 'Не удалось создать запрос' };
            }
            
            onProgress?.('fetching_transaction', { reqId });
            const txData = await this._getTransactionData(recipient, reqId, amount);
            if (!txData) {
                return { success: false, error: 'Не удалось получить данные транзакции' };
            }
            
            onProgress?.('sending_transaction', { amount: txData.amountTon });
            const txHash = await this._sendTransaction(txData);
            
            onProgress?.('completed', { txHash });
            
            return {
                success: true,
                txHash,
                details: {
                    recipient,
                    amount: txData.amountTon,
                    fee: 0
                }
            };
            
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Неизвестная ошибка'
            };
        }
    }
    
    async getWalletInfo(): Promise<WalletInfo> {
        const keyPair = await tonMnemonic.mnemonicToKeyPair(this.config.mnemonic);
        const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));
        const WalletClass = tonweb.wallet.all.v4R2;
        const wallet = new WalletClass(tonweb.provider, {
            publicKey: keyPair.publicKey,
            wc: 0
        });
        
        const address = await wallet.getAddress();
        const balance = await tonweb.getBalance(address);
        const balanceInTon = tonweb.utils.fromNano(balance);
        
        return {
            address: address.toString(true, true, true),
            balance: balanceInTon,
            publicKey: Buffer.from(keyPair.publicKey).toString('hex')
        };
    }
    
    async checkUser(username: string): Promise<boolean> {
        const recipient = await this._findRecipient(username);
        return !!recipient;
    }
    
    estimateCost(amount: number): number {
        return amount * 0.01;
    }
    
    getConfig(): Readonly<SDKConfig> {
        return {
            fragmentHash: this.config.fragmentHash,
            tonApiKey: this.config.tonApiKey,
            // Не возвращаем чувствительные данные
            mnemonic: undefined,
            cookies: undefined
        };
    }
    
    // ========================================================================
    // ПРИВАТНЫЕ МЕТОДЫ
    // ========================================================================
    
    private async _findRecipient(username: string): Promise<string | null> {
        const data = new URLSearchParams({
            query: username,
            method: "searchStarsRecipient"
        });
        
        const response = await fetch(
            `https://fragment.com/api?hash=${this.config.fragmentHash}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": this._cookiesToString(this.config.cookies)
                },
                body: data.toString()
            }
        );
        
        const result: any = await response.json();
        return result.found?.recipient || null;
    }
    
    private async _createRequest(recipient: string, quantity: number): Promise<string | null> {
        const data = new URLSearchParams({
            recipient,
            quantity: quantity.toString(),
            method: "initBuyStarsRequest"
        });
        
        const response = await fetch(
            `https://fragment.com/api?hash=${this.config.fragmentHash}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": this._cookiesToString(this.config.cookies)
                },
                body: data.toString()
            }
        );
        
        const result: any = await response.json();
        return result.req_id || null;
    }
    
    private async _getTransactionData(recipient: string, reqId: string, quantity: number) {
        const data = new URLSearchParams({
            address: "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118",
            chain: "-239",
            walletStateInit: "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq",
            publicKey: "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03",
            features: JSON.stringify(["SendTransaction", { name: "SendTransaction", maxMessages: 255 }]),
            maxProtocolVersion: "2",
            platform: "iphone",
            appName: "Tonkeeper",
            appVersion: "5.0.14",
            transaction: "1",
            id: reqId,
            show_sender: "0",
            method: "getBuyStarsLink"
        });
        
        const response = await fetch(
            `https://fragment.com/api?hash=${this.config.fragmentHash}`,
            {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": this._cookiesToString(this.config.cookies)
                },
                body: data.toString()
            }
        );
        
        const result: any = await response.json();
        
        if (result.ok && result.transaction?.messages?.[0]) {
            const msg = result.transaction.messages[0];
            return {
                address: msg.address,
                amount: msg.amount,
                payload: msg.payload,
                amountTon: parseFloat(msg.amount) / 1e9
            };
        }
        
        return null;
    }
    
    private async _sendTransaction(txData: any): Promise<string> {
        const keyPair = await tonMnemonic.mnemonicToKeyPair(this.config.mnemonic);
        const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));
        const WalletClass = tonweb.wallet.all.v4R2;
        const wallet = new WalletClass(tonweb.provider, {
            publicKey: keyPair.publicKey,
            wc: 0
        });
        
        const seqno = (await wallet.methods.seqno().call()) || 0;
        const payloadCell = TonWeb.boc.Cell.oneFromBoc(
            TonWeb.utils.base64ToBytes(this._fixBase64Padding(txData.payload))
        );
        
        const transfer = wallet.methods.transfer({
            secretKey: keyPair.secretKey,
            toAddress: txData.address,
            amount: tonweb.utils.toNano(txData.amountTon.toString()),
            seqno: seqno,
            payload: payloadCell,
            sendMode: 3
        });
        
        await transfer.send();
        const txHash = TonWeb.utils.bytesToBase64(await transfer.getQuery().hash());
        
        return txHash;
    }
    
    private _cookiesToString(cookies: any): string {
        return Object.entries(cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join("; ");
    }
    
    private _fixBase64Padding(b64String: string): string {
        const missingPadding = b64String.length % 4;
        if (missingPadding) {
            b64String += "=".repeat(4 - missingPadding);
        }
        return b64String;
    }
}

// ============================================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================================

export function createSDK(config?: SDKConfig): FragmentStarsSDK {
    return new FragmentStarsSDK(config);
}

export function createSDKFromEnv(): FragmentStarsSDK {
    return new FragmentStarsSDK({ useEnv: true });
}

export function createSDKFromFile(configPath: string): FragmentStarsSDK {
    return new FragmentStarsSDK({ configPath, useEnv: false });
}

export async function quickBuyStars(
    username: string,
    amount: number,
    config?: SDKConfig
): Promise<PurchaseResult> {
    const sdk = createSDK(config);
    return await sdk.buyStars({ username, amount });
}

// ============================================================================
// ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
// ============================================================================

/*

// ============ СПОСОБ 1: Из .env файла ============
// .env:
// MNEMONIC="word1 word2 word3 ... word24"
// STEL_SSID="xxx"
// STEL_DT="-240"
// STEL_TON_TOKEN="xxx"
// STEL_TOKEN="xxx"

const sdk = createSDKFromEnv();
await sdk.buyStars({ username: "@user", amount: 100 });


// ============ СПОСОБ 2: Из config.json ============
// config.json:
// {
//   "mnemonic": ["word1", "word2", ..., "word24"],
//   "cookies": {
//     "stel_ssid": "xxx",
//     "stel_dt": "-240",
//     "stel_ton_token": "xxx",
//     "stel_token": "xxx"
//   }
// }

const sdk = createSDKFromFile('./config.json');
await sdk.buyStars({ username: "@user", amount: 100 });


// ============ СПОСОБ 3: Прямая передача ============
const sdk = createSDK({
    mnemonic: ["word1", ...],
    cookies: { stel_ssid: "xxx", ... }
});


// ============ СПОСОБ 4: Комбинированный ============
const sdk = createSDK({
    configPath: './config.json',  // Загрузит из файла
    useEnv: true,                 // И из .env
    mnemonic: ["override", ...]   // Переопределит мнемонику
});


// ============ СПОСОБ 5: Быстрая покупка ============
await quickBuyStars("@user", 100);  // Автоматически из .env


// ============ С прогрессом ============
await sdk.buyStars({
    username: "@user",
    amount: 100,
    onProgress: (step, data) => console.log(step, data)
});

*/

export default FragmentStarsSDK;
