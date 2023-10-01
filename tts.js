const gTTS = require('gtts');
const path = require('path');

function save(filepath, text) {
    return new Promise((resolve, reject) => {
        let gtts = new gTTS(text, 'en');
        gtts.save(filepath, function(err, result) {
            if(err) {
                reject(new Error(err));
            } else {
                resolve(result);
            }
        });
    });
}

module.exports.synthesize = async (text, filename, format="mp3") => {
    let filepath = path.join(__dirname, `${filename}.${format}`);
    await save(filepath, text);

    return filepath;
}
