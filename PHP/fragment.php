<?php
// УСТАНОВКА ЗАВИСИМОСТЕЙ:
// composer require guzzlehttp/guzzle
// composer require kornrunner/keccak
// composer require simplito/elliptic-php

require_once 'vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

// КОНФИГУРАЦИЯ
const MNEMONIC = [
    "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
    "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
    "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual"
];

const DATA = [
    "stel_ssid" => "ваш_ssid",
    "stel_dt" => "-240",
    "stel_ton_token" => "ваш_ton_token",
    "stel_token" => "ваш_token"
];

const FRAGMENT_HASH = "ed3ec875a724358cea";
const FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03";
const FRAGMENT_WALLETS = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq";
const FRAGMENT_ADDRESS = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118";
const TON_API_ENDPOINT = "https://toncenter.com/api/v2/sendBoc";

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getCookies($data) {
    return [
        "stel_ssid" => $data["stel_ssid"] ?? "",
        "stel_dt" => $data["stel_dt"] ?? "",
        "stel_ton_token" => $data["stel_ton_token"] ?? "",
        "stel_token" => $data["stel_token"] ?? ""
    ];
}

function fixBase64Padding($b64String) {
    $missingPadding = strlen($b64String) % 4;
    if ($missingPadding > 0) {
        $b64String .= str_repeat('=', 4 - $missingPadding);
    }
    return $b64String;
}

function cookiesToString($cookies) {
    $parts = [];
    foreach ($cookies as $key => $value) {
        $parts[] = "$key=$value";
    }
    return implode('; ', $parts);
}

// TON CRYPTO
class TonCrypto {
    public static function mnemonicToKeys($mnemonic) {
        $mnemonicStr = implode(' ', $mnemonic);
        $salt = "TON default seed";
        
        // PBKDF2 для получения seed
        $seed = hash_pbkdf2("sha512", $mnemonicStr, $salt, 100000, 64, true);
        
        // Генерируем ключевую пару Ed25519
        $keypair = sodium_crypto_sign_seed_keypair(substr($seed, 0, 32));
        
        $publicKey = sodium_crypto_sign_publickey($keypair);
        $privateKey = sodium_crypto_sign_secretkey($keypair);
        
        return [$publicKey, $privateKey];
    }
    
    public static function sign($message, $privateKey) {
        // Создаем keypair из приватного ключа
        $publicKey = substr($privateKey, 32, 32);
        $keypair = $privateKey . $publicKey;
        
        return sodium_crypto_sign_detached($message, $keypair);
    }
}

// TON CELL
class TonCell {
    private $data = [];
    private $refs = [];
    
    public function __construct($data = []) {
        $this->data = $data;
    }
    
    public function writeUint($value, $bits) {
        $bytes = intval(($bits + 7) / 8);
        $valueBytes = [];
        
        for ($i = $bytes - 1; $i >= 0; $i--) {
            $valueBytes[] = ($value >> (8 * $i)) & 0xFF;
        }
        
        $this->data = array_merge($this->data, $valueBytes);
    }
    
    public function writeBytes($bytes) {
        if (is_string($bytes)) {
            $bytes = unpack('C*', $bytes);
            $bytes = array_values($bytes);
        }
        $this->data = array_merge($this->data, $bytes);
    }
    
    public function writeAddress($address) {
        // Парсим адрес вида "0:hash"
        $parts = explode(':', $address);
        if (count($parts) !== 2) {
            throw new Exception("Неверный формат адреса");
        }
        
        $workchain = intval($parts[0]);
        $hash = hex2bin($parts[1]);
        
        $this->data[] = 0x01; // addr_std
        $this->data[] = $workchain & 0xFF;
        $this->writeBytes($hash);
    }
    
    public function addRef($cell) {
        $this->refs[] = $cell;
    }
    
    public function serialize() {
        $result = [];
        
        // Дескрипторы
        $result[] = count($this->refs);
        $result[] = count($this->data);
        
        // Данные
        $result = array_merge($result, $this->data);
        
        // Ссылки
        foreach ($this->refs as $ref) {
            $result = array_merge($result, $ref->serialize());
        }
        
        return $result;
    }
    
