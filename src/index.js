require('dotenv').config();
const Moralis = require('moralis/node');
const currency = require('currency.js');

const init = require('./init');
const util = require('./util');

async function main() {
    await init();

    let inputWallets = await util.getWallets();
    let cleanTransactionArr = await util.queryMoralis(inputWallets);
    let processedTransactions = await util.processTransactions(cleanTransactionArr);

    console.log(processedTransactions);
}

main().catch((e) => {
    console.error(e);
    process.exit(-1);
});
