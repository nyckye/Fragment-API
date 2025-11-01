// КОМПИЛЯЦИЯ:
// g++ -std=c++17 fragment_stars.cpp -lcurl -ljsoncpp -lssl -lcrypto -lsodium -o fragment_stars
//
// УСТАНОВКА ЗАВИСИМОСТЕЙ:
// Ubuntu/Debian: 
//   sudo apt install libcurl4-openssl-dev libjsoncpp-dev libssl-dev libsodium-dev build-essential
// macOS: 
//   brew install curl jsoncpp openssl libsodium

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <algorithm>
#include <iomanip>
#include <cstring>
#include <ctime>
#include <curl/curl.h>
#include <json/json.h>
#include <openssl/bio.h>
#include <openssl/evp.h>
#include <openssl/buffer.h>
#include <openssl/sha.h>
#include <openssl/hmac.h>
#include <sodium.h>
#include <regex>

using namespace std;

// КОНФИГУРАЦИЯ
namespace Config {
    const vector<string> MNEMONIC = {
        "penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
        "coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
        "nature", "manage", "there", "brief", "wet", "pole", "debris", "annual"
    };

    const map<string, string> DATA = {
        {"stel_ssid", "ваш_ssid"},
        {"stel_dt", "-240"},
        {"stel_ton_token", "ваш_ton_token"},
        {"stel_token", "ваш_token"}
    };

    const string FRAGMENT_HASH = "ed3ec875a724358cea";
    const string FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03";
    const string FRAGMENT_WALLETS = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq";
    const string FRAGMENT_ADDRESS = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118";
    const string TON_API_ENDPOINT = "https://toncenter.com/api/v2/sendBoc";
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
namespace Helpers {
    // Callback для curl
    size_t WriteCallback(void* contents, size_t size, size_t nmemb, string* s) {
        size_t newLength = size * nmemb;
        s->append((char*)contents, newLength);
        return newLength;
    }

    // Base64 padding
    string FixBase64Padding(string b64String) {
        int missingPadding = b64String.length() % 4;
        if (missingPadding > 0) {
            b64String.append(4 - missingPadding, '=');
        }
        return b64String;
    }

    // Cookies в строку
    string CookiesToString(const map<string, string>& cookies) {
        stringstream ss;
        bool first = true;
        for (const auto& [key, value] : cookies) {
            if (!first) ss << "; ";
            ss << key << "=" << value;
            first = false;
        }
        return ss.str();
    }

    // URL encode
    string UrlEncode(const string& value) {
        CURL* curl = curl_easy_init();
        char* output = curl_easy_escape(curl, value.c_str(), value.length());
        string result(output);
        curl_free(output);
        curl_easy_cleanup(curl);
        return result;
    }

    // Base64 encode
    string Base64Encode(const unsigned char* buffer, size_t length) {
        BIO *bio, *b64;
        BUF_MEM *bufferPtr;

        b64 = BIO_new(BIO_f_base64());
        bio = BIO_new(BIO_s_mem());
        bio = BIO_push(b64, bio);

        BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL);
        BIO_write(bio, buffer, length);
        BIO_flush(bio);
        BIO_get_mem_ptr(bio, &bufferPtr);
        BIO_set_close(bio, BIO_NOCLOSE);
        BIO_free_all(bio);

        string result(bufferPtr->data, bufferPtr->length);
        BUF_MEM_free(bufferPtr);
        return result;
    }

    // Base64 decode
    vector<uint8_t> Base64Decode(const string& encoded) {
        string fixed = FixBase64Padding(encoded);
        BIO *bio, *b64;
        int decodeLen = fixed.length();
        vector<uint8_t> buffer(decodeLen);
        
        bio = BIO_new_mem_buf(fixed.c_str(), -1);
        b64 = BIO_new(BIO_f_base64());
        bio = BIO_push(b64, bio);
        
        BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL);
        int length = BIO_read(bio, buffer.data(), decodeLen);
        BIO_free_all(bio);
        