    public function hash() {
        $serialized = $this->serialize();
        $bytes = pack('C*', ...$serialized);
        return hash('sha256', $bytes, true);
    }
    
    public function toBoc() {
        $serialized = $this->serialize();
        $bytes = pack('C*', ...$serialized);
        return base64_encode($bytes);
    }
    
    public static function fromBoc($boc) {
        $fixed = fixBase64Padding($boc);
        $bytes = base64_decode($fixed);
        $data = unpack('C*', $bytes);
        return new self(array_values($data));
    }
}

// TON WALLET
class TonWallet {
    private $publicKey;
    private $privateKey;
    private $workchain;
    private $walletId;
    
    public function __construct($mnemonic, $workchain = 0) {
        list($this->publicKey, $this->privateKey) = TonCrypto::mnemonicToKeys($mnemonic);
        $this->workchain = $workchain;
        $this->walletId = 698983191; // Wallet V4R2
    }
    
    public function getAddress() {
        // Упрощенный расчет адреса
        $hash = hash('sha256', $this->publicKey, true);
        return $this->workchain . ':' . bin2hex($hash);
    }
    
    public function createTransferMessage($destAddress, $amount, $payload, $seqno) {
        // Создаем внутреннее сообщение
        $msgBody = new TonCell();
        $msgBody->writeUint(0, 1); // int_msg_info
        $msgBody->writeUint(1, 1); // ihr_disabled
        $msgBody->writeUint(1, 1); // bounce
        $msgBody->writeUint(0, 1); // bounced
        $msgBody->writeUint(0, 2); // src addr_none
        
        $msgBody->writeAddress($destAddress);
        $msgBody->writeUint($amount, 128);
        $msgBody->writeUint(0, 1); // extra currencies
        $msgBody->writeUint(0, 4); // ihr_fee
        $msgBody->writeUint(0, 4); // fwd_fee
        $msgBody->writeUint(0, 64); // created_lt
        $msgBody->writeUint(0, 32); // created_at
        $msgBody->writeUint(0, 1); // init
        $msgBody->writeUint(1, 1); // body present
        
        // Создаем внешнее сообщение
        $extMsg = new TonCell();
        $extMsg->writeUint($seqno, 32);
        $extMsg->writeUint(time() + 60, 32); // valid_until
        $extMsg->writeUint($this->walletId, 32);
        $extMsg->writeUint(3, 8); // mode
        
        return $extMsg;
    }
    
    public function signAndSend($message) {
        $msgData = $message->serialize();
        $msgBytes = pack('C*', ...$msgData);
        
        $signature = TonCrypto::sign($msgBytes, $this->privateKey);
        
        $signedMsg = new TonCell();
        $signedMsg->writeBytes($signature);
        $signedMsg->writeBytes($msgBytes);
        
        return $signedMsg->toBoc();
    }
}

// FRAGMENT CLIENT
class FragmentClient {
    private $url;
    private $cookies;
    private $client;
    
    public function __construct($fragmentHash, $cookiesData) {
        $this->url = "https://fragment.com/api?hash=$fragmentHash";
        $this->cookies = getCookies($cookiesData);
        $this->client = new Client(['timeout' => 30]);
    }
    
    public function fetchRecipient($query) {
        try {
            $response = $this->client->post($this->url, [
                'headers' => [
                    'Cookie' => cookiesToString($this->cookies),
                    'Content-Type' => 'application/x-www-form-urlencoded'
                ],
                'form_params' => [
                    'query' => $query,
                    'method' => 'searchStarsRecipient'
                ]
            ]);
            
            $body = $response->getBody()->getContents();
            echo "Recipient search: $body\n";
            
            $result = json_decode($body, true);
            
            if (isset($result['found']['recipient'])) {
                return $result['found']['recipient'];
            }
            
            throw new Exception("Получатель не найден");
        } catch (RequestException $e) {
            throw new Exception("Ошибка запроса: " . $e->getMessage());
        }
    }
    
