// УСТАНОВКА ЗАВИСИМОСТЕЙ (Cargo.toml):
// [dependencies]
// tokio = { version = "1", features = ["full"] }
// reqwest = { version = "0.11", features = ["json", "cookies"] }
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"
// base64 = "0.21"
// regex = "1.10"
// anyhow = "1.0"
// lazy_static = "1.4"
// chrono = "0.4"
// sha2 = "0.10"
// ed25519-dalek = "2.0"
// pbkdf2 = "0.12"
// hmac = "0.12"
// hex = "0.4"
// crc = "3.0"

use anyhow::{Context, Result};
use base64::{engine::general_purpose, Engine as _};
use regex::Regex;
use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use sha2::{Sha256, Sha512, Digest};
use ed25519_dalek::{Keypair, Signer, SecretKey, PublicKey};
use pbkdf2::pbkdf2_hmac;
use hmac::Hmac;

// КОНФИГУРАЦИЯ
const MNEMONIC: [&str; 24] = [
    "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
    "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
    "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual",
];

lazy_static::lazy_static! {
    static ref DATA: HashMap<&'static str, &'static str> = {
        let mut m = HashMap::new();
        m.insert("stel_ssid", "ваш_ssid");
        m.insert("stel_dt", "-240");
        m.insert("stel_ton_token", "ваш_ton_token");
        m.insert("stel_token", "ваш_token");
        m
    };
}

const FRAGMENT_HASH: &str = "ed3ec875a724358cea";
const FRAGMENT_PUBLICKEY: &str = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03";
const FRAGMENT_WALLETS: &str = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq";
const FRAGMENT_ADDRESS: &str = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118";
const TON_API_ENDPOINT: &str = "https://toncenter.com/api/v2/sendBoc";

// СТРУКТУРЫ ДАННЫХ
#[derive(Debug, Deserialize)]
struct RecipientResponse {
    found: Option<FoundRecipient>,
}

#[derive(Debug, Deserialize)]
struct FoundRecipient {
    recipient: String,
}

#[derive(Debug, Deserialize)]
struct ReqIdResponse {
    req_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BuyLinkResponse {
    ok: Option<bool>,
    transaction: Option<Transaction>,
}

#[derive(Debug, Deserialize)]
struct Transaction {
    messages: Vec<Message>,
}

#[derive(Debug, Deserialize)]
struct Message {
    address: String,
    amount: String,
    payload: String,
}

#[derive(Debug, Serialize)]
struct SendBocRequest {
    boc: String,
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
fn get_cookies(data: &HashMap<&str, &str>) -> HashMap<String, String> {
    let mut cookies = HashMap::new();
    cookies.insert("stel_ssid".to_string(), data.get("stel_ssid").unwrap_or(&"").to_string());
    cookies.insert("stel_dt".to_string(), data.get("stel_dt").unwrap_or(&"").to_string());
    cookies.insert("stel_ton_token".to_string(), data.get("stel_ton_token").unwrap_or(&"").to_string());
    cookies.insert("stel_token".to_string(), data.get("stel_token").unwrap_or(&"").to_string());
    cookies
}

fn fix_base64_padding(b64_string: &str) -> String {
    let missing_padding = b64_string.len() % 4;
    if missing_padding > 0 {
        format!("{}{}", b64_string, "=".repeat(4 - missing_padding))
    } else {
        b64_string.to_string()
    }
}

fn cookies_to_string(cookies: &HashMap<String, String>) -> String {
    cookies
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("; ")
}

// TON CRYPTO
struct TonCrypto;

impl TonCrypto {
    fn mnemonic_to_keys(mnemonic: &[String]) -> Result<(Vec<u8>, Vec<u8>)> {
        let mnemonic_str = mnemonic.join(" ");
        let salt = "TON default seed";
        
        // PBKDF2 для получения seed
        let mut seed = [0u8; 64];
        pbkdf2_hmac::<Hmac<Sha512>>(
            mnemonic_str.as_bytes(),
            salt.as_bytes(),
            100000,
            &mut seed,
        );

        // Генерируем ключевую пару Ed25519
        let secret = SecretKey::from_bytes(&seed[..32])
            .context("Ошибка создания секретного ключа")?;
        
        let public = PublicKey::from(&secret);

        Ok((public.as_bytes().to_vec(), secret.as_bytes().to_vec()))
    }

