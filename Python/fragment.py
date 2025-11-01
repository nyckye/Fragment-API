import asyncio
import base64
import re
import httpx
from tonutils.client import TonapiClient
from tonutils.wallet import WalletV5R1

# КОНФИГУРАЦИЯ 
# API ключ для TON
API_TON = "ваш_api_ключ"

# Мнемоническая фраза кошелька (24 слова)
MNEMONIC = [
    "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage", 
    "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram", 
    "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual"
]

# Cookies для авторизации на Fragment
DATA = {
    "stel_ssid": "ваш_ssid",
    "stel_dt": "-240",
    "stel_ton_token": "ваш_ton_token",
    "stel_token": "ваш_token",
}

# Hash для API Fragment
FRAGMENT_HASH = "ed3ec875a724358cea"

# Данные кошелька Fragment
FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03"
FRAGMENT_WALLETS = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq"
FRAGMENT_ADDRES = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118"


# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ 
def get_cookies(data):
    """Формирует cookies для запросов к Fragment"""
    return {
        "stel_ssid": data.get("stel_ssid", ""),
        "stel_dt": data.get("stel_dt", ""),
        "stel_ton_token": data.get("stel_ton_token", ""),
        "stel_token": data.get("stel_token", ""),
    }


def fix_base64_padding(b64_string: str) -> str:
    """Исправляет padding в Base64 строке"""
    missing_padding = len(b64_string) % 4
    if missing_padding:
        b64_string += "=" * (4 - missing_padding)
    return b64_string


# FRAGMENT CLIENT 
class FragmentClient:
    # Клиент для работы с Fragment API
    
    def __init__(self, fragment_hash: str, cookies_data: dict):
        self.url = f"https://fragment.com/api?hash={fragment_hash}"
        self.cookies = get_cookies(cookies_data)
    
    async def fetch_recipient(self, query: str):
        # Поиск получателя по username
        # Args: query - username получателя (например @username)
        # Returns: recipient ID если найден, иначе None
        data = {
            "query": query,
            "method": "searchStarsRecipient"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.url, cookies=self.cookies, data=data)
            result = response.json()
            print("Recipient search:", result)
            return result.get("found", {}).get("recipient")
    
    async def fetch_req_id(self, recipient: str, quantity: int):
        """
        Инициализация запроса на покупку звезд
        
        Args:
            recipient: ID получателя
            quantity: количество звезд
            
        Returns:
            request ID для транзакции
        """
        data = {
            "recipient": recipient,
            "quantity": quantity,
            "method": "initBuyStarsRequest"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.url, cookies=self.cookies, data=data)
            result = response.json()
            print("Request ID:", result)
            return result.get("req_id")
    
    async def fetch_buy_link(self, recipient: str, req_id: str, quantity: int):
        """
        Получение данных для транзакции TON
        
        Args:
            recipient: ID получателя
            req_id: ID запроса
            quantity: количество звезд
            
        Returns:
            (address, amount, payload) - данные для отправки TON
        """
        data = {
            "address": FRAGMENT_ADDRES,
            "chain": "-239",  # TON mainnet
            "walletStateInit": FRAGMENT_WALLETS,
            "publicKey": FRAGMENT_PUBLICKEY,
            "features": ["SendTransaction", {"name": "SendTransaction", "maxMessages": 255}],
            "maxProtocolVersion": 2,
            "platform": "iphone",
            "appName": "Tonkeeper",
            "appVersion": "5.0.14",
            "transaction": "1",
            "id": req_id,
            "show_sender": "0",
            "method": "getBuyStarsLink"
        }
        
        headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "origin": "https://fragment.com",
            "referer": f"https://fragment.com/stars/buy?recipient={recipient}&quantity={quantity}",
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
            "x-requested-with": "XMLHttpRequest"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.url, headers=headers, cookies=self.cookies, data=data)
            json_data = response.json()
            print("Buy link:", json_data)
            
            if json_data.get("ok") and "transaction" in json_data:
                transaction = json_data["transaction"]
                msg = transaction["messages"][0]
                return msg["address"], msg["amount"], msg["payload"]
        
        return None, None, None