    public function fetchReqId($recipient, $quantity) {
        try {
            $response = $this->client->post($this->url, [
                'headers' => [
                    'Cookie' => cookiesToString($this->cookies),
                    'Content-Type' => 'application/x-www-form-urlencoded'
                ],
                'form_params' => [
                    'recipient' => $recipient,
                    'quantity' => $quantity,
                    'method' => 'initBuyStarsRequest'
                ]
            ]);
            
            $body = $response->getBody()->getContents();
            echo "Request ID: $body\n";
            
            $result = json_decode($body, true);
            
            if (isset($result['req_id'])) {
                return $result['req_id'];
            }
            
            throw new Exception("Не удалось создать запрос");
        } catch (RequestException $e) {
            throw new Exception("Ошибка запроса: " . $e->getMessage());
        }
    }
    
    public function fetchBuyLink($recipient, $reqId, $quantity) {
        try {
            $features = json_encode([
                "SendTransaction",
                ["name" => "SendTransaction", "maxMessages" => 255]
            ]);
            
            $response = $this->client->post($this->url, [
                'headers' => [
                    'Accept' => 'application/json, text/javascript, */*; q=0.01',
                    'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin' => 'https://fragment.com',
                    'Referer' => "https://fragment.com/stars/buy?recipient=$recipient&quantity=$quantity",
                    'User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
                    'X-Requested-With' => 'XMLHttpRequest',
                    'Cookie' => cookiesToString($this->cookies)
                ],
                'form_params' => [
                    'address' => FRAGMENT_ADDRESS,
                    'chain' => '-239',
                    'walletStateInit' => FRAGMENT_WALLETS,
                    'publicKey' => FRAGMENT_PUBLICKEY,
                    'features' => $features,
                    'maxProtocolVersion' => '2',
                    'platform' => 'iphone',
                    'appName' => 'Tonkeeper',
                    'appVersion' => '5.0.14',
                    'transaction' => '1',
                    'id' => $reqId,
                    'show_sender' => '0',
                    'method' => 'getBuyStarsLink'
                ]
            ]);
            
            $body = $response->getBody()->getContents();
            echo "Buy link: $body\n";
            
            $result = json_decode($body, true);
            
            if (isset($result['ok']) && $result['ok'] && isset($result['transaction']['messages'][0])) {
                $msg = $result['transaction']['messages'][0];
                return [
                    $msg['address'],
                    $msg['amount'],
                    $msg['payload']
                ];
            }
            
            throw new Exception("Не удалось получить данные транзакции");
        } catch (RequestException $e) {
            throw new Exception("Ошибка запроса: " . $e->getMessage());
        }
    }
}

// TON TRANSACTION
class TonTransaction {
    private $wallet;
    private $client;
    
    public function __construct($mnemonic) {
        $this->wallet = new TonWallet($mnemonic);
        $this->client = new Client(['timeout' => 30]);
    }
    
    public function decodePayload($payloadBase64, $starsCount) {
        $fixed = fixBase64Padding($payloadBase64);
        $decoded = base64_decode($fixed);
        
        $decodedText = '';
        for ($i = 0; $i < strlen($decoded); $i++) {
            $byte = ord($decoded[$i]);
            $decodedText .= ($byte >= 32 && $byte < 127) ? chr($byte) : ' ';
        }
        
        $cleanText = preg_replace('/\s+/', ' ', $decodedText);
        $cleanText = trim($cleanText);
        
        $pattern = "/$starsCount Telegram Stars.*/";
        if (preg_match($pattern, $cleanText, $matches)) {
            return $matches[0];
        }
        
        return $cleanText;
    }
    
    public function sendTransaction($recipientAddress, $amountTon, $payloadBase64, $starsCount) {
        echo "\n🔐 Инициализация кошелька...\n";
        
        $walletAddress = $this->wallet->getAddress();
        echo "✅ Адрес кошелька: $walletAddress\n";
        
        $amountNano = intval($amountTon * 1e9);
        $seqno = 0; // В реальности нужно получить с блокчейна
        $payloadDecoded = $this->decodePayload($payloadBase64, $starsCount);
        
        echo "\n💸 Отправка транзакции...\n";
        echo "   Получатель: $recipientAddress\n";
        printf("   Сумма: %.4f TON (%d nanoTON)\n", $amountTon, $amountNano);
        echo "   Seqno: $seqno\n";
        echo "   Комментарий: $payloadDecoded\n";
        
        // Декодируем payload
        $payloadCell = TonCell::fromBoc($payloadBase64);
        
        // Создаем сообщение
        $message = $this->wallet->createTransferMessage(
            $recipientAddress,
            $amountNano,
            $payloadCell,
            $seqno
        );
        
        // Подписываем
        $boc = $this->wallet->signAndSend($message);
        
        // Отправляем через API
        $txHash = $this->sendBoc($boc);
        
        echo "\n✅ Транзакция отправлена успешно!\n";
        echo "📝 Hash: $txHash\n";
        
        return $txHash;
    }
    