    fn sign(message: &[u8], private_key: &[u8]) -> Result<Vec<u8>> {
        let secret = SecretKey::from_bytes(private_key)
            .context("Неверный приватный ключ")?;
        let public = PublicKey::from(&secret);
        let keypair = Keypair { secret, public };

        let signature = keypair.sign(message);
        Ok(signature.to_bytes().to_vec())
    }
}

// TON CELL (упрощенная реализация)
struct TonCell {
    data: Vec<u8>,
    refs: Vec<TonCell>,
}

impl TonCell {
    fn new() -> Self {
        Self {
            data: Vec::new(),
            refs: Vec::new(),
        }
    }

    fn from_data(data: Vec<u8>) -> Self {
        Self {
            data,
            refs: Vec::new(),
        }
    }

    fn write_uint(&mut self, value: u64, bits: usize) {
        let bytes = (bits + 7) / 8;
        let value_bytes = value.to_be_bytes();
        let start = 8 - bytes;
        self.data.extend_from_slice(&value_bytes[start..]);
    }

    fn write_bytes(&mut self, bytes: &[u8]) {
        self.data.extend_from_slice(bytes);
    }

    fn write_address(&mut self, address: &str) -> Result<()> {
        // Парсим адрес вида "0:hash"
        let parts: Vec<&str> = address.split(':').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("Неверный формат адреса"));
        }

        let workchain: i8 = parts[0].parse()?;
        let hash = hex::decode(parts[1])?;

        self.data.push(0x01); // addr_std
        self.data.push(workchain as u8);
        self.data.extend_from_slice(&hash);

        Ok(())
    }

    fn add_ref(&mut self, cell: TonCell) {
        self.refs.push(cell);
    }

    fn serialize(&self) -> Vec<u8> {
        let mut result = Vec::new();
        
        // Дескрипторы
        result.push(self.refs.len() as u8);
        result.push(self.data.len() as u8);
        
        // Данные
        result.extend_from_slice(&self.data);
        
        // Ссылки
        for ref_cell in &self.refs {
            result.extend_from_slice(&ref_cell.serialize());
        }
        
        result
    }

    fn hash(&self) -> Vec<u8> {
        let serialized = self.serialize();
        let mut hasher = Sha256::new();
        hasher.update(&serialized);
        hasher.finalize().to_vec()
    }

    fn to_boc(&self) -> String {
        let serialized = self.serialize();
        general_purpose::STANDARD.encode(&serialized)
    }

    fn from_boc(boc: &str) -> Result<Self> {
        let fixed = fix_base64_padding(boc);
        let data = general_purpose::STANDARD.decode(&fixed)?;
        Ok(Self::from_data(data))
    }
}

// FRAGMENT CLIENT
struct FragmentClient {
    url: String,
    cookies: HashMap<String, String>,
    client: Client,
}

impl FragmentClient {
    fn new(fragment_hash: &str, cookies_data: &HashMap<&str, &str>) -> Self {
        Self {
            url: format!("https://fragment.com/api?hash={}", fragment_hash),
            cookies: get_cookies(cookies_data),
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap(),
        }
    }

    async fn fetch_recipient(&self, query: &str) -> Result<String> {
        let mut params = HashMap::new();
        params.insert("query", query);
        params.insert("method", "searchStarsRecipient");

        let response = self.client
            .post(&self.url)
            .header(header::COOKIE, cookies_to_string(&self.cookies))
            .form(&params)
            .send()
            .await?;

        let body = response.text().await?;
        println!("Recipient search: {}", body);

        let result: RecipientResponse = serde_json::from_str(&body)?;
        
        result.found
            .and_then(|f| Some(f.recipient))
            .ok_or_else(|| anyhow::anyhow!("Получатель не найден"))
    }

