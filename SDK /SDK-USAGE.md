# 📘 TON Fragment Stars SDK - Полное руководство

## 🚀 Быстрый старт

```bash
npm install ton-fragment-stars-sdk dotenv
```

## 📋 Способы конфигурации

SDK поддерживает 3 способа конфигурации с приоритетами:

**Приоритет загрузки:** Прямые параметры > Config файл > .env

### 1️⃣ Из `.env` файла (рекомендуется)

**Создайте `.env`:**
```bash
MNEMONIC="word1 word2 word3 ... word24"
STEL_SSID="your_ssid"
STEL_DT="-240"
STEL_TON_TOKEN="your_token"
STEL_TOKEN="your_token"
```

**Использование:**
```typescript
import { createSDKFromEnv } from 'ton-fragment-stars-sdk';

const sdk = createSDKFromEnv();
const result = await sdk.buyStars({
    username: "@example",
    amount: 100
});
```

---

### 2️⃣ Из `config.json` файла

**Создайте `config.json`:**
```json
{
  "mnemonic": ["word1", "word2", ..., "word24"],
  "cookies": {
    "stel_ssid": "xxx",
    "stel_dt": "-240",
    "stel_ton_token": "xxx",
    "stel_token": "xxx"
  }
}
```

**Использование:**
```typescript
import { createSDKFromFile } from 'ton-fragment-stars-sdk';

const sdk = createSDKFromFile('./config.json');
const result = await sdk.buyStars({
    username: "@example",
    amount: 100
});
```

---

### 3️⃣ Прямая передача параметров

```typescript
import { createSDK } from 'ton-fragment-stars-sdk';

const sdk = createSDK({
    mnemonic: ["word1", "word2", ..., "word24"],
    cookies: {
        stel_ssid: "xxx",
        stel_dt: "-240",
        stel_ton_token: "xxx",
        stel_token: "xxx"
    }
});
```

---

### 4️⃣ Комбинированный подход

```typescript
// Загрузит .env, потом config.json, потом переопределит мнемонику
const sdk = createSDK({
    configPath: './config.json',
    useEnv: true,
    mnemonic: ["override", "words", ...]
});
```

---

## 🎯 Примеры использования

### Базовая покупка

```typescript
const result = await sdk.buyStars({
    username: "@example",
    amount: 100
});

if (result.success) {
    console.log("✅ Успешно!", result.txHash);
    console.log("Детали:", result.details);
} else {
    console.log("❌ Ошибка:", result.error);
}
```

### С отслеживанием прогресса

```typescript
const result = await sdk.buyStars({
    username: "@example",
    amount: 100,
    onProgress: (step, data) => {
        const messages = {
            'searching': '🔍 Поиск получателя...',
            'creating_request': '📝 Создание запроса...',
            'fetching_transaction': '💰 Получение данных...',
            'sending_transaction': '🚀 Отправка транзакции...',
            'completed': '✅ Готово!'
        };
        console.log(messages[step] || step, data);
    }
});
```

### Быстрая покупка одной строкой

```typescript
import { quickBuyStars } from 'ton-fragment-stars-sdk';

// Автоматически использует .env
const result = await quickBuyStars("@example", 100);
```

### Проверка баланса

```typescript
const wallet = await sdk.getWalletInfo();

console.log("Адрес:", wallet.address);
console.log("Баланс:", wallet.balance, "TON");
console.log("Public Key:", wallet.publicKey);
```

### Проверка пользователя

```typescript
const exists = await sdk.checkUser("@example");

if (exists) {
    console.log("✅ Пользователь найден");
} else {
    console.log("❌ Пользователь не найден");
}
```

### Расчет стоимости

```typescript
const cost = sdk.estimateCost(100);
console.log(`100 звезд ≈ ${cost} TON`);
```

---

## 🌐 Интеграции

### Express.js API

```typescript
import express from 'express';
import { createSDKFromEnv } from 'ton-fragment-stars-sdk';

const app = express();
app.use(express.json());

const sdk = createSDKFromEnv();

app.post('/api/buy-stars', async (req, res) => {
    const { username, amount } = req.body;
    
    const result = await sdk.buyStars({
        username,
        amount,
        onProgress: (step) => console.log(`[${username}] ${step}`)
    });
    
    res.json(result);
});

app.get('/api/wallet', async (req, res) => {
    const wallet = await sdk.getWalletInfo();
    res.json(wallet);
});

app.listen(3000);
```

