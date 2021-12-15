const Moralis = require("moralis/node");

module.exports = async function init () {
    await Moralis.start({
        serverUrl: process.env.MORALIS_URL,
        appId: process.env.MORALIS_APPID,
        moralisSecret: process.env.MORALIS_SECRET
    });
}