# TON TRANSACTION 
class TonTransaction:
    """Класс для отправки TON транзакций"""
    
    def __init__(self, api_key: str, mnemonic: list):
        self.api_key = api_key
        self.mnemonic = mnemonic
    
    def decode_payload(self, payload_base64: str, stars_count: int) -> str:
        """
        Декодирует payload из Base64 и форматирует
        
        Args:
            payload_base64: закодированный payload
            stars_count: количество звезд
            
        Returns:
            отформатированный текст для транзакции
        """
        # Декодирование Base64
        decoded_bytes = base64.b64decode(fix_base64_padding(payload_base64))
        
        # Преобразование в читаемый текст
        decoded_text = "".join(chr(b) if 32 <= b < 127 else " " for b in decoded_bytes)
        
        # Очистка от лишних пробелов
        clean_text = re.sub(r"\s+", " ", decoded_text).strip()
        
        # Извлечение нужной части (от "X Telegram Stars")
        match = re.search(rf"{stars_count} Telegram Stars.*", clean_text)
        return match.group(0) if match else clean_text
    
    async def send_transaction(self, recipient_address: str, amount_nano: float, 
                              payload: str, stars_count: int):
        """
        Отправка TON транзакции
        
        Args:
            recipient_address: адрес получателя
            amount_nano: сумма в TON
            payload: данные транзакции (Base64)
            stars_count: количество звезд
            
        Returns:
            transaction hash если успешно, иначе None
        """
        # Создание клиента TON
        client = TonapiClient(api_key=self.api_key, is_testnet=False)
        
        # Загрузка кошелька из мнемоники
        wallet, public_key, private_key, mnemonic = WalletV5R1.from_mnemonic(
            client, self.mnemonic
        )
        
        # Декодирование payload
        body_text = self.decode_payload(payload, stars_count)
        
        # Отправка транзакции
        tx_hash = await wallet.transfer(
            destination=recipient_address,
            amount=amount_nano,
            body=body_text
        )
        
        print(f"✅ Транзакция отправлена: {tx_hash}")
        return tx_hash


#  ОСНОВНОЙ ПРОЦЕСС ПОКУПКИ 
async def buy_stars(username: str, stars_count: int, 
                   fragment_hash: str, cookies_data: dict,
                   ton_api_key: str, mnemonic: list):
    """
    Полный процесс покупки звезд
    
    Args:
        username: @username получателя
        stars_count: количество звезд
        fragment_hash: hash для Fragment API
        cookies_data: cookies для авторизации
        ton_api_key: API ключ для TON
        mnemonic: мнемоническая фраза кошелька
        
    Returns:
        (success, tx_hash) - результат операции
    """
    # Инициализация клиентов
    fragment = FragmentClient(fragment_hash, cookies_data)
    ton = TonTransaction(ton_api_key, mnemonic)
    
    # Шаг 1: Поиск получателя
    print(f"Шаг 1: Поиск получателя {username}...")
    recipient = await fragment.fetch_recipient(username)
    if not recipient:
        print("❌ Получатель не найден")
        return False, None
    print(f"✅ Получатель найден: {recipient}")
    
    # Шаг 2: Создание запроса
    print(f"Шаг 2: Создание запроса на {stars_count} звезд...")
    req_id = await fragment.fetch_req_id(recipient, stars_count)
    if not req_id:
        print("❌ Не удалось создать запрос")
        return False, None
    print(f"✅ Request ID: {req_id}")
    
    # Шаг 3: Получение данных транзакции
    print("Шаг 3: Получение данных транзакции...")
    address, amount, payload = await fragment.fetch_buy_link(recipient, req_id, stars_count)
    if not all([address, amount, payload]):
        print("❌ Не удалось получить данные транзакции")
        return False, None
    
    amount_ton = float(amount) / 1_000_000_000
    print(f"✅ Сумма: {amount_ton:.4f} TON")
    print(f"✅ Адрес: {address}")
    
    # Шаг 4: Отправка TON
    print("Шаг 4: Отправка транзакции...")
    tx_hash = await ton.send_transaction(address, amount_ton, payload, stars_count)
    
    if tx_hash:
        print(f"✅ Успешно! Hash: {tx_hash}")
        return True, tx_hash
    
    return False, None


# ПРИМЕР ИСПОЛЬЗОВАНИЯ 
async def main():
    
    # Параметры покупки
    username = "@example"  # Username получателя
    stars_count = 100      # Количество звезд
    
    # Выполнение покупки
    success, tx_hash = await buy_stars(
        username=username,
        stars_count=stars_count,
        fragment_hash=FRAGMENT_HASH,
        cookies_data=DATA,
        ton_api_key=API_TON,
        mnemonic=MNEMONIC
    )
    
    if success:
        print(f"\n🎉 Покупка завершена!")
        print(f"🔗 Ссылка: https://tonviewer.com/transaction/{tx_hash}")
    else:
        print("\n❌ Покупка не удалась")


if __name__ == "__main__":
    asyncio.run(main())