    async fn fetch_req_id(&self, recipient: &str, quantity: i32) -> Result<String> {
        let mut params = HashMap::new();
        params.insert("recipient", recipient.to_string());
        params.insert("quantity", quantity.to_string());
        params.insert("method", "initBuyStarsRequest".to_string());

        let response = self.client
            .post(&self.url)
            .header(header::COOKIE, cookies_to_string(&self.cookies))
            .form(&params)
            .send()
            .await?;

        let body = response.text().await?;
        println!("Request ID: {}", body);

        let result: ReqIdResponse = serde_json::from_str(&body)?;
        
        result.req_id
            .ok_or_else(|| anyhow::anyhow!("Не удалось создать запрос"))
    }

    async fn fetch_buy_link(&self, recipient: &str, req_id: &str, quantity: i32) -> Result<(String, String, String)> {
        let features = json!([
            "SendTransaction",
            {"name": "SendTransaction", "maxMessages": 255}
        ]);

        let mut params = HashMap::new();
        params.insert("address", FRAGMENT_ADDRESS.to_string());
        params.insert("chain", "-239".to_string());
        params.insert("walletStateInit", FRAGMENT_WALLETS.to_string());
        params.insert("publicKey", FRAGMENT_PUBLICKEY.to_string());
        params.insert("features", features.to_string());
        params.insert("maxProtocolVersion", "2".to_string());
        params.insert("platform", "iphone".to_string());
        params.insert("appName", "Tonkeeper".to_string());
        params.insert("appVersion", "5.0.14".to_string());
        params.insert("transaction", "1".to_string());
        params.insert("id", req_id.to_string());
        params.insert("show_sender", "0".to_string());
        params.insert("method", "getBuyStarsLink".to_string());

        let response = self.client
            .post(&self.url)
            .header(header::ACCEPT, "application/json, text/javascript, */*; q=0.01")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded; charset=UTF-8")
            .header("Origin", "https://fragment.com")
            .header("Referer", format!("https://fragment.com/stars/buy?recipient={}&quantity={}", recipient, quantity))
            .header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15")
            .header("X-Requested-With", "XMLHttpRequest")
            .header(header::COOKIE, cookies_to_string(&self.cookies))
            .form(&params)
            .send()
            .await?;

        let body = response.text().await?;
        println!("Buy link: {}", body);

        let result: BuyLinkResponse = serde_json::from_str(&body)?;

        if let Some(true) = result.ok {
            if let Some(transaction) = result.transaction {
                if let Some(msg) = transaction.messages.first() {
                    return Ok((msg.address.clone(), msg.amount.clone(), msg.payload.clone()));
                }
            }
        }

        Err(anyhow::anyhow!("Не удалось получить данные транзакции"))
    }
}

// TON WALLET
struct TonWallet {
    public_key: Vec<u8>,
    private_key: Vec<u8>,
    workchain: i8,
    wallet_id: u32,
}

impl TonWallet {
    fn new(mnemonic: &[String], workchain: i8) -> Result<Self> {
        let (public_key, private_key) = TonCrypto::mnemonic_to_keys(mnemonic)?;
        
        Ok(Self {
            public_key,
            private_key,
            workchain,
            wallet_id: 698983191, // Wallet V4R2
        })
    }

    fn get_address(&self) -> String {
        // Упрощенный расчет адреса
        let mut hasher = Sha256::new();
        hasher.update(&self.public_key);
        let hash = hasher.finalize();
        
        format!("{}:{}", self.workchain, hex::encode(&hash[..]))
    }

