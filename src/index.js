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
    console.log();

    let cleanTransactionArr = await util.queryMoralis(inputWallets);
    console.log(chalk.greenBright(`${cleanTransactionArr.length} total transactions to process...\n`));
    let processedTransactions = await util.processTransactions(cleanTransactionArr);

    let allNFTs = await currentNFTs.queryCurrentNFTs(inputWallets);
    let filtered = currentNFTs.filterTransactionsByCurrentNFTs(processedTransactions, allNFTs);
    console.log(filtered);


    // let cleanTransactionArr = await util.queryMoralis(inputWallets);
    // console.log(chalk.greenBright(`${cleanTransactionArr.length} total transactions to process...\n`));
    // let processedTransactions = await util.processTransactions(cleanTransactionArr);
    // util.objToJSONFile(processedTransactions, 'processed.json');

    /*
    let processedTransactions = util.JSONFileToObj('processed.json');
    for (let t of processedTransactions) {
        t.date = new Date(t.date);
    }
    */

    // console.log(processedTransactions);
    // console.log(chalk.magentaBright('Generating excel workbook...'))
    await excel.createNFTWorksheet(processedTransactions);
}

main().catch((e) => {
    console.error(e);
    process.exit(-1);
});