### React Component

```tsx
import { useState } from 'react';
import { createSDKFromEnv } from 'ton-fragment-stars-sdk';

function BuyStarsButton() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [result, setResult] = useState('');
    
    const sdk = createSDKFromEnv();
    
    const handleBuy = async () => {
        setLoading(true);
        
        const res = await sdk.buyStars({
            username: "@example",
            amount: 100,
            onProgress: (step) => setStatus(step)
        });
        
        setLoading(false);
        setResult(res.success ? 
            `✅ ${res.txHash}` : 
            `❌ ${res.error}`
        );
    };
    
    return (
        <div>
            <button onClick={handleBuy} disabled={loading}>
                {loading ? status : 'Купить Stars'}
            </button>
            {result && <div>{result}</div>}
        </div>
    );
}
```

### Telegram Bot

```typescript
import TelegramBot from 'node-telegram-bot-api';
import { createSDKFromEnv } from 'ton-fragment-stars-sdk';

const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
const sdk = createSDKFromEnv();

bot.onText(/\/buy (.+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match![1];
    const amount = parseInt(match![2]);
    
    bot.sendMessage(chatId, '⏳ Начинаем покупку...');
    
    const result = await sdk.buyStars({
        username,
        amount,
        onProgress: (step) => {
            const messages: Record<string, string> = {
                'searching': '🔍 Ищем получателя...',
                'creating_request': '📝 Создаем запрос...',
                'fetching_transaction': '💰 Получаем данные...',
                'sending_transaction': '🚀 Отправляем TON...',
                'completed': '✅ Готово!'
            };
            bot.sendMessage(chatId, messages[step] || step);
        }
    });
    
    if (result.success) {
        bot.sendMessage(
            chatId, 
            `✅ Успешно!\n\n` +
            `TX: ${result.txHash}\n\n` +
            `Просмотр: https://tonscan.org/tx/${result.txHash}`
        );
    } else {
        bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
    }
});

bot.onText(/\/balance/, async (msg) => {
    const wallet = await sdk.getWalletInfo();
    bot.sendMessage(
        msg.chat.id,
        `💰 Баланс: ${wallet.balance} TON\n` +
        `📍 Адрес: ${wallet.address}`
    );
});
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { createSDKFromEnv, quickBuyStars } from 'ton-fragment-stars-sdk';

const [,, command, ...args] = process.argv;

async function main() {
    switch(command) {
        case 'buy':
            const [username, amount] = args;
            console.log(`Покупка ${amount} звезд для ${username}...`);
            
            const result = await quickBuyStars(
                username, 
                parseInt(amount),
                { onProgress: (step) => console.log('→', step) }
            );
            
            if (result.success) {
                console.log('✅ Успешно!', result.txHash);
            } else {
                console.log('❌ Ошибка:', result.error);
            }
            break;
            
        case 'balance':
            const sdk = createSDKFromEnv();
            const wallet = await sdk.getWalletInfo();
            console.log(`Баланс: ${wallet.balance} TON`);
            console.log(`Адрес: ${wallet.address}`);
            break;
            
        case 'check':
            const [user] = args;
            const sdk2 = createSDKFromEnv();
            const exists = await sdk2.checkUser(user);
            console.log(exists ? '✅ Найден' : '❌ Не найден');
            break;
            
        default:
            console.log('Использование:');
            console.log('  buy <@username> <amount>');
            console.log('  balance');
            console.log('  check <@username>');
    }
}

main();
```

**Использование:**
```bash
chmod +x cli.ts
./cli.ts buy @user 100
./cli.ts balance
./cli.ts check @user
```

---

## 🔐 Безопасность

### ✅ Правильно

```typescript
// Используйте .env файл
require('dotenv').config();
const sdk = createSDKFromEnv();

// Или переменные окружения
const sdk = createSDK({
    mnemonic: process.env.MNEMONIC?.split(' '),
    cookies: {
        stel_ssid: process.env.STEL_SSID!,
        // ...
    }
});