    public function sendBoc($boc) {
        try {
            $response = $this->client->post(TON_API_ENDPOINT, [
                'headers' => [
                    'Content-Type' => 'application/json'
                ],
                'json' => [
                    'boc' => $boc
                ]
            ]);
            
            $body = $response->getBody()->getContents();
            
            // Генерируем hash из BOC
            $bocBytes = base64_decode(fixBase64Padding($boc));
            $hash = hash('sha256', $bocBytes);
            
            return $hash;
        } catch (RequestException $e) {
            throw new Exception("Не удалось отправить транзакцию: " . $e->getMessage());
        }
    }
    
    public function getBalance() {
        echo "💰 Адрес кошелька: " . $this->wallet->getAddress() . "\n";
        echo "   (Проверка баланса требует запроса к TON API)\n";
        return "0";
    }
}

// ОСНОВНОЙ ПРОЦЕСС
function buyStars($username, $starsCount, $fragmentHash, $cookiesData, $mnemonic) {
    try {
        $fragment = new FragmentClient($fragmentHash, $cookiesData);
        $ton = new TonTransaction($mnemonic);
        
        echo str_repeat('=', 60) . "\n";
        echo "🌟 ПОКУПКА TELEGRAM STARS\n";
        echo str_repeat('=', 60) . "\n";
        
        // Проверка баланса
        $ton->getBalance();
        
        // Шаг 1: Поиск получателя
        echo "\n📍 Шаг 1: Поиск получателя $username...\n";
        $recipient = $fragment->fetchRecipient($username);
        echo "✅ Получатель найден: $recipient\n";
        
        // Шаг 2: Создание запроса
        echo "\n📝 Шаг 2: Создание запроса на $starsCount звезд...\n";
        $reqId = $fragment->fetchReqId($recipient, $starsCount);
        echo "✅ Request ID: $reqId\n";
        
        // Шаг 3: Получение данных транзакции
        echo "\n🔍 Шаг 3: Получение данных транзакции...\n";
        list($address, $amount, $payload) = $fragment->fetchBuyLink($recipient, $reqId, $starsCount);
        
        $amountTon = floatval($amount) / 1e9;
        printf("✅ Сумма к оплате: %.4f TON\n", $amountTon);
        echo "✅ Адрес Fragment: $address\n";
        
        // Шаг 4: Отправка TON
        echo "\n💳 Шаг 4: Отправка транзакции в блокчейн...\n";
        $txHash = $ton->sendTransaction($address, $amountTon, $payload, $starsCount);
        
        echo "\n" . str_repeat('=', 60) . "\n";
        echo "🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!\n";
        echo str_repeat('=', 60) . "\n";
        
        return [true, $txHash];
    } catch (Exception $e) {
        echo "\n❌ Ошибка: " . $e->getMessage() . "\n";
        return [false, null];
    }
}

// ПРИМЕР ИСПОЛЬЗОВАНИЯ
function main() {
    // Параметры покупки
    $username = "@example";  // Замените на реальный username
    $starsCount = 100;
    
    list($success, $txHash) = buyStars(
        $username,
        $starsCount,
        FRAGMENT_HASH,
        DATA,
        MNEMONIC
    );
    
    if ($success) {
        echo "\n🔗 Просмотр транзакции:\n";
        echo "   https://tonviewer.com/transaction/$txHash\n";
        echo "   https://tonscan.org/tx/$txHash\n";
    } else {
        echo "\n❌ Покупка не удалась. Проверьте конфигурацию.\n";
    }
}

// Запуск
main();
?>
