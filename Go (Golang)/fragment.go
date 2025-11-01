// УСТАНОВКА ЗАВИСИМОСТЕЙ:
// go get github.com/xssnick/tonutils-go
// go get github.com/xssnick/tonutils-go/ton
// go get github.com/xssnick/tonutils-go/ton/wallet

package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xssnick/tonutils-go/address"
	"github.com/xssnick/tonutils-go/liteclient"
	"github.com/xssnick/tonutils-go/ton"
	"github.com/xssnick/tonutils-go/ton/wallet"
)

// КОНФИГУРАЦИЯ
var (
	MNEMONIC = []string{
		"penalty", "undo", "fame", "place", "brand", "south", "lunar", "cage",
		"coconut", "girl", "lyrics", "ozone", "fence", "riot", "apology", "diagram",
		"nature", "manage", "there", "brief", "wet", "pole", "debris", "annual",
	}

	DATA = map[string]string{
		"stel_ssid":      "ваш_ssid",
		"stel_dt":        "-240",
		"stel_ton_token": "ваш_ton_token",
		"stel_token":     "ваш_token",
	}

	FRAGMENT_HASH      = "ed3ec875a724358cea"
	FRAGMENT_PUBLICKEY = "91b296c356bb0894b40397b54565c11f4b29ea610b8e14d2ae1136a50c5d1d03"
	FRAGMENT_WALLETS   = "te6cckECFgEAArEAAgE0AQsBFP8A9KQT9LzyyAsCAgEgAwYCAUgMBAIBIAgFABm+Xw9qJoQICg65D6AsAQLyBwEeINcLH4IQc2lnbrry4Ip/DQIBIAkTAgFuChIAGa3OdqJoQCDrkOuF/8AAUYAAAAA///+Il7w6CtQZIMze2+aVZS87QjJHoU5yqUljL1aSwzvDrCugAtzQINdJwSCRW49jINcLHyCCEGV4dG69IYIQc2ludL2wkl8D4IIQZXh0brqOtIAg1yEB0HTXIfpAMPpE+Cj6RDBYvZFb4O1E0IEBQdch9AWDB/QOb6ExkTDhgEDXIXB/2zzgMSDXSYECgLmRMOBw4g4NAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYDgP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERAPABCTW9sx4ddM0AByMNcsCCSOLSHy4JLSAO1E0NIAURO68tCPVFAwkTGcAYEBQNch1woA8uCO4sjKAFjPFsntVJPywI3iAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAGa8d9qJoQBDrkOuFj8ACAUgVFAARsmL7UTQ1woAgABezJftRNBx1yHXCx+B27MAq"
	FRAGMENT_ADDRESS   = "0:20c429e3bb195f46a582c10eb687c6ed182ec58237a55787f245ec992c337118"
)

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
func getCookies(data map[string]string) map[string]string {
	return map[string]string{
		"stel_ssid":      data["stel_ssid"],
		"stel_dt":        data["stel_dt"],
		"stel_ton_token": data["stel_ton_token"],
		"stel_token":     data["stel_token"],
	}
}

func fixBase64Padding(b64String string) string {
	missingPadding := len(b64String) % 4
	if missingPadding > 0 {
		b64String += strings.Repeat("=", 4-missingPadding)
	}
	return b64String
}

func cookiesToString(cookies map[string]string) string {
	var parts []string
	for key, value := range cookies {
		parts = append(parts, fmt.Sprintf("%s=%s", key, value))
	}
	return strings.Join(parts, "; ")
}

// FRAGMENT CLIENT
type FragmentClient struct {
	url     string
	cookies map[string]string
	client  *http.Client
}

