🚀 Установка и запуск:

# Установка зависимостей
npm install

# Компиляция TypeScript
npm run build

# Запуск скомпилированного JS
npm start

# Или запуск напрямую с ts-node (для разработки)
npm run dev

📝 Использование как модуль:

```
import { buyStars, FragmentClient, TonTransaction } from './fragment_stars';

async function example() {
    const result = await buyStars(
        "@username",
        100,
        "hash",
        cookiesData,
        mnemonic
    );
    
    if (result.success) {
        console.log("Transaction:", result.txHash);
    }
}
```
