require('dotenv').config();
const Moralis = require('moralis/node');

const init = require('./init');
const util = require('./util');

async function main() {
    await init();

    let inputWallets = await util.getWallets();
    let cleanTransactionArr = await util.queryMoralis(inputWallets);
    let processedTransactions = await util.processTransactions(cleanTransactionArr);

    console.log(cleanTransactionArr);
}

main().catch((e) => {
    console.error(e);
    process.exit(-1);
});