        buffer.resize(length);
        return buffer;
    }

    // Hex to bytes
    vector<uint8_t> HexToBytes(const string& hex) {
        vector<uint8_t> bytes;
        for (size_t i = 0; i < hex.length(); i += 2) {
            string byteString = hex.substr(i, 2);
            uint8_t byte = (uint8_t)strtol(byteString.c_str(), nullptr, 16);
            bytes.push_back(byte);
        }
        return bytes;
    }

    // Bytes to hex
    string BytesToHex(const uint8_t* data, size_t len) {
        stringstream ss;
        ss << hex << setfill('0');
        for (size_t i = 0; i < len; i++) {
            ss << setw(2) << (int)data[i];
        }
        return ss.str();
    }

    // PBKDF2 для мнемоники
    void PBKDF2_HMAC_SHA512(const string& password, const string& salt, 
                           int iterations, uint8_t* output, size_t outputLen) {
        PKCS5_PBKDF2_HMAC(password.c_str(), password.length(),
                          (const unsigned char*)salt.c_str(), salt.length(),
                          iterations, EVP_sha512(), outputLen, output);
    }

    // Int to bytes (big-endian)
    vector<uint8_t> IntToBytes(uint64_t value, size_t size) {
        vector<uint8_t> bytes(size);
        for (int i = size - 1; i >= 0; i--) {
            bytes[i] = value & 0xFF;
            value >>= 8;
        }
        return bytes;
    }

    // CRC16 для TON адресов
    uint16_t CRC16(const vector<uint8_t>& data) {
        uint16_t crc = 0;
        for (uint8_t byte : data) {
            crc ^= (byte << 8);
            for (int i = 0; i < 8; i++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc <<= 1;
                }
            }
        }
        return crc;
    }
}

// TON ADDRESS
class TonAddress {
private:
    int workchain;
    vector<uint8_t> hash;

public:
    TonAddress(int wc, const vector<uint8_t>& h) : workchain(wc), hash(h) {}

    static TonAddress FromString(const string& address) {
        // Парсинг адреса вида "0:hash"
        size_t colonPos = address.find(':');
        if (colonPos == string::npos) {
            throw runtime_error("Неверный формат адреса");
        }

        int wc = stoi(address.substr(0, colonPos));
        string hashHex = address.substr(colonPos + 1);
        vector<uint8_t> hash = Helpers::HexToBytes(hashHex);

        return TonAddress(wc, hash);
    }

    string ToString() const {
        return to_string(workchain) + ":" + Helpers::BytesToHex(hash.data(), hash.size());
    }

    vector<uint8_t> Serialize() const {
        vector<uint8_t> result;
        result.push_back(workchain & 0xFF);
        result.insert(result.end(), hash.begin(), hash.end());
        return result;
    }
};

// TON CELL (упрощенная реализация)
class TonCell {
private:
    vector<uint8_t> data;
    vector<TonCell*> refs;

public:
    TonCell() {}
    TonCell(const vector<uint8_t>& d) : data(d) {}

    void WriteUint(uint64_t value, int bits) {
        int bytes = (bits + 7) / 8;
        auto valueBytes = Helpers::IntToBytes(value, bytes);
        data.insert(data.end(), valueBytes.begin(), valueBytes.end());
    }

    void WriteBytes(const vector<uint8_t>& bytes) {
        data.insert(data.end(), bytes.begin(), bytes.end());
    }

    void WriteAddress(const TonAddress& address) {
        auto serialized = address.Serialize();
        data.push_back(0x01); // addr_std$10
        data.insert(data.end(), serialized.begin(), serialized.end());
    }

    void AddRef(TonCell* cell) {
        refs.push_back(cell);
    }

    vector<uint8_t> Serialize() const {
        vector<uint8_t> result;
        
        // Дескриптор
        uint8_t d1 = refs.size();
        uint8_t d2 = data.size();
        result.push_back(d1);
        result.push_back(d2);
        
        // Данные
        result.insert(result.end(), data.begin(), data.end());
        
        // Ссылки
        for (auto ref : refs) {
            auto refData = ref->Serialize();
            result.insert(result.end(), refData.begin(), refData.end());
        }
        
        return result;
    }

    vector<uint8_t> Hash() const {
        auto serialized = Serialize();
        unsigned char hash[SHA256_DIGEST_LENGTH];
        SHA256(serialized.data(), serialized.size(), hash);
        return vector<uint8_t>(hash, hash + SHA256_DIGEST_LENGTH);
    }

    string ToBoc() const {
        auto serialized = Serialize();
        return Helpers::Base64Encode(serialized.data(), serialized.size());
    }

