require('dotenv').config();
const chalk = require('chalk');
const Moralis = require('moralis/node');

const init = require('./init');
const util = require('./util');
const excel = require('./excel');
const currentNFTs = require('./currentNFTs');

async function main() {
    await init();

    let inputWallets = await util.getWallets();

    console.log('\nQuerying transaction history...')
    let cleanTransactionArr = await util.queryMoralis(inputWallets);

    console.log(chalk.greenBright(`${cleanTransactionArr.length} total transactions to process...\n`));
    let processedTransactions = await util.processTransactions(cleanTransactionArr);

    util.objToJSONFile(processedTransactions, 'processed.json');

    // let processedTransactions = util.JSONFileToObj('processed.json');
    // for (let t of processedTransactions) {
    //     t.date = new Date(t.date);
    // }

    let currentNFTArr = await currentNFTs.queryCurrentNFTs(inputWallets);
    let filteredCurrentNFTs = currentNFTs.filterTransactionsByCurrentNFTs(processedTransactions, currentNFTArr);

    console.log(chalk.magentaBright('Generating excel workbook...'))
    await excel.createNFTWorkbook(processedTransactions, filteredCurrentNFTs);
}

main().catch((e) => {
    console.error(e);
    process.exit(-1);
});