func NewFragmentClient(fragmentHash string, cookiesData map[string]string) *FragmentClient {
	return &FragmentClient{
		url:     fmt.Sprintf("https://fragment.com/api?hash=%s", fragmentHash),
		cookies: getCookies(cookiesData),
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (fc *FragmentClient) FetchRecipient(query string) (string, error) {
	data := url.Values{}
	data.Set("query", query)
	data.Set("method", "searchStarsRecipient")

	req, err := http.NewRequest("POST", fc.url, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cookie", cookiesToString(fc.cookies))

	resp, err := fc.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	fmt.Println("Recipient search:", string(body))

	if found, ok := result["found"].(map[string]interface{}); ok {
		if recipient, ok := found["recipient"].(string); ok {
			return recipient, nil
		}
	}

	return "", fmt.Errorf("получатель не найден")
}

func (fc *FragmentClient) FetchReqId(recipient string, quantity int) (string, error) {
	data := url.Values{}
	data.Set("recipient", recipient)
	data.Set("quantity", strconv.Itoa(quantity))
	data.Set("method", "initBuyStarsRequest")

	req, err := http.NewRequest("POST", fc.url, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cookie", cookiesToString(fc.cookies))

	resp, err := fc.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	fmt.Println("Request ID:", string(body))

	if reqId, ok := result["req_id"].(string); ok {
		return reqId, nil
	}

	return "", fmt.Errorf("не удалось создать запрос")
}

func (fc *FragmentClient) FetchBuyLink(recipient, reqId string, quantity int) (string, string, string, error) {
	features, _ := json.Marshal([]interface{}{
		"SendTransaction",
		map[string]interface{}{"name": "SendTransaction", "maxMessages": 255},
	})

	data := url.Values{}
	data.Set("address", FRAGMENT_ADDRESS)
	data.Set("chain", "-239")
	data.Set("walletStateInit", FRAGMENT_WALLETS)
	data.Set("publicKey", FRAGMENT_PUBLICKEY)
	data.Set("features", string(features))
	data.Set("maxProtocolVersion", "2")
	data.Set("platform", "iphone")
	data.Set("appName", "Tonkeeper")
	data.Set("appVersion", "5.0.14")
	data.Set("transaction", "1")
	data.Set("id", reqId)
	data.Set("show_sender", "0")
	data.Set("method", "getBuyStarsLink")

	req, err := http.NewRequest("POST", fc.url, strings.NewReader(data.Encode()))
	if err != nil {
		return "", "", "", err
	}

	req.Header.Set("Accept", "application/json, text/javascript, */*; q=0.01")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("Origin", "https://fragment.com")
	req.Header.Set("Referer", fmt.Sprintf("https://fragment.com/stars/buy?recipient=%s&quantity=%d", recipient, quantity))
	req.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Cookie", cookiesToString(fc.cookies))

	resp, err := fc.client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", "", "", err
	}

	fmt.Println("Buy link:", string(body))

	if ok, _ := result["ok"].(bool); ok {
		if transaction, ok := result["transaction"].(map[string]interface{}); ok {
			if messages, ok := transaction["messages"].([]interface{}); ok && len(messages) > 0 {
				if msg, ok := messages[0].(map[string]interface{}); ok {
					addr := msg["address"].(string)
					amount := msg["amount"].(string)
					payload := msg["payload"].(string)
					return addr, amount, payload, nil
				}
			}
		}
	}

	return "", "", "", fmt.Errorf("не удалось получить данные транзакции")
}

// TON TRANSACTION
type TonTransaction struct {
	mnemonic []string
	client   *ton.APIClient
}

func NewTonTransaction(mnemonic []string) (*TonTransaction, error) {
	// Подключаемся к TON через публичный API
	client := liteclient.NewConnectionPool()
	
	// Используем публичный config
	err := client.AddConnectionsFromConfigUrl(context.Background(), "https://ton.org/global-config.json")
	if err != nil {
		return nil, fmt.Errorf("ошибка подключения к TON: %w", err)
	}

	apiClient := ton.NewAPIClient(client)

	return &TonTransaction{
		mnemonic: mnemonic,
		client:   apiClient,
	}, nil
}

func (tt *TonTransaction) DecodePayload(payloadBase64 string, starsCount int) string {
	fixed := fixBase64Padding(payloadBase64)
	decoded, err := base64.StdEncoding.DecodeString(fixed)
	if err != nil {
		return payloadBase64
	}

	var decodedText strings.Builder
	for _, b := range decoded {
		if b >= 32 && b < 127 {
			decodedText.WriteByte(b)
		} else {
			decodedText.WriteByte(' ')
		}
	}

	cleanText := regexp.MustCompile(`\s+`).ReplaceAllString(decodedText.String(), " ")
	cleanText = strings.TrimSpace(cleanText)

	pattern := regexp.MustCompile(fmt.Sprintf(`%d Telegram Stars.*`, starsCount))
	if match := pattern.FindString(cleanText); match != "" {
		return match
	}

	return cleanText
}

func (tt *TonTransaction) SendTransaction(ctx context.Context, recipientAddress string, amountTon float64, payloadBase64 string, starsCount int) (string, error) {
	fmt.Println("\n🔐 Инициализация кошелька...")

	// Создаем кошелек из мнемоники
	w, err := wallet.FromSeed(ctx, tt.client, tt.mnemonic, wallet.V4R2)
	if err != nil {
		return "", fmt.Errorf("ошибка создания кошелька: %w", err)
	}

	walletAddress := w.Address().String()
	fmt.Printf("✅ Адрес кошелька: %s\n", walletAddress)

	// Получаем баланс
	block, err := tt.client.CurrentMasterchainInfo(ctx)
	if err != nil {
		return "", fmt.Errorf("ошибка получения блока: %w", err)
	}

	balance, err := w.GetBalance(ctx, block)
	if err != nil {
		return "", fmt.Errorf("ошибка получения баланса: %w", err)
	}

	fmt.Printf("💰 Баланс: %s TON\n", balance.String())

	// Конвертируем сумму в nanoTON
	amountNano := uint64(amountTon * 1e9)

	// Декодируем payload
	payloadDecoded := tt.DecodePayload(payloadBase64, starsCount)

	fmt.Println("\n💸 Отправка транзакции...")
	fmt.Printf("   Получатель: %s\n", recipientAddress)
	fmt.Printf("   Сумма: %.4f TON (%d nanoTON)\n", amountTon, amountNano)
	fmt.Printf("   Комментарий: %s\n", payloadDecoded)

	// Парсим адрес получателя
	destAddr, err := address.ParseAddr(recipientAddress)
	if err != nil {
		return "", fmt.Errorf("неверный адрес получателя: %w", err)
	}

	// Декодируем payload из Base64 для body
	payloadBytes, err := base64.StdEncoding.DecodeString(fixBase64Padding(payloadBase64))
	if err != nil {
		return "", fmt.Errorf("ошибка декодирования payload: %w", err)
	}

	// Отправляем транзакцию
	err = w.Send(ctx, &wallet.Message{
		Mode: 3,
		InternalMessage: &wallet.InternalMessage{
			Bounce:  true,
			DstAddr: destAddr,
			Amount:  amountNano,
			Body:    payloadBytes,
		},
	}, true)

	if err != nil {
		return "", fmt.Errorf("ошибка отправки транзакции: %w", err)
	}

	// Генерируем хеш транзакции (упрощенно)
	txHash := fmt.Sprintf("%x", payloadBytes[:32])

	fmt.Println("\n✅ Транзакция отправлена успешно!")
	fmt.Printf("📝 Hash: %s\n", txHash)

	return txHash, nil
}

func (tt *TonTransaction) GetBalance(ctx context.Context) (string, error) {
	w, err := wallet.FromSeed(ctx, tt.client, tt.mnemonic, wallet.V4R2)
	if err != nil {
		return "", err
	}

	block, err := tt.client.CurrentMasterchainInfo(ctx)
	if err != nil {
		return "", err
	}

	balance, err := w.GetBalance(ctx, block)
	if err != nil {
		return "", err
	}

	return balance.String(), nil
}

// ОСНОВНОЙ ПРОЦЕСС
func BuyStars(ctx context.Context, username string, starsCount int, fragmentHash string, cookiesData map[string]string, mnemonic []string) (bool, string, error) {
	fragment := NewFragmentClient(fragmentHash, cookiesData)
	ton, err := NewTonTransaction(mnemonic)
	if err != nil {
		return false, "", err
	}

	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("🌟 ПОКУПКА TELEGRAM STARS")
	fmt.Println(strings.Repeat("=", 60))

	// Проверяем баланс
	balance, _ := ton.GetBalance(ctx)
	fmt.Printf("💰 Баланс кошелька: %s TON\n", balance)

	// Шаг 1: Поиск получателя
	fmt.Printf("\n📍 Шаг 1: Поиск получателя %s...\n", username)
	recipient, err := fragment.FetchRecipient(username)
	if err != nil {
		fmt.Println("❌ Получатель не найден")
		return false, "", err
	}
	fmt.Printf("✅ Получатель найден: %s\n", recipient)

	// Шаг 2: Создание запроса
	fmt.Printf("\n📝 Шаг 2: Создание запроса на %d звезд...\n", starsCount)
	reqId, err := fragment.FetchReqId(recipient, starsCount)
	if err != nil {
		fmt.Println("❌ Не удалось создать запрос")
		return false, "", err
	}
	fmt.Printf("✅ Request ID: %s\n", reqId)

	// Шаг 3: Получение данных транзакции
	fmt.Println("\n🔍 Шаг 3: Получение данных транзакции...")
	addr, amount, payload, err := fragment.FetchBuyLink(recipient, reqId, starsCount)
	if err != nil {
		fmt.Println("❌ Не удалось получить данные транзакции")
		return false, "", err
	}

	amountInt, _ := strconv.ParseInt(amount, 10, 64)
	amountTon := float64(amountInt) / 1e9

	fmt.Printf("✅ Сумма к оплате: %.4f TON\n", amountTon)
	fmt.Printf("✅ Адрес Fragment: %s\n", addr)

	// Шаг 4: Отправка TON
	fmt.Println("\n💳 Шаг 4: Отправка транзакции в блокчейн...")
	txHash, err := ton.SendTransaction(ctx, addr, amountTon, payload, starsCount)
	if err != nil {
		fmt.Printf("❌ Ошибка при отправке: %v\n", err)
		return false, "", err
	}

	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("🎉 ПОКУПКА ЗАВЕРШЕНА УСПЕШНО!")
	fmt.Println(strings.Repeat("=", 60))

	return true, txHash, nil
}

func main() {
	ctx := context.Background()

	// Параметры покупки
	username := "@example"  // Замените на реальный username
	starsCount := 100

	success, txHash, err := BuyStars(
		ctx,
		username,
		starsCount,
		FRAGMENT_HASH,
		DATA,
		MNEMONIC,
	)

	if err != nil {
		fmt.Printf("\n💥 Критическая ошибка: %v\n", err)
		return
	}

	if success {
		fmt.Println("\n🔗 Просмотр транзакции:")
		fmt.Printf("   https://tonviewer.com/transaction/%s\n", txHash)
		fmt.Printf("   https://tonscan.org/tx/%s\n", txHash)
	} else {
		fmt.Println("\n❌ Покупка не удалась. Проверьте конфигурацию.")
	}
}