    static TonCell* FromBoc(const string& boc) {
        auto data = Helpers::Base64Decode(boc);
        return new TonCell(data);
    }
};

// FRAGMENT CLIENT
class FragmentClient {
private:
    string url;
    map<string, string> cookies;

public:
    FragmentClient(const string& fragmentHash, const map<string, string>& cookiesData)
        : url("https://fragment.com/api?hash=" + fragmentHash), cookies(cookiesData) {}

    string FetchRecipient(const string& query) {
        CURL* curl = curl_easy_init();
        string response;

        if (curl) {
            string postData = "query=" + Helpers::UrlEncode(query) + 
                            "&method=searchStarsRecipient";

            curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData.c_str());
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, Helpers::WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

            struct curl_slist* headers = NULL;
            string cookie = "Cookie: " + Helpers::CookiesToString(cookies);
            headers = curl_slist_append(headers, cookie.c_str());
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            CURLcode res = curl_easy_perform(curl);
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);

            if (res == CURLE_OK) {
                Json::Value root;
                Json::CharReaderBuilder builder;
                istringstream s(response);
                string errs;
                
                if (Json::parseFromStream(builder, s, &root, &errs)) {
                    cout << "Recipient search: " << response << endl;
                    if (root.isMember("found") && root["found"].isMember("recipient")) {
                        return root["found"]["recipient"].asString();
                    }
                }
            }
        }
        return "";
    }

    string FetchReqId(const string& recipient, int quantity) {
        CURL* curl = curl_easy_init();
        string response;

        if (curl) {
            string postData = "recipient=" + Helpers::UrlEncode(recipient) +
                            "&quantity=" + to_string(quantity) +
                            "&method=initBuyStarsRequest";

            curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData.c_str());
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, Helpers::WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

            struct curl_slist* headers = NULL;
            string cookie = "Cookie: " + Helpers::CookiesToString(cookies);
            headers = curl_slist_append(headers, cookie.c_str());
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            CURLcode res = curl_easy_perform(curl);
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);

            if (res == CURLE_OK) {
                Json::Value root;
                Json::CharReaderBuilder builder;
                istringstream s(response);
                string errs;
                
                if (Json::parseFromStream(builder, s, &root, &errs)) {
                    cout << "Request ID: " << response << endl;
                    if (root.isMember("req_id")) {
                        return root["req_id"].asString();
                    }
                }
            }
        }
        return "";
    }

    tuple<string, string, string> FetchBuyLink(const string& recipient, 
                                               const string& reqId, 
                                               int quantity) {
        CURL* curl = curl_easy_init();
        string response;

        if (curl) {
            string features = R"(["SendTransaction",{"name":"SendTransaction","maxMessages":255}])";
            
            string postData = 
                "address=" + Helpers::UrlEncode(Config::FRAGMENT_ADDRESS) +
                "&chain=-239" +
                "&walletStateInit=" + Helpers::UrlEncode(Config::FRAGMENT_WALLETS) +
                "&publicKey=" + Helpers::UrlEncode(Config::FRAGMENT_PUBLICKEY) +
                "&features=" + Helpers::UrlEncode(features) +
                "&maxProtocolVersion=2" +
                "&platform=iphone" +
                "&appName=Tonkeeper" +
                "&appVersion=5.0.14" +
                "&transaction=1" +
                "&id=" + Helpers::UrlEncode(reqId) +
                "&show_sender=0" +
                "&method=getBuyStarsLink";

            curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData.c_str());
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, Helpers::WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

            struct curl_slist* headers = NULL;
            headers = curl_slist_append(headers, "Accept: application/json");
            headers = curl_slist_append(headers, "Content-Type: application/x-www-form-urlencoded");
            headers = curl_slist_append(headers, "Origin: https://fragment.com");
            string referer = "Referer: https://fragment.com/stars/buy?recipient=" + 
                           recipient + "&quantity=" + to_string(quantity);
            headers = curl_slist_append(headers, referer.c_str());
            string cookie = "Cookie: " + Helpers::CookiesToString(cookies);
            headers = curl_slist_append(headers, cookie.c_str());
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            CURLcode res = curl_easy_perform(curl);
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);

            if (res == CURLE_OK) {
                Json::Value root;
                Json::CharReaderBuilder builder;
                istringstream s(response);
                string errs;
                
                if (Json::parseFromStream(builder, s, &root, &errs)) {
                    cout << "Buy link: " << response << endl;
                    
                    if (root.isMember("ok") && root["ok"].asBool() && 
                        root.isMember("transaction")) {
                        auto msg = root["transaction"]["messages"][0];
                        return make_tuple(
                            msg["address"].asString(),
                            msg["amount"].asString(),
                            msg["payload"].asString()
                        );
                    }
                }
            }
        }
        return make_tuple("", "", "");
    }
};