// Добавьте в .gitignore
// .env
// config.json
```

### ❌ Неправильно

```typescript
// НЕ храните в коде!
const sdk = createSDK({
    mnemonic: ["word1", "word2", ...], // ❌ Плохо
    cookies: { ... }
});
```

---

## 🐛 Обработка ошибок

```typescript
try {
    const result = await sdk.buyStars({
        username: "@example",
        amount: 100
    });
    
    if (!result.success) {
        // Обработка ошибки покупки
        console.error("Ошибка:", result.error);
        
        if (result.error?.includes("Получатель не найден")) {
            console.log("→ Проверьте username");
        }
        
        if (result.error?.includes("баланс")) {
            console.log("→ Пополните кошелек");
        }
    }
} catch (error) {
    // Критическая ошибка (неверная конфигурация и т.д.)
    console.error("Критическая ошибка:", error);
}
```

---

## 📊 Множественные покупки

```typescript
const users = [
    { username: "@user1", amount: 100 },
    { username: "@user2", amount: 200 },
    { username: "@user3", amount: 50 }
];

for (const user of users) {
    console.log(`\nПокупка для ${user.username}...`);
    
    const result = await sdk.buyStars({
        username: user.username,
        amount: user.amount
    });
    
    if (result.success) {
        console.log(`✅ ${user.username}: ${result.txHash}`);
    } else {
        console.log(`❌ ${user.username}: ${result.error}`);
    }
    
    // Задержка между покупками (5 секунд)
    await new Promise(resolve => setTimeout(resolve, 5000));
}
```

---

## 🎓 TypeScript типы

```typescript
import { 
    FragmentStarsSDK,
    SDKConfig,
    PurchaseOptions,
    PurchaseResult,
    WalletInfo,
    createSDK,
    createSDKFromEnv,
    createSDKFromFile,
    quickBuyStars
} from 'ton-fragment-stars-sdk';

// Типизированная конфигурация
const config: SDKConfig = {
    mnemonic: ["..."],
    cookies: {
        stel_ssid: "...",
        stel_dt: "-240",
        stel_ton_token: "...",
        stel_token: "..."
    }
};

// Типизированные опции
const options: PurchaseOptions = {
    username: "@example",
    amount: 100,
    onProgress: (step: string, data?: any) => {
        console.log(step, data);
    }
};

// Типизированный результат
const result: PurchaseResult = await sdk.buyStars(options);

// Типизированная информация о кошельке
const wallet: WalletInfo = await sdk.getWalletInfo();
```

---

## 🔧 API Reference

### `createSDK(config?: SDKConfig): FragmentStarsSDK`
Создает SDK с конфигурацией. Автоматически загружает из .env если `useEnv` не false.

### `createSDKFromEnv(): FragmentStarsSDK`
Создает SDK только из .env файла.

### `createSDKFromFile(path: string): FragmentStarsSDK`
Создает SDK из JSON файла.

### `quickBuyStars(username, amount, config?): Promise<PurchaseResult>`
Быстрая покупка одной строкой.

### `sdk.buyStars(options): Promise<PurchaseResult>`
Основной метод покупки.

### `sdk.getWalletInfo(): Promise<WalletInfo>`
Получить информацию о кошельке.

### `sdk.checkUser(username): Promise<boolean>`
Проверить существование пользователя.

### `sdk.estimateCost(amount): number`
Расчет примерной стоимости.

### `sdk.getConfig(): Readonly<SDKConfig>`
Получить текущую конфигурацию (без чувствительных данных).

---

## 📝 Changelog

### v1.0.0
- ✅ Поддержка .env файлов
- ✅ Поддержка config.json
- ✅ Прямая передача параметров
- ✅ Комбинированная конфигурация
- ✅ TypeScript типизация
- ✅ Progress tracking
- ✅ Полная валидация

---

## 🆘 Troubleshooting

**Ошибка: "Мнемоника должна содержать 24 слова"**
- Проверьте что мнемоника в .env указана через пробел
- Проверьте что в config.json массив из 24 элементов

**Ошибка: "Отсутствует cookie: stel_ssid"**
- Получите cookies через DevTools → Application → Cookies
- Проверьте что cookies указаны в .env или config.json

**Ошибка: "Получатель не найден"**
- Проверьте что username начинается с @
- Убедитесь что пользователь существует

**Транзакция не отправляется**
- Проверьте баланс кошелька
- Убедитесь что мнемоника правильная
- Проверьте подключение к интернету

---

## 📄 Лицензия

MIT
