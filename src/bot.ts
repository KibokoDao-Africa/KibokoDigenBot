import dotenv from "dotenv";
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";
import axios, { AxiosError } from "axios";
import { differenceInCalendarDays, parseISO } from "date-fns";
import axiosRetry from 'axios-retry';
import { Calendar } from 'telegram-inline-calendar';

dotenv.config();

const token: string = process.env.TELEGRAM_BOT_TOKEN || "";
const apiUrl: string = process.env.MODEL_API_URL || "";
const webhookUrl: string = process.env.WEBHOOK_URL || "";
const bot: TelegramBot = new TelegramBot(token, { webHook: true });
const calendar = new Calendar(bot, {
    date_format: "YYYY/MM/DD",
    language: "en"
});

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

bot.setWebHook(`${webhookUrl}/bot${token}`).then(() => {
    console.log('Webhook set successfully to', `${webhookUrl}/bot${token}`);
}).catch((error) => {
    console.error('Error setting webhook: ', error);
});

const tokens: { [key: string]: number } = {
    WBTC: 0, WETH: 1, USDC: 2, USDT: 3, DAI: 4, LINK: 5,
    AAVE: 6, STETH: 7, WSTETH: 8, ETH: 9, FRAX: 10, RETH: 11,
    YFI: 12, MIM: 13, "3CRV": 14, ALCX: 15, MKR: 16, STMATIC: 17,
    WAVAX: 18, UNI: 19, COMP: 20, GNO: 21, COW: 22, ALUSD: 23,
    SAVAX: 24, WMATIC: 25, CVX: 26, WOO: 27, TUSD: 28, FRXETH: 29
};

let selectedToken: string = "";
let selectedDate: string = "";

function showTokenSelection(chatId: number): void {
    const keyboard = Object.keys(tokens).map(token => [{ text: token, callback_data: token }]);
    bot.sendMessage(chatId, "Select a token:", {
        reply_markup: { inline_keyboard: keyboard },
    });
}

async function processPriceRequest(chatId: number, tokenName: string, dateString: string): Promise<void> {
  try {
      const tokenIndex = tokens[tokenName];
      if (tokenIndex === undefined) {
          await bot.sendMessage(chatId, "Error: Invalid token name provided.");
          return;
      }

      const latestDate = parseISO("2024/01/23");
      const requestedDate = parseISO(dateString);
      const daysDifference = differenceInCalendarDays(requestedDate, latestDate);
      if (daysDifference < 0) {
          await bot.sendMessage(chatId, "Error: Date must be after January 23, 2024.");
          return;
      }

      const intervals = parseFloat((Math.max(0, daysDifference) / 4).toFixed(2));

      // Adjusting the data format to match the expected API input
      const data = {
          "signature_name": process.env.SIGNATURE_NAME || "serving_default",
          // Using the correct array structure as demonstrated by your successful cURL request
          "instances": [intervals, tokenIndex]
      };

      console.log("Sending data to model:", JSON.stringify(data));

      const response = await axios.post(apiUrl, data, {
          headers: {
              'Content-Type': 'application/json'
          }
      });
      
      const predictions = response.data.predictions;
      const predictedPrice = predictions[predictions.length - 1];

      await bot.sendMessage(chatId, `Predicted closing price for ${tokenName} on ${dateString}: ${predictedPrice}`);
  } catch (error) {
      console.error(error);
      let errorMessage = "Sorry, there was an error processing your request.";
      if (axios.isAxiosError(error) && error.response) {
          // Ensuring the error message is readable and not an object
          errorMessage += ` Details: ${JSON.stringify(error.response.data, null, 2)}`;
      } else {
          errorMessage += ` Some unknown error occurred.`;
      }

      await bot.sendMessage(chatId, errorMessage);
  }
}

bot.on("message", (msg: Message) => {
    const command = msg.text;
    if (command === '/command1') {
        showTokenSelection(msg.chat.id);
    }
});

bot.on("callback_query", async (query: CallbackQuery) => {
    const chatId: number = query.message?.chat.id || 0;
    const data: string = query.data || "";

    if (!selectedToken) {
        selectedToken = data;
        calendar.startNavCalendar(query.message);
    } else if (selectedToken && !selectedDate) {
        selectedDate = data;
        await processPriceRequest(chatId, selectedToken, selectedDate);
        selectedToken = "";  // Reset selected token after processing request
        selectedDate = "";   // Reset selected date after processing request
    }
});

export { bot };
