// УСТАНОВКА ЗАВИСИМОСТЕЙ:
// npm install tonweb tonweb-mnemonic node-fetch

const TonWeb = require('tonweb');
const tonMnemonic = require('tonweb-mnemonic');
const fetch = require('node-fetch');

// КОНФИГУРАЦИЯ
const API_TON = "ваш_api_ключ"; // Не обязательно для TonWeb

// Мнемоническая фраза кошелька (24 слова)
const MNEMONIC = [
    "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
    "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
    "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual"
];

// Cookies для авторизации на Fragment
const DATA = {
    stel_ssid: "ваш_ssid",
    stel_dt: "-240",
    stel_ton_token: "ваш_ton_token",
    stel_token: "ваш_token"
};

// Hash для API Fragment
const FRAGMENT_HASH = "ed3ec875a724358cea";

// Данные кошелька Fragment
const FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03";
const FRAGMENT_WALLETS = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq";
const FRAGMENT_ADDRESS = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118";


// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getCookies(data) {
    return {
        stel_ssid: data.stel_ssid || "",
        stel_dt: data.stel_dt || "",
        stel_ton_token: data.stel_ton_token || "",
        stel_token: data.stel_token || ""
    };
}

function fixBase64Padding(b64String) {
    const missingPadding = b64String.length % 4;
    if (missingPadding) {
        b64String += "=".repeat(4 - missingPadding);
    }
    return b64String;
}

function cookiesToString(cookies) {
    return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
}


// FRAGMENT CLIENT
class FragmentClient {
    constructor(fragmentHash, cookiesData) {
        this.url = `https://fragment.com/api?hash=${fragmentHash}`;
        this.cookies = getCookies(cookiesData);
    }

    async fetchRecipient(query) {
        const data = new URLSearchParams({
            query: query,
            method: "searchStarsRecipient"
        });

        const response = await fetch(this.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookiesToString(this.cookies)
            },
            body: data.toString()
        });

        const result = await response.json();
        console.log("Recipient search:", result);
        return result.found?.recipient;
    }

    async fetchReqId(recipient, quantity) {
        const data = new URLSearchParams({
            recipient: recipient,
            quantity: quantity.toString(),
            method: "initBuyStarsRequest"
        });

        const response = await fetch(this.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookiesToString(this.cookies)
            },
            body: data.toString()
        });

        const result = await response.json();
        console.log("Request ID:", result);
        return result.req_id;
    }

    async fetchBuyLink(recipient, reqId, quantity) {
        const data = new URLSearchParams({
            address: FRAGMENT_ADDRESS,
            chain: "-239",
            walletStateInit: FRAGMENT_WALLETS,
            publicKey: FRAGMENT_PUBLICKEY,
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

        const response = await fetch(this.url, {
            method: "POST",
            headers: {
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://fragment.com",
                "Referer": `https://fragment.com/stars/buy?recipient=${recipient}&quantity=${quantity}`,
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookiesToString(this.cookies)
            },
            body: data.toString()
        });

        const jsonData = await response.json();
        console.log("Buy link:", jsonData);

        if (jsonData.ok && jsonData.transaction) {
            const msg = jsonData.transaction.messages[0];
            return {
                address: msg.address,
                amount: msg.amount,
                payload: msg.payload
            };
        }

        return { address: null, amount: null, payload: null };
    }
}


// TON TRANSACTION
class TonTransaction {
    constructor(mnemonic) {
        this.mnemonic = mnemonic;
        this.tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));
    }

    decodePayload(payloadBase64, starsCount) {
        try {
            const fixedBase64 = fixBase64Padding(payloadBase64);
            const decodedBytes = Buffer.from(fixedBase64, 'base64');
            
            let decodedText = "";
            for (let i = 0; i < decodedBytes.length; i++) {
                const byte = decodedBytes[i];
                decodedText += (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : " ";
            }

            const cleanText = decodedText.replace(/\s+/g, " ").trim();
            
            const regex = new RegExp(`${starsCount} Telegram Stars.*`);
            const match = cleanText.match(regex);
            return match ? match[0] : cleanText;
        } catch (error) {
            console.error("Ошибка декодирования payload:", error);
            return payloadBase64;
        }
    }

    async sendTransaction(recipientAddress, amountNano, payload, starsCount) {
        try {
            console.log("\n🔐 Инициализация кошелька...");
            
            // Получаем ключи из мнемоники
            const mnemonicArray = this.mnemonic;
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonicArray);
            
            // Создаем кошелек V4R2 (самая распространенная версия)
            const WalletClass = this.tonweb.wallet.all.v4R2;
            const wallet = new WalletClass(this.tonweb.provider, {
                publicKey: keyPair.publicKey,
                wc: 0 // workchain
            });

            const walletAddress = await wallet.getAddress();
            console.log(`✅ Адрес кошелька: ${walletAddress.toString(true, true, true)}`);

            // Получаем seqno
            const seqno = await wallet.methods.seqno().call() || 0;
            console.log(`📊 Seqno: ${seqno}`);

            // Декодируем payload из Base64 в BOC
            const payloadCell = TonWeb.boc.Cell.oneFromBoc(
                TonWeb.utils.base64ToBytes(fixBase64Padding(payload))
            );

            // Конвертируем сумму в nanotons
            const amountInNano = this.tonweb.utils.toNano(amountNano.toString());

            console.log(`\n💸 Отправка транзакции...`);
            console.log(`   Получатель: ${recipientAddress}`);
            console.log(`   Сумма: ${amountNano} TON (${amountInNano} nanoTON)`);
            console.log(`   Комментарий: ${this.decodePayload(payload, starsCount)}`);

            // Создаем и отправляем транзакцию
            const transfer = wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: recipientAddress,
                amount: amountInNano,
                seqno: seqno,
                payload: payloadCell,
                sendMode: 3
            });

            await transfer.send();
            
            // Получаем hash транзакции
            const txHash = TonWeb.utils.bytesToBase64(await transfer.getQuery().hash());
            
            console.log(`\n✅ Транзакция отправлена успешно!`);
            console.log(`📝 Hash: ${txHash}`);
            
            return txHash;

        } catch (error) {
            console.error("\n❌ Ошибка при отправке транзакции:", error);
            throw error;
        }
    }

    async getBalance() {
        try {
            const mnemonicArray = this.mnemonic;
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonicArray);
            
            const WalletClass = this.tonweb.wallet.all.v4R2;
            const wallet = new WalletClass(this.tonweb.provider, {
                publicKey: keyPair.publicKey,
                wc: 0
            });

            const walletAddress = await wallet.getAddress();
            const balance = await this.tonweb.getBalance(walletAddress);
            const balanceInTon = this.tonweb.utils.fromNano(balance);
            
            console.log(`💰 Баланс кошелька: ${balanceInTon} TON`);
            return balanceInTon;

        } catch (error) {
            console.error("Ошибка получения баланса:", error);
            return null;
        }
    }
}