// TON CRYPTO
class TonCrypto {
public:
    static pair<vector<uint8_t>, vector<uint8_t>> MnemonicToKeys(const vector<string>& mnemonic) {
        string mnemonicStr;
        for (size_t i = 0; i < mnemonic.size(); i++) {
            if (i > 0) mnemonicStr += " ";
            mnemonicStr += mnemonic[i];
        }

        // PBKDF2 для получения seed
        uint8_t seed[64];
        Helpers::PBKDF2_HMAC_SHA512(mnemonicStr, "TON default seed", 100000, seed, 64);

        // Генерируем ключевую пару Ed25519
        uint8_t publicKey[crypto_sign_PUBLICKEYBYTES];
        uint8_t privateKey[crypto_sign_SECRETKEYBYTES];
        
        crypto_sign_seed_keypair(publicKey, privateKey, seed);

        vector<uint8_t> pubKey(publicKey, publicKey + crypto_sign_PUBLICKEYBYTES);
        vector<uint8_t> privKey(privateKey, privateKey + crypto_sign_SECRETKEYBYTES);

        return {pubKey, privKey};
    }

    static vector<uint8_t> Sign(const vector<uint8_t>& message, const vector<uint8_t>& privateKey) {
        unsigned char signature[crypto_sign_BYTES];
        unsigned long long sigLen;
        
        crypto_sign_detached(signature, &sigLen, message.data(), message.size(), privateKey.data());
        
        return vector<uint8_t>(signature, signature + crypto_sign_BYTES);
    }
};

// TON WALLET
class TonWallet {
private:
    vector<uint8_t> publicKey;
    vector<uint8_t> privateKey;
    int workchain;
    uint32_t walletId;

public:
    TonWallet(const vector<string>& mnemonic, int wc = 0) : workchain(wc) {
        if (sodium_init() < 0) {
            throw runtime_error("Ошибка инициализации libsodium");
        }

        auto keys = TonCrypto::MnemonicToKeys(mnemonic);
        publicKey = keys.first;
        privateKey = keys.second;
        walletId = 698983191; // Wallet V4R2
    }

    string GetAddress() {
        // Упрощенный расчет адреса (в реальности нужен state init)
        vector<uint8_t> addressData = publicKey;
        unsigned char hash[SHA256_DIGEST_LENGTH];
        SHA256(addressData.data(), addressData.size(), hash);
        
        vector<uint8_t> addressHash(hash, hash + 32);
        TonAddress addr(workchain, addressHash);
        return addr.ToString();
    }

    uint32_t GetSeqno() {
        // Для примера возвращаем 0
        // В реальности нужно запросить с блокчейна
        return 0;
    }

    TonCell* CreateTransferMessage(const string& destAddress, uint64_t amount, 
                                    TonCell* payload, uint32_t seqno) {
        // Создаем внутреннее сообщение
        TonCell* msgBody = new TonCell();
        msgBody->WriteUint(0, 1); // int_msg_info$0
        msgBody->WriteUint(1, 1); // ihr_disabled:Bool
        msgBody->WriteUint(1, 1); // bounce:Bool
        msgBody->WriteUint(0, 1); // bounced:Bool
        
        // Адрес отправителя (пустой)
        msgBody->WriteUint(0, 2); // src:MsgAddressExt (addr_none$00)
        
        // Адрес получателя
        TonAddress dest = TonAddress::FromString(destAddress);
        msgBody->WriteAddress(dest);
        
        // Сумма
        msgBody->WriteUint(amount, 128);
        
        // Extra currencies (пустой)
        msgBody->WriteUint(0, 1);
        
        // ihr_fee, fwd_fee, created_lt, created_at
        msgBody->WriteUint(0, 4);
        msgBody->WriteUint(0, 4);
        msgBody->WriteUint(0, 64);
        msgBody->WriteUint(0, 32);
        
        // Init (нет)
        msgBody->WriteUint(0, 1);
        
        // Body (payload)
        msgBody->WriteUint(1, 1);
        if (payload) {
            msgBody->AddRef(payload);
        }

        // Создаем внешнее сообщение
        TonCell* extMsg = new TonCell();
        extMsg->WriteUint(seqno, 32);
        extMsg->WriteUint(time(nullptr) + 60, 32); // valid_until
        extMsg->WriteUint(walletId, 32);
        extMsg->WriteUint(3, 8); // mode
        extMsg->AddRef(msgBody);

        return extMsg;
    }

