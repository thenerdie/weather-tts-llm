require('dotenv').config()

const cron = require("node-cron")
const axios = require("axios")
const { format } = require("date-fns")

const tts = require("./tts")
const gpt = require("./gpt")

const SYSTEM_MESSAGE = "You are a weather reporting service. You will take in weather conditions represented in JSON format and generate a summary of them just like a NOAA Weather Radio Report, but do not refer to the report as a NOAA Weather Report. Just call it a weather report. " +
    "Format times (7:33 AM) as 7 33 AM. For decimal numbers, like 34.5, reformat them like this: 34 point 5."

function formatTimestamp(timestamp, expression) {
    return format(new Date(timestamp * 1000), expression)
}

async function getWeatherData() {
    const { data } = await axios.get("https://swd.weatherflow.com/swd/rest/better_forecast", {
        params: {
            station_id: process.env.TEMPEST_STATION_ID,
            token: process.env.TEMPEST_KEY,
            units_temp: "f"
        }
    })

    return data
}

async function generateForecast() {
    const weather = await getWeatherData()

    weather.forecast.daily.forEach(day => {
        day.sunrise = formatTimestamp(day.sunrise, "h:mm a")
        day.sunset = formatTimestamp(day.sunset, "h:mm a")
        day.day_start_local = formatTimestamp(day.day_start_local, "MM/dd/yyyy")

        delete day.day_num
        delete day.month_num
        delete day.icon
        delete day.precip_icon
    })

    weather.forecast.hourly.forEach(day => {
        day.time = formatTimestamp(day.time, "eeee, MMMM do, yyyy 'at' h:mm:ss a")

        delete day.precip_icon
        delete day.local_day
        delete day.local_hour
        delete day.icon
    })

    const current = await gpt.generateCompletion(SYSTEM_MESSAGE, "Following are current weather conditions. This text will be fed to a TTS AI, optimize it for that.", JSON.stringify(weather.current_conditions))
    console.log("Current conditions have been generated!")

    const daily = await gpt.generateCompletion(SYSTEM_MESSAGE, "Here is the daily forecast. Describe the forecast in paragraph format. Describe each day chronologically, from sunrise to sunset, and describe how the day might feel and what people might experience walking outside. This text will be fed to a TTS AI, optimize it for that.", JSON.stringify(weather.forecast.daily))
    console.log("Daily forecast has been generated!")

    const hourly = await gpt.generateCompletion(SYSTEM_MESSAGE, "Here is the hourly forecast for the next eight hours. Describe the forecast in paragraph format. Describe each hour in terms of what it would feel like and what people might experience walking outside. This text will be fed to a TTS AI, optimize it for that.", JSON.stringify(weather.forecast.hourly.slice(0,8)))
    console.log("Hourly forecast has been generated!")

    return { current, daily, hourly }
}

async function main() {
    const forecast = await generateForecast()

    console.log(forecast)

    await tts.synthesize(forecast.current, "current")
    await tts.synthesize(forecast.daily, "daily")
    await tts.synthesize(forecast.hourly, "hourly")
}

main()

cron.schedule("0 */1 * * *", () => {
    console.log("BWAH")
})