// ОСНОВНОЙ ПРОЦЕСС ПОКУПКИ
async function buyStars(username, starsCount, fragmentHash, cookiesData, mnemonic) {
    const fragment = new FragmentClient(fragmentHash, cookiesData);
    const ton = new TonTransaction(mnemonic);

    console.log("\n" + "=".repeat(60));
    console.log("🌟 ПОКУПКА TELEGRAM STARS");
    console.log("=".repeat(60));

    // Проверяем баланс
    await ton.getBalance();

    // Шаг 1: Поиск получателя
    console.log(`\n📍 Шаг 1: Поиск получателя ${username}...`);
    const recipient = await fragment.fetchRecipient(username);
    if (!recipient) {
        console.log("❌ Получатель не найден");
        return { success: false, txHash: null };
    }
    console.log(`✅ Получатель найден: ${recipient}`);

    // Шаг 2: Создание запроса
    console.log(`\n📝 Шаг 2: Создание запроса на ${starsCount} звезд...`);
    const reqId = await fragment.fetchReqId(recipient, starsCount);
    if (!reqId) {
        console.log("❌ Не удалось создать запрос");
        return { success: false, txHash: null };
    }
    console.log(`✅ Request ID: ${reqId}`);

    // Шаг 3: Получение данных транзакции
    console.log(`\n🔍 Шаг 3: Получение данных транзакции...`);
    const { address, amount, payload } = await fragment.fetchBuyLink(recipient, reqId, starsCount);
    if (!address || !amount || !payload) {
        console.log("❌ Не удалось получить данные транзакции");
        return { success: false, txHash: null };
    }

    const amountTon = parseFloat(amount) / 1_000_000_000;
    console.log(`✅ Сумма к оплате: ${amountTon.toFixed(4)} TON`);
    console.log(`✅ Адрес Fragment: ${address}`);

    // Шаг 4: Отправка TON
    console.log(`\n💳 Шаг 4: Отправка транзакции в блокчейн...`);
    try {
        const txHash = await ton.sendTransaction(address, amountTon, payload, starsCount);

        if (txHash) {
            console.log("\n" + "=".repeat(60));
            console.log("🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!");
            console.log("=".repeat(60));
            return { success: true, txHash };
        }
    } catch (error) {
        console.error("\n❌ Ошибка при отправке:", error.message);
        return { success: false, txHash: null };
    }

    return { success: false, txHash: null };
}


// ПРИМЕР ИСПОЛЬЗОВАНИЯ
async function main() {
    try {
        // Параметры покупки
        const username = "@example";  // Замените на реальный username
        const starsCount = 100;       // Количество звезд

        const { success, txHash } = await buyStars(
            username,
            starsCount,
            FRAGMENT_HASH,
            DATA,
            MNEMONIC
        );

        if (success) {
            console.log(`\n🔗 Просмотр транзакции:`);
            console.log(`   https://tonviewer.com/transaction/${txHash}`);
            console.log(`   https://tonscan.org/tx/${txHash}`);
        } else {
            console.log("\n❌ Покупка не удалась. Проверьте конфигурацию.");
        }

    } catch (error) {
        console.error("\n💥 Критическая ошибка:", error);
    }
}


// Запуск
if (require.main === module) {
    main().catch(console.error);
}


// Экспорт
module.exports = {
    FragmentClient,
    TonTransaction,
    buyStars,
    getCookies,
    fixBase64Padding
};