    string SignAndSendTransaction(TonCell* message) {
        // Сериализуем сообщение
        auto msgData = message->Serialize();
        
        // Подписываем
        auto signature = TonCrypto::Sign(msgData, privateKey);
        
        // Создаем финальное внешнее сообщение
        TonCell* signedMsg = new TonCell();
        signedMsg->WriteBytes(signature);
        signedMsg->WriteBytes(msgData);
        
        // Конвертируем в BOC
        string boc = signedMsg->ToBoc();
        
        // Отправляем через HTTP API
        return SendBoc(boc);
    }

    string SendBoc(const string& boc) {
        CURL* curl = curl_easy_init();
        string response;

        if (curl) {
            Json::Value jsonData;
            jsonData["boc"] = boc;
            
            Json::StreamWriterBuilder writer;
            string postData = Json::writeString(writer, jsonData);

            curl_easy_setopt(curl, CURLOPT_URL, Config::TON_API_ENDPOINT.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, postData.c_str());
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, Helpers::WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

            struct curl_slist* headers = NULL;
            headers = curl_slist_append(headers, "Content-Type: application/json");
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            CURLcode res = curl_easy_perform(curl);
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);

            if (res == CURLE_OK) {
                Json::Value root;
                Json::CharReaderBuilder builder;
                istringstream s(response);
                string errs;
                
                if (Json::parseFromStream(builder, s, &root, &errs)) {
                    if (root.isMember("ok") && root["ok"].asBool()) {
                        // Генерируем hash из BOC
                        auto bocBytes = Helpers::Base64Decode(boc);
                        unsigned char hash[SHA256_DIGEST_LENGTH];
                        SHA256(bocBytes.data(), bocBytes.size(), hash);
                        return Helpers::BytesToHex(hash, SHA256_DIGEST_LENGTH);
                    }
                }
            }
        }

        throw runtime_error("Не удалось отправить транзакцию");
    }
};

// TON TRANSACTION
class TonTransaction {
private:
    TonWallet* wallet;

public:
    TonTransaction(const vector<string>& mnemonic) {
        wallet = new TonWallet(mnemonic);
    }

    ~TonTransaction() {
        delete wallet;
    }

    string DecodePayload(const string& payloadBase64, int starsCount) {
        try {
            auto decoded = Helpers::Base64Decode(payloadBase64);
            
            stringstream decodedText;
            for (uint8_t c : decoded) {
                decodedText << (c >= 32 && c < 127 ? (char)c : ' ');
            }
            
            string cleanText = decodedText.str();
            cleanText = regex_replace(cleanText, regex("\\s+"), " ");
            
            regex pattern(to_string(starsCount) + " Telegram Stars.*");
            smatch match;
            if (regex_search(cleanText, match, pattern)) {
                return match.str();
            }
            return cleanText;
        } catch (...) {
            return payloadBase64;
        }
    }

    string SendTransaction(const string& recipientAddress, double amountTon,
                          const string& payloadBase64, int starsCount) {
        try {
            cout << "\n🔐 Инициализация кошелька..." << endl;
            
            string walletAddress = wallet->GetAddress();
            cout << "✅ Адрес кошелька: " << walletAddress << endl;

            uint64_t amountInNano = static_cast<uint64_t>(amountTon * 1e9);
            uint32_t seqno = wallet->GetSeqno();

            cout << "\n💸 Отправка транзакции..." << endl;
            cout << "   Получатель: " << recipientAddress << endl;
            cout << "   Сумма: " << amountTon << " TON (" << amountInNano << " nanoTON)" << endl;
            cout << "   Seqno: " << seqno << endl;
            cout << "   Комментарий: " << DecodePayload(payloadBase64, starsCount) << endl;

            // Декодируем payload
            TonCell* payloadCell = TonCell::FromBoc(payloadBase64);

            // Создаем сообщение
            TonCell* message = wallet->CreateTransferMessage(
                recipientAddress, 
                amountInNano, 
                payloadCell, 
                seqno
            );

            // Подписываем и отправляем
            string txHash = wallet->SignAndSendTransaction(message);

            cout << "\n✅ Транзакция отправлена успешно!" << endl;
            cout << "📝 Hash: " << txHash << endl;

            delete payloadCell;
            delete message;

            return txHash;
        } catch (const exception& e) {
            cerr << "\n❌ Ошибка при отправке транзакции: " << e.what() << endl;
            throw;
        }
    }

