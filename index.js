require('dotenv').config()

const cron = require("node-cron")
const axios = require("axios")
const { format } = require("date-fns")

const tts = require("./tts")
const gpt = require("./gpt")

const units = {
    units_temp: "f",
    units_wind: 'mph',
    units_pressure: 'mb',
    units_precip: 'in',
    units_distance: 'mi'
}

const SYSTEM_MESSAGE = "You are a weather reporting service. You will take in weather conditions represented in JSON format and generate a summary of them just like a NOAA Weather Radio Report, but do not refer to the report as a NOAA Weather Report. Just call it a weather report. " +
    "Format times (7:33 AM) as 7 33 AM. For decimal numbers, like 34.5, reformat them like this: 34 point 5. " +
    `Always include units for values other than the temperature. The units used are as follows: ${JSON.stringify(units)}. Always convert compass directions (NNE) into fully-spelled-out English counterparts (north north east).`

function formatTimestamp(date, expression) {
    if (typeof(date) == "number")
        date = new Date(date * 1000)

    return format(date, expression)
}

async function getWeatherData() {
    const { data } = await axios.get("https://swd.weatherflow.com/swd/rest/better_forecast", {
        params: {
            station_id: process.env.TEMPEST_STATION_ID,
            token: process.env.TEMPEST_KEY,
            ...units
        }
    })

    return data
}

const typeFlags = {
    DAILY: 1,
    HOURLY: 2,
    CURRENT: 3
}

async function generateForecast(omit) {
    const weather = await getWeatherData()

    weather.forecast.daily.forEach(day => {
        day.sunrise = formatTimestamp(day.sunrise, "h:mm a")
        day.sunset = formatTimestamp(day.sunset, "h:mm a")
        day.day_start_local = formatTimestamp(day.day_start_local, "eeee, MM/dd/yyyy")

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

    let current
    let daily
    let hourly

    if (!omit.includes(typeFlags.CURRENT)) {
        current = await gpt.generateCompletion(SYSTEM_MESSAGE, "Following are current weather conditions. This text will be fed to a TTS AI, optimize it for that.", JSON.stringify(weather.current_conditions))
        console.log("Current conditions have been generated!")
    }

    if (!omit.includes(typeFlags.DAILY)) {
        daily = await gpt.generateCompletion(SYSTEM_MESSAGE, "Here is the daily forecast. Describe the forecast in paragraph format. Describe each day chronologically, from sunrise to sunset, and describe how the day might feel and what people might experience walking outside. This text will be fed to a TTS AI, optimize it for that.", JSON.stringify(weather.forecast.daily))
        console.log("Daily forecast has been generated!")
    }

    if (!omit.includes(typeFlags.HOURLY)) {
        hourly = await gpt.generateCompletion(SYSTEM_MESSAGE, "Here is the hourly forecast for the next eight hours. Describe the forecast in paragraph format. Describe each hour in terms of what it would feel like and what people might experience walking outside. This text will be fed to a TTS AI, optimize it for that.", JSON.stringify(weather.forecast.hourly.slice(0,8)))
        console.log("Hourly forecast has been generated!")
    }

    return { current, daily, hourly }
}

async function generateCurrent() {
    const forecast = await generateForecast([ typeFlags.DAILY, typeFlags.HOURLY ])

    console.log(forecast.current)

    await tts.synthesize(forecast.current, "current")
}

async function generateDailyAndHourly() {
    const forecast = await generateForecast([ typeFlags.CURRENT ])

    console.log(forecast.daily)
    console.log(forecast.hourly)

    await tts.synthesize(forecast.daily, "daily")
    await tts.synthesize(forecast.hourly, "hourly")
}

async function init() {
    await generateCurrent()
    await generateDailyAndHourly()
}

init()

cron.schedule("0 */1 * * *", () => {
    console.log("GENERATING FORECAST")

    generateDailyAndHourly()
})

cron.schedule("*/15 * * * *", () => {
    console.log("GENERATING CURRENT DATA")
    
    generateCurrent()
})

cron.schedule("*/1 * * * *", () => {
    console.log("GENERATING CURRENT TIME")

    const time = formatTimestamp(Date.now() / 1000, "h mm a 'on' eeee, MMMM do, yyyy")

    tts.synthesize(`The time is ${time}.`, "time")
})