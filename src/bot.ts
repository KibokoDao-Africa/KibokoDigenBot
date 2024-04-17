// bot.ts

import dotenv from "dotenv";
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";
import { Calendar } from "telegram-inline-calendar";
import axios, { AxiosError } from "axios";
import { differenceInCalendarDays, parseISO } from "date-fns";

dotenv.config();

const token: string = process.env.TELEGRAM_BOT_TOKEN || "";
const apiUrl: string = process.env.MODEL_API_URL || "";
const bot: TelegramBot = new TelegramBot(token);
const calendar = new Calendar(bot, {
    date_format: "YYYY/MM/DD",
    language: "en"
});

type TokenMap = { [key: string]: number };
const tokens: TokenMap = {
    WBTC: 0, WETH: 1, USDC: 2, USDT: 3, DAI: 4, LINK: 5,
    AAVE: 6, STETH: 7, WSTETH: 8, ETH: 9, FRAX: 10, RETH: 11,
    YFI: 12, MIM: 13, "3CRV": 14, ALCX: 15, MKR: 16, STMATIC: 17,
    WAVAX: 18, UNI: 19, COMP: 20, GNO: 21, COW: 22, ALUSD: 23,
    SAVAX: 24, WMATIC: 25, CVX: 26, WOO: 27, TUSD: 28, FRXETH: 29
};

let selectedToken: string = "";

function showTokenSelection(chatId: number): void {
    const keyboard = Object.keys(tokens).map(token => [{ text: token, callback_data: token }]);
    bot.sendMessage(chatId, "Select a token:", {
        reply_markup: { inline_keyboard: keyboard },
    });
}

async function processPriceRequest(chatId: number, tokenName: string, dateString: string): Promise<void> {
    try {
        const tokenIndex = tokens[tokenName];
        const latestDate = parseISO("2024/01/23");
        const requestedDate = parseISO(dateString);
        const daysDifference = differenceInCalendarDays(requestedDate, latestDate);
        if (daysDifference < 0) {
            await bot.sendMessage(chatId, "Error: Date must be after January 23, 2024.");
            return;
        }

        const intervals = Math.floor(daysDifference / 4);

        const data = {
            "signature_name": process.env.SIGNATURE_NAME || "serving_default",
            "instances": [intervals, tokenIndex]
        };

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
        if (axios.isAxiosError(error)) {
            const serverResponse = (error as AxiosError).response?.data || "No response body.";
            errorMessage += ` Details: ${serverResponse}`;
        }

        await bot.sendMessage(chatId, errorMessage);
    }
}

// Emulate the functionality of bot.onText(/\/command1/, (msg) => { showTokenSelection(msg.chat.id); });
bot.on("message", async (msg: Message) => {
    const chatId: number = msg.chat.id;
    const text: string = msg.text || "";
    if (text === '/command1') {
        showTokenSelection(chatId);
    }
});

bot.on("callback_query", async (query: CallbackQuery) => {
    const chatId: number = query.message?.chat.id || 0;
    const data: string = query.data || "";
    
    if (!selectedToken) {
        selectedToken = data;
        calendar.startNavCalendar(query.message);
    } else {
        const dateString: string = data;
        await processPriceRequest(chatId, selectedToken, dateString);
        selectedToken = ""; // Reset selected token after processing request
    }
});

export { bot };
