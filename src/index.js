require('dotenv').config();

const init = require('./init');
const util = require('./util');
const excel = require('./excel');

async function main() {
    await init();

    let inputWallets = await util.getWallets();
    let cleanTransactionArr = await util.queryMoralis(inputWallets);
    let processedTransactions = await util.processTransactions(cleanTransactionArr);

    console.log(processedTransactions);
    await excel.createNFTWorksheet(processedTransactions);
}

main().catch((e) => {
    console.error(e);
    process.exit(-1);
});