    string GetBalance() {
        try {
            string address = wallet->GetAddress();
            cout << "💰 Адрес кошелька: " << address << endl;
            // В реальности нужно запросить баланс с блокчейна через API
            cout << "   (Проверка баланса требует запроса к TON API)" << endl;
            return "0";
        } catch (const exception& e) {
            cerr << "Ошибка получения баланса: " << e.what() << endl;
            return "0";
        }
    }
};

// ОСНОВНАЯ ФУНКЦИЯ
pair<bool, string> BuyStars(const string& username, int starsCount,
                           const string& fragmentHash,
                           const map<string, string>& cookiesData,
                           const vector<string>& mnemonic) {
    FragmentClient fragment(fragmentHash, cookiesData);
    TonTransaction ton(mnemonic);

    cout << "\n" << string(60, '=') << endl;
    cout << "🌟 ПОКУПКА TELEGRAM STARS" << endl;
    cout << string(60, '=') << endl;

    // Проверяем кошелек
    ton.GetBalance();

    // Шаг 1
    cout << "\n📍 Шаг 1: Поиск получателя " << username << "..." << endl;
    string recipient = fragment.FetchRecipient(username);
    if (recipient.empty()) {
        cout << "❌ Получатель не найден" << endl;
        return {false, ""};
    }
    cout << "✅ Получатель найден: " << recipient << endl;

    // Шаг 2
    cout << "\n📝 Шаг 2: Создание запроса на " << starsCount << " звезд..." << endl;
    string reqId = fragment.FetchReqId(recipient, starsCount);
    if (reqId.empty()) {
        cout << "❌ Не удалось создать запрос" << endl;
        return {false, ""};
    }
    cout << "✅ Request ID: " << reqId << endl;

    // Шаг 3
    cout << "\n🔍 Шаг 3: Получение данных транзакции..." << endl;
    auto [address, amount, payload] = fragment.FetchBuyLink(recipient, reqId, starsCount);
    if (address.empty() || amount.empty() || payload.empty()) {
        cout << "❌ Не удалось получить данные транзакции" << endl;
        return {false, ""};
    }

    double amountTon = stod(amount) / 1'000'000'000;
    cout << "✅ Сумма к оплате: " << fixed << setprecision(4) << amountTon << " TON" << endl;
    cout << "✅ Адрес Fragment: " << address << endl;

    // Шаг 4
    cout << "\n💳 Шаг 4: Отправка транзакции в блокчейн..." << endl;
    try {
        string txHash = ton.SendTransaction(address, amountTon, payload, starsCount);
        
        if (!txHash.empty()) {
            cout << "\n" << string(60, '=') << endl;
            cout << "🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!" << endl;
            cout << string(60, '=') << endl;
            return {true, txHash};
        }
    } catch (const exception& e) {
        cout << "\n❌ Ошибка при отправке: " << e.what() << endl;
        return {false, ""};
    }

    return {false, ""};
}

int main() {
    try {
        string username = "@example";  // ЗАМЕНИТЕ на реальный username
        int starsCount = 100;

        auto [success, txHash] = BuyStars(
            username,
            starsCount,
            Config::FRAGMENT_HASH,
            Config::DATA,
            Config::MNEMONIC
        );

        if (success) {
            cout << "\n🔗 Просмотр транзакции:" << endl;
            cout << "   https://tonviewer.com/transaction/" << txHash << endl;
            cout << "   https://tonscan.org/tx/" << txHash << endl;
        } else {
            cout << "\n❌ Покупка не удалась. Проверьте конфигурацию." << endl;
        }
    } catch (const exception& e) {
        cerr << "\n💥 Критическая ошибка: " << e.what() << endl;
        return 1;
    }

    return 0;
}