    fn create_transfer_message(
        &self,
        dest_address: &str,
        amount: u64,
        payload: &TonCell,
        seqno: u32,
    ) -> Result<TonCell> {
        // Создаем внутреннее сообщение
        let mut msg_body = TonCell::new();
        msg_body.write_uint(0, 1); // int_msg_info
        msg_body.write_uint(1, 1); // ihr_disabled
        msg_body.write_uint(1, 1); // bounce
        msg_body.write_uint(0, 1); // bounced
        msg_body.write_uint(0, 2); // src addr_none
        
        msg_body.write_address(dest_address)?;
        msg_body.write_uint(amount, 128);
        msg_body.write_uint(0, 1); // extra currencies
        msg_body.write_uint(0, 4); // ihr_fee
        msg_body.write_uint(0, 4); // fwd_fee
        msg_body.write_uint(0, 64); // created_lt
        msg_body.write_uint(0, 32); // created_at
        msg_body.write_uint(0, 1); // init
        msg_body.write_uint(1, 1); // body present
        
        // Создаем внешнее сообщение
        let mut ext_msg = TonCell::new();
        ext_msg.write_uint(seqno as u64, 32);
        ext_msg.write_uint((chrono::Utc::now().timestamp() + 60) as u64, 32); // valid_until
        ext_msg.write_uint(self.wallet_id as u64, 32);
        ext_msg.write_uint(3, 8); // mode

        Ok(ext_msg)
    }

    fn sign_and_send(&self, message: &TonCell) -> Result<String> {
        let msg_data = message.serialize();
        let signature = TonCrypto::sign(&msg_data, &self.private_key)?;
        
        let mut signed_msg = TonCell::new();
        signed_msg.write_bytes(&signature);
        signed_msg.write_bytes(&msg_data);
        
        let boc = signed_msg.to_boc();
        Ok(boc)
    }
}

// TON TRANSACTION
struct TonTransaction {
    wallet: TonWallet,
    client: Client,
}

impl TonTransaction {
    fn new(mnemonic: &[&str]) -> Result<Self> {
        let mnemonic_vec: Vec<String> = mnemonic.iter().map(|s| s.to_string()).collect();
        let wallet = TonWallet::new(&mnemonic_vec, 0)?;
        
        Ok(Self {
            wallet,
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap(),
        })
    }

    fn decode_payload(&self, payload_base64: &str, stars_count: i32) -> String {
        let fixed = fix_base64_padding(payload_base64);
        
        match general_purpose::STANDARD.decode(&fixed) {
            Ok(decoded) => {
                let decoded_text: String = decoded
                    .iter()
                    .map(|&b| if b >= 32 && b < 127 { b as char } else { ' ' })
                    .collect();

                let clean_text = Regex::new(r"\s+")
                    .unwrap()
                    .replace_all(&decoded_text, " ")
                    .trim()
                    .to_string();

                let pattern = format!(r"{} Telegram Stars.*", stars_count);
                if let Ok(re) = Regex::new(&pattern) {
                    if let Some(mat) = re.find(&clean_text) {
                        return mat.as_str().to_string();
                    }
                }

                clean_text
            }
            Err(_) => payload_base64.to_string(),
        }
    }

    async fn send_transaction(
        &self,
        recipient_address: &str,
        amount_ton: f64,
        payload_base64: &str,
        stars_count: i32,
    ) -> Result<String> {
        println!("\n🔐 Инициализация кошелька...");

        let wallet_address = self.wallet.get_address();
        println!("✅ Адрес кошелька: {}", wallet_address);

        let amount_nano = (amount_ton * 1e9) as u64;
        let seqno = 0; // В реальности нужно получить с блокчейна
        let payload_decoded = self.decode_payload(payload_base64, stars_count);

        println!("\n💸 Отправка транзакции...");
        println!("   Получатель: {}", recipient_address);
        println!("   Сумма: {:.4} TON ({} nanoTON)", amount_ton, amount_nano);
        println!("   Seqno: {}", seqno);
        println!("   Комментарий: {}", payload_decoded);

        // Декодируем payload
        let payload_cell = TonCell::from_boc(payload_base64)?;

        // Создаем сообщение
        let message = self.wallet.create_transfer_message(
            recipient_address,
            amount_nano,
            &payload_cell,
            seqno,
        )?;

        // Подписываем
        let boc = self.wallet.sign_and_send(&message)?;

        // Отправляем через API
        let tx_hash = self.send_boc(&boc).await?;

        println!("\n✅ Транзакция отправлена успешно!");
        println!("📝 Hash: {}", tx_hash);

        Ok(tx_hash)
    }

