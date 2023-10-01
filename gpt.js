const OpenAI = require("openai")

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

module.exports.generateCompletion = async (systemMessage, ...prompts) => {
    let prompt = ""

    prompts.forEach(p => {
        prompt = prompt.concat(`\n${p}`)
    })

    const chatCompletion = await openai.chat.completions.create({
        messages: [ { role: "system", content: systemMessage }, { role: "user", content: prompt } ],
        model: "gpt-4",
    });

    return chatCompletion.choices[0].message.content
}