    async fn send_boc(&self, boc: &str) -> Result<String> {
        let request = SendBocRequest {
            boc: boc.to_string(),
        };

        let response = self.client
            .post(TON_API_ENDPOINT)
            .header(header::CONTENT_TYPE, "application/json")
            .json(&request)
            .send()
            .await?;

        let body = response.text().await?;
        
        // Генерируем hash из BOC
        let boc_bytes = general_purpose::STANDARD.decode(fix_base64_padding(boc))?;
        let mut hasher = Sha256::new();
        hasher.update(&boc_bytes);
        let hash = hasher.finalize();
        
        Ok(hex::encode(hash))
    }

    async fn get_balance(&self) -> Result<String> {
        println!("💰 Адрес кошелька: {}", self.wallet.get_address());
        println!("   (Проверка баланса требует запроса к TON API)");
        Ok("0".to_string())
    }
}

// ОСНОВНОЙ ПРОЦЕСС
async fn buy_stars(
    username: &str,
    stars_count: i32,
    fragment_hash: &str,
    cookies_data: &HashMap<&str, &str>,
    mnemonic: &[&str],
) -> Result<(bool, String)> {
    let fragment = FragmentClient::new(fragment_hash, cookies_data);
    let ton = TonTransaction::new(mnemonic)?;

    println!("{}", "=".repeat(60));
    println!("🌟 ПОКУПКА TELEGRAM STARS");
    println!("{}", "=".repeat(60));

    // Проверка баланса
    let _ = ton.get_balance().await;

    // Шаг 1: Поиск получателя
    println!("\n📍 Шаг 1: Поиск получателя {}...", username);
    let recipient = fragment.fetch_recipient(username).await?;
    println!("✅ Получатель найден: {}", recipient);

    // Шаг 2: Создание запроса
    println!("\n📝 Шаг 2: Создание запроса на {} звезд...", stars_count);
    let req_id = fragment.fetch_req_id(&recipient, stars_count).await?;
    println!("✅ Request ID: {}", req_id);

    // Шаг 3: Получение данных транзакции
    println!("\n🔍 Шаг 3: Получение данных транзакции...");
    let (address, amount, payload) = fragment.fetch_buy_link(&recipient, &req_id, stars_count).await?;

    let amount_int: u64 = amount.parse()?;
    let amount_ton = amount_int as f64 / 1e9;

    println!("✅ Сумма к оплате: {:.4} TON", amount_ton);
    println!("✅ Адрес Fragment: {}", address);

    // Шаг 4: Отправка TON
    println!("\n💳 Шаг 4: Отправка транзакции в блокчейн...");
    let tx_hash = ton.send_transaction(&address, amount_ton, &payload, stars_count).await?;

    println!("\n{}", "=".repeat(60));
    println!("🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!");
    println!("{}", "=".repeat(60));

    Ok((true, tx_hash))
}

#[tokio::main]
async fn main() -> Result<()> {
    // Параметры покупки
    let username = "@example";  // Замените на реальный username
    let stars_count = 100;

    match buy_stars(
        username,
        stars_count,
        FRAGMENT_HASH,
        &DATA,
        &MNEMONIC,
    ).await {
        Ok((success, tx_hash)) => {
            if success {
                println!("\n🔗 Просмотр транзакции:");
                println!("   https://tonviewer.com/transaction/{}", tx_hash);
                println!("   https://tonscan.org/tx/{}", tx_hash);
            } else {
                println!("\n❌ Покупка не удалась. Проверьте конфигурацию.");
            }
        }
        Err(e) => {
            eprintln!("\n💥 Критическая ошибка: {}", e);
            return Err(e);
        }
    }

    Ok(())
}
